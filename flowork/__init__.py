from flask import Flask
from .config import Config
from .extensions import db, migrate, login_manager, celery_app
from .blueprints.auth import auth_bp
from .blueprints.ui import ui_bp
from .blueprints.api import api_bp
from .commands import init_db_command, create_super_admin

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Extensions 초기화
    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)

    # Celery 설정 업데이트
    celery_app.conf.update(app.config)

    # Blueprints 등록
    app.register_blueprint(auth_bp)
    app.register_blueprint(ui_bp)
    app.register_blueprint(api_bp)

    # CLI 명령어 등록
    app.cli.add_command(init_db_command)
    app.cli.add_command(create_super_admin)

    # 모델 import
    from .models import User, Store, Brand, Product, Variant, StoreStock, Sale, SaleItem, StockTransfer, StoreOrder, Setting, StockHistory

    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(User, int(user_id))

    return app