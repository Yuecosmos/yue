from flask import Blueprint, jsonify

bp = Blueprint('sharing', __name__, url_prefix='/api/sharing')

@bp.route('', methods=['GET'])
def get_sharing_links():
    """获取所有分享链接"""
    return jsonify({'shares': []})