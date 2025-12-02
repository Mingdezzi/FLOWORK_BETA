import traceback
import os
import gc
# [수정] celery_app 임포트
from flowork.extensions import celery_app, db
from flowork.services.excel import parse_stock_excel
from flowork.services.inventory_service import InventoryService

# [수정] celery_app 사용 및 AppContext 주입

@celery_app.task(bind=True)
def task_upsert_inventory(self, file_path, form_data, upload_mode, brand_id, target_store_id, excluded_indices, allow_create):
    """재고 업로드 태스크"""
    # [중요] 앱 컨텍스트 활성화
    with self.app.flask_app.app_context():
        try:
            # 1. 엑셀 파싱
            records, error_msg = parse_stock_excel(
                file_path, form_data, upload_mode, brand_id, excluded_indices
            )
            
            if error_msg or not records:
                return {'status': 'error', 'message': error_msg or "데이터 파싱 실패"}

            # 2. 진행률 콜백 정의
            def progress_callback(current, total):
                if total > 0:
                    self.update_state(state='PROGRESS', meta={
                        'current': current, 
                        'total': total, 
                        'percent': int((current / total) * 100)
                    })

            # 3. DB 업데이트 서비스 호출
            cnt_update, cnt_var, message = InventoryService.process_stock_data(
                records, upload_mode, brand_id, target_store_id, allow_create, progress_callback
            )
            
            return {'status': 'completed', 'result': {'message': message}}
            
        except Exception as e:
            traceback.print_exc()
            return {'status': 'error', 'message': str(e)}
        finally:
            if os.path.exists(file_path):
                try: os.remove(file_path)
                except: pass
            gc.collect()

@celery_app.task(bind=True)
def task_import_db(self, file_path, form_data, brand_id):
    """상품 DB 전체 초기화 태스크"""
    with self.app.flask_app.app_context():
        try:
            records, error_msg = parse_stock_excel(
                file_path, form_data, 'db', brand_id, None
            )
            
            if error_msg or not records:
                return {'status': 'error', 'message': error_msg or "데이터 파싱 실패"}

            def progress_callback(current, total):
                if total > 0:
                    self.update_state(state='PROGRESS', meta={
                        'current': current, 
                        'total': total, 
                        'percent': int((current / total) * 100)
                    })

            success, message = InventoryService.full_import_db(
                records, brand_id, progress_callback
            )
            
            if success:
                return {'status': 'completed', 'result': {'message': message}}
            else:
                return {'status': 'error', 'message': message}
        except Exception as e:
            traceback.print_exc()
            return {'status': 'error', 'message': str(e)}
        finally:
            if os.path.exists(file_path):
                try: os.remove(file_path)
                except: pass
            gc.collect()