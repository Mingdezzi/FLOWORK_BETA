import traceback
from flask import render_template, request, abort, current_app, redirect, url_for
from flask_login import login_required, current_user
from sqlalchemy import or_
from sqlalchemy.orm import selectinload

from flowork.models import db, Product, Variant, Store, Brand
from flowork.utils import clean_string_upper
from flowork.services.db import get_filter_options_from_db
from flowork.services.product_service import ProductService
from . import ui_bp

@ui_bp.route('/product/<int:product_id>')
@login_required
def product_detail(product_id):
    is_partial = request.args.get('partial') == '1'

    try:
        target_product = db.session.get(Product, product_id)
        if not target_product:
             abort(404, description="상품을 찾을 수 없습니다.")

        current_brand_id = target_product.brand_id
        
        if not current_user.is_super_admin and current_user.current_brand_id != current_brand_id:
             abort(403, description="접근 권한이 없는 브랜드의 상품입니다.")

        my_store_id = current_user.store_id
        
        data = ProductService.get_product_detail_context(product_id, current_brand_id, my_store_id)
        
        if not data:
            abort(404, description="상품 상세 정보를 로드할 수 없습니다.")

        context = {
            'active_page': 'search',
            'is_partial': is_partial,
            **data 
        }
        return render_template('detail.html', **context)

    except Exception as e:
        current_app.logger.error(f"Error loading product detail: {e}")
        traceback.print_exc()
        abort(500, description="상품 상세 정보를 불러오는 중 오류가 발생했습니다.")

@ui_bp.route('/stock_overview')
@login_required
def stock_overview():
    if not (current_user.is_super_admin or (current_user.is_admin and not current_user.store_id)):
        abort(403, description="통합 재고 현황은 본사 관리자 이상만 조회할 수 있습니다.")
    
    try:
        target_brand_id = None
        brands = []
        
        if current_user.is_super_admin:
            brands = Brand.query.order_by(Brand.brand_name).all()
            brand_id_arg = request.args.get('brand_id', type=int)
            if brand_id_arg:
                target_brand_id = brand_id_arg
            elif brands:
                target_brand_id = brands[0].id
        else:
            target_brand_id = current_user.current_brand_id

        data = ProductService.get_stock_overview_matrix(target_brand_id)

        context = {
            'active_page': 'stock_overview',
            'brands': brands,
            'target_brand_id': target_brand_id,
            **data 
        }
        return render_template('stock_overview.html', **context)

    except Exception as e:
        current_app.logger.error(f"Error loading stock overview: {e}")
        traceback.print_exc()
        abort(500, description="통합 재고 현황 로드 중 오류가 발생했습니다.")

