import os
import time
from dotenv import load_dotenv

load_dotenv()

class Config:
    os.environ['TZ'] = os.getenv('TZ', 'Asia/Seoul')
    try:
        time.tzset()
    except AttributeError:
        pass

    SECRET_KEY = os.getenv('SECRET_KEY')
    if not SECRET_KEY:
        raise ValueError("SECRET_KEY가 .env 파일에 설정되어야 합니다.")
    
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    FLOWORK_DIR = os.path.join(BASE_DIR, 'flowork')
    
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL')
    if not SQLALCHEMY_DATABASE_URI:
        user = os.getenv('POSTGRES_USER', 'postgres')
        pw = os.getenv('POSTGRES_PASSWORD', 'password')
        host = os.getenv('POSTGRES_HOST', 'db')
        port = os.getenv('POSTGRES_PORT', '5432')
        db_name = os.getenv('POSTGRES_DB', 'flowork')
        SQLALCHEMY_DATABASE_URI = f"postgresql://{user}:{pw}@{host}:{port}/{db_name}"

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = '/tmp'
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024

    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': 30,
        'max_overflow': 60,
        'pool_timeout': 30,
        'pool_recycle': 1800,
        'pool_pre_ping': True,
        'connect_args': {
            'connect_timeout': 10
        }
    }

    CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'redis://redis:6379/0')
    CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', 'redis://redis:6379/0')
    CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
    CELERY_WORKER_MAX_TASKS_PER_CHILD = 50

    # [수정] 캐시 설정: Redis가 연결되어 있으면 Redis 사용, 아니면 SimpleCache 사용
    # 로그의 "CACHE_TYPE is set to null" 경고 해결용
    CACHE_TYPE = 'RedisCache'
    CACHE_REDIS_URL = CELERY_BROKER_URL
    CACHE_DEFAULT_TIMEOUT = 300