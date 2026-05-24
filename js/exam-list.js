var App = window.App || {};

App.ExamList = (function () {
    var _searchTerm = '';
    var _sortKey = 'dateDesc';

    async function render() {
        var t = App.I18n.t;
        var container = document.getElementById('app');
        App.showLoading();

        var exams = await App.Storage.getExamIndex();

        var html = '<div class="exam-list-page">';
        html += '<div class="toolbar">';
        html += '<h2 class="page-title">' + t('appTitle') + '</h2>';
        html += '<div class="toolbar-spacer"></div>';
        html += '<button class="btn btn-primary" id="btn-new-exam">+ ' + t('newExam') + '</button>';
        html += '<button class="btn btn-outline" id="btn-import-exam">' + t('importExam') + '</button>';
        html += '<input type="file" id="import-file" accept=".json" style="display:none">';
        html += '<input type="search" id="exam-search" class="exam-search-input" placeholder="' + t('searchExam') + '" value="' + App.Utils.escapeHtml(_searchTerm) + '">';
        html += '<select id="exam-sort" class="exam-sort-select">';
        html += '<option value="dateDesc"' + (_sortKey === 'dateDesc' ? ' selected' : '') + '>' + t('sortNewest') + '</option>';
        html += '<option value="dateAsc"'  + (_sortKey === 'dateAsc'  ? ' selected' : '') + '>' + t('sortOldest') + '</option>';
        html += '<option value="nameAsc"'  + (_sortKey === 'nameAsc'  ? ' selected' : '') + '>' + t('sortNameAZ') + '</option>';
        html += '<option value="nameDesc"' + (_sortKey === 'nameDesc' ? ' selected' : '') + '>' + t('sortNameZA') + '</option>';
        html += '<option value="count"'    + (_sortKey === 'count'    ? ' selected' : '') + '>' + t('sortCount')  + '</option>';
        html += '</select>';
        html += '</div>';

        // Filter and sort
        var filtered = exams.filter(function (e) {
            return !_searchTerm || (e.name || '').toLowerCase().indexOf(_searchTerm.toLowerCase()) !== -1;
        });
        filtered.sort(function (a, b) {
            if (_sortKey === 'dateAsc')  return (a.date || '') < (b.date || '') ? -1 : 1;
            if (_sortKey === 'nameAsc')  return (a.name || '').localeCompare(b.name || '');
            if (_sortKey === 'nameDesc') return (b.name || '').localeCompare(a.name || '');
            if (_sortKey === 'count')    return (b.examineeCount || 0) - (a.examineeCount || 0);
            return (b.date || '') > (a.date || '') ? 1 : -1; // dateDesc
        });

        if (filtered.length === 0) {
            html += '<div class="empty-state">';
            html += '<div class="empty-icon">&#128203;</div>';
            html += '<p>' + t('noExams') + '</p>';
            html += '</div>';
        } else {
            html += '<div class="exam-grid">';
            filtered.forEach(function (exam) {
                var isOwner = exam.ownerId === App.Auth.getUserId();
                html += '<div class="exam-card" data-id="' + exam.id + '">';
                html += '<div class="exam-card-header">';
                html += '<h3>' + App.Utils.escapeHtml(exam.name) + '</h3>';
                if (isOwner) {
                    html += '<button class="btn btn-sm btn-outline rename-exam-btn" data-id="' + exam.id + '" data-name="' + App.Utils.escapeHtml(exam.name) + '" title="' + t('renameExam') + '">&#9998;</button>';
                    html += '<button class="btn btn-sm btn-danger delete-exam-btn" data-id="' + exam.id + '" title="' + t('delete') + '">&#10005;</button>';
                }
                html += '</div>';
                html += '<div class="exam-card-body">';
                html += '<span class="exam-date">' + (exam.date ? App.Utils.formatDate(exam.date) : '') + '</span>';
                html += '<span class="exam-count">' + (exam.examineeCount || 0) + ' ' + t('examinees') + '</span>';
                html += '</div>';
                html += '<div class="exam-card-actions">';
                html += '<button class="btn btn-sm btn-outline export-exam-btn" data-id="' + exam.id + '">' + t('export') + '</button>';
                html += '</div>';
                html += '</div>';
            });
            html += '</div>';
        }

        html += '</div>';
        html += '<div id="modal-container"></div>';
        container.innerHTML = html;

        bindEvents();

        // Restore focus to search input if user was typing
        if (_searchTerm) {
            var searchEl = document.getElementById('exam-search');
            if (searchEl) { searchEl.focus(); searchEl.setSelectionRange(searchEl.value.length, searchEl.value.length); }
        }
    }

    function bindEvents() {
        var t = App.I18n.t;

        document.getElementById('btn-new-exam').addEventListener('click', showNewExamModal);

        document.getElementById('exam-search').addEventListener('input', function (e) {
            _searchTerm = e.target.value;
            render();
        });

        document.getElementById('exam-sort').addEventListener('change', function (e) {
            _sortKey = e.target.value;
            render();
        });

        document.getElementById('btn-import-exam').addEventListener('click', function () {
            document.getElementById('import-file').click();
        });

        document.getElementById('import-file').addEventListener('change', function (e) {
            var file = e.target.files[0];
            if (!file) return;
            App.Storage.importExam(file, function (err) {
                if (err) {
                    alert('Error importing file');
                } else {
                    render();
                    App.showToast(App.I18n.t('dataSaved'));
                }
            });
        });

        document.querySelectorAll('.exam-card').forEach(function (card) {
            card.addEventListener('click', function (e) {
                if (e.target.closest('.delete-exam-btn') || e.target.closest('.export-exam-btn') || e.target.closest('.rename-exam-btn')) return;
                App.Router.navigate('#/exam/' + card.dataset.id);
            });
        });

        document.querySelectorAll('.rename-exam-btn').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                showRenameExamModal(btn.dataset.id, btn.dataset.name);
            });
        });

        document.querySelectorAll('.delete-exam-btn').forEach(function (btn) {
            btn.addEventListener('click', async function (e) {
                e.stopPropagation();
                if (!confirm(t('confirmDeleteExam'))) return;
                var examId = btn.dataset.id;
                try {
                    var snapshot = await App.Storage.captureExamForRestore(examId);
                    await App.Storage.deleteExam(examId);
                    render();
                    App.Undo.push('examDeleted', async function () {
                        try {
                            await App.Storage.restoreExamFromSnapshot(snapshot);
                            render();
                        } catch (err) {
                            console.error('Undo restore failed:', err);
                            alert(t('error') + ': ' + (err.message || err.code || err));
                        }
                    });
                } catch (err) {
                    console.error('deleteExam failed:', err);
                    alert(t('error') + ': ' + (err.message || err.code || err));
                }
            });
        });

        document.querySelectorAll('.export-exam-btn').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                App.Storage.exportExam(btn.dataset.id);
            });
        });
    }

    function showNewExamModal() {
        var t = App.I18n.t;
        var modalContainer = document.getElementById('modal-container');
        var html = '<div class="modal-overlay" id="new-exam-overlay">';
        html += '<div class="modal">';
        html += '<h2>' + t('newExam') + '</h2>';
        html += '<div class="form-group">';
        html += '<label>' + t('examName') + '</label>';
        html += '<input type="text" id="new-exam-name" autofocus>';
        html += '</div>';
        html += '<div class="form-group">';
        html += '<label>' + t('examDate') + '</label>';
        html += '<input type="date" id="new-exam-date" value="' + new Date().toISOString().split('T')[0] + '">';
        html += '</div>';
        html += '<div class="modal-actions">';
        html += '<button class="btn btn-primary" id="btn-create-exam">' + t('create') + '</button>';
        html += '<button class="btn btn-outline" id="btn-cancel-exam">' + t('cancel') + '</button>';
        html += '</div>';
        html += '</div>';
        html += '</div>';
        modalContainer.innerHTML = html;

        document.getElementById('btn-create-exam').addEventListener('click', createExam);
        document.getElementById('btn-cancel-exam').addEventListener('click', function () {
            modalContainer.innerHTML = '';
        });
        document.getElementById('new-exam-overlay').addEventListener('click', function (e) {
            if (e.target === this) modalContainer.innerHTML = '';
        });
        document.getElementById('new-exam-name').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') createExam();
        });
        document.getElementById('new-exam-name').focus();
    }

    function showRenameExamModal(examId, currentName) {
        var t = App.I18n.t;
        var modalContainer = document.getElementById('modal-container');
        var html = '<div class="modal-overlay" id="rename-exam-overlay">';
        html += '<div class="modal">';
        html += '<h2>' + t('renameExam') + '</h2>';
        html += '<div class="form-group">';
        html += '<label>' + t('newExamName') + '</label>';
        html += '<input type="text" id="rename-exam-input" value="' + App.Utils.escapeHtml(currentName || '') + '" autofocus>';
        html += '</div>';
        html += '<div class="modal-actions">';
        html += '<button class="btn btn-primary" id="btn-confirm-rename">' + t('save') + '</button>';
        html += '<button class="btn btn-outline" id="btn-cancel-rename">' + t('cancel') + '</button>';
        html += '</div>';
        html += '</div></div>';
        modalContainer.innerHTML = html;

        function close() { modalContainer.innerHTML = ''; }
        async function commit() {
            var newName = document.getElementById('rename-exam-input').value.trim();
            if (!newName) { document.getElementById('rename-exam-input').focus(); return; }
            if (newName === currentName) { close(); return; }
            await App.Storage.updateExam(examId, { name: newName });
            close();
            render();
            App.showToast(t('dataSaved'));
        }

        document.getElementById('btn-confirm-rename').addEventListener('click', commit);
        document.getElementById('btn-cancel-rename').addEventListener('click', close);
        document.getElementById('rename-exam-overlay').addEventListener('click', function (e) { if (e.target === this) close(); });
        document.getElementById('rename-exam-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') commit(); });
        var input = document.getElementById('rename-exam-input');
        input.focus();
        input.select();
    }

    async function createExam() {
        var name = document.getElementById('new-exam-name').value.trim();
        var date = document.getElementById('new-exam-date').value;
        if (!name) {
            document.getElementById('new-exam-name').focus();
            return;
        }
        var exam = await App.Storage.createExam(name, date);
        App.Router.navigate('#/exam/' + exam.id);
    }

    return { render: render };
})();
