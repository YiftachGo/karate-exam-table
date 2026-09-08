var App = window.App || {};

// Importing students from an earlier exam, with each one's belt already updated
// from the result they got there.
//
// Shared because two screens need the identical review step:
//   - the exam list, right after creating an exam for a dojo+class it has seen
//     before, which knows the source exam already
//   - the exam table's Manage Test menu and empty state, which do not, and so
//     open the source-exam picker first
//
// `onDone` is the only thing that differs between callers: the exam list
// navigates into the newly created exam, the exam table re-renders in place.

App.ImportStudents = (function () {

    function _container() { return document.getElementById('modal-container'); }
    function _close() {
        var c = _container();
        if (c) c.innerHTML = '';
    }

    function _finish(onDone) {
        _close();
        if (typeof onDone === 'function') onDone();
    }

    function _loadingModal(title) {
        var c = _container();
        if (!c) return;
        c.innerHTML = '<div class="modal-overlay" id="import-overlay"><div class="modal">' +
            '<h2>' + title + '</h2>' +
            '<p class="invite-subtitle">' + App.I18n.t('loading') + '</p></div></div>';
    }

    // --- Step 1: pick the source exam ---

    // opts: { targetExam, onDone }
    async function openPicker(opts) {
        var t = App.I18n.t;
        var esc = App.Utils.escapeHtml;
        var target = opts.targetExam || {};
        var onDone = opts.onDone;

        _loadingModal(t('importFromExam'));

        var exams;
        try {
            exams = await App.Storage.getExamIndex();
        } catch (err) {
            console.error('exam index failed:', err);
            _finish(onDone);
            return;
        }

        var others = exams.filter(function (e) { return e.id !== target.id; });

        var html = '<div class="modal-overlay" id="import-overlay"><div class="modal modal-wide">';
        html += '<h2>' + t('importFromExam') + '</h2>';

        if (!others.length) {
            html += '<p class="invite-subtitle">' + t('noOtherExams') + '</p>';
            html += '<div class="modal-actions">';
            html += '<button class="btn btn-outline" id="btn-close-picker">' + t('cancel') + '</button>';
            html += '</div></div></div>';
            _container().innerHTML = html;
            document.getElementById('btn-close-picker').addEventListener('click', function () { _finish(onDone); });
            document.getElementById('import-overlay').addEventListener('click', function (e) {
                if (e.target === this) _finish(onDone);
            });
            return;
        }

        html += '<p class="invite-subtitle">' + t('selectSourceExam') + '</p>';

        // Same dojo+class first — that is nearly always the exam being looked for.
        var sameGroup = [];
        var rest = [];
        others.forEach(function (e) {
            if (target.groupKey && e.groupKey === target.groupKey) sameGroup.push(e);
            else rest.push(e);
        });
        var ordered = sameGroup.concat(rest);

        html += '<div class="import-list">';
        ordered.forEach(function (e, i) {
            var isSame = target.groupKey && e.groupKey === target.groupKey;
            html += '<button type="button" class="source-exam-row' + (isSame ? ' source-exam-same' : '') +
                '" data-idx="' + i + '">';
            html += '<span class="source-exam-main">';
            html += '<span class="source-exam-name">' + esc(e.name || '') + '</span>';
            if (e.dojo || e.classGroup) {
                html += '<span class="source-exam-group">' +
                    esc([e.dojo, e.classGroup].filter(Boolean).join(' · ')) + '</span>';
            }
            html += '</span>';
            html += '<span class="source-exam-meta">';
            if (isSame) html += '<span class="source-exam-badge">' + t('sameGroup') + '</span>';
            html += '<span class="source-exam-count">' + (e.examineeCount || 0) + ' ' + t('examinees') + '</span>';
            if (e.date) html += '<span class="source-exam-date">' + App.Utils.formatDate(e.date) + '</span>';
            html += '</span>';
            html += '</button>';
        });
        html += '</div>';

        html += '<div class="modal-actions">';
        html += '<button class="btn btn-outline" id="btn-close-picker">' + t('cancel') + '</button>';
        html += '</div></div></div>';
        _container().innerHTML = html;

        document.querySelectorAll('.source-exam-row').forEach(function (row) {
            row.addEventListener('click', function () {
                var source = ordered[parseInt(row.dataset.idx, 10)];
                openReview({ targetExam: target, sourceExam: source, onDone: onDone });
            });
        });

        document.getElementById('btn-close-picker').addEventListener('click', function () { _finish(onDone); });
        document.getElementById('import-overlay').addEventListener('click', function (e) {
            if (e.target === this) _finish(onDone);
        });
    }

    // --- Step 2: review who comes over, and with which belt ---

    // opts: { targetExam, sourceExam, onDone }
    function openReview(opts) {
        var t = App.I18n.t;
        var esc = App.Utils.escapeHtml;
        var target = opts.targetExam || {};
        var source = opts.sourceExam || {};
        var onDone = opts.onDone;

        _loadingModal(t('importReviewTitle'));

        App.Storage.getImportCandidates(source.id, target.id).then(function (candidates) {
            if (!candidates.length) {
                App.showToast(t('noStudentsToImport'));
                _finish(onDone);
                return;
            }

            var html = '<div class="modal-overlay" id="import-overlay"><div class="modal modal-wide">';
            html += '<h2>' + t('importReviewTitle') + '</h2>';
            html += '<p class="invite-subtitle">' + t('importReviewSubtitle') + '</p>';
            html += '<p class="import-source">' + t('previousExamLabel') + ': ' +
                esc(source.name || '') + (source.date ? ' — ' + App.Utils.formatDate(source.date) : '') + '</p>';

            html += '<div class="import-list">';
            html += '<label class="import-select-all"><input type="checkbox" id="import-select-all"> ' +
                t('selectAll') + '</label>';
            candidates.forEach(function (c, i) {
                var verdictClass = c.verdict === 'pass' ? 'verdict-pass'
                    : c.verdict === 'fail' ? 'verdict-fail' : 'verdict-none';
                var verdictLabel = c.verdict === 'pass' ? t('passedLastExam')
                    : c.verdict === 'fail' ? t('failedLastExam') : t('notGraded');

                var rowClass = 'import-row';
                if (c.promoted) rowClass += ' import-row-promoted';
                if (c.alreadyPresent) rowClass += ' import-row-present';

                html += '<label class="' + rowClass + '">';
                // Anyone already in this exam starts unticked so a repeat import
                // cannot silently duplicate them — but stays tickable, because
                // name+DOB matching can be wrong (two same-named students with no
                // recorded birthdate collide).
                html += '<input type="checkbox" class="import-cb" data-idx="' + i + '"' +
                    (c.alreadyPresent ? '' : ' checked') + '>';
                html += '<span class="import-name">' + esc(c.firstName + ' ' + c.lastName) + '</span>';
                if (c.alreadyPresent) {
                    html += '<span class="import-present-badge">' + t('alreadyInThisExam') + '</span>';
                }
                html += '<span class="import-verdict ' + verdictClass + '">' + verdictLabel + '</span>';
                html += '<span class="import-rank">';
                if (c.promoted) {
                    html += '<span class="import-rank-old">' + esc(c.oldRank || '—') + '</span>';
                    // Left-pointing for the RTL base layout, where the old rank
                    // sits to the right. CSS flips it under [dir="ltr"].
                    html += '<span class="import-rank-arrow">&larr;</span>';
                    html += '<span class="import-rank-new">' + esc(c.newRank || '—') + '</span>';
                } else {
                    html += esc(c.newRank || c.oldRank || '—');
                    html += ' <span class="import-rank-same">(' + t('rankUnchanged') + ')</span>';
                }
                html += '</span>';
                html += '</label>';
            });
            html += '</div>';

            html += '<div id="import-error" class="auth-error" style="display:none"></div>';
            html += '<div class="modal-actions">';
            html += '<button class="btn btn-primary" id="btn-do-import">' + t('importSelected') + '</button>';
            html += '<button class="btn btn-outline" id="btn-skip-import">' + t('skipImport') + '</button>';
            html += '</div></div></div>';
            _container().innerHTML = html;

            var selectAll = document.getElementById('import-select-all');
            var boxes = Array.prototype.slice.call(document.querySelectorAll('.import-cb'));

            function syncSelectAll() {
                var checked = boxes.filter(function (cb) { return cb.checked; }).length;
                selectAll.checked = checked === boxes.length;
                selectAll.indeterminate = checked > 0 && checked < boxes.length;
            }
            syncSelectAll();

            selectAll.addEventListener('change', function () {
                var on = this.checked;
                boxes.forEach(function (cb) { cb.checked = on; });
                syncSelectAll();
            });
            boxes.forEach(function (cb) { cb.addEventListener('change', syncSelectAll); });

            document.getElementById('btn-skip-import').addEventListener('click', function () { _finish(onDone); });
            document.getElementById('import-overlay').addEventListener('click', function (e) {
                if (e.target === this) _finish(onDone);
            });

            document.getElementById('btn-do-import').addEventListener('click', async function () {
                var btn = this;
                var errorEl = document.getElementById('import-error');
                errorEl.style.display = 'none';

                var items = boxes.filter(function (cb) { return cb.checked; })
                    .map(function (cb) {
                        var c = candidates[parseInt(cb.dataset.idx, 10)];
                        return {
                            examineeId: c.examineeId,
                            rank: c.newRank,
                            targetRank: c.newTargetRank
                        };
                    });

                if (!items.length) { _finish(onDone); return; }

                btn.disabled = true;
                btn.textContent = t('loading');
                try {
                    var n = await App.Storage.importExaminees(source.id, target.id, items);
                    App.showToast(n + ' ' + t('studentsImportedCount'));
                    _finish(onDone);
                } catch (err) {
                    console.error('import failed:', err);
                    btn.disabled = false;
                    btn.textContent = t('importSelected');
                    errorEl.textContent = t('error') + ': ' + (err.message || err.code || err);
                    errorEl.style.display = '';
                }
            });
        }).catch(function (err) {
            console.warn('import candidates failed:', err);
            _finish(onDone);
        });
    }

    return { openPicker: openPicker, openReview: openReview };
})();
