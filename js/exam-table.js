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
    var dragSrcEl = null;
    var dragType = null; // 'category' or 'examinee'

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

        autoSave = App.Utils.debounce(function (examineeId, catKey, value) {
            App.Storage.updateGrade(currentExamId, examineeId, catKey, value);
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
        var categories = App.Utils.getCategoriesOrdered(categoryOrder);
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
        if (isOwner) {
            html += '<button class="btn btn-outline" id="btn-share-exam">' + t('shareExam') + '</button>';
            html += '<button class="btn btn-outline" id="btn-invite-examinees">' + t('inviteExaminees') + '</button>';
        }
        html += '<button class="btn btn-outline" id="btn-export-exam">' + t('export') + '</button>';
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
            html += '<th class="sticky-col category-header">' + t('category') + '</th>';
            examinees.forEach(function (ex, idx) {
                html += '<th class="examinee-header" data-id="' + ex.id + '" data-order="' + idx + '" draggable="true">';
                html += '<div class="examinee-header-content">';
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
                html += '<div class="examinee-header-actions">';
                html += '<button class="btn btn-sm btn-outline export-rec-btn" data-id="' + ex.id + '" title="' + t('exportRecommendation') + '">&#128196;</button>';
                html += '<button class="btn btn-sm btn-danger remove-examinee-btn" data-id="' + ex.id + '" title="' + t('removeExaminee') + '">&#10005;</button>';
                html += '</div>';
                html += '</div>';
                html += '</th>';
            });
            html += '</tr></thead>';

            // Body rows - categories are draggable
            html += '<tbody>';
            categories.forEach(function (cat, idx) {
                html += '<tr data-cat-key="' + cat.key + '" data-cat-order="' + idx + '">';
                html += '<td class="sticky-col category-cell" draggable="true">';
                html += '<span class="drag-handle-row" title="' + t('dragToReorder') + '">&#8942;&#8942;</span> ';
                html += cat[lang];
                html += '</td>';
                examinees.forEach(function (ex) {
                    html += '<td class="grade-cell" data-examinee="' + ex.id + '" data-category="' + cat.key + '">';
                    if (cat.type === 'passfail') {
                        html += renderPassFailCell(ex.id, cat.key, currentUserId, otherTrainers, trainerNames);
                    } else {
                        html += renderGradeCell(ex.id, cat.key, currentUserId, otherTrainers, trainerNames);
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

    function renderGradeCell(examineeId, catKey, currentUserId, otherTrainers, trainerNames) {
        var html = '';
        var exGrades = cachedGrades[examineeId] || {};

        otherTrainers.forEach(function (tid) {
            var tGrades = exGrades[tid];
            var val = tGrades ? (tGrades[catKey] || '') : '';
            if (val) {
                var name = (tGrades && tGrades.trainerName) || trainerNames[tid] || tid.slice(0, 6);
                html += '<div class="other-trainer-note">';
                html += '<span class="trainer-label">' + App.Utils.escapeHtml(name) + ':</span>';
                html += '<span class="trainer-text">' + App.Utils.escapeHtml(val) + '</span>';
                html += '</div>';
            }
        });

        var myGrades = exGrades[currentUserId];
        var myVal = myGrades ? (myGrades[catKey] || '') : '';
        html += '<textarea class="grade-textarea" data-examinee="' + examineeId + '" data-category="' + catKey + '" placeholder="' + App.I18n.t('enterNotes') + '">' + App.Utils.escapeHtml(myVal) + '</textarea>';

        return html;
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
                var cls = val === 'pass' ? 'pass-badge' : val === 'fail' ? 'fail-badge' : '';
                var label = val === 'pass' ? t('pass') : val === 'fail' ? t('fail') : val;
                html += '<div class="other-trainer-note">';
                html += '<span class="trainer-label">' + App.Utils.escapeHtml(name) + ':</span>';
                html += '<span class="' + cls + '">' + label + '</span>';
                html += '</div>';
            }
        });

        // Current user's selection
        var myGrades = exGrades[currentUserId];
        var myVal = myGrades ? (myGrades[catKey] || '') : '';
        html += '<div class="passfail-selector" data-examinee="' + examineeId + '" data-category="' + catKey + '">';
        html += '<button class="pf-btn pf-pass' + (myVal === 'pass' ? ' active' : '') + '" data-value="pass">' + t('pass') + '</button>';
        html += '<button class="pf-btn pf-fail' + (myVal === 'fail' ? ' active' : '') + '" data-value="fail">' + t('fail') + '</button>';
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
                        var cls = val === 'pass' ? 'pass-badge' : val === 'fail' ? 'fail-badge' : '';
                        var label = val === 'pass' ? App.I18n.t('pass') : val === 'fail' ? App.I18n.t('fail') : val;
                        noteDiv.innerHTML = '<span class="trainer-label">' + App.Utils.escapeHtml(name) + ':</span><span class="' + cls + '">' + label + '</span>';
                    } else {
                        noteDiv.innerHTML = '<span class="trainer-label">' + App.Utils.escapeHtml(name) + ':</span><span class="trainer-text">' + App.Utils.escapeHtml(val) + '</span>';
                    }
                    cell.insertBefore(noteDiv, textarea || pfSelector);
                }
            });

            if (textarea && document.activeElement !== textarea) {
                var myGrades = exGrades[currentUserId];
                var myVal = myGrades ? (myGrades[catKey] || '') : '';
                if (textarea.value !== myVal) {
                    textarea.value = myVal;
                }
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

        // Update order fields
        for (var i = 0; i < examinees.length; i++) {
            if (examinees[i].order !== i) {
                await App.Storage.updateExaminee(currentExamId, examinees[i].id, { order: i });
            }
        }
    }

    async function reorderCategories(fromKey, toKey) {
        var order = categoryOrder.slice();
        var fromIdx = order.indexOf(fromKey);
        var toIdx = order.indexOf(toKey);
        if (fromIdx === -1 || toIdx === -1) return;

        var item = order.splice(fromIdx, 1)[0];
        order.splice(toIdx, 0, item);
        categoryOrder = order;

        // Save category order to exam doc
        await App.db.collection('exams').doc(currentExamId).update({
            categoryOrder: order
        });
        renderTable();
    }

    // --- Recommendation Export ---

    function exportRecommendation(examineeId) {
        var t = App.I18n.t;
        var lang = App.I18n.getLang();
        var ex = cachedExaminees[examineeId];
        if (!ex) return;

        var exam = cachedExam;
        var categories = App.Utils.getCategoriesOrdered(categoryOrder);
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
        html += '.pass-badge { color: #2e7d32; font-weight: 700; } .fail-badge { color: #c62828; font-weight: 700; }';
        html += '.footer { margin-top: 32px; text-align: center; color: #757575; font-size: 0.8rem; }';
        html += '@media print { body { padding: 0; } }';
        html += '</style></head><body>';

        html += '<h1>' + t('exportRecommendation') + '</h1>';

        // Examinee info
        html += '<div class="info">';
        html += '<div class="info-item"><div class="info-label">' + t('fullName') + '</div><div class="info-value">' + App.Utils.escapeHtml(ex.firstName + ' ' + ex.lastName) + '</div></div>';
        if (ex.rank) html += '<div class="info-item"><div class="info-label">' + t('rank') + '</div><div class="info-value">' + App.Utils.escapeHtml(ex.rank) + '</div></div>';
        if (ex.club) html += '<div class="info-item"><div class="info-label">' + t('club') + '</div><div class="info-value">' + App.Utils.escapeHtml(ex.club) + '</div></div>';
        if (ex.beltTrainings) html += '<div class="info-item"><div class="info-label">' + t('beltTrainings') + '</div><div class="info-value">' + App.Utils.escapeHtml(String(ex.beltTrainings)) + '</div></div>';
        if (ex.gasshukuCount) html += '<div class="info-item"><div class="info-label">' + t('gasshukuCount') + '</div><div class="info-value">' + App.Utils.escapeHtml(String(ex.gasshukuCount)) + '</div></div>';
        if (ex.examPayment) {
            var payLabel = ex.examPayment === 'paid' ? t('paid') : ex.examPayment === 'unpaid' ? t('unpaid') : ex.examPayment === 'exempt' ? t('exempt') : ex.examPayment;
            html += '<div class="info-item"><div class="info-label">' + t('examPayment') + '</div><div class="info-value">' + payLabel + '</div></div>';
        }
        html += '<div class="info-item"><div class="info-label">' + t('examName') + '</div><div class="info-value">' + App.Utils.escapeHtml(exam.name) + '</div></div>';
        if (exam.date) html += '<div class="info-item"><div class="info-label">' + t('examDate') + '</div><div class="info-value">' + App.Utils.formatDate(exam.date) + '</div></div>';
        html += '</div>';

        // Grades by category
        html += '<h2>' + t('examNotes') + '</h2>';
        categories.forEach(function (cat) {
            var hasContent = false;
            var catHtml = '<div class="category"><div class="cat-name">' + cat[lang] + '</div>';

            // All trainers' notes
            var allTrainerIds = exam.trainerIds || [];
            allTrainerIds.forEach(function (tid) {
                var tGrades = exGrades[tid];
                var val = tGrades ? (tGrades[cat.key] || '') : '';
                if (val) {
                    hasContent = true;
                    var name = (tGrades && tGrades.trainerName) || trainerNames[tid] || '';
                    if (cat.type === 'passfail') {
                        var label = val === 'pass' ? t('pass') : val === 'fail' ? t('fail') : val;
                        var cls = val === 'pass' ? 'pass-badge' : 'fail-badge';
                        catHtml += '<div class="trainer-note"><span class="trainer-name">' + App.Utils.escapeHtml(name) + ':</span> <span class="' + cls + '">' + label + '</span></div>';
                    } else {
                        catHtml += '<div class="trainer-note"><span class="trainer-name">' + App.Utils.escapeHtml(name) + ':</span> ' + App.Utils.escapeHtml(val) + '</div>';
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

    function bindEvents() {
        var t = App.I18n.t;

        document.getElementById('btn-back-list').addEventListener('click', function () {
            App.Router.navigate('#/');
        });

        document.getElementById('btn-add-examinee').addEventListener('click', function () {
            showAddExamineeModal();
        });

        document.getElementById('btn-export-exam').addEventListener('click', function () {
            App.Storage.exportExam(currentExamId);
        });

        var shareBtn = document.getElementById('btn-share-exam');
        if (shareBtn) {
            shareBtn.addEventListener('click', showShareModal);
        }

        var inviteBtn = document.getElementById('btn-invite-examinees');
        if (inviteBtn) {
            inviteBtn.addEventListener('click', showInviteModal);
        }

        document.querySelectorAll('.remove-examinee-btn').forEach(function (btn) {
            btn.addEventListener('click', async function (e) {
                e.stopPropagation();
                e.preventDefault();
                if (confirm(t('confirmDeleteExaminee'))) {
                    await App.Storage.removeExaminee(currentExamId, btn.dataset.id);
                }
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
            sel.querySelectorAll('.pf-btn').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var exId = sel.dataset.examinee;
                    var catKey = sel.dataset.category;
                    var val = btn.dataset.value;
                    // Toggle: click same button to deselect
                    var currentActive = sel.querySelector('.pf-btn.active');
                    if (currentActive === btn) {
                        btn.classList.remove('active');
                        App.Storage.updateGrade(currentExamId, exId, catKey, '');
                    } else {
                        sel.querySelectorAll('.pf-btn').forEach(function (b) { b.classList.remove('active'); });
                        btn.classList.add('active');
                        App.Storage.updateGrade(currentExamId, exId, catKey, val);
                    }
                });
            });
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
        html += '<div class="form-group">';
        html += '<label>' + t('rank') + '</label>';
        html += '<input type="text" id="new-rank">';
        html += '</div>';
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

    function showShareModal() {
        var t = App.I18n.t;
        var exam = cachedExam;
        var trainerNames = exam.trainerNames || {};
        var modalContainer = document.getElementById('modal-container');

        var html = '<div class="modal-overlay" id="share-overlay">';
        html += '<div class="modal">';
        html += '<h2>' + t('shareExam') + '</h2>';
        html += '<div class="trainer-list"><h3>' + t('sharedTrainers') + '</h3>';
        (exam.trainerIds || []).forEach(function (tid) {
            var name = trainerNames[tid] || tid.slice(0, 8);
            var label = tid === exam.ownerId ? ' (' + t('owner') + ')' : '';
            var youLabel = tid === App.Auth.getUserId() ? ' (' + t('you') + ')' : '';
            html += '<div class="trainer-item">' + App.Utils.escapeHtml(name) + label + youLabel + '</div>';
        });
        html += '</div>';
        html += '<div class="form-group" style="margin-top:16px"><label>' + t('trainerEmail') + '</label>';
        html += '<input type="email" id="trainer-email" placeholder="email@example.com"></div>';
        html += '<div id="share-error" class="auth-error" style="display:none"></div>';
        html += '<div class="modal-actions">';
        html += '<button class="btn btn-primary" id="btn-add-trainer">' + t('addTrainer') + '</button>';
        html += '<button class="btn btn-outline" id="btn-close-share">' + t('cancel') + '</button>';
        html += '</div></div></div>';
        modalContainer.innerHTML = html;

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

    return { render: render };
})();
