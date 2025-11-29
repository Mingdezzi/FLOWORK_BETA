from flask import Flask
from .config import Config
from .extensions import db, migrate, login_manager, celery_app, cache
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

    celery_app.conf.update(app.config)

    app.register_blueprint(auth_bp)
    app.register_blueprint(ui_bp)
    app.register_blueprint(api_bp)

    app.cli.add_command(init_db_command)
    app.cli.add_command(create_super_admin)

    # [중요] 모든 모델 명시적 import (누락 시 DB 테이블 생성 안됨)
    from .models import User, Store, Brand, Product, Variant, StoreStock, Sale, SaleItem, StockTransfer, StoreOrder, Setting, StockHistory, Order, ProcessingStep, Staff, StoreReturn

    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(User, int(user_id))

    return app