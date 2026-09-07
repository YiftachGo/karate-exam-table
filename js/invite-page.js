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
                showIdentifyStep(code);
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

        // Photo upload (REQUIRED — marked with asterisk)
        html += '<div class="photo-section">';
        html += '<label class="photo-label-required">' + t('uploadPhoto') + ' <span class="required-star">*</span></label>';
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
        html += regField('dateOfBirth', t('dateOfBirth'), 'date', true, prefill.dateOfBirth);
        html += App.Utils.buildRankSelect('reg-rank', prefill.rank || '', t('rank') + ' *');
        html += '</div>';

        html += regClubSelect(t('club') + ' *', prefill.club);

        html += '<div class="form-row">';
        html += regField('trainingStartDate', t('trainingStartDate'), 'date', true, prefill.trainingStartDate);
        html += regField('lastExamDate', t('lastExamDate'), 'date', true, prefill.lastExamDate);
        html += '</div>';

        html += regField('trainingsPerWeek', t('trainingsPerWeek'), 'number', true, prefill.trainingsPerWeek);

        // Prerequisites
        html += '<div class="prerequisites-section">';
        html += '<h3 class="section-title">' + t('prerequisites') + '</h3>';

        // Gasshukus as structured list (at least one required) — rows populated after mount
        html += '<div class="form-group">';
        html += '<label>' + t('gasshukusSinceLastExam') + ' <span class="required-star">*</span></label>';
        html += '<p class="field-explanation">' + t('gasshukusExplanation') + '</p>';
        html += '<div id="gasshuku-list"></div>';
        html += '<button type="button" class="btn btn-sm btn-outline" id="btn-add-gasshuku">+ ' + t('addGasshuku') + '</button>';
        html += '</div>';

        html += '<div class="shodan-subsection">';
        html += '<h4 class="subsection-title">' + t('shodanAndAbove') + '</h4>';
        var isDan = App.Utils.isBlackBeltRank(prefill.rank);
        html += '<div class="form-group">';
        html += '<label id="belt-list-label">' + t('beltTrainings') + (isDan ? ' <span class="required-star">*</span>' : '') + '</label>';
        html += '<div id="belt-list"></div>';
        html += '<button type="button" class="btn btn-sm btn-outline" id="btn-add-belt">+ ' + t('addBeltTraining') + '</button>';
        html += '</div>';
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

    // Gasshuku list UI is owned by App.Utils.renderGasshukuList / readGasshukuList.

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
            beltTrainings: App.Utils.readBeltTrainingsList(document.getElementById('belt-list')),
            gasshukus: App.Utils.readGasshukuList(document.getElementById('gasshuku-list'))
        };
    }

    // Required fields validated before submission. Photo is validated separately
    // because it's either a prefilled URL (edit flow) or a freshly selected file.
    var REQUIRED_FIELDS = [
        'firstName', 'lastName', 'dateOfBirth', 'rank', 'club',
        'trainingStartDate', 'lastExamDate', 'trainingsPerWeek'
    ];

    // `onPhotoSelected(file)` returns a Promise<string> with the final photoUrl to store.
    // `existingPhotoUrl` lets us skip the photo requirement in edit mode if a photo is already on file.
    function bindPhotoAndSubmit(onPhotoSelected, onSubmit, submitLabel, existingPhotoUrl, initialGasshukus, initialBeltTrainings) {
        var t = App.I18n.t;
        var selectedPhotoFile = null;

        App.Utils.renderGasshukuList(
            document.getElementById('gasshuku-list'),
            document.getElementById('btn-add-gasshuku'),
            initialGasshukus || []
        );

        App.Utils.renderBeltTrainingsList(
            document.getElementById('belt-list'),
            document.getElementById('btn-add-belt'),
            Array.isArray(initialBeltTrainings) ? initialBeltTrainings : []
        );

        // Toggle belt-trainings asterisk based on rank selection
        var rankEl = document.getElementById('reg-rank');
        var beltLabelEl = document.getElementById('belt-list-label');
        function updateBeltAsterisk() {
            if (!beltLabelEl) return;
            var isDan = App.Utils.isBlackBeltRank(rankEl ? rankEl.value : '');
            beltLabelEl.innerHTML = t('beltTrainings') + (isDan ? ' <span class="required-star">*</span>' : '');
        }
        if (rankEl) rankEl.addEventListener('change', updateBeltAsterisk);

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

            // Clear previous invalid highlights
            document.querySelectorAll('.field-invalid').forEach(function (el) { el.classList.remove('field-invalid'); });

            // Check all required fields
            var missing = [];
            REQUIRED_FIELDS.forEach(function (key) {
                var el = document.getElementById('reg-' + key);
                var val = (data[key] == null ? '' : String(data[key])).trim();
                if (!val) {
                    missing.push(key);
                    if (el) el.classList.add('field-invalid');
                }
            });

            // Photo check — must have either an existing URL or a newly selected file
            var hasPhoto = !!existingPhotoUrl || !!selectedPhotoFile;
            if (!hasPhoto) {
                var photoPreview = document.getElementById('reg-photo-preview');
                if (photoPreview) photoPreview.classList.add('field-invalid');
            }

            // Gasshuku check — at least one entry with location + date
            if (!data.gasshukus.length ||
                !data.gasshukus.some(function (g) { return g.location && g.date; })) {
                var gList = document.getElementById('gasshuku-list');
                if (gList) gList.classList.add('field-invalid');
            }

            // Error summary
            if (!hasPhoto) {
                errorEl.textContent = t('photoRequired');
                errorEl.style.display = '';
                return;
            }
            if (missing.length) {
                errorEl.textContent = t('fillAllFields');
                errorEl.style.display = '';
                return;
            }
            if (!data.gasshukus.length ||
                !data.gasshukus.some(function (g) { return g.location && g.date; })) {
                errorEl.textContent = t('atLeastOneGasshuku');
                errorEl.style.display = '';
                return;
            }
            if (App.Utils.isBlackBeltRank(data.rank) &&
                (!data.beltTrainings.length ||
                 !data.beltTrainings.some(function (b) { return b.location && b.date; }))) {
                var bList = document.getElementById('belt-list');
                if (bList) bList.classList.add('field-invalid');
                errorEl.textContent = t('atLeastOneBeltTraining');
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

    // --- Returning-student identification ---
    //
    // Step 1 of registration: name + date of birth only. If the student has
    // tested with us before we recognise them from the public studentDirectory
    // and hand them a prefilled card instead of the full blank form.

    function showIdentifyStep(code) {
        var t = App.I18n.t;
        var container = document.getElementById('app');

        var html = '<div class="invite-page">';
        html += '<div class="invite-card invite-card-wide">';
        html += '<h2>' + t('identifyYourself') + '</h2>';
        html += '<p class="invite-subtitle">' + t('identifySubtitle') + '</p>';
        html += '<div class="detail-form">';
        html += '<div class="form-row">';
        html += identField('firstName', t('firstName'));
        html += identField('lastName', t('lastName'));
        html += '</div>';
        html += identField('dateOfBirth', t('dateOfBirth'), 'date');
        html += '<div id="ident-error" class="auth-error" style="display:none"></div>';
        html += '<div class="form-actions">';
        html += '<button class="btn btn-primary btn-block" id="btn-identify">' + t('continueBtn') + '</button>';
        html += '</div>';
        html += '</div></div></div>';

        container.innerHTML = html;

        var btn = document.getElementById('btn-identify');
        btn.addEventListener('click', async function () {
            var errorEl = document.getElementById('ident-error');
            errorEl.style.display = 'none';
            document.querySelectorAll('.field-invalid').forEach(function (el) { el.classList.remove('field-invalid'); });

            var typed = {
                firstName: document.getElementById('ident-firstName').value.trim(),
                lastName: document.getElementById('ident-lastName').value.trim(),
                dateOfBirth: document.getElementById('ident-dateOfBirth').value
            };

            var missing = false;
            ['firstName', 'lastName', 'dateOfBirth'].forEach(function (k) {
                if (!typed[k]) {
                    missing = true;
                    var el = document.getElementById('ident-' + k);
                    if (el) el.classList.add('field-invalid');
                }
            });
            if (missing) {
                errorEl.textContent = t('fillNameAndDob');
                errorEl.style.display = '';
                return;
            }

            btn.disabled = true;
            btn.textContent = t('loading');
            var entry = null;
            try {
                entry = await App.Storage.lookupStudentDirectory(
                    typed.firstName, typed.lastName, typed.dateOfBirth);
            } catch (e) {
                // A directory miss must never block registration.
                console.warn('directory lookup failed', e);
            }
            btn.disabled = false;
            btn.textContent = t('continueBtn');

            if (entry) {
                showRecognitionCard(entry, typed, code);
            } else {
                // No exact match. Ask for the club — it both narrows a possible
                // spelling variant and is a required form field anyway, so a new
                // student loses nothing by answering it here.
                showClubStep(typed, code);
            }
        });

        // Enter advances from any of the three fields
        ['ident-firstName', 'ident-lastName', 'ident-dateOfBirth'].forEach(function (id) {
            document.getElementById(id).addEventListener('keydown', function (e) {
                if (e.key === 'Enter') btn.click();
            });
        });
        document.getElementById('ident-firstName').focus();
    }

    function identField(name, label, type) {
        var html = '<div class="form-group">';
        html += '<label>' + label + ' <span class="required-star">*</span></label>';
        html += '<input type="' + (type || 'text') + '" id="ident-' + name + '">';
        html += '</div>';
        return html;
    }

    // Step 2, only when the name didn't match exactly. The club is the third
    // verification factor for the spelling-variant lookup, and carries forward
    // into the form either way.
    function showClubStep(typed, code) {
        var t = App.I18n.t;
        var container = document.getElementById('app');

        var html = '<div class="invite-page">';
        html += '<div class="invite-card invite-card-wide">';
        html += '<h2>' + t('selectYourClub') + '</h2>';
        html += '<p class="invite-subtitle">' + t('selectYourClubSubtitle') + '</p>';
        html += '<div class="detail-form">';
        html += regClubSelect(t('club') + ' *', '');
        html += '<div id="club-error" class="auth-error" style="display:none"></div>';
        html += '<div class="form-actions">';
        html += '<button class="btn btn-primary btn-block" id="btn-club-continue">' + t('continueBtn') + '</button>';
        html += '</div>';
        html += '</div></div></div>';

        container.innerHTML = html;

        var btn = document.getElementById('btn-club-continue');
        btn.addEventListener('click', async function () {
            var errorEl = document.getElementById('club-error');
            errorEl.style.display = 'none';
            var club = document.getElementById('reg-club').value.trim();
            if (!club) {
                errorEl.textContent = t('fillAllFields');
                errorEl.style.display = '';
                return;
            }

            btn.disabled = true;
            btn.textContent = t('loading');
            var entry = null;
            try {
                entry = await App.Storage.lookupStudentDirectoryByClub(
                    typed.firstName, typed.lastName, typed.dateOfBirth, club);
            } catch (e) {
                console.warn('directory club lookup failed', e);
            }
            btn.disabled = false;
            btn.textContent = t('continueBtn');

            if (entry) {
                showRecognitionCard(entry, typed, code);
            } else {
                showRegistrationForm(code, {
                    firstName: typed.firstName,
                    lastName: typed.lastName,
                    dateOfBirth: typed.dateOfBirth,
                    club: club
                });
            }
        });
    }

    // "We found you" — enough detail for the student to recognise themselves,
    // and nothing more. Reached only after they proved name + DOB (+ club).
    function showRecognitionCard(entry, typed, code) {
        var t = App.I18n.t;
        var esc = App.Utils.escapeHtml;
        var container = document.getElementById('app');

        var html = '<div class="invite-page">';
        html += '<div class="invite-card invite-card-wide">';
        html += '<div class="invite-logo">&#128075;</div>';
        html += '<h2>' + t('weFoundYou') + '</h2>';
        html += '<p class="invite-subtitle">' + t('isThisYou') + '</p>';

        html += '<div class="recognition-card">';
        if (entry.photoUrl) {
            html += '<img class="recognition-photo" src="' + entry.photoUrl + '" alt="">';
        } else {
            html += '<div class="recognition-photo recognition-photo-empty">&#128100;</div>';
        }
        html += '<div class="recognition-fields">';
        html += '<div class="recognition-name">' + esc((entry.firstName || '') + ' ' + (entry.lastName || '')) + '</div>';
        if (entry.club) {
            html += '<div class="recognition-row"><span>' + t('club') + '</span> ' + esc(entry.club) + '</div>';
        }
        if (entry.currentRank) {
            html += '<div class="recognition-row"><span>' + t('currentRank') + '</span> ' + esc(entry.currentRank) + '</div>';
        }
        if (entry.lastExamDate) {
            html += '<div class="recognition-row"><span>' + t('lastExamDate') + '</span> ' + esc(App.Utils.formatDate(entry.lastExamDate)) + '</div>';
        }
        html += '</div></div>';

        html += '<div id="recognition-error" class="auth-error" style="display:none"></div>';
        html += '<div class="recognition-actions">';
        html += '<button class="btn btn-primary btn-block" id="btn-thats-me">' + t('yesThisIsMe') + '</button>';
        html += '<button class="btn btn-outline btn-block" id="btn-not-me">' + t('noNotMe') + '</button>';
        html += '</div>';
        html += '</div></div>';

        container.innerHTML = html;

        document.getElementById('btn-thats-me').addEventListener('click', async function () {
            var btn = this;
            var errorEl = document.getElementById('recognition-error');
            errorEl.style.display = 'none';
            btn.disabled = true;
            btn.textContent = t('loading');
            try {
                var result = await App.Storage.selfRegisterReturning(currentExamId, entry, code);
                savePriorRegistration(currentExamId, result.id, result.selfEditToken);
                App.showToast(t('welcomeBack'));
                // Hand off to the existing prefilled self-edit screen rather than
                // rendering a second copy of the same form.
                App.Router.navigate('#/invite/' + currentExamId + '/edit/' + result.id +
                    '?t=' + encodeURIComponent(result.selfEditToken));
            } catch (err) {
                btn.disabled = false;
                btn.textContent = t('yesThisIsMe');
                errorEl.textContent = t('error') + ': ' + err.message;
                errorEl.style.display = '';
            }
        });

        document.getElementById('btn-not-me').addEventListener('click', function () {
            // Keep what they typed; discard everything from the matched record.
            showRegistrationForm(code, {
                firstName: typed.firstName,
                lastName: typed.lastName,
                dateOfBirth: typed.dateOfBirth
            });
        });
    }

    function showRegistrationForm(code, prefill) {
        var t = App.I18n.t;
        var container = document.getElementById('app');

        container.innerHTML = buildRegistrationFormHtml(
            t('registrationTitle'),
            App.Utils.escapeHtml(verifiedExam.name) + ' — ' + t('registrationSubtitle'),
            t('submitRegistration'),
            prefill || {}
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
            t('submitRegistration'),
            null, // no existing photo for fresh registration
            [],
            []
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
            t('saveChanges'),
            ex.photoUrl || null,
            ex.gasshukus || [],
            Array.isArray(ex.beltTrainings) ? ex.beltTrainings : []
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
        html += '<label>' + label + (required ? ' <span class="required-star">*</span>' : '') + '</label>';
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
