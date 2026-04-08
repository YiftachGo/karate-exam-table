var App = window.App || {};

App.ExamineeDetail = (function () {
    function render(examId, examineeId) {
        var t = App.I18n.t;
        var exam = App.Storage.getExam(examId);
        var container = document.getElementById('app');

        if (!exam || !exam.examinees[examineeId]) {
            App.Router.navigate('#/exam/' + examId);
            return;
        }

        var ex = exam.examinees[examineeId];

        var html = '<div class="examinee-detail-page">';
        html += '<button class="back-btn" id="btn-back-table">&larr; ' + t('back') + '</button>';
        html += '<h2 class="page-title">' + t('examineeDetails') + '</h2>';

        html += '<div class="detail-card">';

        // Photo section
        html += '<div class="photo-section">';
        if (ex.photo) {
            html += '<img src="' + ex.photo + '" class="examinee-photo" id="examinee-photo" alt="">';
        } else {
            html += '<div class="photo-placeholder" id="examinee-photo">&#128100;</div>';
        }
        html += '<div class="photo-actions">';
        html += '<label class="btn btn-sm btn-outline photo-upload-label">';
        html += t('uploadPhoto');
        html += '<input type="file" id="photo-input" accept="image/*" style="display:none">';
        html += '</label>';
        if (ex.photo) {
            html += '<button class="btn btn-sm btn-danger" id="btn-remove-photo">' + t('removePhoto') + '</button>';
        }
        html += '</div>';
        html += '</div>';

        // Form
        html += '<div class="detail-form">';

        html += '<div class="form-row">';
        html += formGroup('firstName', t('firstName'), 'text', ex.firstName);
        html += formGroup('lastName', t('lastName'), 'text', ex.lastName);
        html += '</div>';

        html += '<div class="form-row">';
        html += formGroup('dateOfBirth', t('dateOfBirth'), 'date', ex.dateOfBirth);
        html += '<div class="form-group">';
        html += '<label>' + t('age') + '</label>';
        html += '<input type="text" id="field-age" value="' + App.Utils.calculateAge(ex.dateOfBirth) + '" readonly class="readonly-field">';
        html += '</div>';
        html += '</div>';

        html += formGroup('rank', t('rank'), 'text', ex.rank);
        html += formGroup('club', t('club'), 'text', ex.club);

        html += '<div class="form-row">';
        html += formGroup('trainingStartDate', t('trainingStartDate'), 'date', ex.trainingStartDate);
        html += formGroup('lastExamDate', t('lastExamDate'), 'date', ex.lastExamDate);
        html += '</div>';

        html += formGroup('trainingsPerWeek', t('trainingsPerWeek'), 'number', ex.trainingsPerWeek);

        html += '<div class="form-actions">';
        html += '<button class="btn btn-primary" id="btn-save-examinee">' + t('save') + '</button>';
        html += '</div>';

        html += '</div>';
        html += '</div>';
        html += '</div>';

        container.innerHTML = html;
        bindEvents(examId, examineeId);
    }

    function formGroup(fieldName, label, type, value) {
        var val = value !== undefined && value !== null ? value : '';
        var html = '<div class="form-group">';
        html += '<label for="field-' + fieldName + '">' + label + '</label>';
        html += '<input type="' + type + '" id="field-' + fieldName + '" value="' + App.Utils.escapeHtml(String(val)) + '"';
        if (type === 'number') html += ' min="0" max="20"';
        html += '>';
        html += '</div>';
        return html;
    }

    function bindEvents(examId, examineeId) {
        var t = App.I18n.t;

        document.getElementById('btn-back-table').addEventListener('click', function () {
            App.Router.navigate('#/exam/' + examId);
        });

        document.getElementById('btn-save-examinee').addEventListener('click', function () {
            saveExaminee(examId, examineeId);
        });

        // Auto-calculate age when DOB changes
        document.getElementById('field-dateOfBirth').addEventListener('change', function () {
            var age = App.Utils.calculateAge(this.value);
            document.getElementById('field-age').value = age;
        });

        // Photo upload
        document.getElementById('photo-input').addEventListener('change', function (e) {
            var file = e.target.files[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) {
                alert('Max file size: 2MB');
                return;
            }
            var reader = new FileReader();
            reader.onload = function (ev) {
                // Resize image before saving
                resizeImage(ev.target.result, 200, function (dataUrl) {
                    App.Storage.updateExaminee(examId, examineeId, { photo: dataUrl });
                    render(examId, examineeId);
                });
            };
            reader.readAsDataURL(file);
        });

        // Remove photo
        var removePhotoBtn = document.getElementById('btn-remove-photo');
        if (removePhotoBtn) {
            removePhotoBtn.addEventListener('click', function () {
                App.Storage.updateExaminee(examId, examineeId, { photo: '' });
                render(examId, examineeId);
            });
        }
    }

    function resizeImage(dataUrl, maxSize, callback) {
        var img = new Image();
        img.onload = function () {
            var canvas = document.createElement('canvas');
            var w = img.width;
            var h = img.height;
            if (w > maxSize || h > maxSize) {
                if (w > h) {
                    h = Math.round(h * maxSize / w);
                    w = maxSize;
                } else {
                    w = Math.round(w * maxSize / h);
                    h = maxSize;
                }
            }
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            callback(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = dataUrl;
    }

    function saveExaminee(examId, examineeId) {
        var data = {
            firstName: document.getElementById('field-firstName').value.trim(),
            lastName: document.getElementById('field-lastName').value.trim(),
            dateOfBirth: document.getElementById('field-dateOfBirth').value,
            rank: document.getElementById('field-rank').value.trim(),
            club: document.getElementById('field-club').value.trim(),
            trainingStartDate: document.getElementById('field-trainingStartDate').value,
            lastExamDate: document.getElementById('field-lastExamDate').value,
            trainingsPerWeek: document.getElementById('field-trainingsPerWeek').value
        };
        App.Storage.updateExaminee(examId, examineeId, data);
        App.showToast(App.I18n.t('dataSaved'));
    }

    return { render: render };
})();
