// =============================================
// MEU SISTEMA - Activities JavaScript
// =============================================

class ActivitiesManager {
    constructor() {
        this.activities = [];
        this.tags = [];
        this.customFields = [];
        this.settings = {
            allowReopenCompleted: true,
            activityCreationMode: 'simple',
            defaultSort: 'manual'
        };
        this.activeTagFilter = null;
        this.showCompleted = false;
        this.sortable = null;
        
        this.init();
    }
    
    async init() {
        await this.loadSettings();
        await this.loadActivities();
        this.bindEvents();
        this.initDragDrop();
    }
    
    // Data loading
    async loadSettings() {
        try {
            const data = await api.get('/api/settings');
            this.settings = {
                allowReopenCompleted: data.allowReopenCompleted ?? true,
                activityCreationMode: data.activityCreationMode ?? 'simple',
                defaultSort: data.defaultSort ?? 'manual'
            };
            this.tags = data.tags || [];
            this.customFields = data.customFields || [];
            
            this.renderTagsFilter();
            this.updateSettingsUI();
        } catch (err) {
            console.error('Failed to load settings:', err);
        }
    }
    
    async loadActivities() {
        try {
            const data = await api.get('/api/activities');
            this.activities = data.activities || [];
            this.renderActivities();
        } catch (err) {
            console.error('Failed to load activities:', err);
        }
    }
    
    // Rendering
    renderActivities() {
        const container = document.getElementById('activitiesList');
        if (!container) return;
        
        let filtered = [...this.activities];
        
        // Filter by tag
        if (this.activeTagFilter) {
            filtered = filtered.filter(a => a.tags.includes(this.activeTagFilter));
        }
        
        // Filter completed
        if (!this.showCompleted) {
            filtered = filtered.filter(a => !a.completed);
        }
        
        // Sort
        filtered = this.sortActivities(filtered);
        
        container.innerHTML = '';
        
        filtered.forEach(activity => {
            const el = this.createActivityElement(activity);
            container.appendChild(el);
        });
        
        // Reinit drag drop
        this.initDragDrop();
    }
    
    sortActivities(activities) {
        const sort = document.getElementById('sortSelect')?.value || this.settings.defaultSort;
        
        switch (sort) {
            case 'dueDate_asc':
                return activities.sort((a, b) => {
                    const dateA = a.customFields?.prazo ? new Date(a.customFields.prazo) : new Date('9999-12-31');
                    const dateB = b.customFields?.prazo ? new Date(b.customFields.prazo) : new Date('9999-12-31');
                    return dateA - dateB;
                });
            case 'dueDate_desc':
                return activities.sort((a, b) => {
                    const dateA = a.customFields?.prazo ? new Date(a.customFields.prazo) : new Date('1900-01-01');
                    const dateB = b.customFields?.prazo ? new Date(b.customFields.prazo) : new Date('1900-01-01');
                    return dateB - dateA;
                });
            case 'createdAt_desc':
                return activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            default: // manual
                return activities.sort((a, b) => a.order - b.order);
        }
    }
    
