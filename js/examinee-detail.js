var App = window.App || {};

App.ExamineeDetail = (function () {
    async function render(examId, examineeId) {
        var t = App.I18n.t;
        var container = document.getElementById('app');
        App.showLoading();

        var exam = await App.Storage.getExam(examId);
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
        if (ex.photoUrl) {
            html += '<img src="' + ex.photoUrl + '" class="examinee-photo" id="examinee-photo" alt="">';
        } else {
            html += '<div class="photo-placeholder" id="examinee-photo">&#128100;</div>';
        }
        html += '<div class="photo-actions">';
        html += '<label class="btn btn-sm btn-outline photo-upload-label">';
        html += t('uploadPhoto');
        html += '<input type="file" id="photo-input" accept="image/*" style="display:none">';
        html += '</label>';
        if (ex.photoUrl) {
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
        html += clubSelectGroup(t('club'), ex.club || '');

        html += '<div class="form-row">';
        html += formGroup('trainingStartDate', t('trainingStartDate'), 'date', ex.trainingStartDate);
        html += formGroup('lastExamDate', t('lastExamDate'), 'date', ex.lastExamDate);
        html += '</div>';

        html += formGroup('trainingsPerWeek', t('trainingsPerWeek'), 'number', ex.trainingsPerWeek);

        // Prerequisites section
        html += '<div class="prerequisites-section">';
        html += '<h3 class="section-title">' + t('prerequisites') + '</h3>';
        html += formGroup('beltTrainings', t('beltTrainings'), 'number', ex.beltTrainings);
        html += formGroup('gasshukuCount', t('gasshukuCount'), 'number', ex.gasshukuCount);

        html += '<div class="form-group">';
        html += '<label>' + t('examPayment') + '</label>';
        html += '<select id="field-examPayment">';
        html += '<option value="">' + t('selectStatus') + '</option>';
        html += '<option value="paid"' + (ex.examPayment === 'paid' ? ' selected' : '') + '>' + t('paid') + '</option>';
        html += '<option value="unpaid"' + (ex.examPayment === 'unpaid' ? ' selected' : '') + '>' + t('unpaid') + '</option>';
        html += '<option value="exempt"' + (ex.examPayment === 'exempt' ? ' selected' : '') + '>' + t('exempt') + '</option>';
        html += '</select>';
        html += '</div>';
        html += '</div>';

        html += '<div class="form-actions">';
        html += '<button class="btn btn-primary" id="btn-save-examinee">' + t('save') + '</button>';
        html += '</div>';

        html += '</div>';
        html += '</div>';
        html += '</div>';

        container.innerHTML = html;
        bindEvents(examId, examineeId);
    }

    var CLUBS = [
        { value: 'הונבו דוג\'ו - נתניה', display: 'הונבו דוג\'ו - נתניה (סנסיי אריאל בן סימון, בועז היליג, מישל יוסבשוילי)' },
        { value: 'דוג\'ו אבן יהודה', display: 'דוג\'ו אבן יהודה (סנסיי יואל שחר, יוסף אילוז)' },
        { value: 'דוג\'ו באר שבע', display: 'דוג\'ו באר שבע (סנסיי יפתח גוברין)' },
        { value: 'דוג\'ו עמק חפר', display: 'דוג\'ו עמק חפר (סנסיי עמוס דניאלי)' },
        { value: 'דוג\'ו עתלית', display: 'דוג\'ו עתלית (סנסיי קאטי פרש)' },
        { value: 'דוג\'ו פרדסיה', display: 'דוג\'ו פרדסיה (סנסיי אופיר הורביץ)' },
        { value: 'דוג\'ו קרית השרון', display: 'דוג\'ו קרית השרון (סנסיי בועז הייליג)' },
        { value: 'דוג\'ו תל אביב', display: 'דוג\'ו תל אביב (סנסיי יפתח גוברין)' }
    ];

    function clubSelectGroup(label, currentVal) {
        var html = '<div class="form-group">';
        html += '<label for="field-club">' + label + '</label>';
        html += '<select id="field-club">';
        html += '<option value=""></option>';
        CLUBS.forEach(function (club) {
            var selected = currentVal === club.value ? ' selected' : '';
            html += '<option value="' + App.Utils.escapeHtml(club.value) + '"' + selected + '>' + App.Utils.escapeHtml(club.display) + '</option>';
        });
        html += '</select>';
        html += '</div>';
        return html;
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
        document.getElementById('btn-back-table').addEventListener('click', function () {
            App.Router.navigate('#/exam/' + examId);
        });

        document.getElementById('btn-save-examinee').addEventListener('click', function () {
            saveExaminee(examId, examineeId);
        });

        document.getElementById('field-dateOfBirth').addEventListener('change', function () {
            var age = App.Utils.calculateAge(this.value);
            document.getElementById('field-age').value = age;
        });

        // Photo upload via Firebase Storage
        document.getElementById('photo-input').addEventListener('change', async function (e) {
            var file = e.target.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) {
                alert('Max file size: 5MB');
                return;
            }
            try {
                App.showToast(App.I18n.t('loading'));
                await App.PhotoUpload.uploadPhoto(examId, examineeId, file);
                render(examId, examineeId);
            } catch (err) {
                alert(App.I18n.t('error') + ': ' + err.message);
            }
        });

        var removePhotoBtn = document.getElementById('btn-remove-photo');
        if (removePhotoBtn) {
            removePhotoBtn.addEventListener('click', async function () {
                try {
                    await App.PhotoUpload.removePhoto(examId, examineeId);
                    render(examId, examineeId);
                } catch (err) {
                    alert(App.I18n.t('error') + ': ' + err.message);
                }
            });
        }
    }

    async function saveExaminee(examId, examineeId) {
        var data = {
            firstName: document.getElementById('field-firstName').value.trim(),
            lastName: document.getElementById('field-lastName').value.trim(),
            dateOfBirth: document.getElementById('field-dateOfBirth').value,
            rank: document.getElementById('field-rank').value.trim(),
            club: document.getElementById('field-club').value.trim(),
            trainingStartDate: document.getElementById('field-trainingStartDate').value,
            lastExamDate: document.getElementById('field-lastExamDate').value,
            trainingsPerWeek: document.getElementById('field-trainingsPerWeek').value,
            beltTrainings: document.getElementById('field-beltTrainings').value,
            gasshukuCount: document.getElementById('field-gasshukuCount').value,
            examPayment: document.getElementById('field-examPayment').value
        };
        await App.Storage.updateExaminee(examId, examineeId, data);
        App.showToast(App.I18n.t('dataSaved'));
    }

    return { render: render };
})();
