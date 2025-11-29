from flowork import create_app
from flowork.extensions import celery_app

app = create_app()
celery = celery_app