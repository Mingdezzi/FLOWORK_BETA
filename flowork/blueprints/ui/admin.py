import json
import traceback
from flask import render_template, abort, request
from flask_login import login_required, current_user

from flowork.models import db, Setting, Brand, Store, Staff
from . import ui_bp

@ui_bp.route('/setting')
@login_required
def setting_page():
    if not current_user.is_admin and not current_user.is_super_admin:
        abort(403, description="설정 페이지는 관리자만 접근할 수 있습니다.")

    try:
        current_brand_id = current_user.current_brand_id
        brands = []
        
        # 슈퍼 관리자 브랜드 선택 로직
        if current_user.is_super_admin:
            brands = Brand.query.order_by(Brand.brand_name).all()
            brand_id_arg = request.args.get('brand_id', type=int)
            if brand_id_arg:
                current_brand_id = brand_id_arg
            elif brands:
                current_brand_id = brands[0].id
                
        my_store_id = current_user.store_id
        
        brand_name_display = "FLOWORK (Super Admin)"
        all_stores_in_brand = []
        staff_list = []
        hq_store_id_setting = None
        category_config = None
        
        expected_filename = None
        loaded_settings_file = None

        if current_brand_id:
            brand_name_setting = Setting.query.filter_by(brand_id=current_brand_id, key='BRAND_NAME').first()
            brand = db.session.get(Brand, current_brand_id)
            brand_name_display = (brand_name_setting.value if brand_name_setting else brand.brand_name) or "브랜드 이름 없음"

            all_stores_in_brand = Store.query.filter(Store.brand_id == current_brand_id).order_by(Store.store_name).all()
            
            if not my_store_id: 
                hq_setting = Setting.query.filter_by(brand_id=current_brand_id, key='HQ_STORE_ID').first()
                if hq_setting and hq_setting.value:
                    hq_store_id_setting = int(hq_setting.value)
                
                category_setting = Setting.query.filter_by(brand_id=current_brand_id, key='CATEGORY_CONFIG').first()
                if category_setting and category_setting.value:
                    try:
                        category_config = json.loads(category_setting.value)
                    except json.JSONDecodeError:
                        pass
                
                if brand:
                    expected_filename = f"{brand.brand_name}.json"
                loaded_setting = Setting.query.filter_by(
                    brand_id=current_brand_id, 
                    key='LOADED_SETTINGS_FILE'
                ).first()
                if loaded_setting:
                    loaded_settings_file = loaded_setting.value
        
        if my_store_id:
            staff_list = Staff.query.filter(Staff.store_id == my_store_id, Staff.is_active == True).order_by(Staff.name).all()
        
        context = {
            'active_page': 'setting',
            'brand_name': brand_name_display,
            'my_store_id': my_store_id, 
            'all_stores': all_stores_in_brand, 
            'staff_list': staff_list,
            'hq_store_id_setting': hq_store_id_setting,
            'category_config': category_config,
            'expected_settings_file': expected_filename,
            'loaded_settings_file': loaded_settings_file,
            'brands': brands,
            'target_brand_id': current_brand_id
        }
        return render_template('setting.html', **context)
    
    except Exception as e:
        print(f"Error loading setting page: {e}")
        traceback.print_exc()
        abort(500, description="설정 페이지를 불러오는 중 오류가 발생했습니다.")