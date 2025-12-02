from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_migrate import Migrate
from celery import Celery
from flask_caching import Cache
from flask_wtf.csrf import CSRFProtect

db = SQLAlchemy()
migrate = Migrate()
login_manager = LoginManager()
login_manager.login_view = 'auth.login'
login_manager.login_message_category = 'info'

# [수정] 변수명을 celery_app으로 지정 (FLOWORK_B 표준)
celery_app = Celery(__name__, broker='redis://redis:6379/0')
cache = Cache()
csrf = CSRFProtect()