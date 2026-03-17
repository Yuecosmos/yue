from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import db, Location, Image

bp = Blueprint('locations', __name__, url_prefix='/api/locations')


def location_to_dict(location, include_images=False):
    data = {
        'id': location.id,
        'name': location.name,
        'description': location.description,
        'latitude': location.latitude,
        'longitude': location.longitude,
        'visit_date': getattr(location, 'visit_date', None),
        'created_at': location.created_at.isoformat() if location.created_at else None,
    }
    if include_images:
        data['images'] = [
            {
                'id': img.id,
                'filename': img.filename,
                'original_filename': img.original_filename,
                'file_size': img.file_size,
                'mime_type': img.mime_type,
                'created_at': img.created_at.isoformat() if img.created_at else None,
            }
            for img in location.images
        ]
    return data


@bp.route('', methods=['GET'])
@jwt_required()
def get_locations():
    """获取当前用户的所有地点（简要信息）"""
    user_id = get_jwt_identity()
    locations = Location.query.filter_by(user_id=user_id).order_by(Location.created_at.desc()).all()
    return jsonify({'locations': [location_to_dict(loc) for loc in locations]}), 200


@bp.route('', methods=['POST'])
@jwt_required()
def create_location():
    """创建新地点"""
    user_id = get_jwt_identity()
    data = request.get_json() or {}

    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': '地点名称不能为空'}), 400

    latitude = data.get('latitude')
    longitude = data.get('longitude')

    if latitude is None or longitude is None:
        return jsonify({'error': '必须提供经纬度'}), 400

    location = Location(
        user_id=user_id,
        name=name,
        description=data.get('description') or '',
        latitude=float(latitude),
        longitude=float(longitude),
        visit_date=(data.get('visit_date') or '').strip() or None,
    )

    db.session.add(location)
    db.session.commit()

    return jsonify({'message': '地点创建成功', 'location': location_to_dict(location)}), 201


@bp.route('/<location_id>', methods=['GET'])
@jwt_required()
def get_location(location_id):
    """获取当前用户单个地点详情（含图片）"""
    user_id = get_jwt_identity()
    location = Location.query.filter_by(id=location_id, user_id=user_id).first()
    if not location:
        return jsonify({'error': 'Location not found'}), 404

    return jsonify({'location': location_to_dict(location, include_images=True)}), 200


@bp.route('/<location_id>', methods=['PUT'])
@jwt_required()
def update_location(location_id):
    """更新地点信息"""
    user_id = get_jwt_identity()
    location = Location.query.filter_by(id=location_id, user_id=user_id).first()
    if not location:
        return jsonify({'error': 'Location not found'}), 404

    data = request.get_json() or {}

    if 'name' in data:
        name = (data.get('name') or '').strip()
        if not name:
            return jsonify({'error': '地点名称不能为空'}), 400
        location.name = name

    if 'description' in data:
        location.description = data.get('description') or ''

    if 'visit_date' in data:
        location.visit_date = (data.get('visit_date') or '').strip() or None

    if 'latitude' in data and data.get('latitude') is not None:
        location.latitude = float(data.get('latitude'))

    if 'longitude' in data and data.get('longitude') is not None:
        location.longitude = float(data.get('longitude'))

    db.session.commit()

    return jsonify({'message': '地点更新成功', 'location': location_to_dict(location)}), 200


@bp.route('/<location_id>', methods=['DELETE'])
@jwt_required()
def delete_location(location_id):
    """删除地点（及其图片）"""
    user_id = get_jwt_identity()
    location = Location.query.filter_by(id=location_id, user_id=user_id).first()
    if not location:
        return jsonify({'error': 'Location not found'}), 404

    # 级联删除图片（如果模型/数据库未设置级联，这里手动删一下）
    Image.query.filter_by(location_id=location.id).delete()
    db.session.delete(location)
    db.session.commit()

    return jsonify({'message': '地点已删除'}), 200