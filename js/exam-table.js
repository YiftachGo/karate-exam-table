var App = window.App || {};

App.ExamTable = (function () {
    var currentExamId = null;
    var unsubGrades = null;
    var unsubExaminees = null;
    var autoSave = null;
    var cachedExam = null;
    var cachedGrades = {};
    var cachedExaminees = {};

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

        autoSave = App.Utils.debounce(function (examineeId, catKey, value) {
            App.Storage.updateGrade(currentExamId, examineeId, catKey, value);
        }, 300);

        renderTable();

        // Subscribe to real-time updates
        unsubGrades = App.Storage.subscribeToGrades(examId, function (allGrades) {
            cachedGrades = allGrades;
            updateGradeCells();
        });

        unsubExaminees = App.Storage.subscribeToExaminees(examId, function (examinees) {
            cachedExaminees = examinees;
            renderTable();
        });

        // Return cleanup function for router
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
        var categories = App.Utils.CATEGORIES;
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

            // Header row
            html += '<thead><tr>';
            html += '<th class="sticky-col category-header">' + t('category') + '</th>';
            examinees.forEach(function (ex) {
                html += '<th class="examinee-header" data-id="' + ex.id + '">';
                html += '<div class="examinee-header-content">';
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

            // Body rows
            html += '<tbody>';
            categories.forEach(function (cat) {
                html += '<tr>';
                html += '<td class="sticky-col category-cell">' + cat[lang] + '</td>';
                examinees.forEach(function (ex) {
                    html += '<td class="grade-cell" data-examinee="' + ex.id + '" data-category="' + cat.key + '">';
                    html += renderGradeCell(ex.id, cat.key, currentUserId, otherTrainers, trainerNames);
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
        autoResizeTextareas();
    }

    function renderGradeCell(examineeId, catKey, currentUserId, otherTrainers, trainerNames) {
        var html = '';
        var exGrades = cachedGrades[examineeId] || {};

        // Show other trainers' notes (read-only)
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

        // Current user's editable textarea
        var myGrades = exGrades[currentUserId];
        var myVal = myGrades ? (myGrades[catKey] || '') : '';
        html += '<textarea class="grade-textarea" data-examinee="' + examineeId + '" data-category="' + catKey + '" placeholder="' + App.I18n.t('enterNotes') + '">' + App.Utils.escapeHtml(myVal) + '</textarea>';

        return html;
    }

    function updateGradeCells() {
        var currentUserId = App.Auth.getUserId();
        var trainerNames = (cachedExam && cachedExam.trainerNames) || {};
        var trainerIds = (cachedExam && cachedExam.trainerIds) || [];
        var otherTrainers = trainerIds.filter(function (id) { return id !== currentUserId; });

        // Only update other trainers' notes (don't touch the active textarea)
        document.querySelectorAll('.grade-cell').forEach(function (cell) {
            var exId = cell.dataset.examinee;
            var catKey = cell.dataset.category;
            if (!exId || !catKey) return;

            // Update other trainer notes
            var existingNotes = cell.querySelectorAll('.other-trainer-note');
            existingNotes.forEach(function (n) { n.remove(); });

            var exGrades = cachedGrades[exId] || {};
            var textarea = cell.querySelector('.grade-textarea');

            otherTrainers.forEach(function (tid) {
                var tGrades = exGrades[tid];
                var val = tGrades ? (tGrades[catKey] || '') : '';
                if (val) {
                    var name = (tGrades && tGrades.trainerName) || trainerNames[tid] || tid.slice(0, 6);
                    var noteDiv = document.createElement('div');
                    noteDiv.className = 'other-trainer-note';
                    noteDiv.innerHTML = '<span class="trainer-label">' + App.Utils.escapeHtml(name) + ':</span><span class="trainer-text">' + App.Utils.escapeHtml(val) + '</span>';
                    cell.insertBefore(noteDiv, textarea);
                }
            });

            // Update own textarea only if not currently focused
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

        document.querySelectorAll('.grade-textarea').forEach(function (ta) {
            ta.addEventListener('input', function () {
                ta.style.height = 'auto';
                ta.style.height = Math.max(60, ta.scrollHeight) + 'px';
                autoSave(ta.dataset.examinee, ta.dataset.category, ta.value);
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
        document.getElementById('btn-cancel-add').addEventListener('click', function () {
            modalContainer.innerHTML = '';
        });
        document.getElementById('add-examinee-overlay').addEventListener('click', function (e) {
            if (e.target === this) modalContainer.innerHTML = '';
        });
        document.getElementById('new-first-name').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') addExaminee();
        });
        document.getElementById('new-first-name').focus();
    }

    async function addExaminee() {
        var firstName = document.getElementById('new-first-name').value.trim();
        var lastName = document.getElementById('new-last-name').value.trim();
        var rank = document.getElementById('new-rank').value.trim();
        if (!firstName) {
            document.getElementById('new-first-name').focus();
            return;
        }
        document.getElementById('modal-container').innerHTML = '';
        await App.Storage.addExaminee(currentExamId, firstName, lastName, rank);
        // Real-time listener will update the table
    }

    function showShareModal() {
        var t = App.I18n.t;
        var exam = cachedExam;
        var trainerNames = exam.trainerNames || {};
        var modalContainer = document.getElementById('modal-container');

        var html = '<div class="modal-overlay" id="share-overlay">';
        html += '<div class="modal">';
        html += '<h2>' + t('shareExam') + '</h2>';

        // Current trainers list
        html += '<div class="trainer-list">';
        html += '<h3>' + t('sharedTrainers') + '</h3>';
        (exam.trainerIds || []).forEach(function (tid) {
            var name = trainerNames[tid] || tid.slice(0, 8);
            var label = tid === exam.ownerId ? ' (' + t('owner') + ')' : '';
            var youLabel = tid === App.Auth.getUserId() ? ' (' + t('you') + ')' : '';
            html += '<div class="trainer-item">' + App.Utils.escapeHtml(name) + label + youLabel + '</div>';
        });
        html += '</div>';

        // Add trainer form
        html += '<div class="form-group" style="margin-top:16px">';
        html += '<label>' + t('trainerEmail') + '</label>';
        html += '<input type="email" id="trainer-email" placeholder="email@example.com">';
        html += '</div>';
        html += '<div id="share-error" class="auth-error" style="display:none"></div>';
        html += '<div class="modal-actions">';
        html += '<button class="btn btn-primary" id="btn-add-trainer">' + t('addTrainer') + '</button>';
        html += '<button class="btn btn-outline" id="btn-close-share">' + t('cancel') + '</button>';
        html += '</div>';
        html += '</div>';
        html += '</div>';
        modalContainer.innerHTML = html;

        document.getElementById('btn-add-trainer').addEventListener('click', async function () {
            var email = document.getElementById('trainer-email').value.trim();
            if (!email) return;
            var errorEl = document.getElementById('share-error');
            errorEl.style.display = 'none';

            var result = await App.Storage.addTrainerByEmail(currentExamId, email);
            if (result.error) {
                errorEl.textContent = t('trainerNotFound');
                errorEl.style.display = '';
            } else {
                // Refresh exam data and re-show modal
                cachedExam = await App.Storage.getExam(currentExamId);
                App.showToast(t('trainerAdded'));
                showShareModal();
            }
        });

        document.getElementById('btn-close-share').addEventListener('click', function () {
            modalContainer.innerHTML = '';
        });
        document.getElementById('share-overlay').addEventListener('click', function (e) {
            if (e.target === this) modalContainer.innerHTML = '';
        });
    }

    function showInviteModal() {
        var t = App.I18n.t;
        var exam = cachedExam;
        var modalContainer = document.getElementById('modal-container');
        var code = exam.invitationCode || '';
        var baseUrl = window.location.origin + window.location.pathname;
        var link = baseUrl + '#/invite/' + currentExamId;

        var html = '<div class="modal-overlay" id="invite-overlay">';
        html += '<div class="modal">';
        html += '<h2>' + t('inviteExaminees') + '</h2>';

        if (code) {
            html += '<div class="form-group">';
            html += '<label>' + t('invitationLink') + '</label>';
            html += '<div class="copy-field"><input type="text" id="invite-link" value="' + link + '" readonly>';
            html += '<button class="btn btn-sm btn-outline" id="btn-copy-link">' + t('copyLink') + '</button></div>';
            html += '</div>';
            html += '<div class="form-group">';
            html += '<label>' + t('accessCode') + '</label>';
            html += '<div class="copy-field"><input type="text" id="invite-code" value="' + code + '" readonly class="code-display">';
            html += '<button class="btn btn-sm btn-outline" id="btn-copy-code">' + t('copyCode') + '</button></div>';
            html += '</div>';
        } else {
            html += '<p style="margin-bottom:16px">' + t('inviteExaminees') + '</p>';
        }

        html += '<div class="modal-actions">';
        if (!code) {
            html += '<button class="btn btn-primary" id="btn-generate-code">' + t('create') + '</button>';
        }
        html += '<button class="btn btn-outline" id="btn-close-invite">' + t('cancel') + '</button>';
        html += '</div>';
        html += '</div>';
        html += '</div>';
        modalContainer.innerHTML = html;

        var generateBtn = document.getElementById('btn-generate-code');
        if (generateBtn) {
            generateBtn.addEventListener('click', async function () {
                var newCode = await App.Storage.generateInvitationCode(currentExamId);
                cachedExam.invitationCode = newCode;
                showInviteModal();
            });
        }

        var copyLinkBtn = document.getElementById('btn-copy-link');
        if (copyLinkBtn) {
            copyLinkBtn.addEventListener('click', function () {
                navigator.clipboard.writeText(document.getElementById('invite-link').value);
                App.showToast(t('copied'));
            });
        }

        var copyCodeBtn = document.getElementById('btn-copy-code');
        if (copyCodeBtn) {
            copyCodeBtn.addEventListener('click', function () {
                navigator.clipboard.writeText(document.getElementById('invite-code').value);
                App.showToast(t('copied'));
            });
        }

        document.getElementById('btn-close-invite').addEventListener('click', function () {
            modalContainer.innerHTML = '';
        });
        document.getElementById('invite-overlay').addEventListener('click', function (e) {
            if (e.target === this) modalContainer.innerHTML = '';
        });
    }

    return { render: render };
})();
