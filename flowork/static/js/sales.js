if (!window.SalesApp) {
    window.SalesApp = class SalesApp {
        constructor() {
            this.container = document.querySelector('.sales-container:not([data-initialized])');
            if (!this.container) return;
            this.container.dataset.initialized = "true";

            this.abortController = new AbortController();

            this.urls = JSON.parse(this.container.dataset.apiUrls || '{}');
            this.targetStoreId = this.container.dataset.targetStoreId;
            
            this.mode = 'sales';
            this.cart = [];
            this.heldCart = null;
            this.isOnline = false;
            this.refundSaleId = null;
            this.config = { amount_discounts: [] };
            
            this.activeInput = null;
            
            this.touchStartX = 0;
            this.touchStartY = 0;

            this.dom = this.cacheDom();
            this.init();
        }

        cacheDom() {
            const c = this.container;
            const parent = c.closest('.page-content-layer') || document;

            return {
                leftPanel: c.querySelector('#sales-left-panel'),
                rightPanel: c.querySelector('#sales-right-panel'),
                mobileTabs: parent.querySelectorAll('.mobile-tab-btn'),
                dateSales: c.querySelector('#date-area-sales'),
                dateRefund: c.querySelector('#date-area-refund'),
                saleDate: c.querySelector('#sale-date'),
                refundStart: c.querySelector('#refund-start'),
                refundEnd: c.querySelector('#refund-end'),
                modeSales: c.querySelector('#mode-sales'),
                modeRefund: c.querySelector('#mode-refund'),
                searchInput: c.querySelector('#search-input'),
                btnSearch: c.querySelector('#btn-search'),
                leftTbody: c.querySelector('#left-table-body'),
                cartTbody: c.querySelector('#cart-tbody'),
                totalQty: c.querySelector('#total-qty'),
                totalAmt: c.querySelector('#total-amount'),
                mobileCartBadge: parent.querySelector('#mobile-cart-badge'),
                salesActions: c.querySelector('#sales-actions'),
                refundActions: c.querySelector('#refund-actions'),
                refundInfo: c.querySelector('#refund-target-info'),
                btnSubmitSale: c.querySelector('#btn-submit-sale'),
                btnSubmitRefund: c.querySelector('#btn-submit-refund'),
                btnCancelRefund: c.querySelector('#btn-cancel-refund'),
                btnToggleOnline: c.querySelector('#btn-toggle-online'),
                btnClearCart: c.querySelector('#btn-clear-cart'),
                btnHold: c.querySelector('#btn-hold-sale'),
                btnDiscount: c.querySelector('#btn-apply-discount'),
                detailModalEl: parent.querySelector('#detail-modal'),
                recordsModalEl: parent.querySelector('#records-modal'),
                storeSelect: c.querySelector('#admin-store-select'),
                
                numpadModalEl: parent.querySelector('#numpad-modal'),
                numpadDisplay: parent.querySelector('#numpad-display'),
                numpadKeys: parent.querySelectorAll('.num-key'),
                numpadConfirm: parent.querySelector('#btn-numpad-confirm')
            };
        }

        init() {
            const signal = this.abortController.signal;

            if (this.dom.detailModalEl) {
                this.detailModal = new bootstrap.Modal(this.dom.detailModalEl);
                this.dom.detailModalEl.addEventListener('hidden.bs.modal', () => {
                     if(this.dom.searchInput) this.dom.searchInput.focus();
                }, { signal });
            }
            if (this.dom.recordsModalEl) {
                this.recordsModal = new bootstrap.Modal(this.dom.recordsModalEl);
                this.dom.recordsModalEl.addEventListener('hidden.bs.modal', () => {
                     if(this.dom.searchInput) this.dom.searchInput.focus();
                }, { signal });
            }
            
            if (this.dom.numpadModalEl) {
                this.numpadModal = new bootstrap.Modal(this.dom.numpadModalEl);
                this.dom.numpadKeys.forEach(btn => {
                    btn.addEventListener('click', (e) => this.handleNumpadInput(e.target.dataset.key), { signal });
                });
                if (this.dom.numpadConfirm) {
                    this.dom.numpadConfirm.addEventListener('click', () => this.confirmNumpadInput(), { signal });
                }
            }

            this.container.addEventListener('touchstart', (e) => this.handleTouchStart(e), { signal, passive: true });
            this.container.addEventListener('touchend', (e) => this.handleTouchEnd(e), { signal, passive: true });

            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            const todayStr = `${yyyy}-${mm}-${dd}`;

            if(this.dom.saleDate) {
                this.dom.saleDate.value = todayStr;
            }

            const lastMonth = new Date();
            lastMonth.setMonth(today.getMonth() - 1);
            if(this.dom.refundEnd) this.dom.refundEnd.value = todayStr;
            if(this.dom.refundStart) this.dom.refundStart.value = window.Flowork.fmtDate(lastMonth);

            this.loadSettings();

            if(this.dom.modeSales) this.dom.modeSales.addEventListener('change', () => this.setMode('sales'), { signal });
            if(this.dom.modeRefund) this.dom.modeRefund.addEventListener('change', () => this.setMode('refund'), { signal });
            
            if(this.dom.searchInput) {
                this.dom.searchInput.addEventListener('keydown', (e) => { 
                    if(e.key === 'Enter') {
                        e.preventDefault();
                        this.search(); 
                    }
                }, { signal });
            }
            if(this.dom.btnSearch) {
                this.dom.btnSearch.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.search();
                }, { signal });
            }
            
            if(this.dom.btnToggleOnline) this.dom.btnToggleOnline.addEventListener('click', () => this.toggleOnline(), { signal });
            if(this.dom.btnClearCart) this.dom.btnClearCart.addEventListener('click', () => { this.cart = []; this.renderCart(); }, { signal });
            
            if(this.dom.btnSubmitSale) this.dom.btnSubmitSale.addEventListener('click', () => this.submitSale(), { signal });
            if(this.dom.btnSubmitRefund) this.dom.btnSubmitRefund.addEventListener('click', () => this.submitRefund(), { signal });
            if(this.dom.btnCancelRefund) this.dom.btnCancelRefund.addEventListener('click', () => this.resetRefund(), { signal });
            
            if(this.dom.btnHold) this.dom.btnHold.addEventListener('click', () => this.toggleHold(), { signal });
            if(this.dom.btnDiscount) this.dom.btnDiscount.addEventListener('click', () => this.applyAutoDiscount(), { signal });

            if(this.dom.mobileTabs) {
                this.dom.mobileTabs.forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const targetId = e.currentTarget.dataset.target;
                        this.switchMobileTab(targetId);
                    }, { signal });
                });
            }
        }

        destroy() {
            this.abortController.abort();
            if (this.detailModal) this.detailModal.dispose();
            if (this.recordsModal) this.recordsModal.dispose();
            if (this.numpadModal) this.numpadModal.dispose();
            this.cart = null;
            this.dom = null;
            console.log('SalesApp destroyed');
        }

        handleTouchStart(e) {
            this.touchStartX = e.changedTouches[0].screenX;
            this.touchStartY = e.changedTouches[0].screenY;
        }

        handleTouchEnd(e) {
            if (window.innerWidth >= 992) return;

            const touchEndX = e.changedTouches[0].screenX;
            const touchEndY = e.changedTouches[0].screenY;
            
            const diffX = touchEndX - this.touchStartX;
            const diffY = touchEndY - this.touchStartY;

            if (Math.abs(diffX) > 50 && Math.abs(diffY) < 30) {
                if (diffX > 0) {
                    this.switchMobileTab('sales-left');
                } else {
                    this.switchMobileTab('sales-right');
                }
            }
        }

        openKeypad(inputElement) {
            this.activeInput = inputElement;
            this.dom.numpadDisplay.value = inputElement.value || '0';
            this.numpadModal.show();
        }

        handleNumpadInput(key) {
            let currentVal = this.dom.numpadDisplay.value;
            
            if (key === 'C') {
                currentVal = '0';
            } else if (key === 'BS') {
                currentVal = currentVal.length > 1 ? currentVal.slice(0, -1) : '0';
            } else {
                if (currentVal === '0') currentVal = key;
                else currentVal += key;
            }
            this.dom.numpadDisplay.value = currentVal;
        }

        confirmNumpadInput() {
            if (this.activeInput) {
                const newVal = this.dom.numpadDisplay.value;
                this.activeInput.value = newVal;
                const event = new Event('change');
                this.activeInput.dispatchEvent(event);
            }
            this.numpadModal.hide();
            this.activeInput = null;
        }

        switchMobileTab(targetId) {
            this.dom.mobileTabs.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.target === targetId);
            });
            
            if (targetId === 'sales-left') {
                this.dom.leftPanel.classList.add('active');
                this.dom.rightPanel.classList.remove('active');
            } else {
                this.dom.leftPanel.classList.remove('active');
                this.dom.rightPanel.classList.add('active');
            }
        }

        async post(url, data) {
            if (this.targetStoreId) {
                data.target_store_id = this.targetStoreId;
            }
            return await window.Flowork.post(url, data);
        }
        
        async loadSettings() {
            try {
                let url = this.urls.salesSettings;
                if (this.targetStoreId) {
                    url += (url.includes('?') ? '&' : '?') + 'target_store_id=' + this.targetStoreId;
                }
                const data = await window.Flowork.get(url);
                if (data.status === 'success') this.config = data.config;
            } catch (e) { console.error("Settings Load Failed", e); }
        }

        setMode(mode) {
            this.mode = mode;
            this.cart = [];
            this.renderCart();
            this.dom.leftTbody.innerHTML = '';
            this.dom.searchInput.value = '';

            const isSales = (mode === 'sales');
            if(this.dom.dateSales) this.dom.dateSales.style.display = isSales ? 'block' : 'none';
            if(this.dom.dateRefund) this.dom.dateRefund.style.display = isSales ? 'none' : 'block';
            
            this.dom.salesActions.style.display = isSales ? 'block' : 'none';
            this.dom.refundActions.style.display = isSales ? 'none' : 'block';
            
            if (!isSales) this.dom.btnToggleOnline.style.display = 'none';
            else this.dom.btnToggleOnline.style.display = 'block';
        }

        toggleOnline() {
            this.isOnline = !this.isOnline;
            const btn = this.dom.btnToggleOnline;
            btn.textContent = this.isOnline ? 'ONLINE' : 'OFFLINE';
            btn.classList.toggle('btn-outline-dark');
            btn.classList.toggle('btn-info');
        }

        async search() {
            const query = this.dom.searchInput.value.trim();
            if (!query) return;

            if (!this.targetStoreId && this.dom.storeSelect && !this.dom.storeSelect.value) {
                window.Flowork.toast('매장을 먼저 선택해주세요.', 'warning');
                this.dom.storeSelect.focus();
                return;
            }

            this.dom.leftTbody.innerHTML = '<tr><td colspan="4" class="text-center py-3">검색 중...</td></tr>';

            try {
                const payload = {
                    query, 
                    mode: this.mode,
                    start_date: this.dom.refundStart.value,
                    end_date: this.dom.refundEnd.value
                };
                
                const data = await this.post(this.urls.searchSalesProducts, payload);
                this.dom.leftTbody.innerHTML = '';

                if (data.status === 'success' && data.match_type === 'variant') {
                    const item = data.result;
                    this.addToCart({
                        variant_id: item.variant_id,
                        product_name: item.product_name,
                        product_number: item.product_number,
                        color: item.color,
                        size: item.size,
                        original_price: item.original_price,
                        sale_price: item.sale_price,
                        discount_amount: 0,
                        quantity: 1,
                        stock: item.stock,
                        hq_stock: item.hq_stock
                    });
                    this.dom.searchInput.value = '';
                    this.dom.searchInput.focus();
                    window.Flowork.toast(`${item.product_name} 추가됨`, 'success');
                    return;
                }

                if (!data.results || data.results.length === 0) {
                    this.dom.leftTbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">검색 결과가 없습니다.</td></tr>';
                    return;
                }

                data.results.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="fw-bold">${item.product_number}</td>
                        <td><div class="text-truncate" style="max-width: 120px;">${item.product_name}</div></td>
                        <td><span class="badge bg-light text-dark border">${item.color}</span></td>
                        <td class="text-center fw-bold text-primary">${item.stat_qty}</td>
                    `;
                    tr.onclick = () => this.handleResultClick(item);
                    this.dom.leftTbody.appendChild(tr);
                });
            } catch (e) {
                console.error(e);
                this.dom.leftTbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">오류 발생</td></tr>';
            }
        }

        async handleResultClick(item) {
            if (this.mode === 'sales') {
                this.showDetailModal(item);
            } else {
                this.showRefundRecords(item);
            }
        }

        async showDetailModal(item) {
            const title = this.dom.detailModalEl.querySelector('.modal-title');
            const tbody = this.dom.detailModalEl.querySelector('tbody');
            
            title.textContent = `${item.product_name} (${item.product_number})`;
            tbody.innerHTML = '<tr><td colspan="5" class="py-3">로딩중...</td></tr>';
            this.detailModal.show();

            try {
                const data = await this.post(this.urls.searchSalesProducts, { 
                    query: item.product_number, 
                    mode: 'detail_stock' 
                });
                
                tbody.innerHTML = '';
                data.variants.forEach(v => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${v.color}</td>
                        <td><b>${v.size}</b></td>
                        <td>
                            <div class="${v.stock <= 0 ? 'text-danger' : 'text-primary'} fw-bold">${v.stock}</div>
                            <div class="small text-muted" style="font-size:0.7rem;">HQ:${v.hq_stock}</div>
                        </td>
                        <td>${window.Flowork.fmtNum(v.sale_price)}</td>
                        <td><button class="btn btn-sm btn-primary btn-add py-0">추가</button></td>
                    `;
                    const addHandler = () => {
                        this.addToCart({ ...item, ...v, quantity: 1 });
                        this.detailModal.hide();
                        if(window.innerWidth < 992) this.switchMobileTab('sales-right'); 
                    };
                    tr.querySelector('.btn-add').onclick = addHandler;
                    tr.ondblclick = addHandler;
                    tbody.appendChild(tr);
                });
            } catch (e) { tbody.innerHTML = '<tr><td colspan="5" class="text-danger">오류 발생</td></tr>'; }
        }

        async showRefundRecords(item) {
            const title = this.dom.recordsModalEl.querySelector('.modal-title');
            const tbody = this.dom.recordsModalEl.querySelector('tbody');
            title.textContent = `${item.product_name} (${item.color})`;
            tbody.innerHTML = '<tr><td colspan="5" class="py-3">조회중...</td></tr>';
            this.recordsModal.show();

            try {
                const data = await this.post(this.urls.getRefundRecords, {
                    product_number: item.product_number,
                    color: item.color,
                    start_date: this.dom.refundStart.value,
                    end_date: this.dom.refundEnd.value
                });

                tbody.innerHTML = '';
                if (data.records.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" class="py-3">기록 없음</td></tr>';
                    return;
                }

                data.records.forEach(rec => {
                    const tr = document.createElement('tr');
                    tr.style.cursor = 'pointer';
                    tr.innerHTML = `
                        <td>${rec.sale_date.substring(5)}</td>
                        <td>${rec.receipt_number.split(' ')[1]}</td>
                        <td>${rec.product_number}</td>
                        <td>${rec.size}</td>
                        <td class="text-end">${window.Flowork.fmtNum(rec.total_amount)}</td>
                    `;
                    tr.onclick = async () => {
                        await this.loadRefundCart(rec.sale_id, rec.receipt_number);
                        this.recordsModal.hide();
                        if(window.innerWidth < 992) this.switchMobileTab('sales-right');
                    };
                    tbody.appendChild(tr);
                });
            } catch (e) { tbody.innerHTML = '<tr><td colspan="5">오류 발생</td></tr>'; }
        }

        async loadRefundCart(saleId, receiptNumber) {
            try {
                let url = this.urls.saleDetails.replace('999999', saleId);
                if (this.targetStoreId) {
                    url += (url.includes('?') ? '&' : '?') + 'target_store_id=' + this.targetStoreId;
                }
                const data = await window.Flowork.get(url);
                
                if (data.status === 'success') {
                    this.refundSaleId = saleId;
                    this.dom.refundInfo.textContent = receiptNumber;
                    this.cart = data.items.map(i => ({
                        variant_id: i.variant_id,
                        product_name: i.name,
                        product_number: i.pn,
                        color: i.color,
                        size: i.size,
                        original_price: i.original_price || i.price,
                        sale_price: i.price,
                        discount_amount: i.discount_amount,
                        quantity: i.quantity,
                        stock: '-', 
                        hq_stock: '-'
                    }));
                    this.renderCart();
                }
            } catch (e) { window.Flowork.toast('불러오기 실패', 'danger'); }
        }

        addToCart(item) {
            const existing = this.cart.find(c => c.variant_id === item.variant_id);
            if (existing) existing.quantity++;
            else {
                this.cart.push({
                    variant_id: item.variant_id,
                    product_name: item.product_name,
                    product_number: item.product_number,
                    color: item.color,
                    size: item.size,
                    original_price: item.original_price,
                    sale_price: item.sale_price,
                    discount_amount: 0,
                    quantity: 1,
                    stock: item.stock || 0,
                    hq_stock: item.hq_stock || 0
                });
            }
            this.renderCart();
        }

        renderCart() {
            const tbody = this.dom.cartTbody;
            tbody.innerHTML = '';
            let totalQty = 0;
            let totalAmt = 0;

            this.cart.forEach((item, idx) => {
                const org = item.original_price || item.sale_price;
                const sale = item.sale_price;
                
                const unit = sale - item.discount_amount;
                const sub = unit * item.quantity;
                
                totalQty += item.quantity;
                totalAmt += sub;

                let discountRate = 0;
                if (org > 0) {
                    discountRate = Math.round((1 - (sale / org)) * 100);
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="align-middle text-muted small">${idx + 1}</td>
                    
                    <td class="text-start align-middle">
                        <div class="fw-bold text-truncate" style="max-width:120px; font-size:0.95rem;">${item.product_name}</div>
                        <div class="small text-muted" style="font-size:0.75rem;">${item.product_number}</div>
                    </td>
                    
                    <td class="align-middle">
                        <div class="fw-bold text-dark">${item.size}</div>
                        <div class="small text-muted">${item.color}</div>
                    </td>
                    
                    <td class="align-middle text-end">
                        <div class="fw-bold text-dark">${window.Flowork.fmtNum(sale)}</div>
                        ${org > sale ? `<div class="small text-decoration-line-through text-muted" style="font-size:0.75rem;">${window.Flowork.fmtNum(org)}</div>` : ''}
                    </td>
                    
                    <td class="align-middle">
                        <input type="tel" class="form-control form-control-sm text-center cart-input disc-in px-0" 
                               value="${item.discount_amount}" data-idx="${idx}" readonly 
                               style="width: 50px; font-weight:bold; color:#eb6864; background:#fff;">
                        ${discountRate > 0 ? `<div class="small text-danger fw-bold" style="font-size:0.7rem;">-${discountRate}%</div>` : ''}
                    </td>
                    
                    <td class="align-middle">
                        <div class="input-group input-group-sm flex-nowrap" style="width: 100px; margin:0 auto;">
                            <button class="btn btn-outline-secondary px-2 btn-qty-dec" type="button" data-idx="${idx}"><i class="bi bi-dash"></i></button>
                            <input type="text" class="form-control text-center px-0 fw-bold bg-white" value="${item.quantity}" readonly>
                            <button class="btn btn-outline-secondary px-2 btn-qty-inc" type="button" data-idx="${idx}"><i class="bi bi-plus"></i></button>
                        </div>
                    </td>

                    <td class="align-middle">
                        <div class="text-primary fw-bold">${item.stock}</div>
                        <div class="text-muted small" style="font-size:0.75rem;">HQ:${item.hq_stock}</div>
                    </td>
                    
                    <td class="align-middle">
                        <button type="button" class="btn btn-link text-danger p-0 btn-del" data-idx="${idx}">
                            <i class="bi bi-x-circle-fill fs-5"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            this.dom.totalQty.textContent = window.Flowork.fmtNum(totalQty);
            this.dom.totalAmt.textContent = window.Flowork.fmtNum(totalAmt);
            
            if (this.dom.mobileCartBadge) this.dom.mobileCartBadge.textContent = totalQty;

            this.bindCartEvents(tbody);
        }

        bindCartEvents(tbody) {
            tbody.querySelectorAll('.btn-qty-inc').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const idx = e.currentTarget.dataset.idx;
                    this.cart[idx].quantity++;
                    this.renderCart();
                };
            });
            tbody.querySelectorAll('.btn-qty-dec').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const idx = e.currentTarget.dataset.idx;
                    if (this.cart[idx].quantity > 1) {
                        this.cart[idx].quantity--;
                        this.renderCart();
                    }
                };
            });

            tbody.querySelectorAll('.disc-in').forEach(el => {
                el.onclick = (e) => {
                    this.openKeypad(e.target);
                };
                el.onchange = (e) => {
                    const idx = e.target.dataset.idx;
                    const val = parseInt(e.target.value);
                    if (val >= 0) this.cart[idx].discount_amount = val;
                    this.renderCart();
                };
            });

            tbody.querySelectorAll('.btn-del').forEach(el => {
                el.onclick = (e) => {
                    e.stopPropagation();
                    this.cart.splice(e.currentTarget.dataset.idx, 1);
                    this.renderCart();
                };
            });
        }

        toggleHold() {
            const btn = this.dom.btnHold;
            if (this.heldCart) {
                if (confirm('보류된 판매 목록을 복원하시겠습니까?')) {
                    this.cart = JSON.parse(this.heldCart);
                    this.heldCart = null;
                    btn.textContent = '보류';
                    btn.classList.replace('btn-danger', 'btn-warning');
                    this.renderCart();
                }
            } else {
                if (this.cart.length === 0) return window.Flowork.toast('상품이 없습니다.', 'warning');
                this.heldCart = JSON.stringify(this.cart);
                this.cart = [];
                btn.textContent = '복원';
                btn.classList.replace('btn-warning', 'btn-danger');
                this.renderCart();
            }
        }

        applyAutoDiscount() {
            if (this.cart.length === 0) return window.Flowork.toast('상품이 없습니다.', 'warning');
            const currentTotal = this.cart.reduce((sum, i) => sum + (i.sale_price * i.quantity), 0);
            
            let rule = null;
            if (this.config.amount_discounts) {
                rule = this.config.amount_discounts.sort((a, b) => b.limit - a.limit).find(r => currentTotal >= r.limit);
            }

            if (rule) {
                window.Flowork.toast(`${window.Flowork.fmtNum(rule.limit)}원 이상: ${window.Flowork.fmtNum(rule.discount)}원 할인`, 'success');
                this.cart[0].discount_amount += rule.discount;
                this.renderCart();
            } else {
                window.Flowork.toast('적용 가능한 할인 규칙이 없습니다.', 'info');
            }
        }

        async submitSale() {
            if (this.cart.length === 0) return window.Flowork.toast('상품이 없습니다.', 'warning');
            if (!confirm('판매를 등록하시겠습니까?')) return;

            try {
                const payload = {
                    items: this.cart.map(i => ({
                        variant_id: i.variant_id,
                        quantity: i.quantity,
                        price: i.sale_price,
                        discount_amount: i.discount_amount
                    })),
                    sale_date: this.dom.saleDate.value,
                    is_online: this.isOnline
                };

                const res = await this.post(this.urls.submitSales, payload);
                if (res.status === 'success') {
                    window.Flowork.toast('판매 등록 완료', 'success');
                    this.cart = []; 
                    this.renderCart();
                } else {
                    window.Flowork.toast(res.message, 'danger');
                }
            } catch (e) { window.Flowork.toast('등록 실패', 'danger'); }
        }

        async submitRefund() {
            if (!this.refundSaleId) return window.Flowork.toast('환불할 영수증을 선택하세요.', 'warning');
            if (!confirm('전체 환불 처리하시겠습니까?')) return;

            try {
                const url = this.urls.refund.replace('999999', this.refundSaleId);
                const res = await this.post(url, {});
                if (res.status === 'success') {
                    window.Flowork.toast('환불 완료', 'success');
                    this.resetRefund();
                } else {
                    window.Flowork.toast(res.message, 'danger');
                }
            } catch (e) { window.Flowork.toast('오류 발생', 'danger'); }
        }

        resetRefund() {
            this.refundSaleId = null;
            this.dom.refundInfo.textContent = '선택되지 않음';
            this.cart = [];
            this.renderCart();
        }
    };
}

if (document.querySelector('.sales-container')) {
    window.CurrentApp = new window.SalesApp();
}