// 전역 함수 유지 (이미지 에러 처리는 인라인에서 호출됨)
function imgFallback(img) {
    const src = img.src;
    if (src.includes('_DF_01.jpg')) {
        img.src = src.replace('_DF_01.jpg', '_DM_01.jpg');
    } else if (src.includes('_DM_01.jpg')) {
        img.src = src.replace('_DM_01.jpg', '_DG_01.jpg');
    } else {
        img.style.visibility = 'hidden';
    }
}

class SearchApp {
    constructor() {
        this.csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
        this.liveSearchUrl = document.body.dataset.liveSearchUrl;
        
        this.dom = {
            searchInput: document.getElementById('search-query-input'),
            clearTopBtn: document.getElementById('keypad-clear-top'),
            categoryBar: document.getElementById('category-bar'),
            hiddenCategoryInput: document.getElementById('selected-category'),
            keypadContainer: document.getElementById('keypad-container'),
            keypadNum: document.getElementById('keypad-num'),
            keypadKor: document.getElementById('keypad-kor'),
            keypadEng: document.getElementById('keypad-eng'),
            productListUl: document.getElementById('product-list-ul'),
            productListHeader: document.getElementById('product-list-header'),
            paginationUL: document.getElementById('search-pagination'),
            listContainer: document.getElementById('product-list-view'),
            detailContainer: document.getElementById('product-detail-view'),
            detailIframe: document.getElementById('product-detail-iframe'),
            backButton: document.getElementById('btn-back-to-list'),
            searchForm: document.getElementById('search-form'),
            categoryButtons: document.querySelectorAll('.category-btn')
        };

        this.state = {
            debounceTimer: null,
            isKorShiftActive: false
        };

        this.korKeyMap = {'ㅂ':'ㅃ', 'ㅈ':'ㅉ', 'ㄷ':'ㄸ', 'ㄱ':'ㄲ', 'ㅅ':'ㅆ', 'ㅐ':'ㅒ', 'ㅔ':'ㅖ'};
        this.korReverseKeyMap = {'ㅃ':'ㅂ', 'ㅉ':'ㅈ', 'ㄸ':'ㄷ', 'ㄲ':'ㄱ', 'ㅆ':'ㅅ', 'ㅒ':'ㅐ', 'ㅖ':'ㅔ'};

        this.init();
    }

    init() {
        this.checkMobileMode();
        this.bindEvents();
        this.showKeypad('num');
        
        const currentCategory = this.dom.hiddenCategoryInput.value || '전체';
        this.dom.categoryButtons.forEach(btn => {
            if (btn.dataset.category === currentCategory) btn.classList.add('active');
        });
        
        this.performSearch(1);
    }

