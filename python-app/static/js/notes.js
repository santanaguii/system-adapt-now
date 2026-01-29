// =============================================
// MEU SISTEMA - Notes Editor JavaScript
// =============================================

class NotesEditor {
    constructor() {
        this.currentDate = new Date();
        this.lines = [];
        this.history = [];
        this.historyIndex = -1;
        this.saveTimeout = null;
        this.allDates = [];
        
        this.init();
    }
    
    async init() {
        await this.loadDates();
        await this.loadNote();
        this.bindEvents();
        this.updateDateDisplay();
    }
    
    // Data loading
    async loadDates() {
        try {
            const data = await api.get('/api/notes/dates');
            this.allDates = data.dates || [];
            this.renderNotesList();
        } catch (err) {
            console.error('Failed to load dates:', err);
        }
    }
    
    async loadNote() {
        const dateStr = dateUtils.format(this.currentDate, 'iso');
        try {
            const data = await api.get(`/api/notes/${dateStr}`);
            this.lines = data.lines || [this.createLine()];
            this.renderEditor();
            this.saveHistory();
        } catch (err) {
            console.error('Failed to load note:', err);
            this.lines = [this.createLine()];
            this.renderEditor();
        }
    }
    
    // Rendering
    renderEditor() {
        const container = document.getElementById('editorContent');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Calculate visible lines (respecting collapse)
        const visibleLines = this.getVisibleLines();
        
        visibleLines.forEach(line => {
            const el = this.createLineElement(line);
            container.appendChild(el);
        });
    }
    
    getVisibleLines() {
        const visible = [];
        let skipUntilLevel = null;
        
        for (const line of this.lines) {
            const level = this.getLineLevel(line.type);
            
            if (skipUntilLevel !== null) {
                if (level <= skipUntilLevel) {
                    skipUntilLevel = null;
                } else {
                    continue;
                }
            }
            
            visible.push(line);
            
            if (line.collapsed && (line.type === 'title' || line.type === 'subtitle')) {
                skipUntilLevel = level;
            }
        }
        
        return visible;
    }
    
    getLineLevel(type) {
        switch (type) {
            case 'title': return 1;
            case 'subtitle': return 2;
            default: return 3;
        }
    }
    
    hasChildren(line) {
        const lineIndex = this.lines.findIndex(l => l.id === line.id);
        const lineLevel = this.getLineLevel(line.type);
        
        for (let i = lineIndex + 1; i < this.lines.length; i++) {
            const nextLevel = this.getLineLevel(this.lines[i].type);
            if (nextLevel <= lineLevel) break;
            if (nextLevel > lineLevel) return true;
        }
        return false;
    }
    
    createLineElement(line) {
        const div = document.createElement('div');
        div.className = `editor-line indent-${line.indent || 0}`;
        div.dataset.id = line.id;
        
        // Collapse toggle for titles/subtitles
        if ((line.type === 'title' || line.type === 'subtitle') && this.hasChildren(line)) {
            const toggle = document.createElement('span');
            toggle.className = `collapse-toggle ${line.collapsed ? 'collapsed' : ''}`;
            toggle.textContent = '▼';
            toggle.addEventListener('click', () => this.toggleCollapse(line.id));
            div.appendChild(toggle);
        } else {
            const spacer = document.createElement('span');
            spacer.style.width = '1.25rem';
            spacer.style.flexShrink = '0';
            div.appendChild(spacer);
        }
        
        // Content
        const content = document.createElement('div');
        content.className = `editor-line-content line-${line.type}`;
        content.contentEditable = 'true';
        content.textContent = line.content;
        content.dataset.placeholder = this.getPlaceholder(line.type);
        
        // Events
        content.addEventListener('input', () => this.onLineInput(line.id, content.textContent));
        content.addEventListener('keydown', (e) => this.onLineKeyDown(e, line.id));
        content.addEventListener('focus', () => this.onLineFocus(line.id));
        
        div.appendChild(content);
        return div;
    }
    
    getPlaceholder(type) {
        switch (type) {
            case 'title': return 'Título...';
            case 'subtitle': return 'Subtítulo...';
            case 'quote': return 'Citação...';
            case 'bullet': return 'Tópico...';
            default: return 'Digite algo...';
        }
    }
    
