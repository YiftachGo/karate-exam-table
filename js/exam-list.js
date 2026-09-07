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

    function beltSystemSelect(id, currentVal) {
        var t = App.I18n.t;
        var html = '<div class="form-group">';
        html += '<label for="' + id + '">' + t('beltSystem') + '</label>';
        html += '<select id="' + id + '">';
        html += '<option value="">' + t('allBeltSystems') + '</option>';
        App.Utils.RANK_GROUPS.forEach(function (g) {
            html += '<option value="' + g.key + '"' + (currentVal === g.key ? ' selected' : '') + '>' +
                App.Utils.escapeHtml(g.label) + '</option>';
        });
        html += '</select>';
        html += '<p class="field-explanation">' + t('beltSystemHelp') + '</p>';
        html += '</div>';
        return html;
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

        html += beltSystemSelect(prefix + '-belt', exam.beltSystem || '');
        return html;
    }

    function readGroupFields(prefix) {
        return {
            dojo: document.getElementById(prefix + '-dojo').value,
            classGroup: document.getElementById(prefix + '-class').value.trim(),
            beltSystem: document.getElementById(prefix + '-belt').value
        };
    }

    // When the dojo+class name an existing group, adopt that group's belt system
    // so it only has to be chosen once per class.
    function bindBeltSystemInherit(prefix) {
        function sync() {
            var g = readGroupFields(prefix);
            var key = App.Utils.examGroupKey(g.dojo, g.classGroup);
            if (!key) return;
            var peer = _exams.filter(function (e) { return e.groupKey === key && e.beltSystem; })[0];
            var beltEl = document.getElementById(prefix + '-belt');
            // Never override a choice the trainer has already made by hand.
            if (peer && !beltEl.value) beltEl.value = peer.beltSystem;
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
                    beltSystem: g.beltSystem,
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
                showImportReviewModal(exam, previous);
                return;
            }
        } catch (err) {
            console.warn('previous-exam lookup failed:', err);
        }
        App.Router.navigate('#/exam/' + exam.id);
    }

    // --- Import from the group's previous exam ---

    function showImportReviewModal(exam, previous) {
        var t = App.I18n.t;
        var esc = App.Utils.escapeHtml;
        var modalContainer = document.getElementById('modal-container');

        function go() { App.Router.navigate('#/exam/' + exam.id); }

        modalContainer.innerHTML = '<div class="modal-overlay" id="import-overlay"><div class="modal">' +
            '<h2>' + t('importReviewTitle') + '</h2>' +
            '<p class="invite-subtitle">' + t('loading') + '</p></div></div>';

        App.Storage.getGroupImportCandidates(previous.id).then(function (candidates) {
            if (!candidates.length) {
                modalContainer.innerHTML = '';
                go();
                return;
            }

            var html = '<div class="modal-overlay" id="import-overlay"><div class="modal modal-wide">';
            html += '<h2>' + t('importReviewTitle') + '</h2>';
            html += '<p class="invite-subtitle">' + t('importReviewSubtitle') + '</p>';
            html += '<p class="import-source">' + t('previousExamLabel') + ': ' +
                esc(previous.name || '') + (previous.date ? ' — ' + App.Utils.formatDate(previous.date) : '') + '</p>';

            html += '<div class="import-list">';
            html += '<label class="import-select-all"><input type="checkbox" id="import-select-all" checked> ' +
                t('selectAll') + '</label>';
            candidates.forEach(function (c, i) {
                var verdictClass = c.verdict === 'pass' ? 'verdict-pass'
                    : c.verdict === 'fail' ? 'verdict-fail' : 'verdict-none';
                var verdictLabel = c.verdict === 'pass' ? t('passedLastExam')
                    : c.verdict === 'fail' ? t('failedLastExam') : t('notGraded');

                html += '<label class="import-row' + (c.promoted ? ' import-row-promoted' : '') + '">';
                html += '<input type="checkbox" class="import-cb" data-idx="' + i + '" checked>';
                html += '<span class="import-name">' + esc(c.firstName + ' ' + c.lastName) + '</span>';
                html += '<span class="import-verdict ' + verdictClass + '">' + verdictLabel + '</span>';
                html += '<span class="import-rank">';
                if (c.promoted) {
                    html += '<span class="import-rank-old">' + esc(c.oldRank || '—') + '</span>';
                    // Left-pointing for the RTL base layout, where the old rank
                    // sits to the right. CSS flips it under [dir="ltr"].
                    html += '<span class="import-rank-arrow">&larr;</span>';
                    html += '<span class="import-rank-new">' + esc(c.newRank || '—') + '</span>';
                } else {
                    html += esc(c.newRank || c.oldRank || '—');
                    html += ' <span class="import-rank-same">(' + t('rankUnchanged') + ')</span>';
                }
                html += '</span>';
                html += '</label>';
            });
            html += '</div>';

            html += '<div id="import-error" class="auth-error" style="display:none"></div>';
            html += '<div class="modal-actions">';
            html += '<button class="btn btn-primary" id="btn-do-import">' + t('importSelected') + '</button>';
            html += '<button class="btn btn-outline" id="btn-skip-import">' + t('skipImport') + '</button>';
            html += '</div></div></div>';
            modalContainer.innerHTML = html;

            document.getElementById('import-select-all').addEventListener('change', function () {
                var on = this.checked;
                document.querySelectorAll('.import-cb').forEach(function (cb) { cb.checked = on; });
            });

            // Skipping still leaves the exam created — just empty.
            document.getElementById('btn-skip-import').addEventListener('click', function () {
                modalContainer.innerHTML = '';
                go();
            });
            document.getElementById('import-overlay').addEventListener('click', function (e) {
                if (e.target === this) { modalContainer.innerHTML = ''; go(); }
            });

            document.getElementById('btn-do-import').addEventListener('click', async function () {
                var btn = this;
                var errorEl = document.getElementById('import-error');
                errorEl.style.display = 'none';

                var items = Array.from(document.querySelectorAll('.import-cb:checked'))
                    .map(function (cb) {
                        var c = candidates[parseInt(cb.dataset.idx, 10)];
                        return {
                            examineeId: c.examineeId,
                            rank: c.newRank,
                            targetRank: c.newTargetRank
                        };
                    });

                if (!items.length) { modalContainer.innerHTML = ''; go(); return; }

                btn.disabled = true;
                btn.textContent = t('loading');
                try {
                    var n = await App.Storage.importExamineesFromGroup(previous.id, exam.id, items);
                    modalContainer.innerHTML = '';
                    App.showToast(n + ' ' + t('studentsImportedCount'));
                    go();
                } catch (err) {
                    console.error('group import failed:', err);
                    btn.disabled = false;
                    btn.textContent = t('importSelected');
                    errorEl.textContent = t('error') + ': ' + (err.message || err.code || err);
                    errorEl.style.display = '';
                }
            });
        }).catch(function (err) {
            console.warn('import candidates failed:', err);
            modalContainer.innerHTML = '';
            go();
        });
    }

    return { render: render };
})();
