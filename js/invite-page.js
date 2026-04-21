var App = window.App || {};

App.InvitePage = (function () {
    var currentExamId = null;
    var verifiedExam = null;

    function storageKey(examId) { return 'krt_myreg_' + examId; }

    function loadPriorRegistration(examId) {
        try {
            var raw = localStorage.getItem(storageKey(examId));
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }

    function savePriorRegistration(examId, examineeId, token) {
        try {
            localStorage.setItem(storageKey(examId), JSON.stringify({
                examineeId: examineeId, token: token
            }));
        } catch (e) {}
    }

    function render(examId) {
        currentExamId = examId;
        verifiedExam = null;
        showCodeEntry();
    }

    function showCodeEntry() {
        var t = App.I18n.t;
        var container = document.getElementById('app');

        var prior = loadPriorRegistration(currentExamId);

        var html = '<div class="invite-page">';
        html += '<div class="invite-card">';
        html += '<div class="invite-logo">&#129354;</div>';
        html += '<h2>' + t('registrationTitle') + '</h2>';

        if (prior && prior.examineeId && prior.token) {
            html += '<p class="invite-subtitle">' + t('continueEditing') + '</p>';
            html += '<button class="btn btn-primary btn-block" id="btn-continue-edit">' + t('editMyRegistration') + '</button>';
            html += '<div class="or-divider" style="margin:14px 0;text-align:center;color:var(--text-secondary,#888);font-size:0.9rem">' + t('or') + '</div>';
        }

        html += '<p class="invite-subtitle">' + t('enterAccessCode') + '</p>';
        html += '<div class="form-group">';
        html += '<input type="text" id="invite-code-input" class="code-input" placeholder="ABC123" maxlength="6" autocomplete="off">';
        html += '</div>';
        html += '<div id="invite-error" class="auth-error" style="display:none"></div>';
        html += '<button class="btn btn-primary btn-block" id="btn-verify-code">' + t('verify') + '</button>';
        html += '</div>';
        html += '</div>';

        container.innerHTML = html;

        if (prior && prior.examineeId && prior.token) {
            document.getElementById('btn-continue-edit').addEventListener('click', function () {
                App.Router.navigate('#/invite/' + currentExamId + '/edit/' + prior.examineeId + '?t=' + encodeURIComponent(prior.token));
            });
        }

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

    // Builds the shared personal-details form. Used by both new registration and edit mode.
    // `prefill` is optional and pre-populates the fields.
    function buildRegistrationFormHtml(titleHeader, subtitle, submitLabel, prefill) {
        var t = App.I18n.t;
        prefill = prefill || {};

        var html = '<div class="invite-page">';
        html += '<div class="invite-card invite-card-wide">';
        html += '<h2>' + titleHeader + '</h2>';
        html += '<p class="invite-subtitle">' + subtitle + '</p>';

        // Photo upload
        html += '<div class="photo-section">';
        if (prefill.photoUrl) {
            html += '<div class="photo-placeholder" id="reg-photo-preview"><img src="' + prefill.photoUrl + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%"></div>';
        } else {
            html += '<div class="photo-placeholder" id="reg-photo-preview">&#128100;</div>';
        }
        html += '<label class="btn btn-sm btn-outline photo-upload-label">';
        html += t('uploadPhoto');
        html += '<input type="file" id="reg-photo-input" accept="image/*" style="display:none">';
        html += '</label>';
        html += '</div>';

        html += '<div class="detail-form">';
        html += '<div class="form-row">';
        html += regField('firstName', t('firstName'), 'text', true, prefill.firstName);
        html += regField('lastName', t('lastName'), 'text', true, prefill.lastName);
        html += '</div>';

        html += '<div class="form-row">';
        html += regField('dateOfBirth', t('dateOfBirth'), 'date', false, prefill.dateOfBirth);
        html += App.Utils.buildRankSelect('reg-rank', prefill.rank || '', t('rank'));
        html += '</div>';

        html += regClubSelect(t('club'), prefill.club);

        html += '<div class="form-row">';
        html += regField('trainingStartDate', t('trainingStartDate'), 'date', false, prefill.trainingStartDate);
        html += regField('lastExamDate', t('lastExamDate'), 'date', false, prefill.lastExamDate);
        html += '</div>';

        html += regField('trainingsPerWeek', t('trainingsPerWeek'), 'number', false, prefill.trainingsPerWeek);

        // Prerequisites
        html += '<div class="prerequisites-section">';
        html += '<h3 class="section-title">' + t('prerequisites') + '</h3>';
        html += regField('gasshukuCount', t('gasshukuCount'), 'number', false, prefill.gasshukuCount);
        html += '<div class="shodan-subsection">';
        html += '<h4 class="subsection-title">' + t('shodanAndAbove') + '</h4>';
        html += regField('beltTrainings', t('beltTrainings'), 'number', false, prefill.beltTrainings);
        html += '</div>';
        html += '</div>';

        html += '<div id="reg-error" class="auth-error" style="display:none"></div>';

        html += '<div class="form-actions">';
        html += '<button class="btn btn-primary btn-block" id="btn-submit-reg">' + submitLabel + '</button>';
        html += '</div>';
        html += '</div>';

        html += '</div>';
        html += '</div>';
        return html;
    }

    function readFormData() {
        return {
            firstName: document.getElementById('reg-firstName').value.trim(),
            lastName: document.getElementById('reg-lastName').value.trim(),
            dateOfBirth: document.getElementById('reg-dateOfBirth').value,
            rank: document.getElementById('reg-rank').value.trim(),
            club: document.getElementById('reg-club').value.trim(),
            trainingStartDate: document.getElementById('reg-trainingStartDate').value,
            lastExamDate: document.getElementById('reg-lastExamDate').value,
            trainingsPerWeek: document.getElementById('reg-trainingsPerWeek').value,
            beltTrainings: document.getElementById('reg-beltTrainings').value,
            gasshukuCount: document.getElementById('reg-gasshukuCount').value
        };
    }

    // `onPhotoSelected(file)` returns a Promise<string> with the final photoUrl to store.
    function bindPhotoAndSubmit(onPhotoSelected, onSubmit, submitLabel) {
        var t = App.I18n.t;
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

            var data = readFormData();
            if (!data.firstName) {
                errorEl.textContent = t('fillAllFields');
                errorEl.style.display = '';
                return;
            }

            btn.disabled = true;
            btn.textContent = t('loading');

            try {
                if (selectedPhotoFile) {
                    try {
                        data.photoUrl = await onPhotoSelected(selectedPhotoFile);
                    } catch (photoErr) {
                        console.warn('Photo upload failed:', photoErr);
                    }
                }
                await onSubmit(data);
            } catch (err) {
                btn.disabled = false;
                btn.textContent = submitLabel;
                errorEl.textContent = t('error') + ': ' + err.message;
                errorEl.style.display = '';
            }
        });
    }

    function showRegistrationForm(code) {
        var t = App.I18n.t;
        var container = document.getElementById('app');

        container.innerHTML = buildRegistrationFormHtml(
            t('registrationTitle'),
            App.Utils.escapeHtml(verifiedExam.name) + ' — ' + t('registrationSubtitle'),
            t('submitRegistration'),
            {}
        );

        bindPhotoAndSubmit(
            function (file) {
                return App.PhotoUpload.uploadPhotoPublic(currentExamId, null, file);
            },
            async function (data) {
                var result = await App.Storage.selfRegisterExaminee(currentExamId, data, code);
                savePriorRegistration(currentExamId, result.id, result.selfEditToken);
                showSuccess(result.id, result.selfEditToken);
            },
            t('submitRegistration')
        );
    }

    // Renders the edit form for a returning student. Reached via
    // #/invite/:examId/edit/:examineeId?t=...
    async function renderEdit(examId, examineeId, token) {
        currentExamId = examId;
        var t = App.I18n.t;
        var container = document.getElementById('app');
        container.innerHTML = '<div class="invite-page"><div class="invite-card"><p class="invite-subtitle">' + t('loading') + '</p></div></div>';

        var ex;
        try {
            ex = await App.Storage.getSelfRegistration(examId, examineeId, token);
        } catch (err) {
            container.innerHTML = '<div class="invite-page"><div class="invite-card"><p class="invite-subtitle">' + t('error') + '</p></div></div>';
            return;
        }

        if (!ex) {
            container.innerHTML = '<div class="invite-page"><div class="invite-card"><h2>' + t('error') + '</h2><p class="invite-subtitle">' + t('invalidCode') + '</p></div></div>';
            return;
        }

        // Refresh localStorage in case the student opened their link on a new device
        savePriorRegistration(examId, examineeId, token);

        container.innerHTML = buildRegistrationFormHtml(
            t('editMyRegistration'),
            App.Utils.escapeHtml((ex.firstName || '') + ' ' + (ex.lastName || '')),
            t('saveChanges'),
            ex
        );

        bindPhotoAndSubmit(
            function (file) {
                return App.PhotoUpload.uploadPhotoPublic(examId, examineeId, file);
            },
            async function (data) {
                await App.Storage.selfUpdateRegistration(examId, examineeId, token, data);
                App.showToast(t('registrationUpdated'));
                // Re-render to reflect saved values
                renderEdit(examId, examineeId, token);
            },
            t('saveChanges')
        );
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

    function regClubSelect(label, currentVal) {
        var html = '<div class="form-group">';
        html += '<label>' + label + '</label>';
        html += '<select id="reg-club">';
        html += '<option value=""></option>';
        CLUBS.forEach(function (club) {
            var selected = currentVal === club.value ? ' selected' : '';
            html += '<option value="' + App.Utils.escapeHtml(club.value) + '"' + selected + '>' + App.Utils.escapeHtml(club.display) + '</option>';
        });
        html += '</select>';
        html += '</div>';
        return html;
    }

    function regField(name, label, type, required, value) {
        var val = value != null ? String(value) : '';
        var html = '<div class="form-group">';
        html += '<label>' + label + (required ? ' *' : '') + '</label>';
        html += '<input type="' + type + '" id="reg-' + name + '" value="' + App.Utils.escapeHtml(val) + '"';
        if (type === 'number') html += ' min="0" max="20"';
        html += '>';
        html += '</div>';
        return html;
    }

    function showSuccess(examineeId, token) {
        var t = App.I18n.t;
        var container = document.getElementById('app');
        var baseUrl = window.location.origin + window.location.pathname;
        var editLink = baseUrl + '#/invite/' + currentExamId + '/edit/' + examineeId + '?t=' + encodeURIComponent(token);

        var html = '<div class="invite-page">';
        html += '<div class="invite-card invite-card-wide">';
        html += '<div class="invite-logo">&#10004;&#65039;</div>';
        html += '<h2>' + t('thankYou') + '</h2>';
        html += '<p class="invite-subtitle">' + t('registrationSuccess') + '</p>';

        html += '<div class="form-group" style="margin-top:20px">';
        html += '<label>' + t('yourEditLink') + '</label>';
        html += '<div class="copy-field"><input type="text" id="edit-link" value="' + App.Utils.escapeHtml(editLink) + '" readonly>';
        html += '<button class="btn btn-sm btn-outline" id="btn-copy-edit-link">' + t('copyEditLink') + '</button></div>';
        html += '<p class="invite-subtitle" style="font-size:0.85rem;margin-top:8px">' + t('saveEditLink') + '</p>';
        html += '</div>';

        html += '<div class="form-actions" style="margin-top:16px">';
        html += '<button class="btn btn-primary btn-block" id="btn-open-edit">' + t('editMyRegistration') + '</button>';
        html += '</div>';

        html += '</div>';
        html += '</div>';

        container.innerHTML = html;

        document.getElementById('btn-copy-edit-link').addEventListener('click', function () {
            var input = document.getElementById('edit-link');
            input.select();
            try {
                navigator.clipboard.writeText(input.value);
            } catch (e) {
                document.execCommand('copy');
            }
            App.showToast(t('copied'));
        });

        document.getElementById('btn-open-edit').addEventListener('click', function () {
            App.Router.navigate('#/invite/' + currentExamId + '/edit/' + examineeId + '?t=' + encodeURIComponent(token));
        });
    }

    return { render: render, renderEdit: renderEdit };
})();
