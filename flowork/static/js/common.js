// [수정] const 선언 제거 및 window 객체 직접 할당 (중복 로드 방지)
if (!window.Flowork) {
    window.Flowork = {
        getCsrfToken: () => {
            const meta = document.querySelector('meta[name="csrf-token"]');
            return meta ? meta.getAttribute('content') : '';
        },

        api: async (url, options = {}) => {
            const defaults = {
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': window.Flowork.getCsrfToken(),
                    'X-Requested-With': 'XMLHttpRequest'
                }
            };
            
            const settings = { ...defaults, ...options };
            if (options.headers) {
                settings.headers = { ...defaults.headers, ...options.headers };
            }

            try {
                const response = await fetch(url, settings);
                
                // Content-Type 확인하여 JSON 파싱 시도
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    const data = await response.json();
                    if (!response.ok) {
                        throw new Error(data.message || `Server Error: ${response.status}`);
                    }
                    return data;
                } else {
                    // JSON이 아닌 응답(404 HTML 등) 처리
                    if (!response.ok) {
                        throw new Error(`Server Error: ${response.status} (${response.statusText})`);
                    }
                    return await response.text();
                }
            } catch (error) {
                console.error("API Error:", error);
                window.Flowork.toast(error.message, 'danger');
                throw error;
            }
        },

        get: async (url) => {
            return await window.Flowork.api(url, { method: 'GET' });
        },

        post: async (url, body) => {
            return await window.Flowork.api(url, {
                method: 'POST',
                body: JSON.stringify(body)
            });
        },

        fmtNum: (num) => {
            return (num || 0).toLocaleString();
        },

        fmtDate: (dateObj) => {
            if (!dateObj) dateObj = new Date();
            if (typeof dateObj === 'string') dateObj = new Date(dateObj);
            
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        },

        toast: (message, type = 'success') => {
            const container = document.getElementById('toast-container');
            if (!container) return alert(message);

            const id = 'toast_' + Date.now();
            const icon = type === 'success' ? 'check-circle-fill' : (type === 'danger' ? 'exclamation-circle-fill' : 'info-circle-fill');
            const color = type === 'success' ? 'text-success' : (type === 'danger' ? 'text-danger' : 'text-info');

            const html = `
                <div id="${id}" class="toast align-items-center border-0" role="alert" aria-live="assertive" aria-atomic="true">
                    <div class="d-flex">
                        <div class="toast-body d-flex align-items-center">
                            <i class="bi bi-${icon} ${color} fs-5 me-2"></i>
                            <span>${message}</span>
                        </div>
                        <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                    </div>
                </div>
            `;
            
            container.insertAdjacentHTML('beforeend', html);
            const toastEl = document.getElementById(id);
            
            if (typeof bootstrap !== 'undefined') {
                const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
                toast.show();
                toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
            } else {
                setTimeout(() => toastEl.remove(), 3000);
            }
        }
    };
}