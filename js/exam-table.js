var App = window.App || {};

App.ExamTable = (function () {
    var currentExamId = null;
    var autoSave = null;

    function render(examId) {
        currentExamId = examId;
        var t = App.I18n.t;
        var lang = App.I18n.getLang();
        var exam = App.Storage.getExam(examId);
        var container = document.getElementById('app');

        if (!exam) {
            App.Router.navigate('#/');
            return;
        }

        autoSave = App.Utils.debounce(function (examineeId, catKey, value) {
            App.Storage.updateGrade(currentExamId, examineeId, catKey, value);
        }, 300);

        var examinees = getSortedExaminees(exam);
        var categories = App.Utils.CATEGORIES;

        var html = '<div class="exam-table-page">';
        html += '<button class="back-btn" id="btn-back-list">&larr; ' + t('back') + '</button>';
        html += '<div class="toolbar">';
        html += '<h2 class="page-title">' + App.Utils.escapeHtml(exam.name) + '</h2>';
        html += '<span class="exam-date-badge">' + (exam.date ? App.Utils.formatDate(exam.date) : '') + '</span>';
        html += '<div class="toolbar-spacer"></div>';
        html += '<button class="btn btn-primary" id="btn-add-examinee">+ ' + t('addExaminee') + '</button>';
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
                if (ex.photo) {
                    html += '<img src="' + ex.photo + '" class="examinee-thumb" alt="">';
                }
                html += '<a href="#/exam/' + examId + '/examinee/' + ex.id + '" class="examinee-name-link">';
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
                    var val = (exam.grades[ex.id] && exam.grades[ex.id][cat.key]) || '';
                    html += '<td class="grade-cell">';
                    html += '<textarea class="grade-textarea" data-examinee="' + ex.id + '" data-category="' + cat.key + '" placeholder="' + t('enterNotes') + '">' + App.Utils.escapeHtml(val) + '</textarea>';
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

        bindEvents(examId);
        autoResizeTextareas();
    }

    function getSortedExaminees(exam) {
        return Object.values(exam.examinees).sort(function (a, b) {
            return (a.order || 0) - (b.order || 0);
        });
    }

    function autoResizeTextareas() {
        document.querySelectorAll('.grade-textarea').forEach(function (ta) {
            ta.style.height = 'auto';
            ta.style.height = Math.max(60, ta.scrollHeight) + 'px';
        });
    }

    function bindEvents(examId) {
        var t = App.I18n.t;

        document.getElementById('btn-back-list').addEventListener('click', function () {
            App.Router.navigate('#/');
        });

        document.getElementById('btn-add-examinee').addEventListener('click', function () {
            showAddExamineeModal(examId);
        });

        document.getElementById('btn-export-exam').addEventListener('click', function () {
            App.Storage.exportExam(examId);
        });

        document.querySelectorAll('.remove-examinee-btn').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                e.preventDefault();
                if (confirm(t('confirmDeleteExaminee'))) {
                    App.Storage.removeExaminee(examId, btn.dataset.id);
                    render(examId);
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

    function showAddExamineeModal(examId) {
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

        document.getElementById('btn-confirm-add').addEventListener('click', function () {
            addExaminee(examId);
        });
        document.getElementById('btn-cancel-add').addEventListener('click', function () {
            modalContainer.innerHTML = '';
        });
        document.getElementById('add-examinee-overlay').addEventListener('click', function (e) {
            if (e.target === this) modalContainer.innerHTML = '';
        });
        document.getElementById('new-first-name').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') addExaminee(examId);
        });
        document.getElementById('new-last-name').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') addExaminee(examId);
        });
        document.getElementById('new-first-name').focus();
    }

    function addExaminee(examId) {
        var firstName = document.getElementById('new-first-name').value.trim();
        var lastName = document.getElementById('new-last-name').value.trim();
        var rank = document.getElementById('new-rank').value.trim();
        if (!firstName) {
            document.getElementById('new-first-name').focus();
            return;
        }
        App.Storage.addExaminee(examId, firstName, lastName, rank);
        render(examId);
    }

    return { render: render };
})();
