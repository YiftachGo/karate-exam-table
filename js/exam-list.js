var App = window.App || {};

App.ExamList = (function () {
    var _searchTerm = '';
    var _sortKey = 'dateDesc';
    // Last-loaded exam index. Feeds the class-name suggestions and lets the edit
    // modal open with the exam's current values without a re-read.
    var _exams = [];

    // --- View state (per device, so cards on a desktop and a list on a phone) ---
    //
    // Deliberately its own localStorage keys rather than folded into krt_settings:
    // app.js's language toggle calls saveSettings({ language }), which replaces the
    // whole object and would wipe any sibling key on every language switch.

    var VIEW_KEY = 'krt_examview';
    var COLLAPSE_KEY = 'krt_foldercollapse';

    function getView() {
        try {
            return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'cards';
        } catch (e) { return 'cards'; }
    }
    function setView(v) {
        try { localStorage.setItem(VIEW_KEY, v); } catch (e) {}
    }
    function getCollapsed() {
        try { return JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '{}'); }
        catch (e) { return {}; }
    }
    function setCollapsed(map) {
        try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(map)); } catch (e) {}
    }
    function toggleCollapsed(folderId) {
        var map = getCollapsed();
        if (map[folderId]) delete map[folderId];
        else map[folderId] = true;
        setCollapsed(map);
    }

    // opts.useCache re-renders from the exams already in memory. Search, sort, the
    // view toggle, collapsing and filing all change presentation only, so they
    // must not trigger a Firestore round-trip or flash the spinner. The default
    // stays "fetch" because the router calls render() with no arguments.
    async function render(opts) {
        var t = App.I18n.t;
        var container = document.getElementById('app');
        var useCache = !!(opts && opts.useCache) && _exams.length > 0;

        if (!useCache) {
            App.showLoading();
            _exams = await App.Storage.getExamIndex();
        }
        var exams = _exams;
        var view = getView();

        var html = '<div class="exam-list-page">';
        html += '<div class="toolbar">';
        html += '<h2 class="page-title">' + t('appTitle') + '</h2>';
        html += '<div class="toolbar-spacer"></div>';
        html += '<button class="btn btn-primary" id="btn-new-exam">+ ' + t('newExam') + '</button>';
        html += '<button class="btn btn-outline" id="btn-new-folder">+ ' + t('newFolder') + '</button>';
        html += '<button class="btn btn-outline" id="btn-import-exam">' + t('importExam') + '</button>';
        html += '<input type="file" id="import-file" accept=".json" style="display:none">';
        html += '<input type="search" id="exam-search" class="exam-search-input" placeholder="' + t('searchExam') + '" value="' + App.Utils.escapeHtml(_searchTerm) + '">';
        html += '<select id="exam-sort" class="exam-sort-select">';
        html += '<option value="dateDesc"' + (_sortKey === 'dateDesc' ? ' selected' : '') + '>' + t('sortNewest') + '</option>';
        html += '<option value="dateAsc"'  + (_sortKey === 'dateAsc'  ? ' selected' : '') + '>' + t('sortOldest') + '</option>';
        html += '<option value="nameAsc"'  + (_sortKey === 'nameAsc'  ? ' selected' : '') + '>' + t('sortNameAZ') + '</option>';
        html += '<option value="nameDesc"' + (_sortKey === 'nameDesc' ? ' selected' : '') + '>' + t('sortNameZA') + '</option>';
        html += '<option value="count"'    + (_sortKey === 'count'    ? ' selected' : '') + '>' + t('sortCount')  + '</option>';
        html += '<option value="dojoAsc"'  + (_sortKey === 'dojoAsc'  ? ' selected' : '') + '>' + t('sortDojo')   + '</option>';
        html += '</select>';
        // Two-segment view switch, same shape as the draft toggle in the exam table
        html += '<div class="view-toggle">';
        html += '<button class="view-toggle-seg' + (view === 'cards' ? ' active' : '') + '" data-view="cards">&#9638; ' + t('viewCards') + '</button>';
        html += '<button class="view-toggle-seg' + (view === 'list' ? ' active' : '') + '" data-view="list">&#9776; ' + t('viewList') + '</button>';
        html += '</div>';
        html += '</div>';

        var filtered = filterAndSort(exams);

        if (filtered.length === 0) {
            html += '<div class="empty-state">';
            html += '<div class="empty-icon">&#128203;</div>';
            html += '<p>' + t('noExams') + '</p>';
            html += '</div>';
        } else {
            html += renderSections(filtered, view);
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

    // Search matches the exam name plus its dojo and class, so "תל אביב" or
    // "בוגרים" finds every exam of that group.
    function filterAndSort(exams) {
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
            if (_sortKey === 'dojoAsc') {
                // ￿ sorts an untagged exam last instead of leading with a blank.
                var ad = a.dojo || '￿', bd = b.dojo || '￿';
                return ad.localeCompare(bd, 'he')
                    || (a.classGroup || '').localeCompare(b.classGroup || '', 'he')
                    || (b.date || '').localeCompare(a.date || '');
            }
            return (b.date || '') > (a.date || '') ? 1 : -1; // dateDesc
        });
        return filtered;
    }

    // --- Folder sections ---

    // With no folders the list renders exactly as it always did — a trainer who
    // never makes one sees no headings and no empty Unfiled section.
    function renderSections(exams, view) {
        var t = App.I18n.t;
        var folders = App.UserPrefs.getFolders();
        if (!folders.length) return renderExamContainer(exams, view);

        var assign = App.UserPrefs.getFolderAssignments();
        var collapsed = getCollapsed();
        var byFolder = {};
        var unfiled = [];
        folders.forEach(function (f) { byFolder[f.id] = []; });
        exams.forEach(function (e) {
            var fid = assign[e.id];
            if (fid && byFolder[fid]) byFolder[fid].push(e);
            else unfiled.push(e);
        });

        var html = '';
        folders.forEach(function (f) {
            html += renderFolderSection(f, byFolder[f.id], view, !!collapsed[f.id], true);
        });
        // Unfiled is always present so there is somewhere to drag exams back to.
        html += renderFolderSection(
            { id: '', name: t('unfiled') }, unfiled, view, !!collapsed['__unfiled'], false);
        return html;
    }

    function renderFolderSection(folder, exams, view, isCollapsed, canEdit) {
        var t = App.I18n.t;
        var esc = App.Utils.escapeHtml;
        var dropId = folder.id || '';

        var html = '<div class="exam-folder' + (isCollapsed ? ' collapsed' : '') +
            '" data-folder-id="' + esc(dropId) + '" data-folder-key="' +
            esc(folder.id || '__unfiled') + '">';
        html += '<div class="exam-folder-header">';
        html += '<button type="button" class="exam-folder-toggle" data-folder-key="' +
            esc(folder.id || '__unfiled') + '">';
        html += '<span class="exam-folder-chevron">' + (isCollapsed ? '&#9656;' : '&#9662;') + '</span>';
        html += '<span class="exam-folder-name">' + esc(folder.name || '') + '</span>';
        html += '<span class="exam-folder-count">' + exams.length + '</span>';
        html += '</button>';
        if (canEdit) {
            html += '<div class="exam-folder-actions">';
            html += '<button class="btn btn-sm btn-outline folder-rename-btn" data-folder-id="' +
                esc(folder.id) + '" title="' + t('renameFolder') + '">&#9998;</button>';
            html += '<button class="btn btn-sm btn-danger folder-delete-btn" data-folder-id="' +
                esc(folder.id) + '" title="' + t('deleteFolder') + '">&#10005;</button>';
            html += '</div>';
        }
        html += '</div>';

        if (!isCollapsed) {
            html += '<div class="exam-folder-body">';
            if (!exams.length) {
                html += '<p class="exam-folder-empty">' + t('emptyFolder') + '</p>';
            } else {
                html += renderExamContainer(exams, view);
            }
            html += '</div>';
        }
        html += '</div>';
        return html;
    }

    function renderExamContainer(exams, view) {
        // A separate class per view, not a restyle of .exam-grid — responsive.css
        // loads after this stylesheet and overrides .exam-grid at two breakpoints.
        var html = '<div class="' + (view === 'list' ? 'exam-list-rows' : 'exam-grid') + '">';
        exams.forEach(function (exam) { html += renderExamCard(exam, view); });
        html += '</div>';
        return html;
    }

    function renderExamCard(exam, view) {
        var t = App.I18n.t;
        var esc = App.Utils.escapeHtml;
        var isOwner = exam.ownerId === App.Auth.getUserId();
        var hasFolders = App.UserPrefs.getFolders().length > 0;
        // Keeping the .exam-card class on list rows means the existing
        // click-to-navigate handler and its button guard work unchanged.
        var cls = 'exam-card' + (view === 'list' ? ' exam-row' : '');
        var group = [exam.dojo, exam.classGroup].filter(Boolean).join(' · ');

        var html = '<div class="' + cls + '" data-id="' + exam.id + '"' +
            (_canDrag() ? ' draggable="true"' : '') + '>';
        html += '<div class="exam-card-header">';
        html += '<h3>' + esc(exam.name) + '</h3>';
        if (hasFolders) {
            html += '<button class="btn btn-sm btn-outline folder-move-btn" data-id="' + exam.id +
                '" title="' + t('moveToFolder') + '">&#128193;</button>';
        }
        if (isOwner) {
            html += '<button class="btn btn-sm btn-outline rename-exam-btn" data-id="' + exam.id + '" title="' + t('editExam') + '">&#9998;</button>';
            html += '<button class="btn btn-sm btn-danger delete-exam-btn" data-id="' + exam.id + '" title="' + t('delete') + '">&#10005;</button>';
        }
        html += '</div>';
        if (group) {
            html += '<div class="exam-card-group">' + esc(group) + '</div>';
        }
        html += '<div class="exam-card-body">';
        html += '<span class="exam-date">' + (exam.date ? App.Utils.formatDate(exam.date) : '') + '</span>';
        html += '<span class="exam-count">' + (exam.examineeCount || 0) + ' ' + t('examinees') + '</span>';
        html += '</div>';
        html += '<div class="exam-card-actions">';
        html += '<button class="btn btn-sm btn-outline export-exam-btn" data-id="' + exam.id + '">' + t('export') + '</button>';
        html += '</div>';
        html += '</div>';
        return html;
    }

    // Drag is pointless on touch — the same call the exam table uses. The folder
    // button is the path that works everywhere, which is why it is not
    // drag-dependent.
    function _canDrag() {
        return !(App.Drawing && App.Drawing.isTouch && App.Drawing.isTouch());
    }

    function bindEvents() {
        var t = App.I18n.t;

        document.getElementById('btn-new-exam').addEventListener('click', showNewExamModal);

        // Search and sort only change what is shown, so they re-render from the
        // exams already in memory — no fetch, no spinner flash per keystroke.
        document.getElementById('exam-search').addEventListener('input', function (e) {
            _searchTerm = e.target.value;
            render({ useCache: true });
        });

        document.getElementById('exam-sort').addEventListener('change', function (e) {
            _sortKey = e.target.value;
            render({ useCache: true });
        });

        document.querySelectorAll('.view-toggle-seg').forEach(function (seg) {
            seg.addEventListener('click', function () {
                setView(seg.dataset.view);
                render({ useCache: true });
            });
        });

        document.getElementById('btn-new-folder').addEventListener('click', function () {
            showFolderNameModal(null);
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

        // Whole-card click opens the exam. Clicks that landed on one of the card's
        // own buttons must not navigate — this covers list rows too, which keep
        // the .exam-card class precisely so this keeps working.
        document.querySelectorAll('.exam-card').forEach(function (card) {
            card.addEventListener('click', function (e) {
                if (e.target.closest('.delete-exam-btn') ||
                    e.target.closest('.export-exam-btn') ||
                    e.target.closest('.rename-exam-btn') ||
                    e.target.closest('.folder-move-btn')) return;
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

        bindFolderEvents();
    }

    function bindFolderEvents() {
        var t = App.I18n.t;

        document.querySelectorAll('.exam-folder-toggle').forEach(function (btn) {
            btn.addEventListener('click', function () {
                toggleCollapsed(btn.dataset.folderKey);
                render({ useCache: true });
            });
        });

        document.querySelectorAll('.folder-rename-btn').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                showFolderNameModal(btn.dataset.folderId);
            });
        });

        document.querySelectorAll('.folder-delete-btn').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                if (!confirm(t('confirmDeleteFolder'))) return;
                // Drops its assignments too, so the exams inside reappear under
                // Unfiled rather than disappearing.
                App.UserPrefs.removeFolder(btn.dataset.folderId);
                render({ useCache: true });
            });
        });

        document.querySelectorAll('.folder-move-btn').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                showMoveToFolderModal(btn.dataset.id);
            });
        });

        if (_canDrag()) bindFolderDragDrop();
    }

    // HTML5 drag to file an exam. Same shape as the reorder handlers in
    // exam-table.js. Touch devices skip this entirely and use the folder button.
    function bindFolderDragDrop() {
        var dragExamId = null;

        document.querySelectorAll('.exam-card[draggable]').forEach(function (card) {
            card.addEventListener('dragstart', function (e) {
                dragExamId = card.dataset.id;
                card.classList.add('exam-card-dragging');
                e.dataTransfer.effectAllowed = 'move';
                try { e.dataTransfer.setData('text/plain', dragExamId); } catch (err) { /* IE */ }
            });
            card.addEventListener('dragend', function () {
                card.classList.remove('exam-card-dragging');
                document.querySelectorAll('.exam-folder-drop-active').forEach(function (x) {
                    x.classList.remove('exam-folder-drop-active');
                });
                dragExamId = null;
            });
        });

        document.querySelectorAll('.exam-folder').forEach(function (section) {
            section.addEventListener('dragover', function (e) {
                if (!dragExamId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                section.classList.add('exam-folder-drop-active');
            });
            section.addEventListener('dragleave', function (e) {
                // Ignore moves between the section's own children.
                if (section.contains(e.relatedTarget)) return;
                section.classList.remove('exam-folder-drop-active');
            });
            section.addEventListener('drop', function (e) {
                e.preventDefault();
                section.classList.remove('exam-folder-drop-active');
                if (!dragExamId) return;
                var target = section.dataset.folderId || '';
                if (App.UserPrefs.getExamFolderId(dragExamId) === target) return;
                fileExam(dragExamId, target);
            });
        });
    }

    // Cache-first: state updates and the screen repaints straight away, the write
    // goes out in the background. Also prunes assignments for exams that no
    // longer exist so the map cannot grow without bound.
    function fileExam(examId, folderId) {
        App.UserPrefs.setExamFolder(examId, folderId, _exams.map(function (e) { return e.id; }));
        render({ useCache: true });
    }

    // --- Folder modals ---

    // folderId null creates a new folder; otherwise renames that one.
    function showFolderNameModal(folderId) {
        var t = App.I18n.t;
        var modalContainer = document.getElementById('modal-container');
        var existing = folderId
            ? App.UserPrefs.getFolders().filter(function (f) { return f.id === folderId; })[0]
            : null;

        var html = '<div class="modal-overlay" id="folder-name-overlay"><div class="modal">';
        html += '<h2>' + (folderId ? t('renameFolder') : t('newFolder')) + '</h2>';
        html += '<div class="form-group">';
        html += '<label for="folder-name-input">' + t('folderName') + '</label>';
        html += '<input type="text" id="folder-name-input" value="' +
            App.Utils.escapeHtml(existing ? existing.name : '') + '">';
        html += '</div>';
        html += '<div class="modal-actions">';
        html += '<button class="btn btn-primary" id="btn-save-folder">' + t('save') + '</button>';
        html += '<button class="btn btn-outline" id="btn-cancel-folder">' + t('cancel') + '</button>';
        html += '</div></div></div>';
        modalContainer.innerHTML = html;

        function close() { modalContainer.innerHTML = ''; }
        function commit() {
            var input = document.getElementById('folder-name-input');
            var name = input.value.trim();
            if (!name) { input.focus(); return; }
            if (folderId) App.UserPrefs.renameFolder(folderId, name);
            else App.UserPrefs.addFolder(name);
            close();
            render({ useCache: true });
        }

        document.getElementById('btn-save-folder').addEventListener('click', commit);
        document.getElementById('btn-cancel-folder').addEventListener('click', close);
        document.getElementById('folder-name-overlay').addEventListener('click', function (e) {
            if (e.target === this) close();
        });
        var input = document.getElementById('folder-name-input');
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter') commit(); });
        input.focus();
        input.select();
    }

    // The path that works everywhere, including touch where drag is disabled.
    function showMoveToFolderModal(examId) {
        var t = App.I18n.t;
        var esc = App.Utils.escapeHtml;
        var modalContainer = document.getElementById('modal-container');
        var folders = App.UserPrefs.getFolders();
        var current = App.UserPrefs.getExamFolderId(examId);
        var exam = _exams.filter(function (e) { return e.id === examId; })[0] || {};

        var html = '<div class="modal-overlay" id="move-folder-overlay"><div class="modal">';
        html += '<h2>' + t('moveToFolder') + '</h2>';
        html += '<p class="invite-subtitle">' + esc(exam.name || '') + '</p>';
        html += '<div class="import-list">';
        folders.forEach(function (f) {
            html += '<button type="button" class="folder-pick-row' +
                (f.id === current ? ' folder-pick-current' : '') +
                '" data-folder-id="' + esc(f.id) + '">';
            html += '<span>&#128193; ' + esc(f.name) + '</span>';
            if (f.id === current) html += '<span class="folder-pick-check">&#10004;</span>';
            html += '</button>';
        });
        html += '<button type="button" class="folder-pick-row' +
            (!current ? ' folder-pick-current' : '') + '" data-folder-id="">';
        html += '<span>' + t('removeFromFolder') + '</span>';
        if (!current) html += '<span class="folder-pick-check">&#10004;</span>';
        html += '</button>';
        html += '</div>';
        html += '<div class="modal-actions">';
        html += '<button class="btn btn-outline" id="btn-cancel-move">' + t('cancel') + '</button>';
        html += '</div></div></div>';
        modalContainer.innerHTML = html;

        function close() { modalContainer.innerHTML = ''; }
        document.querySelectorAll('.folder-pick-row').forEach(function (row) {
            row.addEventListener('click', function () {
                close();
                fileExam(examId, row.dataset.folderId || '');
            });
        });
        document.getElementById('btn-cancel-move').addEventListener('click', close);
        document.getElementById('move-folder-overlay').addEventListener('click', function (e) {
            if (e.target === this) close();
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