    checkMobileMode() {
        if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && this.dom.searchInput) {
            this.dom.searchInput.setAttribute('readonly', true);
            this.dom.searchInput.setAttribute('inputmode', 'none');
        }
    }

    bindEvents() {
        if (this.dom.productListUl) {
            this.dom.productListUl.addEventListener('click', (e) => this.handleProductClick(e));
        }
        if (this.dom.backButton) {
            this.dom.backButton.addEventListener('click', () => this.handleBackButtonClick());
        }
        if (this.dom.keypadContainer) {
            this.dom.keypadContainer.addEventListener('click', (e) => this.handleKeypadClick(e));
        }
        if (this.dom.categoryBar) {
            this.dom.categoryBar.addEventListener('click', (e) => this.handleCategoryClick(e));
        }
        if (this.dom.clearTopBtn) {
            this.dom.clearTopBtn.addEventListener('click', () => {
                this.dom.searchInput.value = '';
                this.triggerSearch(true); 
                this.dom.searchInput.focus();
            });
        }
        if (this.dom.searchInput) {
            this.dom.searchInput.addEventListener('input', (e) => {
                if (e.isTrusted && !e.target.readOnly) this.triggerSearch();
            });
            this.dom.searchInput.addEventListener('keydown', (e) => {
                if (e.target.readOnly) return;
                if (e.key === 'Enter') { clearTimeout(this.state.debounceTimer); this.performSearch(1); }
            });
        }
        if (this.dom.searchForm) {
            this.dom.searchForm.addEventListener('submit', (e) => {
                e.preventDefault(); clearTimeout(this.state.debounceTimer); this.performSearch(1);
            });
        }
    }

    handleProductClick(e) {
        const link = e.target.closest('a.product-item');
        if (link && window.innerWidth >= 992) {
            e.preventDefault();
            const targetUrl = link.getAttribute('href');
            const detailUrl = targetUrl + (targetUrl.includes('?') ? '&' : '?') + 'partial=1';
            
            if (this.dom.detailIframe) this.dom.detailIframe.src = detailUrl;
            if (this.dom.listContainer && this.dom.detailContainer) {
                this.dom.listContainer.style.display = 'none';
                this.dom.detailContainer.style.display = 'flex';
            }
        }
    }

    handleBackButtonClick() {
        if (this.dom.listContainer && this.dom.detailContainer) {
            this.dom.listContainer.style.display = 'flex';
            this.dom.detailContainer.style.display = 'none';
        }
        if (this.dom.detailIframe) this.dom.detailIframe.src = 'about:blank';
    }

    handleKeypadClick(e) {
        const key = e.target.closest('.keypad-btn, .qwerty-key');
        if (!key) return;
        const dataKey = key.dataset.key;
        if (!dataKey) return;

        const input = this.dom.searchInput;

        if (dataKey === 'backspace') {
            if (input.value.length > 0) input.value = input.value.slice(0, -1);
            this.triggerSearch();
        } else if (dataKey === 'mode-kor') {
            this.showKeypad('kor');
        } else if (dataKey === 'mode-eng') {
            this.showKeypad('eng');
            this.resetShift();
        } else if (dataKey === 'mode-num') {
            this.showKeypad('num');
            this.resetShift();
        } else if (dataKey === 'shift-kor') {
            this.toggleShift();
        } else if (dataKey === 'shift-eng') {
            // 영문 쉬프트 (추후 구현)
        } else if (dataKey === ' ') {
            input.value += ' ';
            this.triggerSearch();
        } else {
            input.value = Hangul.assemble(input.value + dataKey);
            this.triggerSearch();
        }
        input.focus();
    }

    handleCategoryClick(e) {
        const target = e.target.closest('.category-btn');
        if (!target) return;
        this.dom.categoryButtons.forEach(btn => btn.classList.remove('active'));
        target.classList.add('active');
        this.dom.hiddenCategoryInput.value = target.dataset.category;
        this.performSearch(1);
        this.dom.searchInput.focus();
    }

    showKeypad(mode) {
        this.dom.keypadNum.classList.add('keypad-hidden');
        this.dom.keypadKor.classList.add('keypad-hidden');
        this.dom.keypadEng.classList.add('keypad-hidden');

        if (mode === 'kor') {
            this.dom.keypadKor.classList.remove('keypad-hidden');
            document.body.dataset.inputMode = 'kor';
        } else if (mode === 'eng') {
            this.dom.keypadEng.classList.remove('keypad-hidden');
            document.body.dataset.inputMode = 'eng';
        } else {
            this.dom.keypadNum.classList.remove('keypad-hidden');
            document.body.dataset.inputMode = 'num';
        }
    }

    resetShift() {
        if (this.state.isKorShiftActive) this.toggleShift();
    }

    toggleShift() {
        this.state.isKorShiftActive = !this.state.isKorShiftActive;
        const korShiftBtn = document.querySelector('#keypad-kor [data-key="shift-kor"]');
        
        if (this.state.isKorShiftActive) {
            korShiftBtn.classList.add('active', 'btn-primary');
            korShiftBtn.classList.remove('btn-outline-secondary');
            for (const [base, shifted] of Object.entries(this.korKeyMap)) {
                const el = document.querySelector(`#keypad-kor [data-key="${base}"]`);
                if (el) { el.dataset.key = shifted; el.textContent = shifted; }
            }
        } else {
            korShiftBtn.classList.remove('active', 'btn-primary');
            korShiftBtn.classList.add('btn-outline-secondary');
            for (const [shifted, base] of Object.entries(this.korReverseKeyMap)) {
                const el = document.querySelector(`#keypad-kor [data-key="${shifted}"]`);
                if (el) { el.dataset.key = base; el.textContent = base; }
            }
        }
    }

    triggerSearch(immediate = false) {
        clearTimeout(this.state.debounceTimer);
        if (immediate) this.performSearch(1);
        else this.state.debounceTimer = setTimeout(() => this.performSearch(1), 300);
    }

    async performSearch(page = 1) {
        const query = this.dom.searchInput.value;
        const category = this.dom.hiddenCategoryInput.value;
        
        this.dom.productListUl.innerHTML = '<li class="list-group-item text-center text-muted p-4">검색 중...</li>';
        this.dom.paginationUL.innerHTML = '';

        try {
            const response = await fetch(this.liveSearchUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken },
                body: JSON.stringify({ query, category, page, per_page: 10 })
            });
            const data = await response.json();
            
            if (data.status === 'success') {
                if (this.dom.listContainer && this.dom.detailContainer) {
                    this.dom.listContainer.style.display = 'flex';
                    this.dom.detailContainer.style.display = 'none';
                }
                if (this.dom.detailIframe) this.dom.detailIframe.src = 'about:blank';

                this.renderResults(data.products, data.showing_favorites, data.selected_category);
                this.renderPagination(data.total_pages, data.current_page);
            } else throw new Error(data.message);
        } catch (error) {
            console.error('Search error:', error);
            this.dom.productListUl.innerHTML = '<li class="list-group-item text-center text-danger p-4">오류 발생</li>';
        }
    }

    renderResults(products, showingFavorites, selectedCategory) {
        if (showingFavorites) {
            this.dom.productListHeader.innerHTML = '<i class="bi bi-star-fill me-2 text-warning"></i>즐겨찾기 목록';
        } else {
            const badge = (selectedCategory && selectedCategory !== '전체') ? `<span class="badge bg-success ms-2">${selectedCategory}</span>` : '';
            this.dom.productListHeader.innerHTML = `<i class="bi bi-card-list me-2"></i>상품 검색 결과 ${badge}`;
        }
        
        this.dom.productListUl.innerHTML = '';
        if (products.length === 0) {
            this.dom.productListUl.innerHTML = `<li class="list-group-item text-center text-muted p-4">${showingFavorites ? '즐겨찾기 없음' : '검색 결과 없음'}</li>`;
            return;
        }

        products.forEach(p => {
            const html = `
                <li class="list-group-item">
                    <a href="/product/${p.product_id}" class="product-item d-flex align-items-center text-decoration-none text-body spa-link">
                        <img src="${p.image_url}" alt="${p.product_name}" class="item-image rounded border flex-shrink-0" onerror="imgFallback(this)">
                        <div class="item-details flex-grow-1 ms-3">
                            <div class="product-name fw-bold">${p.product_name}</div>
                            <div class="product-meta small text-muted">
                                <span class="meta-item me-2">${p.product_number}</span>
                                ${p.colors ? `<span class="meta-item d-block d-sm-inline me-2"><i class="bi bi-palette"></i> ${p.colors}</span>` : ''}
                                <span class="meta-item me-2 fw-bold text-dark">${p.sale_price}</span>
                                <span class="meta-item discount ${p.original_price > 0 ? 'text-danger' : 'text-secondary'}">${p.discount}</span>
                            </div>
                        </div>
                    </a>
                </li>`;
            this.dom.productListUl.insertAdjacentHTML('beforeend', html);
        });
    }

    renderPagination(totalPages, currentPage) {
        if (totalPages <= 1) return;
        
        const createItem = (page, text, isActive, isDisabled) => {
            const li = document.createElement('li');
            li.className = `page-item ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`;
            const a = document.createElement('a');
            a.className = 'page-link';
            a.href = '#';
            a.textContent = text;
            if (!isDisabled && !isActive) a.onclick = (e) => { e.preventDefault(); this.performSearch(page); };
            li.appendChild(a);
            return li;
        };

        this.dom.paginationUL.appendChild(createItem(currentPage - 1, '«', false, currentPage === 1));
        
        let start = Math.max(1, currentPage - 2);
        let end = Math.min(totalPages, currentPage + 2);
        if (end - start < 4) {
            if (start === 1) end = Math.min(totalPages, start + 4);
            else if (end === totalPages) start = Math.max(1, end - 4);
        }

        for (let i = start; i <= end; i++) {
            this.dom.paginationUL.appendChild(createItem(i, i, i === currentPage, false));
        }
        
        this.dom.paginationUL.appendChild(createItem(currentPage + 1, '»', false, currentPage === totalPages));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('search-query-input')) new SearchApp();
});