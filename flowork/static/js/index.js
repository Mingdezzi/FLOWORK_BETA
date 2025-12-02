class SearchApp {
    constructor() {
        this.container = document.querySelector('.search-container:not([data-initialized])');
        if (!this.container) return;
        this.container.dataset.initialized = "true";

        const csrfMeta = document.querySelector('meta[name="csrf-token"]');
        this.csrfToken = csrfMeta ? csrfMeta.getAttribute('content') : '';
        this.liveSearchUrl = this.container.dataset.liveSearchUrl;
        
        this.dom = {
            searchInput: this.container.querySelector('#search-query-input'),
            clearTopBtn: this.container.querySelector('#keypad-clear-top'),
            hiddenCategoryInput: this.container.querySelector('#selected-category'),
            keypadContainer: this.container.querySelector('#keypad-container'),
            keypadNum: this.container.querySelector('#keypad-num'),
            keypadKor: this.container.querySelector('#keypad-kor'),
            keypadEng: this.container.querySelector('#keypad-eng'),
            productListUl: this.container.querySelector('#product-list-ul'),
            productListHeader: this.container.querySelector('#product-list-header'),
            paginationUL: this.container.querySelector('#search-pagination'),
            listContainer: this.container.querySelector('#product-list-view'),
            detailContainer: this.container.querySelector('#product-detail-view'),
            detailIframe: this.container.querySelector('#product-detail-iframe'),
            backButton: this.container.querySelector('#btn-back-to-list'),
            searchForm: this.container.querySelector('#search-form'),
            categoryButtons: this.container.querySelectorAll('.category-btn')
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
        
        if (this.dom.hiddenCategoryInput) {
            const currentCategory = this.dom.hiddenCategoryInput.value || '전체';
            this.dom.categoryButtons.forEach(btn => {
                if (btn.dataset.category === currentCategory) btn.classList.add('active');
            });
        }
        this.performSearch(1);
    }

    checkMobileMode() {
        if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && this.dom.searchInput) {
            this.dom.searchInput.setAttribute('readonly', true);
            this.dom.searchInput.setAttribute('inputmode', 'none');
        }
    }

    bindEvents() {
        if (this.dom.keypadContainer) {
            this.dom.keypadContainer.addEventListener('click', (e) => this.handleKeypadClick(e));
        }
        this.dom.categoryButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.handleCategoryClick(e));
        });
        if (this.dom.clearTopBtn) {
            this.dom.clearTopBtn.addEventListener('click', () => {
                this.dom.searchInput.value = '';
                this.triggerSearch(true); 
                this.dom.searchInput.focus();
            });
        }
        if (this.dom.searchInput) {
            this.dom.searchInput.addEventListener('input', (e) => {
                if (!this.dom.searchInput.readOnly) this.triggerSearch();
            });
            this.dom.searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { 
                    e.preventDefault(); 
                    clearTimeout(this.state.debounceTimer); 
                    this.performSearch(1); 
                }
            });
        }
        if (this.dom.searchForm) {
            this.dom.searchForm.addEventListener('submit', (e) => {
                e.preventDefault(); 
            });
        }
        // [수정] 리스트 클릭 시 이벤트 캡처링
        if (this.dom.productListUl) {
            this.dom.productListUl.addEventListener('click', (e) => this.handleProductClick(e));
        }
        if (this.dom.backButton) {
            this.dom.backButton.addEventListener('click', () => this.handleBackButtonClick());
        }
    }

    handleKeypadClick(e) {
        const btn = e.target.closest('button.keypad-btn, button.qwerty-key');
        if (!btn) return;
        e.preventDefault();
        const key = btn.dataset.key;
        if (!key) return;
        const input = this.dom.searchInput;

        switch (key) {
            case 'backspace': this.handleBackspace(input); break;
            case 'mode-kor': this.showKeypad('kor'); break;
            case 'mode-eng': this.showKeypad('eng'); this.resetShift(); break;
            case 'mode-num': this.showKeypad('num'); this.resetShift(); break;
            case 'shift-kor': this.toggleShiftKor(); break;
            case 'shift-eng': break;
            case ' ': input.value += ' '; this.triggerSearch(); break;
            default: this.handleInputChar(input, key); break;
        }
    }

    handleInputChar(input, char) {
        if (window.Hangul && this.dom.keypadKor && !this.dom.keypadKor.classList.contains('keypad-hidden')) {
            input.value = Hangul.assemble(input.value + char);
        } else {
            input.value += char;
        }
        this.triggerSearch();
    }

    handleBackspace(input) {
        if (input.value.length > 0) {
            if (window.Hangul) {
                let disassembled = Hangul.d(input.value);
                disassembled.pop();
                input.value = Hangul.a(disassembled);
            } else {
                input.value = input.value.slice(0, -1);
            }
            this.triggerSearch();
        }
    }

    showKeypad(mode) {
        if(this.dom.keypadNum) this.dom.keypadNum.classList.add('keypad-hidden');
        if(this.dom.keypadKor) this.dom.keypadKor.classList.add('keypad-hidden');
        if(this.dom.keypadEng) this.dom.keypadEng.classList.add('keypad-hidden');

        if (mode === 'kor' && this.dom.keypadKor) this.dom.keypadKor.classList.remove('keypad-hidden');
        else if (mode === 'eng' && this.dom.keypadEng) this.dom.keypadEng.classList.remove('keypad-hidden');
        else if (this.dom.keypadNum) this.dom.keypadNum.classList.remove('keypad-hidden');
    }

    toggleShiftKor() {
        this.state.isKorShiftActive = !this.state.isKorShiftActive;
        const shiftBtn = this.dom.keypadKor.querySelector('[data-key="shift-kor"]');
        if (shiftBtn) {
            shiftBtn.classList.toggle('active', this.state.isKorShiftActive);
            shiftBtn.classList.toggle('btn-primary', this.state.isKorShiftActive);
            shiftBtn.classList.toggle('btn-outline-secondary', !this.state.isKorShiftActive);
        }
        const mapToUse = this.state.isKorShiftActive ? this.korKeyMap : this.korReverseKeyMap;
        for (const [fromKey, toKey] of Object.entries(mapToUse)) {
            const btn = this.dom.keypadKor.querySelector(`[data-key="${fromKey}"]`);
            if (btn) {
                btn.dataset.key = toKey;
                btn.textContent = toKey;
            }
        }
    }

    resetShift() {
        if (this.state.isKorShiftActive) this.toggleShiftKor();
    }

    handleCategoryClick(e) {
        const btn = e.currentTarget;
        this.dom.categoryButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (this.dom.hiddenCategoryInput) this.dom.hiddenCategoryInput.value = btn.dataset.category;
        this.performSearch(1);
    }

    triggerSearch(immediate = false) {
        if (this.state.debounceTimer) clearTimeout(this.state.debounceTimer);
        if (immediate) this.performSearch(1);
        else this.state.debounceTimer = setTimeout(() => this.performSearch(1), 300);
    }

    async performSearch(page = 1) {
        const query = this.dom.searchInput ? this.dom.searchInput.value : '';
        const category = this.dom.hiddenCategoryInput ? this.dom.hiddenCategoryInput.value : '전체';
        
        if (this.dom.productListUl) this.dom.productListUl.innerHTML = '<li class="list-group-item text-center text-muted p-4">검색 중...</li>';
        if (this.dom.paginationUL) this.dom.paginationUL.innerHTML = '';

        try {
            const response = await fetch(this.liveSearchUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken },
                body: JSON.stringify({ query, category, page, per_page: 10 })
            });
            const data = await response.json();
            
            if (data.status === 'success') {
                // [수정] 검색 시 상세 화면 닫고 리스트 화면으로 복귀 (우측 패널 초기화)
                if (this.dom.listContainer && this.dom.detailContainer) {
                    this.dom.listContainer.style.display = 'flex';
                    this.dom.detailContainer.style.display = 'none';
                }
                if (this.dom.detailIframe) this.dom.detailIframe.src = 'about:blank';

                this.renderResults(data.products, data.showing_favorites, data.selected_category);
                this.renderPagination(data.total_pages, data.current_page);
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Search error:', error);
            if (this.dom.productListUl) this.dom.productListUl.innerHTML = '<li class="list-group-item text-center text-danger p-4">검색 오류가 발생했습니다.</li>';
        }
    }

    renderResults(products, showingFavorites, selectedCategory) {
        if (this.dom.productListHeader) {
            if (showingFavorites) {
                this.dom.productListHeader.innerHTML = '<i class="bi bi-star-fill me-2 text-warning"></i>즐겨찾기';
            } else {
                const badge = (selectedCategory && selectedCategory !== '전체') ? `<span class="badge bg-success ms-2">${selectedCategory}</span>` : '';
                this.dom.productListHeader.innerHTML = `<i class="bi bi-card-list me-2"></i>검색 결과 ${badge}`;
            }
        }
        
        const ul = this.dom.productListUl;
        if (!ul) return;
        
        ul.innerHTML = '';
        if (!products || products.length === 0) {
            ul.innerHTML = `<li class="list-group-item text-center text-muted p-4">${showingFavorites ? '즐겨찾기 상품이 없습니다.' : '검색된 상품이 없습니다.'}</li>`;
            return;
        }

        products.forEach(p => {
            // [수정] spa-link 제거: index.js에서 직접 클릭 이벤트 처리
            const html = `
                <li class="list-group-item p-0">
                    <a href="/product/${p.product_id}" class="product-item d-flex align-items-center text-decoration-none text-body p-3">
                        <img src="${p.image_url}" alt="${p.product_name}" class="item-image rounded border flex-shrink-0" onerror="imgFallback(this)">
                        <div class="item-details flex-grow-1 ms-3 overflow-hidden">
                            <div class="product-name fw-bold text-truncate">${p.product_name}</div>
                            <div class="product-meta small text-muted d-flex align-items-center">
                                <span class="meta-item me-2">${p.product_number}</span>
                                ${p.colors ? `<span class="meta-item text-truncate d-none d-sm-inline me-2" style="max-width:100px;">| ${p.colors}</span>` : ''}
                            </div>
                            <div class="d-flex align-items-center mt-1">
                                <span class="meta-item me-2 fw-bold text-dark">${p.sale_price}</span>
                                <span class="meta-item discount small fw-bold ${p.original_price > 0 ? 'text-danger' : 'text-secondary'}">${p.discount}</span>
                            </div>
                        </div>
                    </a>
                </li>`;
            ul.insertAdjacentHTML('beforeend', html);
        });
    }

    renderPagination(totalPages, currentPage) {
        const ul = this.dom.paginationUL;
        if (!ul || totalPages <= 1) return;
        
        const createItem = (page, text, isActive, isDisabled) => {
            const li = document.createElement('li');
            li.className = `page-item ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`;
            const a = document.createElement('a');
            a.className = 'page-link shadow-none border-0 text-secondary';
            a.href = '#';
            a.innerHTML = text;
            if (!isDisabled && !isActive) {
                a.onclick = (e) => { e.preventDefault(); this.performSearch(page); };
            }
            li.appendChild(a);
            return li;
        };

        ul.appendChild(createItem(currentPage - 1, '&laquo;', false, currentPage === 1));
        
        let start = Math.max(1, currentPage - 1);
        let end = Math.min(totalPages, currentPage + 1);

        if(start > 1) ul.appendChild(createItem(1, '1', false, false));
        if(start > 2) ul.appendChild(createItem(null, '...', false, true));

        for (let i = start; i <= end; i++) {
            ul.appendChild(createItem(i, i, i === currentPage, false));
        }
        
        if(end < totalPages - 1) ul.appendChild(createItem(null, '...', false, true));
        if(end < totalPages) ul.appendChild(createItem(totalPages, totalPages, false, false));
        
        ul.appendChild(createItem(currentPage + 1, '&raquo;', false, currentPage === totalPages));
    }

    // [중요] 상세 페이지 처리: 우측 패널(iframe)에 표시하고 새 탭 방지
    handleProductClick(e) {
        const link = e.target.closest('a.product-item');
        if (!link) return;
        
        // 데스크탑(992px 이상)에서는 우측 iframe에 표시
        if (window.innerWidth >= 992) {
            e.preventDefault();
            e.stopPropagation(); // [중요] base.html의 글로벌 리스너 전파 차단
            const targetUrl = link.getAttribute('href');
            const detailUrl = targetUrl + (targetUrl.includes('?') ? '&' : '?') + 'partial=1';
            
            if (this.dom.detailIframe) this.dom.detailIframe.src = detailUrl;
            if (this.dom.listContainer && this.dom.detailContainer) {
                this.dom.listContainer.style.display = 'none';
                this.dom.detailContainer.style.display = 'flex';
            }
        }
        // 모바일에서는 기본 동작(페이지 이동)을 허용하거나 별도 로직
    }

    handleBackButtonClick() {
        if (this.dom.listContainer && this.dom.detailContainer) {
            this.dom.listContainer.style.display = 'flex';
            this.dom.detailContainer.style.display = 'none';
        }
        if (this.dom.detailIframe) this.dom.detailIframe.src = 'about:blank';
    }
}

const initSearch = () => {
    if (document.querySelector('.search-container')) new SearchApp();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSearch);
} else {
    initSearch();
}