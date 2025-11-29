from flask import jsonify
from flowork.extensions import celery_app
from . import api_bp

@api_bp.route('/api/task_status/<task_id>', methods=['GET'])
def get_task_status(task_id):
    task = celery_app.AsyncResult(task_id)
    
    if task.state == 'PENDING':
        response = {
            'status': 'processing',
            'current': 0,
            'total': 0,
            'percent': 0
        }
    elif task.state == 'PROGRESS':
        response = {
            'status': 'processing',
            'current': task.info.get('current', 0),
            'total': task.info.get('total', 0),
            'percent': task.info.get('percent', 0)
        }
    elif task.state == 'SUCCESS':
        result = task.result
        if isinstance(result, dict):
            response = result
        else:
             response = {
                'status': 'completed',
                'result': result
            }
    elif task.state == 'FAILURE':
        response = {
            'status': 'error',
            'message': str(task.info)
        }
    else:
        response = {
            'status': 'error',
            'message': f'Task status: {task.state}'
        }
        
    return jsonify(response)