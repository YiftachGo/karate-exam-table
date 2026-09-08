var App = window.App || {};

App.ExamList = (function () {
    var _searchTerm = '';
    var _sortKey = 'dateDesc';
    // Last-loaded exam index. Feeds the class-name suggestions and lets the edit
    // modal open with the exam's current values without a re-read.
    var _exams = [];

    async function render() {
        var t = App.I18n.t;
        var container = document.getElementById('app');
        App.showLoading();

        var exams = await App.Storage.getExamIndex();
        _exams = exams;

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

        // Filter and sort. Search matches the exam name plus its dojo and class,
        // so "תל אביב" or "בוגרים" finds every exam of that group.
        var filtered = exams.filter(function (e) {
            if (!_searchTerm) return true;
            var q = _searchTerm.toLowerCase();
            return [e.name, e.dojo, e.classGroup].some(function (field) {
                return (field || '').toLowerCase().indexOf(q) !== -1;
            });
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
                    html += '<button class="btn btn-sm btn-outline rename-exam-btn" data-id="' + exam.id + '" title="' + t('editExam') + '">&#9998;</button>';
                    html += '<button class="btn btn-sm btn-danger delete-exam-btn" data-id="' + exam.id + '" title="' + t('delete') + '">&#10005;</button>';
                }
                html += '</div>';
                if (exam.dojo || exam.classGroup) {
                    html += '<div class="exam-card-group">';
                    html += App.Utils.escapeHtml(
                        [exam.dojo, exam.classGroup].filter(Boolean).join(' · '));
                    html += '</div>';
                }
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
                showEditExamModal(btn.dataset.id);
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

    // --- Dojo / class / belt-system fields, shared by the new and edit modals ---

    // Distinct class names the trainer has used before, for the datalist.
    function classSuggestions() {
        var seen = {};
        _exams.forEach(function (e) {
            var c = (e.classGroup || '').trim();
            if (c) seen[c] = true;
        });
        return Object.keys(seen).sort(function (a, b) { return a.localeCompare(b); });
    }

    // Checkboxes, not a dropdown — a class can span more than one belt ladder
    // (mixed-age groups, a teen training on the adult ladder). Checking none
    // means no filtering at all, which is why the hint says so explicitly.
    function beltSystemChecks(prefix, currentVals) {
        var t = App.I18n.t;
        var selected = App.Utils.toBeltSystems(currentVals);
        var html = '<div class="form-group">';
        html += '<label>' + t('beltSystem') + '</label>';
        html += '<div class="belt-system-checks">';
        App.Utils.RANK_GROUPS.forEach(function (g) {
            html += '<label class="belt-system-check">';
            html += '<input type="checkbox" class="' + prefix + '-belt-cb" value="' + g.key + '"' +
                (selected.indexOf(g.key) !== -1 ? ' checked' : '') + '>';
            html += '<span>' + App.Utils.escapeHtml(g.label) + '</span>';
            html += '</label>';
        });
        html += '</div>';
        html += '<p class="field-explanation">' + t('beltSystemHelp') + '</p>';
        html += '</div>';
        return html;
    }

    function readBeltSystems(prefix) {
        return Array.from(document.querySelectorAll('.' + prefix + '-belt-cb:checked'))
            .map(function (cb) { return cb.value; });
    }

    // prefix keeps the two modals' element ids distinct.
    function groupFieldsHtml(prefix, exam) {
        var t = App.I18n.t;
        var esc = App.Utils.escapeHtml;
        exam = exam || {};
        var listId = prefix + '-class-suggestions';

        var html = App.Utils.buildClubSelect(prefix + '-dojo', exam.dojo || '', t('dojo'));

        html += '<div class="form-group">';
        html += '<label for="' + prefix + '-class">' + t('classGroup') + '</label>';
        html += '<input type="text" id="' + prefix + '-class" list="' + listId + '"' +
            ' placeholder="' + esc(t('classGroupPlaceholder')) + '"' +
            ' value="' + esc(exam.classGroup || '') + '">';
        html += '<datalist id="' + listId + '">';
        classSuggestions().forEach(function (c) {
            html += '<option value="' + esc(c) + '"></option>';
        });
        html += '</datalist>';
        html += '</div>';

        html += beltSystemChecks(prefix, exam.beltSystems);
        return html;
    }

    function readGroupFields(prefix) {
        return {
            dojo: document.getElementById(prefix + '-dojo').value,
            classGroup: document.getElementById(prefix + '-class').value.trim(),
            beltSystems: readBeltSystems(prefix)
        };
    }

    // When the dojo+class name an existing group, adopt that group's belt systems
    // so they only have to be chosen once per class.
    function bindBeltSystemInherit(prefix) {
        function sync() {
            var g = readGroupFields(prefix);
            var key = App.Utils.examGroupKey(g.dojo, g.classGroup);
            if (!key) return;
            // Never override choices the trainer has already ticked by hand.
            if (g.beltSystems.length) return;
            var peer = _exams.filter(function (e) {
                return e.groupKey === key && App.Utils.toBeltSystems(e.beltSystems).length;
            })[0];
            if (!peer) return;
            var inherit = App.Utils.toBeltSystems(peer.beltSystems);
            document.querySelectorAll('.' + prefix + '-belt-cb').forEach(function (cb) {
                if (inherit.indexOf(cb.value) !== -1) cb.checked = true;
            });
        }
        document.getElementById(prefix + '-dojo').addEventListener('change', sync);
        document.getElementById(prefix + '-class').addEventListener('change', sync);
        document.getElementById(prefix + '-class').addEventListener('blur', sync);
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
        html += groupFieldsHtml('new-exam', {});
        html += '<div class="modal-actions">';
        html += '<button class="btn btn-primary" id="btn-create-exam">' + t('create') + '</button>';
        html += '<button class="btn btn-outline" id="btn-cancel-exam">' + t('cancel') + '</button>';
        html += '</div>';
        html += '</div>';
        html += '</div>';
        modalContainer.innerHTML = html;

        bindBeltSystemInherit('new-exam');

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

    // Was rename-only; now edits name, date and the group fields.
    function showEditExamModal(examId) {
        var t = App.I18n.t;
        var exam = _exams.filter(function (e) { return e.id === examId; })[0] || {};
        var modalContainer = document.getElementById('modal-container');

        var html = '<div class="modal-overlay" id="edit-exam-overlay">';
        html += '<div class="modal">';
        html += '<h2>' + t('editExam') + '</h2>';
        html += '<div class="form-group">';
        html += '<label>' + t('examName') + '</label>';
        html += '<input type="text" id="edit-exam-name" value="' + App.Utils.escapeHtml(exam.name || '') + '" autofocus>';
        html += '</div>';
        html += '<div class="form-group">';
        html += '<label>' + t('examDate') + '</label>';
        html += '<input type="date" id="edit-exam-date" value="' + App.Utils.escapeHtml(exam.date || '') + '">';
        html += '</div>';
        html += groupFieldsHtml('edit-exam', exam);
        html += '<div class="modal-actions">';
        html += '<button class="btn btn-primary" id="btn-confirm-edit">' + t('save') + '</button>';
        html += '<button class="btn btn-outline" id="btn-cancel-edit">' + t('cancel') + '</button>';
        html += '</div>';
        html += '</div></div>';
        modalContainer.innerHTML = html;

        bindBeltSystemInherit('edit-exam');

        function close() { modalContainer.innerHTML = ''; }
        async function commit() {
            var nameEl = document.getElementById('edit-exam-name');
            var newName = nameEl.value.trim();
            if (!newName) { nameEl.focus(); return; }
            var g = readGroupFields('edit-exam');
            try {
                await App.Storage.updateExam(examId, {
                    name: newName,
                    date: document.getElementById('edit-exam-date').value,
                    dojo: g.dojo,
                    classGroup: g.classGroup,
                    beltSystems: g.beltSystems,
                    // Must be recomputed whenever dojo or class changes, or the
                    // exam would stay in its old group.
                    groupKey: App.Utils.examGroupKey(g.dojo, g.classGroup)
                });
                close();
                render();
                App.showToast(t('dataSaved'));
            } catch (err) {
                console.error('updateExam failed:', err);
                alert(t('error') + ': ' + (err.message || err.code || err));
            }
        }

        document.getElementById('btn-confirm-edit').addEventListener('click', commit);
        document.getElementById('btn-cancel-edit').addEventListener('click', close);
        document.getElementById('edit-exam-overlay').addEventListener('click', function (e) { if (e.target === this) close(); });
        document.getElementById('edit-exam-name').addEventListener('keydown', function (e) { if (e.key === 'Enter') commit(); });
        var input = document.getElementById('edit-exam-name');
        input.focus();
        input.select();
    }

    async function createExam() {
        var t = App.I18n.t;
        var nameEl = document.getElementById('new-exam-name');
        var name = nameEl.value.trim();
        var date = document.getElementById('new-exam-date').value;
        if (!name) {
            nameEl.focus();
            return;
        }
        var g = readGroupFields('new-exam');
        var btn = document.getElementById('btn-create-exam');
        btn.disabled = true;

        var exam;
        try {
            exam = await App.Storage.createExam(name, date, g);
        } catch (err) {
            btn.disabled = false;
            console.error('createExam failed:', err);
            alert(t('error') + ': ' + (err.message || err.code || err));
            return;
        }

        // The exam now exists. Anything past this point must still end with the
        // trainer inside it — never strand them on the list because the import
        // lookup misbehaved.
        try {
            var previous = await App.Storage.findPreviousExamInGroup(exam.groupKey, exam.id);
            if (previous) {
                // Same review screen the exam table uses; here it always ends by
                // taking the trainer into the exam that was just created.
                App.ImportStudents.openReview({
                    targetExam: exam,
                    sourceExam: previous,
                    onDone: function () { App.Router.navigate('#/exam/' + exam.id); }
                });
                return;
            }
        } catch (err) {
            console.warn('previous-exam lookup failed:', err);
        }
        App.Router.navigate('#/exam/' + exam.id);
    }

    return { render: render };
})();