    createActivityElement(activity) {
        const div = document.createElement('div');
        div.className = `activity-item ${activity.completed ? 'completed' : ''}`;
        div.dataset.id = activity.id;
        
        // Get tags for this activity
        const activityTags = this.tags.filter(t => activity.tags.includes(t.id));
        
        div.innerHTML = `
            <div class="activity-drag-handle" title="Arrastar">⋮⋮</div>
            <div class="activity-checkbox ${activity.completed ? 'checked' : ''}" 
                 title="${activity.completed ? 'Reabrir' : 'Concluir'}">
                ${activity.completed ? '✓' : ''}
            </div>
            <div class="activity-content">
                <div class="activity-title">${this.escapeHtml(activity.title)}</div>
                <div class="activity-meta">
                    <div class="activity-tags">
                        ${activityTags.map(t => `
                            <span class="tag" style="background: ${t.color}; color: white;">
                                ${this.escapeHtml(t.name)}
                            </span>
                        `).join('')}
                    </div>
                    ${this.renderCustomFieldsMeta(activity)}
                </div>
            </div>
            <div class="activity-actions">
                <button class="btn btn-ghost btn-icon btn-sm activity-edit" title="Editar">✏️</button>
                <button class="btn btn-ghost btn-icon btn-sm activity-delete" title="Excluir">🗑️</button>
            </div>
        `;
        
        // Events
        div.querySelector('.activity-checkbox').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleComplete(activity.id);
        });
        
        div.querySelector('.activity-edit').addEventListener('click', (e) => {
            e.stopPropagation();
            this.openEditModal(activity);
        });
        
        div.querySelector('.activity-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteActivity(activity.id);
        });
        
        div.querySelector('.activity-content').addEventListener('click', () => {
            this.openEditModal(activity);
        });
        
        return div;
    }
    
    renderCustomFieldsMeta(activity) {
        const fields = this.customFields.filter(f => 
            f.enabled && 
            (f.display === 'list' || f.display === 'both') &&
            activity.customFields[f.key]
        );
        
        return fields.map(f => {
            let value = activity.customFields[f.key];
            
            if (f.type === 'date') {
                value = dateUtils.format(new Date(value), 'short');
            } else if (f.type === 'boolean') {
                value = value ? '✓' : '✗';
            } else if (f.type === 'currency') {
                value = 'R$ ' + parseFloat(value).toFixed(2);
            }
            
            return `<span class="activity-field">${this.escapeHtml(String(value))}</span>`;
        }).join('');
    }
    
    renderTagsFilter() {
        const container = document.getElementById('tagsFilter');
        if (!container) return;
        
        container.innerHTML = this.tags.map(tag => `
            <span class="tag tag-filter ${this.activeTagFilter === tag.id ? 'active' : ''}" 
                  style="background: ${tag.color}; color: white;"
                  data-id="${tag.id}">
                ${this.escapeHtml(tag.name)}
            </span>
        `).join('');
        
        container.querySelectorAll('.tag-filter').forEach(el => {
            el.addEventListener('click', () => {
                const tagId = el.dataset.id;
                this.activeTagFilter = this.activeTagFilter === tagId ? null : tagId;
                this.renderTagsFilter();
                this.renderActivities();
            });
        });
    }
    
    // CRUD operations
    async createActivity(title, customFields = {}) {
        try {
            const data = await api.post('/api/activities', {
                title,
                tags: [],
                customFields
            });
            
            this.activities.push(data);
            this.renderActivities();
            
            return data;
        } catch (err) {
            console.error('Failed to create activity:', err);
        }
    }
    
    async updateActivity(id, updates) {
        try {
            await api.patch(`/api/activities/${id}`, updates);
            
            const idx = this.activities.findIndex(a => a.id === id);
            if (idx !== -1) {
                this.activities[idx] = { ...this.activities[idx], ...updates };
            }
            
            this.renderActivities();
        } catch (err) {
            console.error('Failed to update activity:', err);
        }
    }
    
    async deleteActivity(id) {
        if (!confirm('Excluir esta atividade?')) return;
        
        try {
            await api.delete(`/api/activities/${id}`);
            this.activities = this.activities.filter(a => a.id !== id);
            this.renderActivities();
        } catch (err) {
            console.error('Failed to delete activity:', err);
        }
    }
    
    async toggleComplete(id) {
        const activity = this.activities.find(a => a.id === id);
        if (!activity) return;
        
        // Check if can reopen
        if (activity.completed && !this.settings.allowReopenCompleted) {
            alert('Reabrir atividades concluídas está desabilitado nas configurações.');
            return;
        }
        
        await this.updateActivity(id, { completed: !activity.completed });
    }
    
    async reorderActivities(order) {
        try {
            await api.post('/api/activities/reorder', { order });
            
            // Update local order
            Object.entries(order).forEach(([id, newOrder]) => {
                const activity = this.activities.find(a => a.id === id);
                if (activity) activity.order = newOrder;
            });
        } catch (err) {
            console.error('Failed to reorder:', err);
        }
    }
    
    // Modals
    openEditModal(activity = null) {
        const modal = document.getElementById('activityModal');
        const title = document.getElementById('activityModalTitle');
        const form = document.getElementById('activityForm');
        
        if (!modal || !form) return;
        
        title.textContent = activity ? 'Editar Atividade' : 'Nova Atividade';
        
        // Fill form
        document.getElementById('activityId').value = activity?.id || '';
        document.getElementById('activityTitle').value = activity?.title || '';
        document.getElementById('activityDescription').value = activity?.description || '';
        
        // Render tags
        this.renderActivityTags(activity?.tags || []);
        
        // Render custom fields
        this.renderCustomFieldsForm(activity?.customFields || {});
        
        modals.open('activityModal');
    }
    
    renderActivityTags(selectedTags) {
        const container = document.getElementById('activityTags');
        if (!container) return;
        
        container.innerHTML = this.tags.map(tag => `
            <input type="checkbox" class="tag-checkbox" id="tag_${tag.id}" 
                   value="${tag.id}" ${selectedTags.includes(tag.id) ? 'checked' : ''}>
            <label for="tag_${tag.id}">
                <span class="tag" style="background: ${tag.color}; color: white;">
                    ${this.escapeHtml(tag.name)}
                </span>
            </label>
        `).join('');
    }
    
    renderCustomFieldsForm(values) {
        const container = document.getElementById('customFieldsContainer');
        if (!container) return;
        
        const enabledFields = this.customFields.filter(f => f.enabled);
        
        container.innerHTML = enabledFields.map(field => {
            const value = values[field.key] ?? field.defaultValue ?? '';
            return `
                <div class="form-group">
                    <label for="field_${field.key}">${this.escapeHtml(field.name)}${field.required ? ' *' : ''}</label>
                    ${this.renderFieldInput(field, value)}
                </div>
            `;
        }).join('');
    }
    
    renderFieldInput(field, value) {
        switch (field.type) {
            case 'text':
                return `<input type="text" class="input" id="field_${field.key}" 
                         data-field="${field.key}" value="${this.escapeHtml(String(value))}">`;
            
            case 'long_text':
                return `<textarea class="textarea" id="field_${field.key}" 
                         data-field="${field.key}" rows="3">${this.escapeHtml(String(value))}</textarea>`;
            
            case 'date':
                return `<input type="date" class="input" id="field_${field.key}" 
                         data-field="${field.key}" value="${value}">`;
            
            case 'datetime':
                return `<input type="datetime-local" class="input" id="field_${field.key}" 
                         data-field="${field.key}" value="${value}">`;
            
            case 'number':
                return `<input type="number" class="input" id="field_${field.key}" 
                         data-field="${field.key}" value="${value}">`;
            
            case 'currency':
                return `<input type="number" step="0.01" class="input" id="field_${field.key}" 
                         data-field="${field.key}" value="${value}">`;
            
            case 'boolean':
                return `<input type="checkbox" id="field_${field.key}" 
                         data-field="${field.key}" ${value ? 'checked' : ''}>`;
            
            case 'single_select':
                return `
                    <select class="select" id="field_${field.key}" data-field="${field.key}">
                        <option value="">Selecione...</option>
                        ${(field.options || []).map(opt => 
                            `<option value="${this.escapeHtml(opt)}" ${value === opt ? 'selected' : ''}>
                                ${this.escapeHtml(opt)}
                            </option>`
                        ).join('')}
                    </select>
                `;
            
            case 'multi_select':
                return `
                    <div class="multi-select">
                        ${(field.options || []).map(opt => `
                            <label class="checkbox-label">
                                <input type="checkbox" data-field="${field.key}" value="${this.escapeHtml(opt)}"
                                       ${Array.isArray(value) && value.includes(opt) ? 'checked' : ''}>
                                <span>${this.escapeHtml(opt)}</span>
                            </label>
                        `).join('')}
                    </div>
                `;
            
            default:
                return `<input type="text" class="input" id="field_${field.key}" 
                         data-field="${field.key}" value="${this.escapeHtml(String(value))}">`;
        }
    }
    
    getFormValues() {
        const id = document.getElementById('activityId').value;
        const title = document.getElementById('activityTitle').value;
        const description = document.getElementById('activityDescription').value;
        
        // Get selected tags
        const tags = Array.from(document.querySelectorAll('#activityTags input:checked'))
            .map(input => input.value);
        
        // Get custom field values
        const customFields = {};
        this.customFields.filter(f => f.enabled).forEach(field => {
            const el = document.querySelector(`[data-field="${field.key}"]`);
            if (!el) return;
            
            if (field.type === 'boolean') {
                customFields[field.key] = el.checked;
            } else if (field.type === 'multi_select') {
                customFields[field.key] = Array.from(
                    document.querySelectorAll(`[data-field="${field.key}"]:checked`)
                ).map(input => input.value);
            } else if (field.type === 'number' || field.type === 'currency') {
                customFields[field.key] = parseFloat(el.value) || null;
            } else {
                customFields[field.key] = el.value || null;
            }
        });
        
        return { id, title, description, tags, customFields };
    }
    
    // Settings
    updateSettingsUI() {
        const allowReopen = document.getElementById('allowReopenCompleted');
        const creationMode = document.getElementById('creationMode');
        const sortSelect = document.getElementById('sortSelect');
        
        if (allowReopen) allowReopen.checked = this.settings.allowReopenCompleted;
        if (creationMode) creationMode.value = this.settings.activityCreationMode;
        if (sortSelect) sortSelect.value = this.settings.defaultSort;
    }
    
    async saveSettings(updates) {
        try {
            await api.patch('/api/settings', updates);
            Object.assign(this.settings, updates);
        } catch (err) {
            console.error('Failed to save settings:', err);
        }
    }
    
    // Drag & Drop
    initDragDrop() {
        const container = document.getElementById('activitiesList');
        if (!container || this.sortable) return;
        
        this.sortable = new Sortable(container, {
            animation: 150,
            handle: '.activity-drag-handle',
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            onEnd: (evt) => {
                const order = {};
                container.querySelectorAll('.activity-item').forEach((el, idx) => {
                    order[el.dataset.id] = idx;
                });
                this.reorderActivities(order);
            }
        });
    }
    
    // Events
    bindEvents() {
        // Create activity
        const createBtn = document.getElementById('btnAddActivity');
        const createInput = document.getElementById('newActivityTitle');
        
        if (createBtn && createInput) {
            createBtn.addEventListener('click', () => {
                const title = createInput.value.trim();
                if (title) {
                    if (this.settings.activityCreationMode === 'detailed') {
                        this.openEditModal();
                        document.getElementById('activityTitle').value = title;
                    } else {
                        this.createActivity(title);
                    }
                    createInput.value = '';
                }
            });
            
            createInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    createBtn.click();
                }
            });
        }
        
        // Show completed toggle
        const showCompletedCheckbox = document.getElementById('showCompleted');
        if (showCompletedCheckbox) {
            showCompletedCheckbox.addEventListener('change', (e) => {
                this.showCompleted = e.target.checked;
                this.renderActivities();
            });
        }
        
        // Sort select
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                this.renderActivities();
            });
        }
        
        // Activity form
        const activityForm = document.getElementById('activityForm');
        if (activityForm) {
            activityForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const values = this.getFormValues();
                
                if (!values.title.trim()) {
                    alert('Título é obrigatório');
                    return;
                }
                
                if (values.id) {
                    await this.updateActivity(values.id, values);
                } else {
                    await this.createActivity(values.title, values.customFields);
                    // Update with other fields
                    const newActivity = this.activities[this.activities.length - 1];
                    if (newActivity) {
                        await this.updateActivity(newActivity.id, values);
                    }
                }
                
                modals.close('activityModal');
            });
        }
        
        // Settings button
        document.getElementById('btnSettings')?.addEventListener('click', () => {
            modals.open('settingsModal');
            this.renderSettingsLists();
        });
        
        // Settings changes
        document.getElementById('allowReopenCompleted')?.addEventListener('change', (e) => {
            this.saveSettings({ allowReopenCompleted: e.target.checked });
        });
        
        document.getElementById('creationMode')?.addEventListener('change', (e) => {
            this.saveSettings({ activityCreationMode: e.target.value });
        });
    }
    
    // Settings lists (tags & fields)
    renderSettingsLists() {
        this.renderFieldsList();
        this.renderTagsList();
    }
    
    renderFieldsList() {
        const container = document.getElementById('fieldsList');
        if (!container) return;
        
        container.innerHTML = this.customFields.map(field => `
            <div class="field-item">
                <div class="field-info">
                    <span class="field-name">${this.escapeHtml(field.name)}</span>
                    <span class="field-type">${field.type} ${field.enabled ? '' : '(desabilitado)'}</span>
                </div>
                <div class="field-actions">
                    <button class="btn btn-ghost btn-icon btn-sm" data-edit-field="${field.id}">✏️</button>
                    <button class="btn btn-ghost btn-icon btn-sm" data-delete-field="${field.id}">🗑️</button>
                </div>
            </div>
        `).join('') || '<p style="color: var(--muted-foreground);">Nenhum campo criado</p>';
        
        // Bind events
        container.querySelectorAll('[data-edit-field]').forEach(btn => {
            btn.addEventListener('click', () => {
                const field = this.customFields.find(f => f.id === btn.dataset.editField);
                if (field) this.openFieldModal(field);
            });
        });
        
        container.querySelectorAll('[data-delete-field]').forEach(btn => {
            btn.addEventListener('click', () => this.deleteField(btn.dataset.deleteField));
        });
        
        // Add button
        document.getElementById('btnAddField')?.addEventListener('click', () => {
            this.openFieldModal();
        });
    }
    
    renderTagsList() {
        const container = document.getElementById('tagsList');
        if (!container) return;
        
        container.innerHTML = this.tags.map(tag => `
            <div class="tag-item">
                <div class="tag-info" style="display: flex; align-items: center;">
                    <span class="tag-color" style="background: ${tag.color};"></span>
                    <span class="tag-name">${this.escapeHtml(tag.name)}</span>
                </div>
                <div class="tag-actions">
                    <button class="btn btn-ghost btn-icon btn-sm" data-edit-tag="${tag.id}">✏️</button>
                    <button class="btn btn-ghost btn-icon btn-sm" data-delete-tag="${tag.id}">🗑️</button>
                </div>
            </div>
        `).join('') || '<p style="color: var(--muted-foreground);">Nenhuma tag criada</p>';
        
        // Bind events
        container.querySelectorAll('[data-edit-tag]').forEach(btn => {
            btn.addEventListener('click', () => {
                const tag = this.tags.find(t => t.id === btn.dataset.editTag);
                if (tag) this.openTagModal(tag);
            });
        });
        
        container.querySelectorAll('[data-delete-tag]').forEach(btn => {
            btn.addEventListener('click', () => this.deleteTag(btn.dataset.deleteTag));
        });
        
        // Add button
        document.getElementById('btnAddTag')?.addEventListener('click', () => {
            this.openTagModal();
        });
    }
    
    // Field modal
    openFieldModal(field = null) {
        const title = document.getElementById('fieldModalTitle');
        const form = document.getElementById('fieldForm');
        
        title.textContent = field ? 'Editar Campo' : 'Novo Campo';
        
        document.getElementById('fieldId').value = field?.id || '';
        document.getElementById('fieldName').value = field?.name || '';
        document.getElementById('fieldType').value = field?.type || 'text';
        document.getElementById('fieldOptions').value = (field?.options || []).join('\n');
        document.getElementById('fieldDisplay').value = field?.display || 'both';
        document.getElementById('fieldRequired').checked = field?.required || false;
        document.getElementById('fieldEnabled').checked = field?.enabled !== false;
        
        this.toggleOptionsVisibility();
        
        // Bind type change
        document.getElementById('fieldType').onchange = () => this.toggleOptionsVisibility();
        
        // Bind form submit
        form.onsubmit = async (e) => {
            e.preventDefault();
            await this.saveField();
            modals.close('fieldModal');
            this.renderSettingsLists();
        };
        
        modals.open('fieldModal');
    }
    
    toggleOptionsVisibility() {
        const type = document.getElementById('fieldType').value;
        const optionsGroup = document.getElementById('fieldOptionsGroup');
        const needsOptions = ['single_select', 'multi_select'].includes(type);
        optionsGroup.style.display = needsOptions ? '' : 'none';
    }
    
    async saveField() {
        const id = document.getElementById('fieldId').value;
        const data = {
            name: document.getElementById('fieldName').value,
            type: document.getElementById('fieldType').value,
            options: document.getElementById('fieldOptions').value.split('\n').filter(o => o.trim()),
            display: document.getElementById('fieldDisplay').value,
            required: document.getElementById('fieldRequired').checked,
            enabled: document.getElementById('fieldEnabled').checked
        };
        
        try {
            if (id) {
                await api.patch(`/api/settings/fields/${id}`, data);
                const idx = this.customFields.findIndex(f => f.id === id);
                if (idx !== -1) this.customFields[idx] = { ...this.customFields[idx], ...data };
            } else {
                const result = await api.post('/api/settings/fields', data);
                this.customFields.push(result);
            }
        } catch (err) {
            console.error('Failed to save field:', err);
        }
    }
    
    async deleteField(id) {
        if (!confirm('Excluir este campo?')) return;
        
        try {
            await api.delete(`/api/settings/fields/${id}`);
            this.customFields = this.customFields.filter(f => f.id !== id);
            this.renderSettingsLists();
        } catch (err) {
            console.error('Failed to delete field:', err);
        }
    }
    
    // Tag modal
    openTagModal(tag = null) {
        const title = document.getElementById('tagModalTitle');
        const form = document.getElementById('tagForm');
        
        title.textContent = tag ? 'Editar Tag' : 'Nova Tag';
        
        document.getElementById('tagId').value = tag?.id || '';
        document.getElementById('tagName').value = tag?.name || '';
        document.getElementById('tagColor').value = tag?.color || '#f59e0b';
        
        form.onsubmit = async (e) => {
            e.preventDefault();
            await this.saveTag();
            modals.close('tagModal');
            this.renderSettingsLists();
            this.renderTagsFilter();
        };
        
        modals.open('tagModal');
    }
    
    async saveTag() {
        const id = document.getElementById('tagId').value;
        const data = {
            name: document.getElementById('tagName').value,
            color: document.getElementById('tagColor').value
        };
        
        try {
            if (id) {
                await api.patch(`/api/settings/tags/${id}`, data);
                const idx = this.tags.findIndex(t => t.id === id);
                if (idx !== -1) this.tags[idx] = { ...this.tags[idx], ...data };
            } else {
                const result = await api.post('/api/settings/tags', data);
                this.tags.push(result);
            }
        } catch (err) {
            console.error('Failed to save tag:', err);
        }
    }
    
    async deleteTag(id) {
        if (!confirm('Excluir esta tag?')) return;
        
        try {
            await api.delete(`/api/settings/tags/${id}`);
            this.tags = this.tags.filter(t => t.id !== id);
            this.renderSettingsLists();
            this.renderTagsFilter();
        } catch (err) {
            console.error('Failed to delete tag:', err);
        }
    }
    
    // Utilities
    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Initialize
let activitiesManager;
document.addEventListener('DOMContentLoaded', () => {
    activitiesManager = new ActivitiesManager();
});