    renderNotesList() {
        const container = document.getElementById('notesList');
        if (!container) return;
        
        container.innerHTML = '';
        const currentDateStr = dateUtils.format(this.currentDate, 'iso');
        
        this.allDates.forEach(dateStr => {
            const item = document.createElement('div');
            item.className = `note-item ${dateStr === currentDateStr ? 'active' : ''}`;
            
            const date = new Date(dateStr + 'T12:00:00');
            item.innerHTML = `
                <div class="note-item-date">${dateUtils.format(date, 'short')}</div>
            `;
            
            item.addEventListener('click', () => {
                this.currentDate = date;
                this.loadNote();
                this.updateDateDisplay();
                this.renderNotesList();
            });
            
            container.appendChild(item);
        });
    }
    
    updateDateDisplay() {
        const dateEl = document.getElementById('currentDate');
        const todayBadge = document.getElementById('todayBadge');
        
        if (dateEl) {
            dateEl.textContent = dateUtils.format(this.currentDate, 'display');
        }
        
        if (todayBadge) {
            todayBadge.style.display = dateUtils.isToday(this.currentDate) ? '' : 'none';
        }
    }
    
    // Line operations
    createLine(type = 'paragraph') {
        return {
            id: this.generateId(),
            content: '',
            type: type,
            collapsed: false,
            indent: 0
        };
    }
    
    generateId() {
        return 'line_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    onLineInput(lineId, content) {
        const line = this.lines.find(l => l.id === lineId);
        if (line) {
            line.content = content;
            this.scheduleSave();
        }
    }
    
    onLineFocus(lineId) {
        // Could track focused line for navigation
    }
    
    onLineKeyDown(e, lineId) {
        const line = this.lines.find(l => l.id === lineId);
        const lineIndex = this.lines.findIndex(l => l.id === lineId);
        
        // Enter - new line
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const newLine = this.createLine();
            this.lines.splice(lineIndex + 1, 0, newLine);
            this.saveHistory();
            this.renderEditor();
            this.scheduleSave();
            
            // Focus new line
            setTimeout(() => {
                const newEl = document.querySelector(`[data-id="${newLine.id}"] .editor-line-content`);
                if (newEl) newEl.focus();
            }, 10);
        }
        
        // Backspace on empty line
        if (e.key === 'Backspace' && line.content === '' && this.lines.length > 1) {
            e.preventDefault();
            const prevLine = this.lines[lineIndex - 1];
            this.lines.splice(lineIndex, 1);
            this.saveHistory();
            this.renderEditor();
            this.scheduleSave();
            
            if (prevLine) {
                setTimeout(() => {
                    const prevEl = document.querySelector(`[data-id="${prevLine.id}"] .editor-line-content`);
                    if (prevEl) prevEl.focus();
                }, 10);
            }
        }
        
        // Arrow navigation
        if (e.key === 'ArrowUp') {
            const visibleLines = this.getVisibleLines();
            const visIdx = visibleLines.findIndex(l => l.id === lineId);
            if (visIdx > 0) {
                const prevLine = visibleLines[visIdx - 1];
                const prevEl = document.querySelector(`[data-id="${prevLine.id}"] .editor-line-content`);
                if (prevEl) prevEl.focus();
            }
        }
        
        if (e.key === 'ArrowDown') {
            const visibleLines = this.getVisibleLines();
            const visIdx = visibleLines.findIndex(l => l.id === lineId);
            if (visIdx < visibleLines.length - 1) {
                const nextLine = visibleLines[visIdx + 1];
                const nextEl = document.querySelector(`[data-id="${nextLine.id}"] .editor-line-content`);
                if (nextEl) nextEl.focus();
            }
        }
        
        // Tab - indent
        if (e.key === 'Tab') {
            e.preventDefault();
            if (e.shiftKey) {
                line.indent = Math.max(0, (line.indent || 0) - 1);
            } else {
                line.indent = Math.min(4, (line.indent || 0) + 1);
            }
            this.saveHistory();
            this.renderEditor();
            this.scheduleSave();
            
            // Refocus
            setTimeout(() => {
                const el = document.querySelector(`[data-id="${lineId}"] .editor-line-content`);
                if (el) el.focus();
            }, 10);
        }
        
