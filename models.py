from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import uuid

db = SQLAlchemy()


# ========================
# 用户表
# ========================
class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(200), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # 一个用户有多个地点
    locations = db.relationship('Location', backref='user', lazy=True)


# ========================
# 地点表
# ========================
class Location(db.Model):
    __tablename__ = 'locations'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)

    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    # 访问日期（前端 date input 直接存 YYYY-MM-DD 字符串，便于简单持久化）
    visit_date = db.Column(db.String(20))

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # 一个地点有多个图片
    images = db.relationship('Image', backref='location', lazy=True)


# ========================
# 图片表
# ========================
class Image(db.Model):
    __tablename__ = 'images'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    location_id = db.Column(db.String(36), db.ForeignKey('locations.id'), nullable=False)

    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255))
    file_path = db.Column(db.String(500))
    file_size = db.Column(db.Integer)
    mime_type = db.Column(db.String(100))

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'location_id': self.location_id,
            'filename': self.filename,
            'original_filename': self.original_filename,
            'file_size': self.file_size,
            'mime_type': self.mime_type,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }