from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_migrate import Migrate
from celery import Celery

db = SQLAlchemy()
migrate = Migrate()
login_manager = LoginManager()
login_manager.login_view = 'auth.login'
login_manager.login_message_category = 'info'

# Celery 초기화 (이름은 임의로 설정, 나중에 create_app에서 업데이트)
celery_app = Celery(__name__, broker='redis://redis:6379/0')