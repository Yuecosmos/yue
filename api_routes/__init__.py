"""API Routes Package"""
from . import auth
from . import locations
from . import images
from . import sharing

auth_bp = auth.bp
locations_bp = locations.bp
images_bp = images.bp
sharing_bp = sharing.bp

__all__ = ['auth_bp', 'locations_bp', 'images_bp', 'sharing_bp']