@ui_bp.route('/list')
@login_required
def list_page():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = 20
        
        target_brand_id = None
        brands = []
        if current_user.is_super_admin:
            brands = Brand.query.order_by(Brand.brand_name).all()
            target_brand_id = request.args.get('brand_id', type=int)
            if not target_brand_id and brands:
                target_brand_id = brands[0].id
        else:
            target_brand_id = current_user.current_brand_id
        
        filter_options = get_filter_options_from_db(target_brand_id)

        search_params = {
            'product_name': request.args.get('product_name', ''),
            'product_number': request.args.get('product_number', ''),
            'item_category': request.args.get('item_category', ''),
            'release_year': request.args.get('release_year', ''),
            'color': request.args.get('color', ''),
            'size': request.args.get('size', ''),
            'original_price': request.args.get('original_price', ''),
            'sale_price': request.args.get('sale_price', ''),
            'min_discount': request.args.get('min_discount', ''),
        }
        
        query = db.session.query(Product).options(selectinload(Product.variants)).distinct().filter(
             Product.brand_id == target_brand_id
        )
        
        needs_variant_join = False
        variant_filters = []
        
        if search_params['product_name']:
            query = query.filter(Product.product_name_cleaned.like(f"%{clean_string_upper(search_params['product_name'])}%"))
        if search_params['product_number']:
            query = query.filter(Product.product_number_cleaned.like(f"%{clean_string_upper(search_params['product_number'])}%"))
        if search_params['item_category']:
            query = query.filter(Product.item_category == search_params['item_category'])
        if search_params['release_year']:
            query = query.filter(Product.release_year == int(search_params['release_year']))

        if search_params['color']:
            needs_variant_join = True
            variant_filters.append(Variant.color_cleaned == clean_string_upper(search_params['color']))
        if search_params['size']:
            needs_variant_join = True
            variant_filters.append(Variant.size_cleaned == clean_string_upper(search_params['size']))
        if search_params['original_price']:
            needs_variant_join = True
            variant_filters.append(Variant.original_price == int(search_params['original_price']))
        if search_params['sale_price']:
            needs_variant_join = True
            variant_filters.append(Variant.sale_price == int(search_params['sale_price']))
        if search_params['min_discount']:
            try:
                min_discount_val = float(search_params['min_discount']) / 100.0
                if min_discount_val > 0:
                    needs_variant_join = True
                    variant_filters.append(Variant.original_price > 0)
                    variant_filters.append((Variant.sale_price / Variant.original_price) <= (1.0 - min_discount_val))
            except (ValueError, TypeError):
                pass 

        if needs_variant_join:
            query = query.join(Product.variants).filter(*variant_filters)
            
        showing_all = not any(v for v in search_params.values())

        pagination = query.order_by(
            Product.release_year.desc(), Product.product_name
        ).paginate(page=page, per_page=per_page, error_out=False)

        context = {
            'active_page': 'list',
            'products': pagination.items,
            'pagination': pagination,
            'filter_options': filter_options,
            'advanced_search_params': search_params,
            'showing_all': showing_all,
            'brands': brands,
            'target_brand_id': target_brand_id
        }
        
        return render_template('list.html', **context)

    except Exception as e:
        current_app.logger.error(f"Error loading list page: {e}")
        traceback.print_exc()
        abort(500, description="상세 검색 중 오류가 발생했습니다.")

@ui_bp.route('/check')
@login_required
def check_page():
    all_stores = []
    
    if current_user.is_super_admin:
        all_stores = Store.query.filter_by(is_active=True).join(Brand).order_by(Brand.brand_name, Store.store_name).all()
    elif not current_user.store_id:
        all_stores = Store.query.filter_by(
            brand_id=current_user.current_brand_id,
            is_active=True
        ).order_by(Store.store_name).all()
        
    return render_template('check.html', active_page='check', all_stores=all_stores)

@ui_bp.route('/stock')
@login_required
def stock_management():
    try:
        target_brand_id = None
        brands = []
        
        if current_user.is_super_admin:
            brands = Brand.query.order_by(Brand.brand_name).all()
            target_brand_id = request.args.get('brand_id', type=int)
            if not target_brand_id and brands:
                target_brand_id = brands[0].id
        else:
            target_brand_id = current_user.current_brand_id

        missing_data_products = Product.query.filter(
            Product.brand_id == target_brand_id, 
            or_(
                Product.item_category.is_(None),
                Product.item_category == '',
                Product.release_year.is_(None)
            )
        ).order_by(Product.product_number).all()
        
        all_stores = []
        if not current_user.store_id: 
            query = Store.query.filter(Store.is_active==True)
            if target_brand_id:
                query = query.filter(Store.brand_id == target_brand_id)
            all_stores = query.order_by(Store.store_name).all()
        
        context = {
            'active_page': 'stock',
            'missing_data_products': missing_data_products,
            'all_stores': all_stores,
            'brands': brands,
            'target_brand_id': target_brand_id
        }
        return render_template('stock.html', **context)

    except Exception as e:
        current_app.logger.error(f"Error loading stock management page: {e}")
        abort(500, description="DB 관리 페이지 로드 중 오류가 발생했습니다.")