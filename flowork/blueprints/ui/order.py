from flask import render_template, request, abort, redirect, url_for, flash
from flask_login import login_required, current_user
from datetime import datetime
from flowork.extensions import db
# [수정됨] OrderProcessing -> ProcessingStep
from flowork.models import Order, ProcessingStep, Product, Store, Setting, Brand
from . import ui_bp

@ui_bp.route('/orders')
@login_required
def order_list():
    # 권한 체크 및 필터링 로직 (기존 유지)
    page = request.args.get('page', 1, type=int)
    year = request.args.get('year', datetime.now().year, type=int)
    month = request.args.get('month', datetime.now().month, type=int)
    
    query = Order.query
    
    if not current_user.is_super_admin:
        if current_user.is_admin:
            store_ids = [s.id for s in Store.query.filter_by(brand_id=current_user.current_brand_id).all()]
            query = query.filter(Order.store_id.in_(store_ids))
        elif current_user.store_id:
            query = query.filter_by(store_id=current_user.store_id)
        else:
            abort(403)

    # 대기중인 주문 (완료되지 않은 것)
    pending_orders = query.filter(Order.order_status != '완료').order_by(Order.created_at.desc()).all()
    
    # 월별 완료 내역
    monthly_query = query.filter(
        db.extract('year', Order.created_at) == year,
        db.extract('month', Order.created_at) == month
    ).order_by(Order.created_at.desc())
    
    pagination = monthly_query.paginate(page=page, per_page=20)
    
    return render_template(
        'order.html',
        active_page='order',
        pending_orders=pending_orders,
        monthly_orders=pagination.items,
        pagination=pagination,
        selected_year=year,
        selected_month=month,
        year_list=range(datetime.now().year, datetime.now().year - 3, -1),
        month_list=range(1, 13)
    )

@ui_bp.route('/orders/new', methods=['GET', 'POST'])
@login_required
def new_order():
    if request.method == 'POST':
        try:
            order = Order(
                store_id=current_user.store_id if current_user.store_id else request.form.get('store_id'), # 관리자일 경우 form에서 받을 수 있음
                customer_name=request.form['customer_name'],
                customer_phone=request.form['customer_phone'],
                product_number=request.form['product_number'],
                product_name=request.form.get('product_name'),
                color=request.form['color'],
                size=request.form['size'],
                reception_method=request.form.get('reception_method', '방문수령'),
                postcode=request.form.get('postcode'),
                address1=request.form.get('address1'),
                address2=request.form.get('address2'),
                remarks=request.form.get('remarks'),
                order_status='고객주문'
            )
            
            if request.form.get('created_at'):
                order.created_at = datetime.strptime(request.form['created_at'], '%Y-%m-%d')

            db.session.add(order)
            db.session.flush() # ID 생성을 위해 flush

            # 처리 단계 저장
            sources = request.form.getlist('processing_source')
            results = request.form.getlist('processing_result')
            
            for s_id, res in zip(sources, results):
                if s_id:
                    # [수정됨] ProcessingStep 사용
                    step = ProcessingStep(
                        order_id=order.id,
                        source_store_id=int(s_id),
                        source_result=res if res else None
                    )
                    db.session.add(step)
            
            db.session.commit()
            flash('주문이 등록되었습니다.', 'success')
            return redirect(url_for('ui.order_list'))
            
        except Exception as e:
            db.session.rollback()
            flash(f'오류 발생: {str(e)}', 'danger')
            
    # 폼 렌더링을 위한 데이터 준비
    stores = []
    if current_user.is_super_admin:
        stores = Store.query.all()
    elif current_user.is_admin:
        stores = Store.query.filter_by(brand_id=current_user.current_brand_id).all()
    else:
        # 매장 직원은 본인 매장 외에 "주문처"로 선택할 수 있는 다른 매장 목록이 필요할 수 있음
        # 여기서는 같은 브랜드의 모든 매장을 가져옴
        if current_user.store:
            stores = Store.query.filter_by(brand_id=current_user.store.brand_id).all()

    return render_template(
        'order_detail.html',
        active_page='order',
        order=None,
        data={},
        order_sources=stores,
        order_statuses=['고객주문', '주문등록', '매장도착', '고객연락', '택배 발송', '완료'],
        is_view_mode=False,
        default_created_at=datetime.now()
    )