        // Ctrl shortcuts for line types
        if (e.ctrlKey || e.metaKey) {
            let newType = null;
            switch (e.key) {
                case '1': newType = 'title'; break;
                case '2': newType = 'subtitle'; break;
                case '3': newType = 'quote'; break;
                case '4': newType = 'bullet'; break;
                case '0': newType = 'paragraph'; break;
                case 'z':
                    if (!e.shiftKey) {
                        e.preventDefault();
                        this.undo();
                        return;
                    }
                    break;
                case 'y':
                    e.preventDefault();
                    this.redo();
                    return;
            }
            
            if (newType) {
                e.preventDefault();
                line.type = newType;
                this.saveHistory();
                this.renderEditor();
                this.scheduleSave();
                
                // Refocus
                setTimeout(() => {
                    const el = document.querySelector(`[data-id="${lineId}"] .editor-line-content`);
                    if (el) el.focus();
                }, 10);
            }
        }
    }
    
    toggleCollapse(lineId) {
        const line = this.lines.find(l => l.id === lineId);
        if (line) {
            line.collapsed = !line.collapsed;
            this.renderEditor();
            this.scheduleSave();
        }
    }
    
    // History (Undo/Redo)
    saveHistory() {
        // Remove future history if we're in the middle
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        // Save current state
        this.history.push(JSON.stringify(this.lines));
        this.historyIndex = this.history.length - 1;
        
        // Limit history
        if (this.history.length > 50) {
            this.history.shift();
            this.historyIndex--;
        }
        
        this.updateHistoryButtons();
    }
    
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.lines = JSON.parse(this.history[this.historyIndex]);
            this.renderEditor();
            this.scheduleSave();
            this.updateHistoryButtons();
        }
    }
    
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.lines = JSON.parse(this.history[this.historyIndex]);
            this.renderEditor();
            this.scheduleSave();
            this.updateHistoryButtons();
        }
    }
    
    updateHistoryButtons() {
        const undoBtn = document.getElementById('btnUndo');
        const redoBtn = document.getElementById('btnRedo');
        
        if (undoBtn) undoBtn.disabled = this.historyIndex <= 0;
        if (redoBtn) redoBtn.disabled = this.historyIndex >= this.history.length - 1;
    }
    
    // Saving
    scheduleSave() {
        if (this.saveTimeout) clearTimeout(this.saveTimeout);
        
        this.updateSaveStatus('saving');
        
        this.saveTimeout = setTimeout(() => {
            this.saveNote();
        }, 1000);
    }
    
    async saveNote() {
        const dateStr = dateUtils.format(this.currentDate, 'iso');
        try {
            await api.put(`/api/notes/${dateStr}`, { lines: this.lines });
            this.updateSaveStatus('saved');
            
            // Update dates list if new date
            if (!this.allDates.includes(dateStr)) {
                this.allDates.unshift(dateStr);
                this.renderNotesList();
            }
        } catch (err) {
            console.error('Failed to save note:', err);
            this.updateSaveStatus('error');
        }
    }
    
    updateSaveStatus(status) {
        const el = document.getElementById('saveStatus');
        if (!el) return;
        
        el.className = '';
        switch (status) {
            case 'saving':
                el.textContent = '⏳ Salvando...';
                el.className = 'save-status-saving';
                break;
            case 'saved':
                el.textContent = '✓ Salvo';
                el.className = 'save-status-saved';
                break;
            case 'error':
                el.textContent = '⚠ Erro ao salvar';
                el.className = 'save-status-error';
                break;
        }
    }
    
    // Navigation
    goToDate(date) {
        this.currentDate = new Date(date);
        this.loadNote();
        this.updateDateDisplay();
        this.renderNotesList();
    }
    
    prevDay() {
        this.currentDate = dateUtils.addDays(this.currentDate, -1);
        this.loadNote();
        this.updateDateDisplay();
        this.renderNotesList();
    }
    
    nextDay() {
        this.currentDate = dateUtils.addDays(this.currentDate, 1);
        this.loadNote();
        this.updateDateDisplay();
        this.renderNotesList();
    }
    
    goToToday() {
        this.currentDate = new Date();
        this.loadNote();
        this.updateDateDisplay();
        this.renderNotesList();
    }
    
    // Search
    async search(query) {
        if (!query.trim()) return [];
        
        try {
            const data = await api.get(`/api/notes/search/${encodeURIComponent(query)}`);
            return data.results || [];
        } catch (err) {
            console.error('Search failed:', err);
            return [];
        }
    }
    
    // Events
    bindEvents() {
        // Navigation buttons
        document.getElementById('btnPrevDay')?.addEventListener('click', () => this.prevDay());
        document.getElementById('btnNextDay')?.addEventListener('click', () => this.nextDay());
        document.getElementById('btnTodayNote')?.addEventListener('click', () => this.goToToday());
        
        // Undo/Redo buttons
        document.getElementById('btnUndo')?.addEventListener('click', () => this.undo());
        document.getElementById('btnRedo')?.addEventListener('click', () => this.redo());
        
        // Calendar button
        document.getElementById('btnCalendar')?.addEventListener('click', () => {
            this.openCalendar();
        });
        
        // Search
        const searchInput = document.getElementById('notesSearch');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(async () => {
                    const results = await this.search(e.target.value);
                    this.renderSearchResults(results);
                }, 300);
            });
        }
        
        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                // Undo is handled in line keydown
            }
        });
    }
    
    openCalendar() {
        modals.open('calendarModal');
        this.renderCalendar();
    }
    
    renderCalendar() {
        const container = document.getElementById('calendar');
        if (!container) return;
        
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const today = new Date();
        
        const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                       'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();
        
        let html = `
            <div class="calendar-header">
                <button class="btn btn-ghost btn-icon" id="calPrev">◀</button>
                <span>${months[month]} ${year}</span>
                <button class="btn btn-ghost btn-icon" id="calNext">▶</button>
            </div>
            <div class="calendar-grid">
        `;
        
        // Day names
        days.forEach(day => {
            html += `<div class="calendar-day-name">${day}</div>`;
        });
        
        // Previous month days
        for (let i = firstDay - 1; i >= 0; i--) {
            const day = daysInPrevMonth - i;
            html += `<div class="calendar-day other-month">${day}</div>`;
        }
        
        // Current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateStr = dateUtils.format(date, 'iso');
            const isToday = date.toDateString() === today.toDateString();
            const isSelected = date.toDateString() === this.currentDate.toDateString();
            const hasNote = this.allDates.includes(dateStr);
            
            let classes = 'calendar-day';
            if (isToday) classes += ' today';
            if (isSelected) classes += ' selected';
            if (hasNote) classes += ' has-note';
            
            html += `<div class="${classes}" data-date="${dateStr}">${day}</div>`;
        }
        
        // Next month days
        const remaining = 42 - (firstDay + daysInMonth);
        for (let day = 1; day <= remaining; day++) {
            html += `<div class="calendar-day other-month">${day}</div>`;
        }
        
        html += '</div>';
        container.innerHTML = html;
        
        // Bind events
        document.getElementById('calPrev')?.addEventListener('click', () => {
            this.currentDate = new Date(year, month - 1, 1);
            this.renderCalendar();
        });
        
        document.getElementById('calNext')?.addEventListener('click', () => {
            this.currentDate = new Date(year, month + 1, 1);
            this.renderCalendar();
        });
        
        container.querySelectorAll('.calendar-day[data-date]').forEach(el => {
            el.addEventListener('click', () => {
                this.goToDate(el.dataset.date);
                modals.close('calendarModal');
            });
        });
    }
    
    renderSearchResults(results) {
        // Could show in a dropdown or update notes list
        if (results.length === 0) {
            this.renderNotesList();
        } else {
            const container = document.getElementById('notesList');
            if (!container) return;
            
            container.innerHTML = '';
            results.forEach(result => {
                const item = document.createElement('div');
                item.className = 'note-item';
                const date = new Date(result.date + 'T12:00:00');
                item.innerHTML = `
                    <div class="note-item-date">${dateUtils.format(date, 'short')}</div>
                    <div class="note-item-preview">${result.lines[0]?.content || ''}</div>
                `;
                item.addEventListener('click', () => {
                    this.goToDate(result.date);
                });
                container.appendChild(item);
            });
        }
    }
}

// Initialize
let notesEditor;
document.addEventListener('DOMContentLoaded', () => {
    notesEditor = new NotesEditor();
});
