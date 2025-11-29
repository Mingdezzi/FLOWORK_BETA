import os

class Config:
    # 보안 키
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev_key')

    # 데이터베이스 설정
    POSTGRES_USER = os.environ.get('POSTGRES_USER', 'postgres')
    POSTGRES_PASSWORD = os.environ.get('POSTGRES_PASSWORD', 'password')
    POSTGRES_DB = os.environ.get('POSTGRES_DB', 'flowork')
    POSTGRES_HOST = 'db'
    POSTGRES_PORT = '5432'

    SQLALCHEMY_DATABASE_URI = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Celery (비동기 작업) 설정
    CELERY_BROKER_URL = 'redis://redis:6379/0'
    CELERY_RESULT_BACKEND = 'redis://redis:6379/0'
    
    # 파일 업로드 경로 (이미지 등)
    UPLOAD_FOLDER = '/app/flowork/static/product_images'