@ui_bp.route('/orders/<int:order_id>', methods=['GET', 'POST'])
@login_required
def order_detail(order_id):
    order = Order.query.get_or_404(order_id)
    
    # 권한 체크
    if not current_user.is_super_admin:
        if current_user.is_admin:
            if order.store.brand_id != current_user.current_brand_id: abort(403)
        elif current_user.store_id:
            if order.store_id != current_user.store_id: abort(403)
        else:
            abort(403)

    if request.method == 'POST':
        try:
            order.customer_name = request.form['customer_name']
            order.customer_phone = request.form['customer_phone']
            order.product_number = request.form['product_number']
            order.color = request.form['color']
            order.size = request.form['size']
            order.reception_method = request.form.get('reception_method')
            order.postcode = request.form.get('postcode')
            order.address1 = request.form.get('address1')
            order.address2 = request.form.get('address2')
            order.remarks = request.form.get('remarks')
            order.order_status = request.form['order_status']
            order.courier = request.form.get('courier')
            order.tracking_number = request.form.get('tracking_number')
            
            if request.form.get('created_at'):
                order.created_at = datetime.strptime(request.form['created_at'], '%Y-%m-%d')
                
            if request.form.get('completed_at'):
                 order.completed_at = datetime.strptime(request.form['completed_at'], '%Y-%m-%d')
            elif order.order_status == '완료' and not order.completed_at:
                 order.completed_at = datetime.now()

            # 기존 처리 단계 삭제 후 재생성 (간편한 업데이트 방식)
            # [수정됨] ProcessingStep 사용
            ProcessingStep.query.filter_by(order_id=order.id).delete()
            
            sources = request.form.getlist('processing_source')
            results = request.form.getlist('processing_result')
            
            for s_id, res in zip(sources, results):
                if s_id:
                    step = ProcessingStep(
                        order_id=order.id,
                        source_store_id=int(s_id),
                        source_result=res if res else None
                    )
                    db.session.add(step)
            
            db.session.commit()
            flash('주문 정보가 수정되었습니다.', 'success')
            return redirect(url_for('ui.order_detail', order_id=order.id))
            
        except Exception as e:
            db.session.rollback()
            flash(f'수정 실패: {str(e)}', 'danger')

    # 뷰 모드 렌더링
    stores = []
    if current_user.is_super_admin:
        stores = Store.query.all()
    elif current_user.is_admin or current_user.store_id:
        # 본인 브랜드 매장들
        brand_id = current_user.current_brand_id
        if not brand_id and current_user.store: brand_id = current_user.store.brand_id
        if brand_id:
             stores = Store.query.filter_by(brand_id=brand_id).all()

    return render_template(
        'order_detail.html',
        active_page='order',
        order=order,
        data=order, # 템플릿에서 data 변수 사용
        order_sources=stores,
        order_statuses=['고객주문', '주문등록', '매장도착', '고객연락', '택배 발송', '완료'],
        is_view_mode=True # 상세 조회 시 기본은 보기 모드
    )

@ui_bp.route('/orders/<int:order_id>/delete', methods=['POST'])
@login_required
def delete_order(order_id):
    order = Order.query.get_or_404(order_id)
    # 권한 체크 (상세 조회와 동일)
    if not current_user.is_super_admin:
        if current_user.is_admin:
            if order.store.brand_id != current_user.current_brand_id: abort(403)
        elif current_user.store_id:
            if order.store_id != current_user.store_id: abort(403)
        else:
            abort(403)
            
    try:
        db.session.delete(order)
        db.session.commit()
        flash('주문이 삭제되었습니다.', 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'삭제 실패: {str(e)}', 'danger')
        
    return redirect(url_for('ui.order_list'))