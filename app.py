from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import config
from models import db
from api_routes import auth_bp, locations_bp, images_bp, sharing_bp
import os
import sqlite3


def create_app(config_name='development'):
    """应用工厂函数"""
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # 初始化扩展
    db.init_app(app)
    CORS(app)
    JWTManager(app)

    # 注册蓝图
    app.register_blueprint(auth_bp)
    app.register_blueprint(locations_bp)
    app.register_blueprint(images_bp)
    app.register_blueprint(sharing_bp)

    # =========================
    # 首页（防止 404）
    # =========================
    @app.route('/')
    def serve_index():
        return send_from_directory('static', 'index.html', mimetype='text/html; charset=utf-8')

    # =========================
    # 健康检查接口
    # =========================
    @app.route('/api/health', methods=['GET'])
    def health():
        return jsonify({'status': 'ok', 'message': 'API is running'})

    # =========================
    # 图片访问接口（重要）
    # =========================
    @app.route('/uploads/<filename>')
    def uploaded_file(filename):
        return send_from_directory(
            app.config['UPLOAD_FOLDER'],
            filename
        )

    # =========================
    # 全局错误处理
    # =========================
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({"error": "Resource not found"}), 404

    @app.errorhandler(500)
    def server_error(error):
        return jsonify({"error": "Internal server error"}), 500

    # 创建数据库和上传目录
    with app.app_context():
        db.create_all()
        upload_folder = app.config['UPLOAD_FOLDER']
        if not os.path.exists(upload_folder):
            os.makedirs(upload_folder, exist_ok=True)

        # 轻量迁移：给 locations 表补 visit_date 字段（避免老库缺列导致保存失败）
        try:
            uri = app.config.get('SQLALCHEMY_DATABASE_URI', '')
            if uri.startswith('sqlite:///'):
                db_path = uri.replace('sqlite:///', '', 1)
                # 相对路径相对于 instance/ 或当前工作目录，这里优先尝试 instance 下
                candidate_paths = [
                    os.path.join(app.instance_path, db_path),
                    os.path.join(os.getcwd(), db_path),
                    os.path.join(os.getcwd(), 'instance', db_path),
                ]
                real_path = next((p for p in candidate_paths if os.path.exists(p)), None)
                if real_path:
                    conn = sqlite3.connect(real_path)
                    cur = conn.cursor()
                    cur.execute("PRAGMA table_info(locations);")
                    cols = [row[1] for row in cur.fetchall()]
                    if 'visit_date' not in cols:
                        cur.execute("ALTER TABLE locations ADD COLUMN visit_date VARCHAR(20);")
                        conn.commit()
                    conn.close()
        except Exception as e:
            # 迁移失败不阻断启动，避免影响开发
            print("DB migration (visit_date) skipped/failed:", e)

    return app


# 让 flask run 识别
app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)