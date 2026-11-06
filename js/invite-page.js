var App = window.App || {};

App.InvitePage = (function () {
    var currentExamId = null;
    var verifiedExam = null;

    function storageKey(examId) { return 'krt_myreg_' + examId; }

    // Every registration made from this device for this exam — a list, because a
    // parent may register two children from one phone. Each entry carries the
    // person's key, so re-entering the same person can be sent to their existing
    // registration while a sibling still registers normally.
    // The old single-object format is read as a one-item list.
    function loadPriorRegistrations(examId) {
        try {
            var raw = JSON.parse(localStorage.getItem(storageKey(examId)) || 'null');
            if (!raw) return [];
            if (Array.isArray(raw.regs)) {
                return raw.regs.filter(function (r) { return r && r.examineeId && r.token; });
            }
            if (raw.examineeId && raw.token) {
                return [{ examineeId: raw.examineeId, token: raw.token, key: '', name: '' }];
            }
        } catch (e) {}
        return [];
    }

    // person: { firstName, lastName, dateOfBirth } when known.
    function savePriorRegistration(examId, examineeId, token, person) {
        person = person || {};
        var regs = loadPriorRegistrations(examId).filter(function (r) {
            return r.examineeId !== examineeId;
        });
        regs.push({
            examineeId: examineeId,
            token: token,
            key: App.Utils.personKey(person.firstName, person.lastName, person.dateOfBirth),
            name: ((person.firstName || '') + ' ' + (person.lastName || '')).trim()
        });
        try {
            localStorage.setItem(storageKey(examId), JSON.stringify({ regs: regs }));
        } catch (e) {}
    }

    function editRoute(examId, reg) {
        return '#/invite/' + examId + '/edit/' + reg.examineeId + '?t=' + encodeURIComponent(reg.token);
    }

    function render(examId) {
        currentExamId = examId;
        verifiedExam = null;
        showCodeEntry();
    }

    function showCodeEntry() {
        var t = App.I18n.t;
        var container = document.getElementById('app');

        var priors = loadPriorRegistrations(currentExamId);

        var html = '<div class="invite-page">';
        html += '<div class="invite-card">';
        html += '<div class="invite-logo">&#129354;</div>';
        html += '<h2>' + t('registrationTitle') + '</h2>';

        if (priors.length) {
            html += '<p class="invite-subtitle">' + t('continueEditing') + '</p>';
            priors.forEach(function (r, i) {
                html += '<button class="btn btn-primary btn-block prior-reg-btn" data-idx="' + i + '" style="margin-bottom:8px">' +
                    t('editMyRegistration') + (r.name ? ' — ' + App.Utils.escapeHtml(r.name) : '') + '</button>';
            });
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

        document.querySelectorAll('.prior-reg-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                App.Router.navigate(editRoute(currentExamId, priors[parseInt(btn.dataset.idx, 10)]));
            });
        });

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
        // Copied, with dates normalized: a record imported from a spreadsheet may
        // hold an Excel serial, which a date input shows as blank and which the
        // student's save would then erase.
        prefill = Object.assign({}, prefill || {});
        ['dateOfBirth', 'trainingStartDate', 'lastExamDate'].forEach(function (k) {
            if (prefill[k]) prefill[k] = App.Utils.normalizeDate(prefill[k]);
        });

        var html = '<div class="invite-page">';
        html += '<div class="invite-card invite-card-wide">';
        html += '<h2>' + titleHeader + '</h2>';
        html += '<p class="invite-subtitle">' + subtitle + '</p>';

        // Photo upload (REQUIRED — marked with asterisk)
        html += '<div class="photo-section">';
        html += '<label class="photo-label-required">' + t('uploadPhoto') + ' <span class="required-star">*</span></label>';
        // Only a real photo is shown, so the preview never claims one is on file
        // when what is stored is a broken leftover.
        if (App.PhotoUpload.isUsablePhoto(prefill.photoUrl)) {
            html += '<div class="photo-placeholder" id="reg-photo-preview"><img src="' + App.Utils.escapeHtml(prefill.photoUrl) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%"></div>';
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
        // Narrow the belt list to the exam's ladder when we know it. Reaching the
        // edit screen straight from a saved link leaves verifiedExam unset, in
        // which case all belts are shown — the safe default, since a filtered list
        // that omitted the student's current belt would deselect it.
        html += App.Utils.buildRankSelect('reg-rank', prefill.rank || '', t('rank') + ' *', {
            beltSystems: (verifiedExam && verifiedExam.beltSystems) || []
        });
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
        // A photo already on file only counts if it is a real image — older records
        // can hold an empty or broken value, and must not satisfy the requirement.
        var keptPhoto = App.PhotoUpload.isUsablePhoto(existingPhotoUrl) ? existingPhotoUrl : null;
        // The photo is processed as soon as it is chosen, not at submit. A photo
        // that cannot be read is then reported on the spot, while the student is
        // still looking at the picker. It used to be read only at submit, where a
        // failure was logged and the registration went through without a photo.
        var processedPhoto = null;
        var photoPending = null;

        App.Utils.bindRankShowAll(document);

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

        function showPreview(url) {
            var preview = document.getElementById('reg-photo-preview');
            if (!preview) return;
            preview.innerHTML = url
                ? '<img src="' + url + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
                : '&#128100;';
        }

        var photoInput = document.getElementById('reg-photo-input');
        photoInput.addEventListener('change', function (e) {
            var file = e.target.files[0];
            if (!file) return;
            var errorEl = document.getElementById('reg-error');
            var preview = document.getElementById('reg-photo-preview');
            errorEl.style.display = 'none';
            if (preview) {
                preview.classList.remove('field-invalid');
                preview.classList.add('photo-processing');
            }

            photoPending = onPhotoSelected(file).then(function (url) {
                processedPhoto = url;
                showPreview(url);
            }, function (err) {
                console.warn('photo could not be read:', err);
                processedPhoto = null;
                // Back to whatever was there before, and let them choose again.
                showPreview(keptPhoto);
                photoInput.value = '';
                if (preview) preview.classList.add('field-invalid');
                errorEl.textContent = t('photoUnreadable');
                errorEl.style.display = '';
            }).then(function () {
                if (preview) preview.classList.remove('photo-processing');
                photoPending = null;
            });
        });

        document.getElementById('btn-submit-reg').addEventListener('click', async function () {
            var btn = this;
            var errorEl = document.getElementById('reg-error');
            errorEl.style.display = 'none';

            // A photo still being processed is waited for, not skipped.
            if (photoPending) {
                btn.disabled = true;
                btn.textContent = t('loading');
                await photoPending;
                btn.disabled = false;
                btn.textContent = submitLabel;
            }

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

            // Photo check — a successfully processed new photo, or a real one on file.
            var photoUrl = processedPhoto || keptPhoto;
            var hasPhoto = App.PhotoUpload.isUsablePhoto(photoUrl);
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
                data.photoUrl = photoUrl;
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

            // Already registered from this phone: straight to their registration.
            var typedKey = App.Utils.personKey(typed.firstName, typed.lastName, typed.dateOfBirth);
            var localReg = loadPriorRegistrations(currentExamId).filter(function (r) {
                return r.key && r.key === typedKey;
            })[0];
            if (localReg) { showAlreadyRegistered(typed, code, localReg); return; }

            btn.disabled = true;
            btn.textContent = t('loading');

            // Already registered from somewhere else. Checked now rather than after
            // the whole form is filled in. 'unknown' (rule missing, network) carries
            // on — the submit itself is guarded too.
            var regState = await App.Storage.checkRegistration(
                currentExamId, typed.firstName, typed.lastName, typed.dateOfBirth);
            if (regState === 'registered') { showAlreadyRegistered(typed, code, null); return; }

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
        if (App.PhotoUpload.isUsablePhoto(entry.photoUrl)) {
            html += '<img class="recognition-photo" src="' + esc(entry.photoUrl) + '" alt="">';
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

        // Opens the registration form prefilled from their last exam. Nothing is
        // saved until they submit it.
        //
        // This used to create their record the moment they tapped "yes" and only
        // then show the form. A student whose old record had no photo got a new
        // record with none, and the photo requirement applied only if they pressed
        // Save afterwards. And one who backed out and registered again left two.
        document.getElementById('btn-thats-me').addEventListener('click', function () {
            showRegistrationForm(code, prefillFromDirectory(entry), { returningEntry: entry });
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

    // What a returning student's form starts with. Gasshukus and belt trainings
    // are deliberately not carried over: both are asked "since your last exam",
    // so last time's answers would be wrong this time.
    function prefillFromDirectory(entry) {
        return {
            firstName: entry.firstName || '',
            lastName: entry.lastName || '',
            dateOfBirth: entry.dateOfBirth || '',
            club: entry.club || '',
            rank: entry.currentRank || '',
            trainingStartDate: entry.trainingStartDate || '',
            trainingsPerWeek: entry.trainingsPerWeek || '',
            lastExamDate: entry.lastExamDate || '',
            photoUrl: entry.photoUrl || ''
        };
    }

    // opts.returningEntry — the directory entry this form was prefilled from.
    function showRegistrationForm(code, prefill, opts) {
        opts = opts || {};
        var t = App.I18n.t;
        var container = document.getElementById('app');
        var entry = opts.returningEntry || null;
        prefill = prefill || {};

        container.innerHTML = buildRegistrationFormHtml(
            entry ? t('weFoundYou') : t('registrationTitle'),
            App.Utils.escapeHtml(verifiedExam.name) + ' — ' +
                (entry ? t('welcomeBack') : t('registrationSubtitle')),
            t('submitRegistration'),
            prefill
        );

        var registerOpts = {};
        if (entry) {
            registerOpts.addedBy = 'self-registration:returning';
            if (entry.sourceExamId && entry.sourceExamineeId) {
                registerOpts.linkedRecordIds = [entry.sourceExamId + '__' + entry.sourceExamineeId];
            }
        }

        bindPhotoAndSubmit(
            function (file) {
                return App.PhotoUpload.uploadPhotoPublic(currentExamId, null, file);
            },
            async function (data) {
                var result;
                try {
                    result = await App.Storage.selfRegisterExaminee(currentExamId, data, code, registerOpts);
                } catch (err) {
                    if (err && err.code === 'already_registered') {
                        showAlreadyRegistered(data, code, null);
                        return;
                    }
                    throw err;
                }
                savePriorRegistration(currentExamId, result.id, result.selfEditToken, data);
                showSuccess(result.id, result.selfEditToken);
            },
            t('submitRegistration'),
            // A returning student's last photo counts, so they need not upload
            // again — but only a real one; otherwise the form asks for a photo.
            entry ? (prefill.photoUrl || null) : null,
            [],
            []
        );
    }

    // This person is already registered for this exam.
    // localReg — their registration as saved on this device, if it was made here;
    // then they can go straight to it. Otherwise the edit link they were given, or
    // their trainer, is the way in: nothing about another device's registration
    // can be revealed to someone who only knows a name and birthdate.
    function showAlreadyRegistered(person, code, localReg) {
        var t = App.I18n.t;
        var esc = App.Utils.escapeHtml;
        var container = document.getElementById('app');
        var name = ((person.firstName || '') + ' ' + (person.lastName || '')).trim();

        var html = '<div class="invite-page">';
        html += '<div class="invite-card invite-card-wide already-registered">';
        html += '<div class="invite-logo">&#9989;</div>';
        html += '<h2>' + t('alreadyRegisteredTitle') + '</h2>';
        if (name) html += '<p class="already-registered-name">' + esc(name) + '</p>';
        if (localReg) {
            html += '<p class="invite-subtitle">' + t('alreadyRegisteredHere') + '</p>';
            html += '<button class="btn btn-primary btn-block" id="btn-open-existing">' + t('editMyRegistration') + '</button>';
        } else {
            html += '<p class="invite-subtitle">' + t('alreadyRegisteredElsewhere') + '</p>';
        }
        html += '<button class="btn btn-outline btn-block" id="btn-register-other" style="margin-top:10px">' +
            t('registerSomeoneElse') + '</button>';
        html += '</div></div>';
        container.innerHTML = html;

        if (localReg) {
            document.getElementById('btn-open-existing').addEventListener('click', function () {
                App.Router.navigate(editRoute(currentExamId, localReg));
            });
        }
        document.getElementById('btn-register-other').addEventListener('click', function () {
            showIdentifyStep(code);
        });
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
        savePriorRegistration(examId, examineeId, token, ex);

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

    // Dojo list lives in App.Utils.CLUBS — see buildClubSelect there.
    function regClubSelect(label, currentVal) {
        return App.Utils.buildClubSelect('reg-club', currentVal, label);
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
