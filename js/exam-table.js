var App = window.App || {};

App.ExamTable = (function () {
    var currentExamId = null;
    var unsubGrades = null;
    var unsubExaminees = null;
    var autoSave = null;
    var cachedExam = null;
    var cachedGrades = {};
    var cachedExaminees = {};
    var categoryOrder = null;
    var customCategories = null;
    var dragSrcEl = null;
    var dragType = null; // 'category' or 'examinee'
    var isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    // --- Draft / private mode helpers ---

    function renderDraftToggle() {
        if (!currentExamId) return '';
        var t = App.I18n.t;
        var userId = App.Auth.getUserId();
        var priv = App.Draft.isPrivate(currentExamId);
        var pending = App.Draft.pendingCount(currentExamId, userId);
        var label = priv
            ? ('🔒 ' + t('privateMode') + (pending ? ' (' + pending + ')' : ''))
            : ('🔓 ' + t('publishedMode'));
        var cls = priv ? 'btn btn-warning' : 'btn btn-outline';
        return '<button class="' + cls + '" id="btn-draft-toggle">' + label + '</button>';
    }

    // Routes a grade save to localStorage (draft) or Firestore depending on current mode.
    function saveGrade(examineeId, catKey, value) {
        var userId = App.Auth.getUserId();
        if (App.Draft.isPrivate(currentExamId)) {
            App.Draft.setGrade(currentExamId, userId, examineeId, catKey, value);
            updateDraftBadge();
        } else {
            App.Storage.updateGrade(currentExamId, examineeId, catKey, value);
        }
    }

    function updateDraftBadge() {
        var btn = document.getElementById('btn-draft-toggle');
        if (!btn) return;
        var t = App.I18n.t;
        var userId = App.Auth.getUserId();
        var pending = App.Draft.pendingCount(currentExamId, userId);
        btn.textContent = '🔒 ' + t('privateMode') + (pending ? ' (' + pending + ')' : '');
    }

    async function render(examId) {
        currentExamId = examId;
        var container = document.getElementById('app');
        App.showLoading();

        cachedExam = await App.Storage.getExam(examId);
        if (!cachedExam) {
            App.Router.navigate('#/');
            return;
        }

        cachedExaminees = cachedExam.examinees || {};
        cachedGrades = cachedExam.allGrades || {};
        categoryOrder = cachedExam.categoryOrder || App.Utils.DEFAULT_CATEGORY_ORDER;
        customCategories = cachedExam.customCategories || {};

        autoSave = App.Utils.debounce(function (examineeId, catKey, value) {
            saveGrade(examineeId, catKey, value);
        }, 300);

        renderTable();

        unsubGrades = App.Storage.subscribeToGrades(examId, function (allGrades) {
            cachedGrades = allGrades;
            updateGradeCells();
        });

        unsubExaminees = App.Storage.subscribeToExaminees(examId, function (examinees) {
            cachedExaminees = examinees;
            renderTable();
        });

        return cleanup;
    }

    function cleanup() {
        if (unsubGrades) { unsubGrades(); unsubGrades = null; }
        if (unsubExaminees) { unsubExaminees(); unsubExaminees = null; }
    }

    function renderTable() {
        var t = App.I18n.t;
        var lang = App.I18n.getLang();
        var container = document.getElementById('app');
        var exam = cachedExam;
        var examinees = getSortedExaminees();
        var categories = App.Utils.getCategoriesOrdered(categoryOrder, customCategories);
        var currentUserId = App.Auth.getUserId();
        var isOwner = exam.ownerId === currentUserId;
        var trainerNames = exam.trainerNames || {};
        var trainerIds = exam.trainerIds || [];
        var otherTrainers = trainerIds.filter(function (id) { return id !== currentUserId; });

        var html = '<div class="exam-table-page">';
        html += '<button class="back-btn" id="btn-back-list">&larr; ' + t('back') + '</button>';
        html += '<div class="toolbar">';
        html += '<h2 class="page-title">' + App.Utils.escapeHtml(exam.name) + '</h2>';
        html += '<span class="exam-date-badge">' + (exam.date ? App.Utils.formatDate(exam.date) : '') + '</span>';
        html += '<div class="toolbar-spacer"></div>';
        html += '<button class="btn btn-primary" id="btn-add-examinee">+ ' + t('addExaminee') + '</button>';
        html += '<button class="btn btn-outline" id="btn-general-remarks">' + t('generalRemarks') + '</button>';
        html += renderDraftToggle();

        // Manage Test dropdown — collapses copy/import/export/share/invite
        html += '<div class="menu-wrapper" id="manage-test-wrapper">';
        html += '<button class="btn btn-outline" id="btn-manage-test">' + t('manageTest') + ' &#9662;</button>';
        html += '<div class="menu-dropdown" id="manage-test-menu">';
        html += '<button class="menu-item" data-action="copy">' + t('copyExaminees') + '</button>';
        html += '<button class="menu-item" data-action="import">' + t('importStudents') + '</button>';
        html += '<button class="menu-item" data-action="export">' + t('export') + '</button>';
        if (isOwner) {
            html += '<button class="menu-item" data-action="share">' + t('shareExam') + '</button>';
            html += '<button class="menu-item" data-action="invite">' + t('inviteExaminees') + '</button>';
        }
        html += '</div></div>';
        html += '<input type="file" id="import-students-file" accept=".xlsx,.csv,.json" style="display:none">';
        html += '</div>';

        if (examinees.length === 0) {
            html += '<div class="empty-state">';
            html += '<p>' + t('addExaminee') + '</p>';
            html += '</div>';
        } else {
            html += '<div class="table-wrapper">';
            html += '<table class="grading-table">';

            // Header row - examinees are draggable
            html += '<thead><tr>';
            html += '<th class="sticky-col category-header">';
            html += '<div class="cat-header-content">';
            html += '<span>' + t('category') + '</span>';
            html += '<div class="menu-wrapper" id="cat-header-menu-wrapper">';
            html += '<button class="cat-header-menu-btn" id="btn-cat-header-menu" title="' + t('options') + '">&#8942;</button>';
            html += '<div class="menu-dropdown menu-dropdown-cat" id="cat-header-menu">';
            html += '<button class="menu-item" data-action="sort">' + t('sort') + '</button>';
            html += '<button class="menu-item" data-action="manage">' + t('manageCategories') + '</button>';
            html += '</div></div>';
            html += '</div>';
            html += '</th>';
            examinees.forEach(function (ex, idx) {
                html += '<th class="examinee-header" data-id="' + ex.id + '" data-order="' + idx + '"' + (isTouch ? '' : ' draggable="true"') + '>';
                html += '<div class="examinee-header-content">';
                html += '<button class="btn btn-sm export-rec-btn" data-id="' + ex.id + '" title="' + t('exportRecommendation') + '">&#128196;</button>';
                html += '<div class="drag-handle" title="' + t('dragToReorder') + '">&#8942;&#8942;</div>';
                if (ex.photoUrl) {
                    html += '<img src="' + ex.photoUrl + '" class="examinee-thumb" alt="">';
                }
                html += '<a href="#/exam/' + currentExamId + '/examinee/' + ex.id + '" class="examinee-name-link">';
                html += App.Utils.escapeHtml(ex.firstName + ' ' + ex.lastName);
                html += '</a>';
                if (ex.rank) {
                    html += '<span class="examinee-rank">' + App.Utils.escapeHtml(ex.rank) + '</span>';
                }
                html += '<button class="btn btn-sm btn-danger remove-examinee-btn" data-id="' + ex.id + '" title="' + t('removeExaminee') + '">&#10005;</button>';
                html += '</div>';
                html += '</th>';
            });
            html += '</tr></thead>';

            // Body rows - categories are draggable
            html += '<tbody>';
            categories.forEach(function (cat, idx) {
                html += '<tr data-cat-key="' + cat.key + '" data-cat-order="' + idx + '">';
                html += '<td class="sticky-col category-cell"' + (isTouch ? '' : ' draggable="true"') + '>';
                html += '<span class="drag-handle-row" title="' + t('dragToReorder') + '">&#8942;&#8942;</span> ';
                html += cat[lang];
                html += '</td>';
                examinees.forEach(function (ex) {
                    html += '<td class="grade-cell" data-examinee="' + ex.id + '" data-category="' + cat.key + '">';
                    if (cat.type === 'passfail') {
                        html += renderPassFailCell(ex.id, cat.key, currentUserId, otherTrainers, trainerNames);
                    } else {
                        html += renderGradeCell(ex.id, cat.key, currentUserId, otherTrainers, trainerNames, cat);
                    }
                    html += '</td>';
                });
                html += '</tr>';
            });
            html += '</tbody>';

            html += '</table>';
            html += '</div>';
        }

        html += '</div>';
        html += '<div id="modal-container"></div>';
        container.innerHTML = html;

        bindEvents();
        bindDragDrop();
        autoResizeTextareas();
    }

    function renderGradeCell(examineeId, catKey, currentUserId, otherTrainers, trainerNames, cat) {
        var html = '';
        var t = App.I18n.t;
        var exGrades = cachedGrades[examineeId] || {};

        // Other trainers' notes and marks
        otherTrainers.forEach(function (tid) {
            var tGrades = exGrades[tid];
            var val = tGrades ? (tGrades[catKey] || '') : '';
            var mark = tGrades ? (tGrades[catKey + '_mark'] || '') : '';
            if (val || mark) {
                var name = (tGrades && tGrades.trainerName) || trainerNames[tid] || tid.slice(0, 6);
                html += '<div class="other-trainer-note">';
                html += '<span class="trainer-label">' + App.Utils.escapeHtml(name) + ':</span>';
                if (mark) html += '<span class="comp-badge comp-badge-' + mark + '">' + _markLabel(mark) + '</span> ';
                if (val) html += '<span class="trainer-text">' + App.Utils.escapeHtml(val) + '</span>';
                html += '</div>';
            }
        });

        // My competence mark buttons
        var myGrades = exGrades[currentUserId];
        var myMark = myGrades ? (myGrades[catKey + '_mark'] || '') : '';
        var myVal = myGrades ? (myGrades[catKey] || '') : '';

        // Check draft overlay
        var draftData = App.Draft && App.Draft.isPrivate(currentExamId)
            ? (App.Draft.getDraft(currentExamId, currentUserId)[examineeId] || {})
            : {};
        if (draftData[catKey] !== undefined) myVal = draftData[catKey];
        if (draftData[catKey + '_mark'] !== undefined) myMark = draftData[catKey + '_mark'];

        if (!cat || !cat.hideMarks) {
            html += '<div class="competence-marks" data-examinee="' + examineeId + '" data-category="' + catKey + '">';
            html += '<button class="comp-btn comp-v' + (myMark === 'v' ? ' active' : '') + '" data-mark="v" title="' + t('competenceV') + '">✓</button>';
            html += '<button class="comp-btn comp-q' + (myMark === 'q' ? ' active' : '') + '" data-mark="q" title="' + t('competenceQ') + '">?</button>';
            html += '<button class="comp-btn comp-x' + (myMark === 'x' ? ' active' : '') + '" data-mark="x" title="' + t('competenceX') + '">✗</button>';
            html += '</div>';
        }

        html += '<textarea class="grade-textarea" data-examinee="' + examineeId + '" data-category="' + catKey + '" placeholder="' + t('enterNotes') + '">' + App.Utils.escapeHtml(myVal) + '</textarea>';

        return html;
    }

    function _markLabel(mark) {
        var t = App.I18n.t;
        if (mark === 'v') return '✓ ' + t('competenceV');
        if (mark === 'q') return '? ' + t('competenceQ');
        if (mark === 'x') return '✗ ' + t('competenceX');
        return mark;
    }

    function renderPassFailCell(examineeId, catKey, currentUserId, otherTrainers, trainerNames) {
        var html = '';
        var exGrades = cachedGrades[examineeId] || {};
        var t = App.I18n.t;

        // Show other trainers' decisions
        otherTrainers.forEach(function (tid) {
            var tGrades = exGrades[tid];
            var val = tGrades ? (tGrades[catKey] || '') : '';
            if (val) {
                var name = (tGrades && tGrades.trainerName) || trainerNames[tid] || tid.slice(0, 6);
                var isConditional = val.indexOf('conditional:') === 0;
                var cls, label;
                if (isConditional) {
                    cls = 'conditional-badge';
                    label = t('conditionalPass');
                } else {
                    cls = val === 'pass' ? 'pass-badge' : val === 'fail' ? 'fail-badge' : '';
                    label = val === 'pass' ? t('pass') : val === 'fail' ? t('fail') : val;
                }
                html += '<div class="other-trainer-note">';
                html += '<span class="trainer-label">' + App.Utils.escapeHtml(name) + ':</span>';
                html += '<span class="' + cls + '">' + label + '</span>';
                if (isConditional) {
                    var cond = val.substring(12);
                    if (cond) html += '<div class="condition-text">' + App.Utils.escapeHtml(cond) + '</div>';
                }
                html += '</div>';
            }
        });

        // Current user's selection
        var myGrades = exGrades[currentUserId];
        var myVal = myGrades ? (myGrades[catKey] || '') : '';
        var myNewRank = myGrades ? (myGrades[catKey + '_newRank'] || '') : '';
        var isMyConditional = myVal.indexOf('conditional:') === 0;
        var myConditionText = isMyConditional ? myVal.substring(12) : '';
        var showNewRank = (myVal === 'pass' || isMyConditional);

        html += '<div class="passfail-selector" data-examinee="' + examineeId + '" data-category="' + catKey + '">';
        html += '<button class="pf-btn pf-pass' + (myVal === 'pass' ? ' active' : '') + '" data-value="pass">' + t('pass') + '</button>';
        html += '<button class="pf-btn pf-fail' + (myVal === 'fail' ? ' active' : '') + '" data-value="fail">' + t('fail') + '</button>';
        html += '<button class="pf-btn pf-conditional' + (isMyConditional ? ' active' : '') + '" data-value="conditional">' + t('conditionalPass') + '</button>';
        html += '</div>';
        html += '<textarea class="condition-input' + (isMyConditional ? '' : ' hidden') + '" data-examinee="' + examineeId + '" data-category="' + catKey + '" placeholder="' + t('enterCondition') + '">' + App.Utils.escapeHtml(myConditionText) + '</textarea>';

        // New rank dropdown — visible only when pass or conditional is active
        html += '<div class="newrank-wrapper' + (showNewRank ? '' : ' hidden') + '" data-examinee="' + examineeId + '" data-category="' + catKey + '">';
        html += '<label class="newrank-label">' + t('newRank') + '</label>';
        html += '<select class="newrank-select">';
        html += '<option value=""></option>';
        App.Utils.RANK_GROUPS.forEach(function (group) {
            html += '<optgroup label="' + App.Utils.escapeHtml(group.label) + '">';
            group.ranks.forEach(function (rank) {
                html += '<option value="' + App.Utils.escapeHtml(rank) + '"' + (myNewRank === rank ? ' selected' : '') + '>' + App.Utils.escapeHtml(rank) + '</option>';
            });
            html += '</optgroup>';
        });
        html += '</select>';
        html += '</div>';

        return html;
    }

    function updateGradeCells() {
        var currentUserId = App.Auth.getUserId();
        var trainerNames = (cachedExam && cachedExam.trainerNames) || {};
        var trainerIds = (cachedExam && cachedExam.trainerIds) || [];
        var otherTrainers = trainerIds.filter(function (id) { return id !== currentUserId; });

        document.querySelectorAll('.grade-cell').forEach(function (cell) {
            var exId = cell.dataset.examinee;
            var catKey = cell.dataset.category;
            if (!exId || !catKey) return;

            var existingNotes = cell.querySelectorAll('.other-trainer-note');
            existingNotes.forEach(function (n) { n.remove(); });

            var exGrades = cachedGrades[exId] || {};
            var textarea = cell.querySelector('.grade-textarea');
            var pfSelector = cell.querySelector('.passfail-selector');

            otherTrainers.forEach(function (tid) {
                var tGrades = exGrades[tid];
                var val = tGrades ? (tGrades[catKey] || '') : '';
                if (val) {
                    var name = (tGrades && tGrades.trainerName) || trainerNames[tid] || tid.slice(0, 6);
                    var noteDiv = document.createElement('div');
                    noteDiv.className = 'other-trainer-note';
                    if (catKey === 'rank_approval') {
                        var isConditional = val.indexOf('conditional:') === 0;
                        var cls, label;
                        if (isConditional) {
                            cls = 'conditional-badge';
                            label = App.I18n.t('conditionalPass');
                        } else {
                            cls = val === 'pass' ? 'pass-badge' : val === 'fail' ? 'fail-badge' : '';
                            label = val === 'pass' ? App.I18n.t('pass') : val === 'fail' ? App.I18n.t('fail') : val;
                        }
                        noteDiv.innerHTML = '<span class="trainer-label">' + App.Utils.escapeHtml(name) + ':</span><span class="' + cls + '">' + label + '</span>';
                        if (isConditional) {
                            var cond = val.substring(12);
                            if (cond) noteDiv.innerHTML += '<div class="condition-text">' + App.Utils.escapeHtml(cond) + '</div>';
                        }
                    } else {
                        noteDiv.innerHTML = '<span class="trainer-label">' + App.Utils.escapeHtml(name) + ':</span><span class="trainer-text">' + App.Utils.escapeHtml(val) + '</span>';
                    }
                    cell.insertBefore(noteDiv, textarea || pfSelector);
                }
            });

            // Update my textarea (skip if focused — don't interrupt typing)
            var myGrades = exGrades[currentUserId];
            if (textarea && document.activeElement !== textarea) {
                var myVal = myGrades ? (myGrades[catKey] || '') : '';
                // Don't overwrite if we're in draft mode (local value takes precedence)
                if (!App.Draft.isPrivate(currentExamId) && textarea.value !== myVal) {
                    textarea.value = myVal;
                }
            }

            // Update my competence mark buttons
            var markGroup = cell.querySelector('.competence-marks');
            if (markGroup) {
                var myMark = myGrades ? (myGrades[catKey + '_mark'] || '') : '';
                markGroup.querySelectorAll('.comp-btn').forEach(function (btn) {
                    btn.classList.toggle('active', btn.dataset.mark === myMark);
                });
            }
        });
    }

    function getSortedExaminees() {
        return Object.values(cachedExaminees).sort(function (a, b) {
            return (a.order || 0) - (b.order || 0);
        });
    }

    function autoResizeTextareas() {
        document.querySelectorAll('.grade-textarea').forEach(function (ta) {
            ta.style.height = 'auto';
            ta.style.height = Math.max(60, ta.scrollHeight) + 'px';
        });
    }

    // --- Drag & Drop ---

    function bindDragDrop() {
        // Examinee header drag
        document.querySelectorAll('.examinee-header[draggable]').forEach(function (el) {
            el.addEventListener('dragstart', function (e) {
                dragType = 'examinee';
                dragSrcEl = el;
                el.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', el.dataset.id);
            });
            el.addEventListener('dragover', function (e) {
                if (dragType !== 'examinee') return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                el.classList.add('drag-over');
            });
            el.addEventListener('dragleave', function () {
                el.classList.remove('drag-over');
            });
            el.addEventListener('drop', async function (e) {
                e.preventDefault();
                el.classList.remove('drag-over');
                if (dragType !== 'examinee' || dragSrcEl === el) return;
                var fromId = dragSrcEl.dataset.id;
                var toId = el.dataset.id;
                await reorderExaminees(fromId, toId);
            });
            el.addEventListener('dragend', function () {
                el.classList.remove('dragging');
                document.querySelectorAll('.drag-over').forEach(function (x) { x.classList.remove('drag-over'); });
            });
        });

        // Category row drag
        document.querySelectorAll('.category-cell[draggable]').forEach(function (el) {
            var row = el.parentElement;
            el.addEventListener('dragstart', function (e) {
                dragType = 'category';
                dragSrcEl = row;
                row.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', row.dataset.catKey);
            });
            el.addEventListener('dragover', function (e) {
                if (dragType !== 'category') return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                row.classList.add('drag-over');
            });
            el.addEventListener('dragleave', function () {
                row.classList.remove('drag-over');
            });
            el.addEventListener('drop', async function (e) {
                e.preventDefault();
                row.classList.remove('drag-over');
                if (dragType !== 'category' || dragSrcEl === row) return;
                var fromKey = dragSrcEl.dataset.catKey;
                var toKey = row.dataset.catKey;
                await reorderCategories(fromKey, toKey);
            });
            el.addEventListener('dragend', function () {
                row.classList.remove('dragging');
                document.querySelectorAll('.drag-over').forEach(function (x) { x.classList.remove('drag-over'); });
            });
        });
    }

    async function reorderExaminees(fromId, toId) {
        var examinees = getSortedExaminees();
        var fromIdx = examinees.findIndex(function (e) { return e.id === fromId; });
        var toIdx = examinees.findIndex(function (e) { return e.id === toId; });
        if (fromIdx === -1 || toIdx === -1) return;

        var item = examinees.splice(fromIdx, 1)[0];
        examinees.splice(toIdx, 0, item);

        await applyExamineeOrder(examinees.map(function (e) { return e.id; }));
    }

    async function applyExamineeOrder(idsInOrder) {
        for (var i = 0; i < idsInOrder.length; i++) {
            var ex = cachedExaminees[idsInOrder[i]];
            if (!ex) continue;
            if (ex.order !== i) {
                ex.order = i;
                await App.Storage.updateExaminee(currentExamId, idsInOrder[i], { order: i });
            }
        }
    }

    // Build a rank → index map. Lower index = lower rank. Unranked students get Infinity.
    // Tier ordering: adults > kids 10+ > kids under 10. RANK_GROUPS is stored in display
    // order (adults first for the UI dropdown), so we iterate in REVERSE so kids<10 get
    // the lowest indices and adults get the highest — adult dan 4 ends up as the top rank.
    // For duplicate names (e.g. "לבנה" in both kids groups), first match wins — which
    // under the reversed iteration is kids<10. Acceptable for a rare edge case.
    function getRankIndexMap() {
        var map = {};
        var idx = 0;
        var groups = (App.Utils.RANK_GROUPS || []).slice().reverse();
        groups.forEach(function (group) {
            group.ranks.forEach(function (rank) {
                if (!(rank in map)) map[rank] = idx;
                idx++;
            });
        });
        return map;
    }

    async function sortExamineesByKey(key, direction) {
        var list = getSortedExaminees();
        var rankMap = key === 'rank' ? getRankIndexMap() : null;
        var desc = direction === 'desc';
        list.sort(function (a, b) {
            var av, bv;
            if (key === 'firstName') {
                av = (a.firstName || '').trim();
                bv = (b.firstName || '').trim();
            } else if (key === 'lastName') {
                av = (a.lastName || '').trim();
                bv = (b.lastName || '').trim();
            } else if (key === 'rank') {
                av = rankMap[a.rank];
                bv = rankMap[b.rank];
                // Unranked always sorted last, regardless of direction
                if (av === undefined && bv === undefined) return 0;
                if (av === undefined) return 1;
                if (bv === undefined) return -1;
                return desc ? (bv - av) : (av - bv);
            }
            // Empty strings always last, regardless of direction
            if (!av && !bv) return 0;
            if (!av) return 1;
            if (!bv) return -1;
            var cmp = av.localeCompare(bv, 'he');
            return desc ? -cmp : cmp;
        });
        await applyExamineeOrder(list.map(function (e) { return e.id; }));
    }

    function showExportModal() {
        var t = App.I18n.t;
        var modalContainer = document.getElementById('modal-container');
        var html = '<div class="modal-overlay" id="export-overlay"><div class="modal">';
        html += '<h2>' + t('export') + '</h2>';
        html += '<div class="sort-options">';
        html += '<button class="btn btn-outline btn-block" id="btn-export-excel">' + t('exportToExcel') + '</button>';
        html += '<button class="btn btn-outline btn-block" id="btn-export-csv">' + t('exportToCsv') + '</button>';
        html += '<button class="btn btn-outline btn-block" id="btn-export-json">' + t('exportJson') + '</button>';
        html += '</div>';
        html += '<div class="modal-actions">';
        html += '<button class="btn btn-outline" id="btn-close-export">' + t('cancel') + '</button>';
        html += '</div></div></div>';
        modalContainer.innerHTML = html;

        document.getElementById('btn-export-excel').addEventListener('click', async function () {
            modalContainer.innerHTML = '';
            try { await App.Storage.exportExamineesToExcel(currentExamId); }
            catch (err) { alert(t('error') + ': ' + (err.message || err)); }
        });
        document.getElementById('btn-export-csv').addEventListener('click', async function () {
            modalContainer.innerHTML = '';
            try { await App.Storage.exportExamineesToCsv(currentExamId); }
            catch (err) { alert(t('error') + ': ' + (err.message || err)); }
        });
        document.getElementById('btn-export-json').addEventListener('click', function () {
            modalContainer.innerHTML = '';
            App.Storage.exportExam(currentExamId);
        });
        document.getElementById('btn-close-export').addEventListener('click', function () { modalContainer.innerHTML = ''; });
        document.getElementById('export-overlay').addEventListener('click', function (e) { if (e.target === this) modalContainer.innerHTML = ''; });
    }

    function showSortModal() {
        var t = App.I18n.t;
        var modalContainer = document.getElementById('modal-container');
        var html = '<div class="modal-overlay" id="sort-overlay"><div class="modal">';
        html += '<h2>' + t('sortExaminees') + '</h2>';
        html += '<div class="sort-options">';
        html += '<button class="btn btn-outline btn-block sort-opt-btn" data-key="firstName" data-dir="asc">' + t('sortByFirstName') + '</button>';
        html += '<button class="btn btn-outline btn-block sort-opt-btn" data-key="lastName" data-dir="asc">' + t('sortByLastName') + '</button>';
        html += '<button class="btn btn-outline btn-block sort-opt-btn" data-key="rank" data-dir="asc">' + t('sortByRankAsc') + '</button>';
        html += '<button class="btn btn-outline btn-block sort-opt-btn" data-key="rank" data-dir="desc">' + t('sortByRankDesc') + '</button>';
        html += '</div>';
        html += '<div class="modal-actions">';
        html += '<button class="btn btn-outline" id="btn-close-sort">' + t('cancel') + '</button>';
        html += '</div></div></div>';
        modalContainer.innerHTML = html;

        document.querySelectorAll('.sort-opt-btn').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                modalContainer.innerHTML = '';
                await sortExamineesByKey(btn.dataset.key, btn.dataset.dir);
                renderTable();
            });
        });
        document.getElementById('btn-close-sort').addEventListener('click', function () { modalContainer.innerHTML = ''; });
        document.getElementById('sort-overlay').addEventListener('click', function (e) { if (e.target === this) modalContainer.innerHTML = ''; });
    }

    async function reorderCategories(fromKey, toKey) {
        var order = categoryOrder.slice();
        var fromIdx = order.indexOf(fromKey);
        var toIdx = order.indexOf(toKey);
        if (fromIdx === -1 || toIdx === -1) return;

        var item = order.splice(fromIdx, 1)[0];
        order.splice(toIdx, 0, item);
        categoryOrder = order;
        await App.Storage.updateCategoryOrder(currentExamId, order);
        renderTable();
    }

    // --- Recommendation Export ---

    function exportRecommendation(examineeId) {
        var t = App.I18n.t;
        var lang = App.I18n.getLang();
        var ex = cachedExaminees[examineeId];
        if (!ex) return;

        var exam = cachedExam;
        var categories = App.Utils.getCategoriesOrdered(categoryOrder, customCategories);
        var exGrades = cachedGrades[examineeId] || {};
        var trainerNames = exam.trainerNames || {};
        var dir = lang === 'he' ? 'rtl' : 'ltr';

        var html = '<!DOCTYPE html><html lang="' + lang + '" dir="' + dir + '"><head>';
        html += '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">';
        html += '<title>' + t('exportRecommendation') + ' - ' + App.Utils.escapeHtml(ex.firstName + ' ' + ex.lastName) + '</title>';
        html += '<style>';
        html += 'body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; color: #212121; direction: ' + dir + '; }';
        html += 'h1 { color: #1a237e; border-bottom: 2px solid #1a237e; padding-bottom: 8px; font-size: 1.5rem; }';
        html += 'h2 { color: #3949ab; font-size: 1.1rem; margin-top: 20px; }';
        html += '.info { display: flex; flex-wrap: wrap; gap: 16px; margin: 16px 0; padding: 16px; background: #f5f5f5; border-radius: 8px; }';
        html += '.info-item { flex: 1; min-width: 150px; } .info-label { font-weight: 600; color: #757575; font-size: 0.85rem; } .info-value { font-size: 1rem; }';
        html += '.category { margin: 12px 0; padding: 12px; border: 1px solid #e0e0e0; border-radius: 6px; }';
        html += '.cat-name { font-weight: 700; color: #1a237e; margin-bottom: 6px; }';
        html += '.trainer-note { margin: 4px 0; padding: 4px 8px; background: #f0f0f5; border-radius: 4px; font-size: 0.9rem; }';
        html += '.trainer-name { font-weight: 600; color: #3949ab; }';
        html += '.pass-badge { color: #2e7d32; font-weight: 700; } .fail-badge { color: #c62828; font-weight: 700; } .conditional-badge { color: #e65100; font-weight: 700; }';
        html += '.footer { margin-top: 32px; text-align: center; color: #757575; font-size: 0.8rem; }';
        html += '@media print { body { padding: 0; } }';
        html += '</style></head><body>';

        html += '<h1>' + t('exportRecommendation') + '</h1>';

        // Examinee info
        html += '<div class="info">';
        html += '<div class="info-item"><div class="info-label">' + t('fullName') + '</div><div class="info-value">' + App.Utils.escapeHtml(ex.firstName + ' ' + ex.lastName) + '</div></div>';
        if (ex.rank) html += '<div class="info-item"><div class="info-label">' + t('rank') + '</div><div class="info-value">' + App.Utils.escapeHtml(ex.rank) + '</div></div>';
        if (ex.club) html += '<div class="info-item"><div class="info-label">' + t('club') + '</div><div class="info-value">' + App.Utils.escapeHtml(ex.club) + '</div></div>';
        var beltDisplay = Array.isArray(ex.beltTrainings) ? ex.beltTrainings.length : ex.beltTrainings;
        if (beltDisplay) html += '<div class="info-item"><div class="info-label">' + t('beltTrainings') + '</div><div class="info-value">' + App.Utils.escapeHtml(String(beltDisplay)) + '</div></div>';
        if (ex.gasshukuCount) html += '<div class="info-item"><div class="info-label">' + t('gasshukuCount') + '</div><div class="info-value">' + App.Utils.escapeHtml(String(ex.gasshukuCount)) + '</div></div>';
        if (ex.examPayment) {
            var payLabel = ex.examPayment === 'paid' ? t('paid') : ex.examPayment === 'unpaid' ? t('unpaid') : ex.examPayment === 'exempt' ? t('exempt') : ex.examPayment;
            html += '<div class="info-item"><div class="info-label">' + t('examPayment') + '</div><div class="info-value">' + payLabel + '</div></div>';
        }
        if (ex.formSubmitted) {
            var formLabel = ex.formSubmitted === 'submitted' ? t('submitted') : t('notSubmitted');
            html += '<div class="info-item"><div class="info-label">' + t('formSubmitted') + '</div><div class="info-value">' + formLabel + '</div></div>';
        }
        if (ex.theoryExamGrade) html += '<div class="info-item"><div class="info-label">' + t('theoryExamGrade') + '</div><div class="info-value">' + App.Utils.escapeHtml(String(ex.theoryExamGrade)) + '</div></div>';
        html += '<div class="info-item"><div class="info-label">' + t('examName') + '</div><div class="info-value">' + App.Utils.escapeHtml(exam.name) + '</div></div>';
        if (exam.date) html += '<div class="info-item"><div class="info-label">' + t('examDate') + '</div><div class="info-value">' + App.Utils.formatDate(exam.date) + '</div></div>';
        html += '</div>';

        // Grades by category
        html += '<h2>' + t('examNotes') + '</h2>';
        categories.forEach(function (cat) {
            var hasContent = false;
            var catHtml = '<div class="category"><div class="cat-name">' + cat[lang] + '</div>';

            // All trainers' notes (anonymous — no trainer names)
            var allTrainerIds = exam.trainerIds || [];
            allTrainerIds.forEach(function (tid) {
                var tGrades = exGrades[tid];
                var val = tGrades ? (tGrades[cat.key] || '') : '';
                if (val) {
                    hasContent = true;
                    if (cat.type === 'passfail') {
                        var isConditional = val.indexOf('conditional:') === 0;
                        var label, cls;
                        if (isConditional) {
                            label = t('conditionalPass');
                            cls = 'conditional-badge';
                            var condition = val.substring(12);
                            catHtml += '<div class="trainer-note"><span class="' + cls + '">' + label + '</span>';
                            if (condition) catHtml += ' — ' + App.Utils.escapeHtml(condition);
                            catHtml += '</div>';
                        } else {
                            label = val === 'pass' ? t('pass') : val === 'fail' ? t('fail') : val;
                            cls = val === 'pass' ? 'pass-badge' : 'fail-badge';
                            catHtml += '<div class="trainer-note"><span class="' + cls + '">' + label + '</span></div>';
                        }
                    } else {
                        var mark = tGrades ? (tGrades[cat.key + '_mark'] || '') : '';
                        var markHtml = (mark && !cat.hideMarks)
                            ? '<span style="font-weight:700;color:' + (mark === 'v' ? '#2e7d32' : mark === 'q' ? '#e65100' : '#c62828') + '">' +
                              (mark === 'v' ? '✓' : mark === 'q' ? '?' : '✗') + '</span> '
                            : '';
                        catHtml += '<div class="trainer-note">' + markHtml + App.Utils.escapeHtml(val) + '</div>';
                    }
                }
            });

            catHtml += '</div>';
            if (hasContent) html += catHtml;
        });

        html += '<div class="footer">' + t('generatedOn') + ' ' + new Date().toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US') + '</div>';
        html += '</body></html>';

        // Open in new window for printing
        var win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
    }

    // Wires a button → dropdown menu pair. Toggles open class, handles click-outside,
    // and dispatches data-action on menu-item click to the supplied callback.
    function bindMenuDropdown(triggerId, menuId, onAction, opts) {
        var trigger = document.getElementById(triggerId);
        var menu = document.getElementById(menuId);
        if (!trigger || !menu) return;
        var fixed = opts && opts.fixed;

        function close() {
            menu.classList.remove('open');
            document.removeEventListener('click', outsideHandler, true);
        }
        function outsideHandler(e) {
            if (!menu.contains(e.target) && e.target !== trigger) close();
        }
        trigger.addEventListener('click', function (e) {
            e.stopPropagation();
            var wasOpen = menu.classList.contains('open');
            // Close any other open menus first
            document.querySelectorAll('.menu-dropdown.open').forEach(function (m) { m.classList.remove('open'); });
            if (!wasOpen) {
                if (fixed) {
                    var rect = trigger.getBoundingClientRect();
                    menu.style.top = (rect.bottom + 4) + 'px';
                    menu.style.insetInlineEnd = (window.innerWidth - rect.right) + 'px';
                }
                menu.classList.add('open');
                setTimeout(function () { document.addEventListener('click', outsideHandler, true); }, 0);
            }
        });
        menu.querySelectorAll('.menu-item').forEach(function (item) {
            item.addEventListener('click', function (e) {
                e.stopPropagation();
                close();
                onAction(item.dataset.action);
            });
        });
    }

    function bindEvents() {
        var t = App.I18n.t;

        document.getElementById('btn-back-list').addEventListener('click', function () {
            App.Router.navigate('#/');
        });

        document.getElementById('btn-add-examinee').addEventListener('click', function () {
            showAddExamineeModal();
        });

        document.getElementById('btn-general-remarks').addEventListener('click', showGeneralRemarksModal);

        // Manage Test dropdown
        bindMenuDropdown('btn-manage-test', 'manage-test-menu', function (action) {
            if (action === 'copy') showCopyExamineesModal();
            else if (action === 'import') document.getElementById('import-students-file').click();
            else if (action === 'export') showExportModal();
            else if (action === 'share') showShareModal();
            else if (action === 'invite') showInviteModal();
        });

        // Category header three-dots menu
        bindMenuDropdown('btn-cat-header-menu', 'cat-header-menu', function (action) {
            if (action === 'sort') showSortModal();
            else if (action === 'manage') showManageCategoriesModal();
        }, { fixed: true });

        document.getElementById('btn-draft-toggle').addEventListener('click', async function () {
            var userId = App.Auth.getUserId();
            if (App.Draft.isPrivate(currentExamId)) {
                // Publish draft
                var pending = App.Draft.pendingCount(currentExamId, userId);
                if (pending > 0) {
                    if (!confirm(t('publishDraft') + ' (' + pending + ')?')) return;
                    await App.Draft.publish(currentExamId, userId);
                    App.showToast(t('draftPublished'));
                }
                App.Draft.setMode(currentExamId, 'published');
            } else {
                App.Draft.setMode(currentExamId, 'private');
            }
            renderTable();
        });

        document.getElementById('import-students-file').addEventListener('change', async function (e) {
            var file = e.target.files[0];
            if (!file) return;
            e.target.value = ''; // reset so same file can be reselected later
            var lower = file.name.toLowerCase();
            try {
                App.showToast(t('loading'));
                if (lower.endsWith('.json')) {
                    await new Promise(function (resolve, reject) {
                        App.Storage.importExam(file, function (err) { err ? reject(err) : resolve(); });
                    });
                } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) {
                    await App.Storage.importExamineesFromFile(currentExamId, file);
                    App.showToast(t('studentsImported'));
                } else {
                    alert(t('invalidFileFormat'));
                }
            } catch (err) {
                alert(t('error') + ': ' + (err.message || err));
            }
        });

        document.querySelectorAll('.remove-examinee-btn').forEach(function (btn) {
            btn.addEventListener('click', async function (e) {
                e.stopPropagation();
                e.preventDefault();
                var exId = btn.dataset.id;
                var exData = cachedExaminees[exId];
                if (!exData) return;
                await App.Storage.removeExaminee(currentExamId, exId);
                App.Undo.push('examineeDeleted', async function () {
                    await App.Storage.restoreExaminee(currentExamId, exId, exData);
                });
            });
        });

        document.querySelectorAll('.export-rec-btn').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                e.preventDefault();
                exportRecommendation(btn.dataset.id);
            });
        });

        document.querySelectorAll('.grade-textarea').forEach(function (ta) {
            ta.addEventListener('input', function () {
                ta.style.height = 'auto';
                ta.style.height = Math.max(60, ta.scrollHeight) + 'px';
                autoSave(ta.dataset.examinee, ta.dataset.category, ta.value);
            });
        });

        // Pass/fail buttons
        document.querySelectorAll('.passfail-selector').forEach(function (sel) {
            var cell = sel.parentElement;
            var condInput = cell.querySelector('.condition-input');
            var newRankWrapper = cell.querySelector('.newrank-wrapper');
            sel.querySelectorAll('.pf-btn').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var exId = sel.dataset.examinee;
                    var catKey = sel.dataset.category;
                    var val = btn.dataset.value;
                    // Toggle: click same button to deselect
                    var currentActive = sel.querySelector('.pf-btn.active');
                    if (currentActive === btn) {
                        btn.classList.remove('active');
                        if (condInput) condInput.classList.add('hidden');
                        if (newRankWrapper) newRankWrapper.classList.add('hidden');
                        saveGrade(exId, catKey, '');
                    } else {
                        sel.querySelectorAll('.pf-btn').forEach(function (b) { b.classList.remove('active'); });
                        btn.classList.add('active');
                        var showRank = (val === 'pass' || val === 'conditional');
                        if (newRankWrapper) newRankWrapper.classList.toggle('hidden', !showRank);
                        if (val === 'conditional') {
                            if (condInput) {
                                condInput.classList.remove('hidden');
                                condInput.focus();
                            }
                            saveGrade(exId, catKey, 'conditional:' + (condInput ? condInput.value : ''));
                        } else {
                            if (condInput) condInput.classList.add('hidden');
                            saveGrade(exId, catKey, val);
                        }
                    }
                });
            });
        });

        // Condition text inputs
        document.querySelectorAll('.condition-input').forEach(function (ta) {
            ta.addEventListener('input', function () {
                saveGrade(ta.dataset.examinee, ta.dataset.category, 'conditional:' + ta.value);
            });
        });

        // Competence mark buttons (V / ? / X)
        document.querySelectorAll('.competence-marks').forEach(function (group) {
            var exId = group.dataset.examinee;
            var catKey = group.dataset.category;
            group.querySelectorAll('.comp-btn').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var mark = btn.dataset.mark;
                    var current = btn.classList.contains('active') ? mark : '';
                    var newMark = (current === mark) ? '' : mark; // toggle
                    group.querySelectorAll('.comp-btn').forEach(function (b) { b.classList.remove('active'); });
                    if (newMark) btn.classList.add('active');
                    saveGrade(exId, catKey + '_mark', newMark);
                });
            });
        });

        // New rank selects (inside rank_approval pass/fail cells)
        document.querySelectorAll('.newrank-wrapper').forEach(function (wrapper) {
            var exId = wrapper.dataset.examinee;
            var catKey = wrapper.dataset.category;
            var sel = wrapper.querySelector('.newrank-select');
            if (sel) {
                sel.addEventListener('change', function () {
                    saveGrade(exId, catKey + '_newRank', sel.value);
                });
            }
        });
    }

    function showAddExamineeModal() {
        var t = App.I18n.t;
        var modalContainer = document.getElementById('modal-container');
        var html = '<div class="modal-overlay" id="add-examinee-overlay">';
        html += '<div class="modal">';
        html += '<h2>' + t('addExaminee') + '</h2>';
        html += '<div class="form-row">';
        html += '<div class="form-group">';
        html += '<label>' + t('firstName') + '</label>';
        html += '<input type="text" id="new-first-name" autofocus>';
        html += '</div>';
        html += '<div class="form-group">';
        html += '<label>' + t('lastName') + '</label>';
        html += '<input type="text" id="new-last-name">';
        html += '</div>';
        html += '</div>';
        html += App.Utils.buildRankSelect('new-rank', '', t('rank'));
        html += '<div class="modal-actions">';
        html += '<button class="btn btn-primary" id="btn-confirm-add">' + t('create') + '</button>';
        html += '<button class="btn btn-outline" id="btn-cancel-add">' + t('cancel') + '</button>';
        html += '</div>';
        html += '</div>';
        html += '</div>';
        modalContainer.innerHTML = html;

        document.getElementById('btn-confirm-add').addEventListener('click', addExaminee);
        document.getElementById('btn-cancel-add').addEventListener('click', function () { modalContainer.innerHTML = ''; });
        document.getElementById('add-examinee-overlay').addEventListener('click', function (e) { if (e.target === this) modalContainer.innerHTML = ''; });
        document.getElementById('new-first-name').addEventListener('keydown', function (e) { if (e.key === 'Enter') addExaminee(); });
        document.getElementById('new-first-name').focus();
    }

    async function addExaminee() {
        var firstName = document.getElementById('new-first-name').value.trim();
        var lastName = document.getElementById('new-last-name').value.trim();
        var rank = document.getElementById('new-rank').value.trim();
        if (!firstName) { document.getElementById('new-first-name').focus(); return; }
        document.getElementById('modal-container').innerHTML = '';
        await App.Storage.addExaminee(currentExamId, firstName, lastName, rank);
    }

    async function showShareModal() {
        var t = App.I18n.t;
        var exam = cachedExam;
        var trainerNames = exam.trainerNames || {};
        var currentTrainerIds = exam.trainerIds || [];
        var modalContainer = document.getElementById('modal-container');

        // Load trainers from previous exams
        var knownTrainers = await App.Storage.getKnownTrainers();
        // Filter out trainers already in this exam
        var suggestedTrainers = Object.keys(knownTrainers).filter(function (tid) {
            return currentTrainerIds.indexOf(tid) === -1;
        });

        var html = '<div class="modal-overlay" id="share-overlay">';
        html += '<div class="modal">';
        html += '<h2>' + t('shareExam') + '</h2>';

        // Current trainers list
        html += '<div class="trainer-list"><h3>' + t('sharedTrainers') + '</h3>';
        currentTrainerIds.forEach(function (tid) {
            var name = trainerNames[tid] || tid.slice(0, 8);
            var label = tid === exam.ownerId ? ' (' + t('owner') + ')' : '';
            var youLabel = tid === App.Auth.getUserId() ? ' (' + t('you') + ')' : '';
            html += '<div class="trainer-item">' + App.Utils.escapeHtml(name) + label + youLabel + '</div>';
        });
        html += '</div>';

        // Suggested trainers from previous exams
        if (suggestedTrainers.length > 0) {
            html += '<div class="trainer-list" style="margin-top:14px"><h3>' + t('fromPreviousExams') + '</h3>';
            suggestedTrainers.forEach(function (tid) {
                var name = knownTrainers[tid];
                html += '<div class="trainer-item trainer-item-suggest">';
                html += '<span>' + App.Utils.escapeHtml(name) + '</span>';
                html += '<button class="btn btn-sm btn-outline btn-quick-add" data-id="' + tid + '" data-name="' + App.Utils.escapeHtml(name) + '">+ ' + t('addTrainer') + '</button>';
                html += '</div>';
            });
            html += '</div>';
        }

        // Manual email input
        html += '<div class="form-group" style="margin-top:16px"><label>' + t('trainerEmail') + '</label>';
        html += '<input type="email" id="trainer-email" placeholder="email@example.com"></div>';
        html += '<div id="share-error" class="auth-error" style="display:none"></div>';
        html += '<div class="modal-actions">';
        html += '<button class="btn btn-primary" id="btn-add-trainer">' + t('addTrainer') + '</button>';
        html += '<button class="btn btn-outline" id="btn-close-share">' + t('cancel') + '</button>';
        html += '</div></div></div>';
        modalContainer.innerHTML = html;

        // Quick-add buttons (from previous exams)
        document.querySelectorAll('.btn-quick-add').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                btn.disabled = true;
                await App.Storage.addTrainerById(currentExamId, btn.dataset.id, btn.dataset.name);
                cachedExam = await App.Storage.getExam(currentExamId);
                App.showToast(t('trainerAdded'));
                showShareModal();
            });
        });

        document.getElementById('btn-add-trainer').addEventListener('click', async function () {
            var email = document.getElementById('trainer-email').value.trim();
            if (!email) return;
            var errorEl = document.getElementById('share-error');
            errorEl.style.display = 'none';
            var result = await App.Storage.addTrainerByEmail(currentExamId, email);
            if (result.error) { errorEl.textContent = t('trainerNotFound'); errorEl.style.display = ''; }
            else { cachedExam = await App.Storage.getExam(currentExamId); App.showToast(t('trainerAdded')); showShareModal(); }
        });
        document.getElementById('btn-close-share').addEventListener('click', function () { modalContainer.innerHTML = ''; });
        document.getElementById('share-overlay').addEventListener('click', function (e) { if (e.target === this) modalContainer.innerHTML = ''; });
    }

    function showInviteModal() {
        var t = App.I18n.t;
        var exam = cachedExam;
        var modalContainer = document.getElementById('modal-container');
        var code = exam.invitationCode || '';
        var baseUrl = window.location.origin + window.location.pathname;
        var link = baseUrl + '#/invite/' + currentExamId;

        if (code) {
            // Ensure examInvitations doc is up to date (backward compat for pre-existing codes)
            App.Storage.syncInvitationDoc(currentExamId, code, exam.name, exam.date)
                .catch(function () {});
        }

        var html = '<div class="modal-overlay" id="invite-overlay"><div class="modal">';
        html += '<h2>' + t('inviteExaminees') + '</h2>';
        if (code) {
            html += '<div class="form-group"><label>' + t('invitationLink') + '</label>';
            html += '<div class="copy-field"><input type="text" id="invite-link" value="' + link + '" readonly>';
            html += '<button class="btn btn-sm btn-outline" id="btn-copy-link">' + t('copyLink') + '</button></div></div>';
            html += '<div class="form-group"><label>' + t('accessCode') + '</label>';
            html += '<div class="copy-field"><input type="text" id="invite-code" value="' + code + '" readonly class="code-display">';
            html += '<button class="btn btn-sm btn-outline" id="btn-copy-code">' + t('copyCode') + '</button></div></div>';
        } else {
            html += '<p style="margin-bottom:16px">' + t('inviteExaminees') + '</p>';
        }
        html += '<div class="modal-actions">';
        if (!code) html += '<button class="btn btn-primary" id="btn-generate-code">' + t('create') + '</button>';
        html += '<button class="btn btn-outline" id="btn-close-invite">' + t('cancel') + '</button>';
        html += '</div></div></div>';
        modalContainer.innerHTML = html;

        var generateBtn = document.getElementById('btn-generate-code');
        if (generateBtn) { generateBtn.addEventListener('click', async function () { cachedExam.invitationCode = await App.Storage.generateInvitationCode(currentExamId); showInviteModal(); }); }
        var copyLinkBtn = document.getElementById('btn-copy-link');
        if (copyLinkBtn) { copyLinkBtn.addEventListener('click', function () { navigator.clipboard.writeText(document.getElementById('invite-link').value); App.showToast(t('copied')); }); }
        var copyCodeBtn = document.getElementById('btn-copy-code');
        if (copyCodeBtn) { copyCodeBtn.addEventListener('click', function () { navigator.clipboard.writeText(document.getElementById('invite-code').value); App.showToast(t('copied')); }); }
        document.getElementById('btn-close-invite').addEventListener('click', function () { modalContainer.innerHTML = ''; });
        document.getElementById('invite-overlay').addEventListener('click', function (e) { if (e.target === this) modalContainer.innerHTML = ''; });
    }

    // --- Copy Examinees Modal ---

    async function showCopyExamineesModal() {
        var t = App.I18n.t;
        var modalContainer = document.getElementById('modal-container');
        var examinees = getSortedExaminees();
        var allExams = await App.Storage.getExamIndex();
        var otherExams = allExams.filter(function (e) { return e.id !== currentExamId; });

        var html = '<div class="modal-overlay" id="copy-overlay"><div class="modal">';
        html += '<h2>' + t('copyExaminees') + '</h2>';

        // Examinee list
        html += '<div class="form-group">';
        html += '<label>' + t('selectExaminees') + '</label>';
        html += '<div class="copy-examinee-list">';
        html += '<label class="copy-select-all"><input type="checkbox" id="copy-select-all"> ' + t('selectAll') + '</label>';
        examinees.forEach(function (ex) {
            html += '<label class="copy-examinee-item">';
            html += '<input type="checkbox" class="copy-examinee-cb" value="' + ex.id + '"> ';
            html += App.Utils.escapeHtml(ex.firstName + ' ' + ex.lastName);
            if (ex.rank) html += ' <span class="copy-rank">(' + App.Utils.escapeHtml(ex.rank) + ')</span>';
            html += '</label>';
        });
        html += '</div>';
        html += '</div>';

        // Target exam dropdown
        html += '<div class="form-group">';
        html += '<label>' + t('selectTargetExam') + '</label>';
        html += '<select id="copy-target-exam">';
        html += '<option value="">' + t('selectTargetExam') + '</option>';
        otherExams.forEach(function (e) {
            html += '<option value="' + e.id + '">' + App.Utils.escapeHtml(e.name) + (e.date ? ' — ' + App.Utils.formatDate(e.date) : '') + '</option>';
        });
        html += '</select>';
        html += '</div>';

        html += '<div id="copy-error" class="auth-error" style="display:none"></div>';
        html += '<div class="modal-actions">';
        html += '<button class="btn btn-primary" id="btn-confirm-copy">' + t('copy') + '</button>';
        html += '<button class="btn btn-outline" id="btn-cancel-copy">' + t('cancel') + '</button>';
        html += '</div></div></div>';
        modalContainer.innerHTML = html;

        // Select all toggle
        document.getElementById('copy-select-all').addEventListener('change', function () {
            document.querySelectorAll('.copy-examinee-cb').forEach(function (cb) {
                cb.checked = this.checked;
            }.bind(this));
        });

        document.getElementById('btn-cancel-copy').addEventListener('click', function () { modalContainer.innerHTML = ''; });
        document.getElementById('copy-overlay').addEventListener('click', function (e) { if (e.target === this) modalContainer.innerHTML = ''; });

        document.getElementById('btn-confirm-copy').addEventListener('click', async function () {
            var errorEl = document.getElementById('copy-error');
            errorEl.style.display = 'none';
            var targetExamId = document.getElementById('copy-target-exam').value;
            var selectedIds = Array.from(document.querySelectorAll('.copy-examinee-cb:checked')).map(function (cb) { return cb.value; });

            if (!targetExamId) { errorEl.textContent = t('noExamSelected'); errorEl.style.display = ''; return; }
            if (!selectedIds.length) { errorEl.textContent = t('noExamineesSelected'); errorEl.style.display = ''; return; }

            document.getElementById('btn-confirm-copy').disabled = true;
            var count = await App.Storage.copyExaminees(currentExamId, targetExamId, selectedIds);
            modalContainer.innerHTML = '';
            App.showToast(t('examineesCopied'));
        });
    }

    // --- Manage Categories Modal ---

    function showManageCategoriesModal() {
        var t = App.I18n.t;
        var lang = App.I18n.getLang();
        var modalContainer = document.getElementById('modal-container');
        var categories = App.Utils.getCategoriesOrdered(categoryOrder, customCategories);

        var html = '<div class="modal-overlay" id="cat-mgr-overlay"><div class="modal modal-wide">';
        html += '<h2>' + t('manageCategories') + '</h2>';
        html += '<div class="cat-mgr-list">';
        html += '<div class="cat-mgr-row cat-mgr-header">';
        html += '<label class="cat-mgr-selectall"><input type="checkbox" id="cat-mgr-select-all"> ' + t('selectAll') + '</label>';
        html += '</div>';
        categories.forEach(function (cat) {
            html += '<div class="cat-mgr-row" data-key="' + cat.key + '">';
            html += '<label class="cat-mgr-checkbox"><input type="checkbox" class="cat-mgr-cb" value="' + cat.key + '"></label>';
            html += '<span class="cat-mgr-name">' + App.Utils.escapeHtml(cat[lang] || cat.he) + '</span>';
            if (cat.type !== 'passfail') {
                html += '<label class="cat-mgr-marks-label" title="' + t('showMarks') + '">';
                html += '<input type="checkbox" class="cat-mgr-marks-cb" data-key="' + cat.key + '"' + (cat.hideMarks ? '' : ' checked') + '>';
                html += ' ' + t('showMarks');
                html += '</label>';
            }
            html += '<div class="cat-mgr-actions">';
            html += '<button class="btn btn-sm btn-outline cat-edit-btn" data-key="' + cat.key + '">✏️</button>';
            html += '<button class="btn btn-sm btn-danger cat-delete-btn" data-key="' + cat.key + '">🗑️</button>';
            html += '</div>';
            html += '</div>';
        });
        html += '</div>';
        html += '<div class="modal-actions" style="justify-content:space-between;flex-wrap:wrap;gap:8px">';
        html += '<button class="btn btn-outline" id="btn-add-category">+ ' + t('addCategory') + '</button>';
        html += '<button class="btn btn-outline" id="btn-open-presets">' + t('categoryPresets') + '</button>';
        html += '<button class="btn btn-danger" id="btn-delete-selected-categories">' + t('deleteSelected') + '</button>';
        html += '<button class="btn btn-outline" id="btn-close-cat-mgr">' + t('cancel') + '</button>';
        html += '</div></div></div>';
        modalContainer.innerHTML = html;

        // Select-all toggle
        document.getElementById('cat-mgr-select-all').addEventListener('change', function () {
            var checked = this.checked;
            document.querySelectorAll('.cat-mgr-cb').forEach(function (cb) { cb.checked = checked; });
        });

        // Per-category V/?/X marks toggle
        document.querySelectorAll('.cat-mgr-marks-cb').forEach(function (cb) {
            cb.addEventListener('change', async function () {
                var key = cb.dataset.key;
                var existing = customCategories[key] || {};
                if (cb.checked) {
                    delete existing.hideMarks;
                    if (Object.keys(existing).length === 0) {
                        delete customCategories[key];
                    } else {
                        customCategories[key] = existing;
                    }
                } else {
                    existing.hideMarks = true;
                    customCategories[key] = existing;
                }
                await App.Storage.updateCustomCategories(currentExamId, customCategories);
                cachedExam.customCategories = customCategories;
            });
        });

        // Edit buttons — after editing, showCategoryEditForm's save handler returns to this modal
        document.querySelectorAll('.cat-edit-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                showCategoryEditForm(btn.dataset.key);
            });
        });

        // Single delete — stay in modal after delete
        document.querySelectorAll('.cat-delete-btn').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                if (!confirm(t('confirmDeleteCategory'))) return;
                await deleteCategories([btn.dataset.key], 'categoryDeleted');
                showManageCategoriesModal(); // re-render modal
            });
        });

        // Bulk delete
        document.getElementById('btn-delete-selected-categories').addEventListener('click', async function () {
            var selected = Array.from(document.querySelectorAll('.cat-mgr-cb:checked')).map(function (cb) { return cb.value; });
            if (!selected.length) {
                alert(t('noCategoriesSelected'));
                return;
            }
            if (!confirm(t('confirmDeleteSelectedCategories'))) return;
            await deleteCategories(selected, 'categoriesDeleted');
            showManageCategoriesModal(); // re-render modal
        });

        document.getElementById('btn-add-category').addEventListener('click', function () {
            showCategoryEditForm(null);
        });
        document.getElementById('btn-open-presets').addEventListener('click', showPresetsModal);
        document.getElementById('btn-close-cat-mgr').addEventListener('click', function () { modalContainer.innerHTML = ''; renderTable(); });
        document.getElementById('cat-mgr-overlay').addEventListener('click', function (e) { if (e.target === this) { modalContainer.innerHTML = ''; renderTable(); } });
    }

    async function deleteCategories(keys, undoLabelKey) {
        // Snapshot what we're about to delete so undo can restore it
        var snapshot = {
            order: categoryOrder.slice(),
            customs: Object.assign({}, customCategories)
        };

        categoryOrder = categoryOrder.filter(function (k) { return keys.indexOf(k) === -1; });
        var customMutated = false;
        keys.forEach(function (k) {
            if (customCategories[k]) { delete customCategories[k]; customMutated = true; }
        });
        if (customMutated) await App.Storage.updateCustomCategories(currentExamId, customCategories);
        await App.Storage.updateCategoryOrder(currentExamId, categoryOrder);
        cachedExam.categoryOrder = categoryOrder;
        cachedExam.customCategories = customCategories;

        if (undoLabelKey) {
            App.Undo.push(undoLabelKey, async function () {
                categoryOrder = snapshot.order;
                customCategories = snapshot.customs;
                await App.Storage.updateCustomCategories(currentExamId, customCategories);
                await App.Storage.updateCategoryOrder(currentExamId, categoryOrder);
                cachedExam.categoryOrder = categoryOrder;
                cachedExam.customCategories = customCategories;
                showManageCategoriesModal();
            });
        }
    }

    function showCategoryEditForm(catKey) {
        var t = App.I18n.t;
        var isNew = !catKey;
        var modalContainer = document.getElementById('modal-container');

        // Find existing values
        var existingHe = '';
        var existingEn = '';
        if (!isNew) {
            var cats = App.Utils.getCategoriesOrdered(categoryOrder, customCategories);
            var existing = cats.find(function (c) { return c.key === catKey; });
            if (existing) { existingHe = existing.he || ''; existingEn = existing.en || ''; }
        }

        var html = '<div class="modal-overlay" id="cat-edit-overlay"><div class="modal">';
        html += '<h2>' + t(isNew ? 'addCategory' : 'editCategory') + '</h2>';
        html += '<div class="form-group"><label>' + t('categoryNameHe') + '</label>';
        html += '<input type="text" id="cat-name-he" value="' + App.Utils.escapeHtml(existingHe) + '" dir="rtl" autofocus></div>';
        html += '<div class="form-group"><label>' + t('categoryNameEn') + '</label>';
        html += '<input type="text" id="cat-name-en" value="' + App.Utils.escapeHtml(existingEn) + '" dir="ltr"></div>';
        html += '<div class="modal-actions">';
        html += '<button class="btn btn-primary" id="btn-save-category">' + t('save') + '</button>';
        html += '<button class="btn btn-outline" id="btn-back-cat-mgr">' + t('cancel') + '</button>';
        html += '</div></div></div>';
        modalContainer.innerHTML = html;
        document.getElementById('cat-name-he').focus();

        document.getElementById('btn-back-cat-mgr').addEventListener('click', showManageCategoriesModal);
        document.getElementById('cat-edit-overlay').addEventListener('click', function (e) { if (e.target === this) modalContainer.innerHTML = ''; });

        document.getElementById('btn-save-category').addEventListener('click', async function () {
            var nameHe = document.getElementById('cat-name-he').value.trim();
            var nameEn = document.getElementById('cat-name-en').value.trim();
            if (!nameHe) { document.getElementById('cat-name-he').focus(); return; }

            if (isNew) {
                var newKey = 'custom_' + Date.now().toString(36);
                customCategories[newKey] = { he: nameHe, en: nameEn || nameHe };
                categoryOrder = categoryOrder.concat([newKey]);
            } else {
                customCategories[catKey] = { he: nameHe, en: nameEn || nameHe };
            }

            await Promise.all([
                App.Storage.updateCustomCategories(currentExamId, customCategories),
                isNew ? App.Storage.updateCategoryOrder(currentExamId, categoryOrder) : Promise.resolve()
            ]);
            cachedExam.categoryOrder = categoryOrder;
            cachedExam.customCategories = customCategories;
            // Stay in category management — re-render it to show updated state
            showManageCategoriesModal();
        });
    }

    // --- General exam remarks modal ---

    async function showGeneralRemarksModal() {
        var t = App.I18n.t;
        var userId = App.Auth.getUserId();
        var modalContainer = document.getElementById('modal-container');
        modalContainer.innerHTML = '<div class="modal-overlay"><div class="modal"><p>' + t('loading') + '</p></div></div>';

        var allRemarks = await App.Storage.getGeneralRemarks(currentExamId);
        var myText = (allRemarks[userId] && allRemarks[userId].text) || '';
        var otherEntries = Object.entries(allRemarks).filter(function (kv) { return kv[0] !== userId; });

        var html = '<div class="modal-overlay" id="remarks-overlay"><div class="modal">';
        html += '<h2>' + t('generalRemarks') + '</h2>';
        html += '<div class="form-group">';
        html += '<label>' + t('yourRemarks') + '</label>';
        html += '<textarea id="my-general-remarks" rows="5" style="width:100%;resize:vertical">' + App.Utils.escapeHtml(myText) + '</textarea>';
        html += '</div>';

        if (otherEntries.length > 0) {
            html += '<div class="form-group">';
            html += '<label>' + t('othersRemarks') + '</label>';
            otherEntries.forEach(function (kv) {
                var entry = kv[1];
                if (!entry.text) return;
                html += '<div class="other-trainer-note" style="margin-bottom:6px">';
                html += '<span class="trainer-label">' + App.Utils.escapeHtml(entry.name) + ':</span>';
                html += '<span class="trainer-text" style="white-space:pre-wrap">' + App.Utils.escapeHtml(entry.text) + '</span>';
                html += '</div>';
            });
            html += '</div>';
        }

        html += '<div class="modal-actions">';
        html += '<button class="btn btn-primary" id="btn-save-remarks">' + t('save') + '</button>';
        html += '<button class="btn btn-outline" id="btn-close-remarks">' + t('cancel') + '</button>';
        html += '</div></div></div>';
        modalContainer.innerHTML = html;

        document.getElementById('btn-save-remarks').addEventListener('click', async function () {
            var text = document.getElementById('my-general-remarks').value;
            await App.Storage.saveGeneralRemarks(currentExamId, text);
            modalContainer.innerHTML = '';
            App.showToast(t('dataSaved'));
        });
        document.getElementById('btn-close-remarks').addEventListener('click', function () { modalContainer.innerHTML = ''; });
        document.getElementById('remarks-overlay').addEventListener('click', function (e) { if (e.target === this) modalContainer.innerHTML = ''; });
        document.getElementById('my-general-remarks').focus();
    }

    // --- Category presets ---

    async function showPresetsModal() {
        var t = App.I18n.t;
        var userId = App.Auth.getUserId();
        var modalContainer = document.getElementById('modal-container');
        modalContainer.innerHTML = '<div class="modal-overlay"><div class="modal"><p>' + t('loading') + '</p></div></div>';

        var presets = await App.Storage.getPresets();

        var html = '<div class="modal-overlay" id="presets-overlay"><div class="modal modal-wide">';
        html += '<h2>' + t('categoryPresets') + '</h2>';

        if (presets.length === 0) {
            html += '<p class="invite-subtitle">' + t('noPresets') + '</p>';
        } else {
            html += '<div class="cat-mgr-list">';
            presets.forEach(function (p) {
                html += '<div class="cat-mgr-row">';
                html += '<span class="cat-mgr-name">' + App.Utils.escapeHtml(p.name) + ' <small style="color:var(--text-secondary)">— ' + App.Utils.escapeHtml(p.createdByName || '') + '</small></span>';
                html += '<div class="cat-mgr-actions">';
                html += '<button class="btn btn-sm btn-primary preset-load-btn" data-id="' + p.id + '">' + t('loadPreset') + '</button>';
                if (p.createdBy === userId) {
                    html += '<button class="btn btn-sm btn-danger preset-delete-btn" data-id="' + p.id + '">' + t('deletePreset') + '</button>';
                }
                html += '</div>';
                html += '</div>';
            });
            html += '</div>';
        }

        html += '<div class="form-group" style="margin-top:12px">';
        html += '<label>' + t('saveAsPreset') + '</label>';
        html += '<div style="display:flex;gap:8px">';
        html += '<input type="text" id="preset-name-input" placeholder="' + t('presetName') + '" style="flex:1">';
        html += '<button class="btn btn-outline" id="btn-save-preset">' + t('save') + '</button>';
        html += '</div></div>';

        html += '<div class="modal-actions">';
        html += '<button class="btn btn-outline" id="btn-close-presets">' + t('cancel') + '</button>';
        html += '</div></div></div>';
        modalContainer.innerHTML = html;

        // Load preset
        document.querySelectorAll('.preset-load-btn').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                var preset = presets.find(function (p) { return p.id === btn.dataset.id; });
                if (!preset) return;
                categoryOrder = preset.categoryOrder || App.Utils.DEFAULT_CATEGORY_ORDER;
                customCategories = preset.customCategories || {};
                await Promise.all([
                    App.Storage.updateCategoryOrder(currentExamId, categoryOrder),
                    App.Storage.updateCustomCategories(currentExamId, customCategories)
                ]);
                cachedExam.categoryOrder = categoryOrder;
                cachedExam.customCategories = customCategories;
                modalContainer.innerHTML = '';
                renderTable();
                App.showToast(t('presetLoaded'));
            });
        });

        // Delete preset (own only)
        document.querySelectorAll('.preset-delete-btn').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                if (!confirm(t('confirmDeletePreset'))) return;
                await App.Storage.deletePreset(btn.dataset.id);
                showPresetsModal();
            });
        });

        // Save current as preset
        document.getElementById('btn-save-preset').addEventListener('click', async function () {
            var name = document.getElementById('preset-name-input').value.trim();
            if (!name) { document.getElementById('preset-name-input').focus(); return; }
            await App.Storage.savePreset(name, categoryOrder, customCategories);
            App.showToast(t('presetSaved'));
            showPresetsModal();
        });

        document.getElementById('btn-close-presets').addEventListener('click', function () { modalContainer.innerHTML = ''; });
        document.getElementById('presets-overlay').addEventListener('click', function (e) { if (e.target === this) modalContainer.innerHTML = ''; });
    }

    // Hook presets into the manage-categories modal: add a "Presets" button

    return { render: render };
})();
