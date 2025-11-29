import click
from flask.cli import with_appcontext
from .extensions import db
# 모든 모델을 임포트하여 SQLAlchemy가 테이블을 인식하도록 함
from .models import User, Brand, Store, Product, Variant, StoreStock, Sale, SaleItem, StockTransfer, StoreOrder, Setting, StockHistory

@click.command('init-db')
@with_appcontext
def init_db_command():
    """기존 데이터를 삭제하고 새로운 테이블을 생성합니다."""
    try:
        # 안전을 위해 기존 테이블 삭제 후 재생성
        db.drop_all()
        db.create_all()
        click.echo('Initialized the database.')
    except Exception as e:
        click.echo(f'Error initializing database: {e}')

@click.command('create-super-admin')
@with_appcontext
def create_super_admin():
    """슈퍼 관리자 계정을 생성합니다."""
    username = 'superadmin'
    password = 'password' # 배포 시 변경 권장
    
    if User.query.filter_by(username=username).first():
        click.echo('Super admin already exists.')
        return

    user = User(username=username, role='super_admin', is_active=True)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    click.echo(f'Created super admin: {username}')