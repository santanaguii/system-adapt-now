// =============================================
// MEU SISTEMA - Main JavaScript
// =============================================

// API helper
const api = {
    async get(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
    },
    
    async post(url, data) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
    },
    
    async patch(url, data) {
        const res = await fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
    },
    
    async put(url, data) {
        const res = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
    },
    
    async delete(url) {
        const res = await fetch(url, { method: 'DELETE' });
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
    }
};

// Date formatting
const dateUtils = {
    format(date, format = 'display') {
        const d = new Date(date);
        const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
                       'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
        const monthsShort = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
                            'jul', 'ago', 'set', 'out', 'nov', 'dez'];
        
        switch(format) {
            case 'iso':
                return d.toISOString().split('T')[0];
            case 'display':
                return `${d.getDate()} de ${months[d.getMonth()]}, ${d.getFullYear()}`;
            case 'short':
                return `${d.getDate()} ${monthsShort[d.getMonth()]}`;
            default:
                return d.toLocaleDateString('pt-BR');
        }
    },
    
    isToday(date) {
        const today = new Date();
        const d = new Date(date);
        return d.toDateString() === today.toDateString();
    },
    
    addDays(date, days) {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        return d;
    }
};

// Modal management
const modals = {
    open(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    },
    
    close(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    },
    
    init() {
        // Close on backdrop click
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.addEventListener('click', () => {
                const modal = backdrop.closest('.modal');
                if (modal) modal.classList.remove('active');
                document.body.style.overflow = '';
            });
        });
        
        // Close on button click
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                const modal = btn.closest('.modal');
                if (modal) modal.classList.remove('active');
                document.body.style.overflow = '';
            });
        });
        
        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal.active').forEach(modal => {
                    modal.classList.remove('active');
                });
                document.body.style.overflow = '';
            }
        });
    }
};

// Panel resizing
const resizer = {
    init() {
        const resizer1 = document.getElementById('resizer1');
        const resizer2 = document.getElementById('resizer2');
        const sidebar = document.getElementById('notesSidebar');
        const activities = document.getElementById('activitiesPanel');
        
        if (resizer1 && sidebar) {
            this.makeResizable(resizer1, sidebar, 'left');
        }
        
        if (resizer2 && activities) {
            this.makeResizable(resizer2, activities, 'right');
        }
    },
    
    makeResizable(resizerEl, panel, side) {
        let startX, startWidth;
        
        const startResize = (e) => {
            startX = e.clientX;
            startWidth = panel.offsetWidth;
            document.addEventListener('mousemove', resize);
            document.addEventListener('mouseup', stopResize);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        };
        
        const resize = (e) => {
            const diff = e.clientX - startX;
            const newWidth = side === 'left' 
                ? startWidth + diff 
                : startWidth - diff;
            
            const minWidth = parseInt(getComputedStyle(panel).minWidth) || 180;
            const maxWidth = parseInt(getComputedStyle(panel).maxWidth) || 500;
            
            if (newWidth >= minWidth && newWidth <= maxWidth) {
                panel.style.width = newWidth + 'px';
            }
        };
        
        const stopResize = () => {
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', stopResize);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
        
        resizerEl.addEventListener('mousedown', startResize);
    }
};

// Tab management
const tabs = {
    init() {
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.dataset.tab;
                const parent = tab.closest('.modal-body, .panel');
                
                // Update tab buttons
                parent.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Update tab content
                parent.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                const content = document.getElementById('tab' + tabId.charAt(0).toUpperCase() + tabId.slice(1));
                if (content) content.classList.add('active');
            });
        });
    }
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    modals.init();
    resizer.init();
    tabs.init();
});

// Export for use in other modules
window.api = api;
window.dateUtils = dateUtils;
window.modals = modals;
