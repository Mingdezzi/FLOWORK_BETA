from flowork import create_app
# [수정] celery_app import
from flowork.extensions import celery_app

app = create_app()
# [중요] 외부에서 'celery'라는 이름으로 찾으므로 할당 필요
celery = celery_app