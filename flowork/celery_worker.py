from flowork import create_app
# [수정] celery 대신 celery_app 임포트
from flowork.extensions import celery_app

app = create_app()
# [중요] docker-compose 명령어가 'celery'라는 이름을 찾으므로 별칭 할당
celery = celery_app