from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
import os
import uuid
from models import db, Location, Image

bp = Blueprint('images', __name__, url_prefix='/api/images')


def allowed_file(filename):
    """检查文件是否允许"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in current_app.config['ALLOWED_EXTENSIONS']


@bp.route('/upload/<location_id>', methods=['POST'])
@jwt_required()
def upload_image(location_id):
    """上传图片"""
    user_id = get_jwt_identity()
    location = Location.query.filter_by(id=location_id, user_id=user_id).first()

    if not location:
        return jsonify({'error': 'Location not found'}), 404

    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'error': 'Empty filename'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': f'File type not allowed'}), 400

    # 生成安全的文件名
    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)

    try:
        file.save(filepath)
        file_size = os.path.getsize(filepath)

        image = Image(
            location_id=location_id,
            filename=filename,
            original_filename=secure_filename(file.filename),
            file_path=filepath,
            file_size=file_size,
            mime_type=file.content_type
        )

        db.session.add(image)
        db.session.commit()

        return jsonify({
            'message': 'Image uploaded successfully',
            'image': image.to_dict()
        }), 201

    except Exception as e:
        return jsonify({'error': f'Upload failed: {str(e)}'}), 500


@bp.route('/<location_id>', methods=['GET'])
@jwt_required()
def get_images(location_id):
    """获取地点的所有图片"""
    user_id = get_jwt_identity()
    location = Location.query.filter_by(id=location_id, user_id=user_id).first()

    if not location:
        return jsonify({'error': 'Location not found'}), 404

    images = Image.query.filter_by(location_id=location_id).all()

    return jsonify({
        'total': len(images),
        'images': [img.to_dict() for img in images]
    }), 200


@bp.route('/<image_id>', methods=['DELETE'])
@jwt_required()
def delete_image(image_id):
    """删除图片"""
    user_id = get_jwt_identity()
    image = Image.query.join(Location).filter(
        Image.id == image_id,
        Location.user_id == user_id
    ).first()

    if not image:
        return jsonify({'error': 'Image not found'}), 404

    try:
        if os.path.exists(image.file_path):
            os.remove(image.file_path)

        db.session.delete(image)
        db.session.commit()

        return jsonify({'message': 'Image deleted successfully'}), 200

    except Exception as e:
        return jsonify({'error': f'Delete failed: {str(e)}'}), 500