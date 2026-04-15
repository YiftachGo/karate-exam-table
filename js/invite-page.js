var App = window.App || {};

App.InvitePage = (function () {
    var currentExamId = null;
    var verifiedExam = null;

    function render(examId) {
        currentExamId = examId;
        verifiedExam = null;
        showCodeEntry();
    }

    function showCodeEntry() {
        var t = App.I18n.t;
        var container = document.getElementById('app');

        var html = '<div class="invite-page">';
        html += '<div class="invite-card">';
        html += '<div class="invite-logo">&#129354;</div>';
        html += '<h2>' + t('registrationTitle') + '</h2>';
        html += '<p class="invite-subtitle">' + t('enterAccessCode') + '</p>';
        html += '<div class="form-group">';
        html += '<input type="text" id="invite-code-input" class="code-input" placeholder="ABC123" maxlength="6" autocomplete="off">';
        html += '</div>';
        html += '<div id="invite-error" class="auth-error" style="display:none"></div>';
        html += '<button class="btn btn-primary btn-block" id="btn-verify-code">' + t('verify') + '</button>';
        html += '</div>';
        html += '</div>';

        container.innerHTML = html;

        document.getElementById('btn-verify-code').addEventListener('click', verifyCode);
        document.getElementById('invite-code-input').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') verifyCode();
        });
        // Auto-uppercase
        document.getElementById('invite-code-input').addEventListener('input', function () {
            this.value = this.value.toUpperCase();
        });
        document.getElementById('invite-code-input').focus();
    }

    async function verifyCode() {
        var t = App.I18n.t;
        var code = document.getElementById('invite-code-input').value.trim();
        var errorEl = document.getElementById('invite-error');
        errorEl.style.display = 'none';

        if (!code) {
            document.getElementById('invite-code-input').focus();
            return;
        }

        try {
            var exam = await App.Storage.verifyInvitationCode(currentExamId, code);
            if (exam) {
                verifiedExam = exam;
                showRegistrationForm(code);
            } else {
                errorEl.textContent = t('invalidCode');
                errorEl.style.display = '';
            }
        } catch (err) {
            errorEl.textContent = t('error');
            errorEl.style.display = '';
        }
    }

    function showRegistrationForm(code) {
        var t = App.I18n.t;
        var container = document.getElementById('app');

        var html = '<div class="invite-page">';
        html += '<div class="invite-card invite-card-wide">';
        html += '<h2>' + t('registrationTitle') + '</h2>';
        html += '<p class="invite-subtitle">' + App.Utils.escapeHtml(verifiedExam.name) + ' — ' + t('registrationSubtitle') + '</p>';

        // Photo upload
        html += '<div class="photo-section">';
        html += '<div class="photo-placeholder" id="reg-photo-preview">&#128100;</div>';
        html += '<label class="btn btn-sm btn-outline photo-upload-label">';
        html += t('uploadPhoto');
        html += '<input type="file" id="reg-photo-input" accept="image/*" style="display:none">';
        html += '</label>';
        html += '</div>';

        html += '<div class="detail-form">';
        html += '<div class="form-row">';
        html += regField('firstName', t('firstName'), 'text', true);
        html += regField('lastName', t('lastName'), 'text', true);
        html += '</div>';

        html += '<div class="form-row">';
        html += regField('dateOfBirth', t('dateOfBirth'), 'date', false);
        html += regField('rank', t('rank'), 'text', false);
        html += '</div>';

        html += regClubSelect(t('club'));

        html += '<div class="form-row">';
        html += regField('trainingStartDate', t('trainingStartDate'), 'date', false);
        html += regField('lastExamDate', t('lastExamDate'), 'date', false);
        html += '</div>';

        html += regField('trainingsPerWeek', t('trainingsPerWeek'), 'number', false);

        // Prerequisites
        html += '<div class="prerequisites-section">';
        html += '<h3 class="section-title">' + t('prerequisites') + '</h3>';
        html += regField('beltTrainings', t('beltTrainings'), 'number', false);
        html += regField('gasshukuCount', t('gasshukuCount'), 'number', false);
        html += '</div>';

        html += '<div id="reg-error" class="auth-error" style="display:none"></div>';

        html += '<div class="form-actions">';
        html += '<button class="btn btn-primary btn-block" id="btn-submit-reg">' + t('submitRegistration') + '</button>';
        html += '</div>';
        html += '</div>';

        html += '</div>';
        html += '</div>';

        container.innerHTML = html;

        // Photo preview
        var selectedPhotoFile = null;
        document.getElementById('reg-photo-input').addEventListener('change', function (e) {
            var file = e.target.files[0];
            if (!file) return;
            selectedPhotoFile = file;
            var reader = new FileReader();
            reader.onload = function (ev) {
                var preview = document.getElementById('reg-photo-preview');
                preview.innerHTML = '<img src="' + ev.target.result + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
            };
            reader.readAsDataURL(file);
        });

        document.getElementById('btn-submit-reg').addEventListener('click', async function () {
            var btn = this;
            var errorEl = document.getElementById('reg-error');
            errorEl.style.display = 'none';

            var firstName = document.getElementById('reg-firstName').value.trim();
            var lastName = document.getElementById('reg-lastName').value.trim();

            if (!firstName) {
                errorEl.textContent = t('fillAllFields');
                errorEl.style.display = '';
                return;
            }

            // Disable button immediately to prevent duplicate submissions
            btn.disabled = true;
            btn.textContent = t('loading');

            try {
                var data = {
                    firstName: firstName,
                    lastName: lastName,
                    dateOfBirth: document.getElementById('reg-dateOfBirth').value,
                    rank: document.getElementById('reg-rank').value.trim(),
                    club: document.getElementById('reg-club').value.trim(),
                    trainingStartDate: document.getElementById('reg-trainingStartDate').value,
                    lastExamDate: document.getElementById('reg-lastExamDate').value,
                    trainingsPerWeek: document.getElementById('reg-trainingsPerWeek').value,
                    beltTrainings: document.getElementById('reg-beltTrainings').value,
                    gasshukuCount: document.getElementById('reg-gasshukuCount').value,
                    photoUrl: ''
                };

                // Resize photo to base64 if selected
                if (selectedPhotoFile) {
                    try {
                        data.photoUrl = await App.PhotoUpload.uploadPhotoPublic(currentExamId, null, selectedPhotoFile);
                    } catch (photoErr) {
                        console.warn('Photo resize failed:', photoErr);
                    }
                }

                await App.Storage.selfRegisterExaminee(currentExamId, data, code);

                showSuccess();
            } catch (err) {
                // Re-enable button so user can try again
                btn.disabled = false;
                btn.textContent = t('submitRegistration');
                errorEl.textContent = t('error') + ': ' + err.message;
                errorEl.style.display = '';
            }
        });
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

    function regClubSelect(label) {
        var html = '<div class="form-group">';
        html += '<label>' + label + '</label>';
        html += '<select id="reg-club">';
        html += '<option value=""></option>';
        CLUBS.forEach(function (club) {
            html += '<option value="' + App.Utils.escapeHtml(club.value) + '">' + App.Utils.escapeHtml(club.display) + '</option>';
        });
        html += '</select>';
        html += '</div>';
        return html;
    }

    function regField(name, label, type, required) {
        var html = '<div class="form-group">';
        html += '<label>' + label + (required ? ' *' : '') + '</label>';
        html += '<input type="' + type + '" id="reg-' + name + '"';
        if (type === 'number') html += ' min="0" max="20"';
        html += '>';
        html += '</div>';
        return html;
    }

    function showSuccess() {
        var t = App.I18n.t;
        var container = document.getElementById('app');

        var html = '<div class="invite-page">';
        html += '<div class="invite-card">';
        html += '<div class="invite-logo">&#10004;&#65039;</div>';
        html += '<h2>' + t('thankYou') + '</h2>';
        html += '<p class="invite-subtitle">' + t('registrationSuccess') + '</p>';
        html += '</div>';
        html += '</div>';

        container.innerHTML = html;
    }

    return { render: render };
})();
