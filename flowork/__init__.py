import os
import logging
from logging.handlers import RotatingFileHandler
from flask import Flask
from flask_wtf.csrf import CSRFProtect
from .config import Config
# [수정] celery -> celery_app 으로 임포트 수정
from .extensions import db, login_manager, celery_app, migrate, cache, csrf
from .blueprints.auth import auth_bp
from .blueprints.ui import ui_bp
from .blueprints.api import api_bp
from .commands import init_db_command, create_super_admin

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    cache.init_app(app)
    csrf.init_app(app)

    # [수정] celery_app 설정 업데이트
    celery_app.conf.update(app.config)
    
    # [중요] Celery 태스크에서 DB 접근을 위해 앱 참조 저장
    celery_app.flask_app = app

    app.register_blueprint(auth_bp)
    app.register_blueprint(ui_bp)
    app.register_blueprint(api_bp)

    app.cli.add_command(init_db_command)
    app.cli.add_command(create_super_admin)

    from .models import (
        User, Store, Brand, Product, Variant, StoreStock, Sale, SaleItem, 
        StockTransfer, StoreOrder, Setting, StockHistory, Order, ProcessingStep, 
        Staff, StoreReturn
    )

    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(User, int(user_id))
        
    if not app.debug and not app.testing:
        if not os.path.exists('logs'):
            os.mkdir('logs')
        file_handler = RotatingFileHandler('logs/flowork.log', maxBytes=102400, backupCount=10)
        file_handler.setFormatter(logging.Formatter('%(asctime)s %(levelname)s: %(message)s'))
        file_handler.setLevel(logging.INFO)
        app.logger.addHandler(file_handler)

    return app