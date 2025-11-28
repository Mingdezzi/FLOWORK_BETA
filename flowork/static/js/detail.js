class DetailApp {
    constructor() {
        const bodyData = document.body.dataset;
        this.config = {
            updateStockUrl: bodyData.updateStockUrl,
            toggleFavoriteUrl: bodyData.toggleFavoriteUrl,
            updateActualStockUrl: bodyData.updateActualStockUrl,
            updateProductDetailsUrl: bodyData.updateProductDetailsUrl,
            currentProductID: bodyData.productId,
            myStoreID: parseInt(bodyData.myStoreId, 10) || 0
        };

        this.dom = {
            storeSelector: document.getElementById('hq-store-selector'),
            variantsTbody: document.getElementById('variants-tbody'),
            rowTemplate: document.getElementById('variant-row-template'),
            addRowTemplate: document.getElementById('add-variant-row-template'),
            toggleActualStockBtn: document.getElementById('toggle-actual-stock-btn'),
            favButton: document.getElementById('fav-btn'),
            editProductBtn: document.getElementById('edit-product-btn'),
            saveProductBtn: document.getElementById('save-product-btn'),
            cancelEditBtn: document.getElementById('cancel-edit-btn'),
            deleteProductBtn: document.getElementById('delete-product-btn'),
            deleteProductForm: document.getElementById('delete-product-form')
        };

        this.state = {
            isActualStockEnabled: false
        };

        this.init();
    }

    init() {
        if (this.dom.storeSelector) {
            this.dom.storeSelector.addEventListener('change', () => {
                const selectedStoreId = parseInt(this.dom.storeSelector.value, 10) || 0;
                this.renderStockTable(selectedStoreId);
            });
        }

        if (this.dom.variantsTbody) {
            this.dom.variantsTbody.addEventListener('click', (e) => this.handleTableClick(e));
            this.dom.variantsTbody.addEventListener('input', (e) => this.handleTableInput(e));
            this.dom.variantsTbody.addEventListener('keydown', (e) => this.handleTableKeydown(e));
        }

        if (this.dom.favButton) {
            this.dom.favButton.addEventListener('click', (e) => this.handleFavorite(e));
        }

        this.setupEditMode();
        this.setupDeleteProduct();

        if (this.dom.toggleActualStockBtn) {
            this.dom.toggleActualStockBtn.addEventListener('click', () => {
                if (document.body.classList.contains('edit-mode')) return;
                this.toggleActualStockMode();
            });
        }

        let initialStoreId = 0;
        if (this.dom.storeSelector) {
            initialStoreId = parseInt(this.dom.storeSelector.value, 10) || 0;
        } else if (this.config.myStoreID) {
            initialStoreId = this.config.myStoreID;
        }
        this.renderStockTable(initialStoreId);
    }

    setupEditMode() {
        if (this.dom.editProductBtn) {
            this.dom.editProductBtn.addEventListener('click', () => {
                if (confirm('✏️ 상품 정보 수정 모드로 전환합니다.\n수정 후에는 반드시 [수정 완료] 버튼을 눌러 저장해주세요.')) {
                    document.body.classList.add('edit-mode');
                    const currentStoreId = this.dom.storeSelector ? (parseInt(this.dom.storeSelector.value, 10) || 0) : this.config.myStoreID;
                    this.renderStockTable(currentStoreId);
                }
            });
        }

        if (this.dom.cancelEditBtn) {
            this.dom.cancelEditBtn.addEventListener('click', () => {
                if (confirm('⚠️ 수정 중인 내용을 취소하고 원래 상태로 되돌립니다.\n계속하시겠습니까?')) {
                    document.body.classList.remove('edit-mode');
                    const currentStoreId = this.dom.storeSelector ? (parseInt(this.dom.storeSelector.value, 10) || 0) : this.config.myStoreID;
                    this.renderStockTable(currentStoreId);
                }
            });
        }

        if (this.dom.saveProductBtn) {
            this.dom.saveProductBtn.addEventListener('click', () => this.saveProductDetails());
        }
    }

    setupDeleteProduct() {
        if (this.dom.deleteProductBtn && this.dom.deleteProductForm) {
            const productName = document.querySelector('.product-details h2')?.textContent || '이 상품';
            this.dom.deleteProductBtn.addEventListener('click', () => {
                if (confirm(`🚨🚨🚨 최종 경고 🚨🚨🚨\n\n'${productName}' 상품을(를) DB에서 완전히 삭제합니다.\n\n연결된 모든 옵션, 재고 데이터가 영구적으로 삭제됩니다.\n\n정말로 삭제하시겠습니까?`)) {
                    this.dom.deleteProductBtn.disabled = true;
                    this.dom.deleteProductBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 삭제 중...';
                    this.dom.deleteProductForm.submit();
                }
            });
        }
    }

    renderStockTable(selectedStoreId) {
        if (!this.dom.variantsTbody || !this.dom.rowTemplate || !window.allVariants || !window.hqStockData) {
            if(this.dom.variantsTbody) this.dom.variantsTbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger p-4">데이터 로드 실패</td></tr>';
            return;
        }

        this.dom.variantsTbody.innerHTML = ''; 
        const isMyStore = (selectedStoreId === this.config.myStoreID);
        
        if (this.dom.toggleActualStockBtn) {
            if (isMyStore) {
                this.dom.toggleActualStockBtn.style.display = 'inline-block';
            } else {
                this.dom.toggleActualStockBtn.style.display = 'none';
                if (this.state.isActualStockEnabled) this.toggleActualStockMode(false);
            }
        }
        
        window.allVariants.forEach(variant => {
            const storeStockData = window.hqStockData[selectedStoreId]?.[variant.id] || {};
            const storeQty = storeStockData.quantity || 0;
            const actualQty = storeStockData.actual_stock; 
            
            let diffVal = '-';
            let diffClass = 'bg-light text-dark';
            if (actualQty !== null && actualQty !== undefined) {
                const diff = storeQty - actualQty;
                diffVal = diff;
                if (diff > 0) diffClass = 'bg-primary';
                else if (diff < 0) diffClass = 'bg-danger';
                else diffClass = 'bg-secondary';
            }

            const html = this.dom.rowTemplate.innerHTML
                .replace(/__BARCODE__/g, variant.barcode)
                .replace(/__VARIANT_ID__/g, variant.id)
                .replace(/__COLOR__/g, variant.color || '')
                .replace(/__SIZE__/g, variant.size || '')
                .replace(/__STORE_QTY__/g, storeQty)
                .replace(/__STORE_QTY_CLASS__/g, storeQty === 0 ? 'text-danger' : '')
                .replace(/__HQ_QTY__/g, variant.hq_quantity || 0)
                .replace(/__HQ_QTY_CLASS__/g, (variant.hq_quantity || 0) === 0 ? 'text-danger' : 'text-muted')
                .replace(/__ACTUAL_QTY_VAL__/g, (actualQty !== null && actualQty !== undefined) ? actualQty : '')
                .replace(/__DIFF_VAL__/g, diffVal)
                .replace(/__DIFF_CLASS__/g, diffClass)
                .replace(/__SHOW_IF_MY_STORE__/g, isMyStore ? '' : 'd-none')
                .replace(/__SHOW_IF_NOT_MY_STORE__/g, isMyStore ? 'd-none' : '');
            
            this.dom.variantsTbody.insertAdjacentHTML('beforeend', html);
        });
        
        if (window.allVariants.length === 0) {
             this.dom.variantsTbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted p-4">옵션 정보가 없습니다.</td></tr>';
        }

        if (document.body.classList.contains('edit-mode') && this.dom.addRowTemplate) {
            this.dom.variantsTbody.insertAdjacentHTML('beforeend', this.dom.addRowTemplate.innerHTML);
        }
        
        this.updateActualStockInputsState();
    }

    handleTableClick(e) {
        const stockButton = e.target.closest('button.btn-inc, button.btn-dec');
        if (stockButton) {
            const barcode = stockButton.dataset.barcode;
            const change = parseInt(stockButton.dataset.change, 10);
            const currentSelectedStoreId = this.dom.storeSelector ? (parseInt(this.dom.storeSelector.value, 10) || 0) : this.config.myStoreID;
            
            if (currentSelectedStoreId !== this.config.myStoreID) {
                alert('재고 수정은 \'내 매장\'이 선택된 경우에만 가능합니다.');
                return;
            }
            
            if (confirm(`재고를 ${Math.abs(change)}개 ${change > 0 ? "증가" : "감소"}시키겠습니까?`)) {
                const allButtons = stockButton.closest('.button-stack').querySelectorAll('button');
                allButtons.forEach(btn => btn.disabled = true);
                this.updateStockOnServer(barcode, change, allButtons);
            }
        }

        const saveButton = e.target.closest('button.btn-save-actual');
        if (saveButton && !saveButton.disabled) {
            const barcode = saveButton.dataset.barcode;
            const inputElement = document.getElementById(`actual-${barcode}`);
            this.saveActualStockHandler(saveButton, inputElement, barcode);
        }
        
        if (e.target.closest('#btn-add-variant')) {
            this.handleAddVariantRow();
        }

        const deleteBtn = e.target.closest('.btn-delete-variant');
        if (deleteBtn) {
            if (confirm('🗑️ 이 행을 삭제하시겠습니까? [수정 완료]를 눌러야 최종 반영됩니다.')) {
                const row = e.target.closest('tr');
                if (row.dataset.variantId) {
                    row.style.display = 'none';
                    row.dataset.action = 'delete';
                } else {
                    row.remove(); 
                }
            }
        }
    }

    handleTableInput(e) {
        if (e.target.classList.contains('actual-stock-input')) {
            const barcode = e.target.dataset.barcode;
            const saveBtn = document.querySelector(`.btn-save-actual[data-barcode="${barcode}"]`);
            if(saveBtn && this.state.isActualStockEnabled) {
                saveBtn.disabled = false;
            }
        }
    }

    handleTableKeydown(e) {
        if (!e.target.classList.contains('actual-stock-input') || !this.state.isActualStockEnabled) return;
        
        const inputs = Array.from(this.dom.variantsTbody.querySelectorAll('.actual-stock-input'));
        const currentIndex = inputs.indexOf(e.target);
        const currentBarcode = e.target.dataset.barcode;

        if (e.key === 'Enter') {
            e.preventDefault();
            const saveBtn = document.querySelector(`.btn-save-actual[data-barcode="${currentBarcode}"]`);
            if (saveBtn && !saveBtn.disabled) {
                saveBtn.click(); 
            } else {
                 const nextInput = inputs[currentIndex + 1];
                 if (nextInput) { nextInput.focus(); nextInput.select(); }
            }
        } else if (e.key === 'ArrowDown') {
             e.preventDefault();
             const nextInput = inputs[currentIndex + 1];
             if (nextInput) { nextInput.focus(); nextInput.select(); }
        } else if (e.key === 'ArrowUp') {
             e.preventDefault();
             const prevInput = inputs[currentIndex - 1];
             if (prevInput) { prevInput.focus(); prevInput.select(); }
        }
    }

    handleFavorite(e) {
        const button = e.target.closest('button');
        const isFavorite = button.classList.contains('btn-warning');
        const actionText = isFavorite ? '즐겨찾기에서 해제' : '즐겨찾기에 추가';
        if (confirm(`⭐ 이 상품을 ${actionText}하시겠습니까?`)) {
           button.disabled = true;
           this.toggleFavoriteOnServer(this.config.currentProductID, button);
        }
    }

    toggleActualStockMode(forceState) {
         if (forceState === false) this.state.isActualStockEnabled = true;
         else if (forceState === true) this.state.isActualStockEnabled = false;

         this.state.isActualStockEnabled = !this.state.isActualStockEnabled;
         this.updateActualStockInputsState(); 
         
         if (this.state.isActualStockEnabled) {
             this.dom.toggleActualStockBtn.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> 등록 완료';
             this.dom.toggleActualStockBtn.classList.replace('btn-secondary', 'btn-success');
             const firstInput = this.dom.variantsTbody.querySelector('.actual-stock-input');
             if (firstInput) firstInput.focus();
         } else {
             this.dom.toggleActualStockBtn.innerHTML = '<i class="bi bi-pencil-square me-1"></i> 실사재고 등록';
             this.dom.toggleActualStockBtn.classList.replace('btn-success', 'btn-secondary');
         }
    }
    
    updateActualStockInputsState() {
         const actualStockInputs = this.dom.variantsTbody.querySelectorAll('.actual-stock-input');
         const saveActualStockBtns = this.dom.variantsTbody.querySelectorAll('.btn-save-actual');
         
         actualStockInputs.forEach(input => { input.disabled = !this.state.isActualStockEnabled; });
         saveActualStockBtns.forEach(button => { button.disabled = true; }); 
    }

    handleAddVariantRow() {
         const addVariantRow = document.getElementById('add-variant-row'); 
         const newColorInput = addVariantRow.querySelector('[data-field="new-color"]');
         const newSizeInput = addVariantRow.querySelector('[data-field="new-size"]');
         const color = newColorInput.value.trim();
         const size = newSizeInput.value.trim();

         if (!color || !size) return alert('컬러와 사이즈를 입력해주세요.');

         const newRow = document.createElement('tr');
         newRow.dataset.action = 'add'; 
         newRow.innerHTML = `
             <td class="variant-edit-cell"><input type="text" class="form-control form-control-sm variant-edit-input" data-field="color" value="${color}"></td>
             <td class="variant-edit-cell"><input type="text" class="form-control form-control-sm variant-edit-input" data-field="size" value="${size}"></td>
             <td></td><td></td><td class="view-field"></td><td class="view-field"></td>
             <td class="edit-field"><button class="btn btn-danger btn-sm btn-delete-variant"><i class="bi bi-trash-fill"></i></button></td>
         `;
         this.dom.variantsTbody.insertBefore(newRow, addVariantRow);
         newColorInput.value = ''; newSizeInput.value = ''; newColorInput.focus();
    }

    async saveProductDetails() {
        if (!confirm('💾 수정된 상품 정보를 저장하시겠습니까?')) return;

        const productData = {
            product_id: this.config.currentProductID,
            product_name: document.getElementById('edit-product-name').value,
            release_year: document.getElementById('edit-release-year').value || null,
            item_category: document.getElementById('edit-item-category').value || null,
            variants: []
        };
        
        const originalPrice = document.getElementById('edit-original-price-field').value;
        const salePrice = document.getElementById('edit-sale-price-field').value;

        this.dom.variantsTbody.querySelectorAll('tr[data-variant-id], tr[data-action="add"]').forEach(row => {
            if (row.id === 'add-variant-row' || (row.style.display === 'none' && row.dataset.action !== 'delete')) return;
            
            const action = row.dataset.action || 'update';
            const variantID = row.dataset.variantId || null;

            if (action === 'delete') {
                productData.variants.push({ variant_id: variantID, action: 'delete' });
            } else {
                 const variant = {
                    variant_id: variantID, action: action,
                    color: row.querySelector('[data-field="color"]').value,
                    size: row.querySelector('[data-field="size"]').value,
                    original_price: originalPrice, sale_price: salePrice
                };
                if (action === 'add' && (!variant.color || !variant.size)) return;
                productData.variants.push(variant);
            }
        });

        this.dom.saveProductBtn.disabled = true;
        this.dom.saveProductBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 저장 중...';

        try {
            await Flowork.post(this.config.updateProductDetailsUrl, productData);
            alert('저장되었습니다.');
            window.location.reload();
        } catch (error) {
            alert(`오류: ${error.message}`);
            this.dom.saveProductBtn.disabled = false;
            this.dom.saveProductBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i> 수정 완료';
        }
    }

    saveActualStockHandler(saveButton, inputElement, barcode) {
        const val = inputElement.value;
        if (val !== '' && (isNaN(val) || parseInt(val) < 0)) {
            alert('0 이상의 숫자만 입력 가능합니다.');
            inputElement.focus(); inputElement.select(); return;
        }
        saveButton.disabled = true;
        this.saveActualStock(barcode, val, saveButton, inputElement);
    }

    async updateStockOnServer(barcode, change, buttons) {
        try {
            const data = await Flowork.post(this.config.updateStockUrl, { barcode: barcode, change: change });
            const quantitySpan = document.getElementById(`stock-${data.barcode}`);
            quantitySpan.textContent = data.new_quantity;
            quantitySpan.classList.toggle('text-danger', data.new_quantity === 0);
            this.updateStockDiffDisplayDirectly(barcode, data.new_stock_diff);
        } catch(error) { alert(`오류: ${error.message}`); } 
        finally { buttons.forEach(btn => btn.disabled = false); }
    }

    async toggleFavoriteOnServer(productID, button) {
        try {
            const data = await Flowork.post(this.config.toggleFavoriteUrl, { product_id: productID });
            if (data.new_favorite_status === 1) {
                button.innerHTML = '<i class="bi bi-star-fill me-1"></i> 즐겨찾기 해제';
                button.classList.replace('btn-outline-secondary', 'btn-warning');
            } else {
                button.innerHTML = '<i class="bi bi-star me-1"></i> 즐겨찾기 추가';
                button.classList.replace('btn-warning', 'btn-outline-secondary');
            }
        } catch(error) { alert(`오류: ${error.message}`); } 
        finally { button.disabled = false; }
    }

    async saveActualStock(barcode, actualStock, saveButton, inputElement) {
        try {
            const data = await Flowork.post(this.config.updateActualStockUrl, { barcode: barcode, actual_stock: actualStock });
            this.updateStockDiffDisplayDirectly(barcode, data.new_stock_diff);
            inputElement.value = data.new_actual_stock;
            saveButton.disabled = true;
            inputElement.disabled = !this.state.isActualStockEnabled; 
            
            const inputs = Array.from(this.dom.variantsTbody.querySelectorAll('.actual-stock-input'));
            const nextInput = inputs[inputs.indexOf(inputElement) + 1];
            if (nextInput && this.state.isActualStockEnabled) { nextInput.focus(); nextInput.select(); }
        } catch (error) {
            alert(`오류: ${error.message}`);
            saveButton.disabled = false;
            inputElement.disabled = !this.state.isActualStockEnabled;
        }
    }

    updateStockDiffDisplayDirectly(barcode, stockDiffValue) {
        const diffSpan = document.getElementById(`diff-${barcode}`);
        if (diffSpan) {
            diffSpan.textContent = stockDiffValue !== '' && stockDiffValue !== null ? stockDiffValue : '-';
            diffSpan.className = 'stock-diff badge ';
            if (stockDiffValue !== '' && stockDiffValue !== null) {
                const diff = parseInt(stockDiffValue);
                if (!isNaN(diff)) {
                   if (diff > 0) diffSpan.classList.add('bg-primary');
                   else if (diff < 0) diffSpan.classList.add('bg-danger');
                   else diffSpan.classList.add('bg-secondary');
                } else diffSpan.classList.add('bg-light', 'text-dark');
            } else diffSpan.classList.add('bg-light', 'text-dark');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('variants-tbody')) new DetailApp();
});