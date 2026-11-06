var App = window.App || {};

App.Utils = (function () {
    function generateId(prefix) {
        return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function calculateAge(dateOfBirth) {
        if (!dateOfBirth) return '';
        var birth = new Date(dateOfBirth);
        var today = new Date();
        var age = today.getFullYear() - birth.getFullYear();
        var m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return age;
    }

    function formatDate(isoString) {
        if (!isoString) return '';
        var d = new Date(isoString);
        return d.toLocaleDateString('he-IL');
    }

    function debounce(fn, ms) {
        var timer;
        return function () {
            var context = this;
            var args = arguments;
            clearTimeout(timer);
            timer = setTimeout(function () {
                fn.apply(context, args);
            }, ms);
        };
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    var CATEGORIES = [
        { key: 'basic_standing', he: 'תרגילי בסיס בעמידה', en: 'Basic Standing Exercises' },
        { key: 'basic_movement', he: 'תרגילי בסיס בתנועה', en: 'Basic Movement Exercises' },
        { key: 'randori', he: 'עבודה בזוגות - רנדורי', en: 'Pair Work - Randori' },
        { key: 'ippon_kumite', he: 'איפון קומיטה', en: 'Ippon Kumite' },
        { key: 'kakia', he: 'קאקיאה', en: 'Kakia' },
        { key: 'pad_work', he: 'עבודה מול כרית', en: 'Pad Work' },
        { key: 'makiwara', he: 'מאקיווארה', en: 'Makiwara' },
        { key: 'chiishi', he: 'צ\'יאישי', en: 'Chiishi' },
        { key: 'nigiri_game', he: 'ניגירי-גאמה', en: 'Nigiri-Game' },
        { key: 'bunkai', he: 'בונקאי', en: 'Bunkai' },
        { key: 'kata', he: 'קאטה', en: 'Kata' },
        { key: 'sanchin', he: 'סנצ\'ין', en: 'Sanchin' },
        { key: 'general_notes', he: 'הערות כלליות', en: 'General Notes' },
        { key: 'recommendations', he: 'המלצות', en: 'Recommendations' },
        { key: 'rank_approval', he: 'אישור דרגה', en: 'Rank Approval', type: 'passfail' }
    ];

    var DEFAULT_CATEGORY_ORDER = CATEGORIES.map(function (c) { return c.key; });

    // --- Belt Ranks ---

    var _blueStripes  = ['', ' - פס כחול', ' - שני פסים כחולים', ' - שלושה פסים כחולים', ' - ארבעה פסים כחולים', ' - חמישה פסים כחולים'];
    var _greenStripes = ['', ' - פס ירוק', ' - שני פסים ירוקים', ' - שלושה פסים ירוקים', ' - ארבעה פסים ירוקים', ' - חמישה פסים ירוקים'];

    function _expand(colors, stripes) {
        var out = [];
        colors.forEach(function (c) { stripes.forEach(function (s) { out.push(c + s); }); });
        return out;
    }

    // The dojos. Single source of truth — previously duplicated verbatim in both
    // invite-page.js and examinee-detail.js. `value` is what gets persisted;
    // `display` adds the sensei names for the dropdown only.
    var CLUBS = [
        { value: 'הונבו דוג\'ו - נתניה', display: 'הונבו דוג\'ו - נתניה (סנסיי אריאל בן סימון, בועז היליג, מישל יוסבשוילי)' },
        { value: 'דוג\'ו אבן יהודה', display: 'דוג\'ו אבן יהודה (סנסיי יואל שחר, יוסף אילוז)' },
        { value: 'דוג\'ו באר שבע', display: 'דוג\'ו באר שבע (סנסיי יפתח גוברין)' },
        { value: 'דוג\'ו עמק חפר', display: 'דוג\'ו עמק חפר (סנסיי עמוס דניאלי)' },
        { value: 'דוג\'ו עתלית', display: 'דוג\'ו עתלית (סנסיי קאטי פרש)' },
        { value: 'דוג\'ו פרדסיה', display: 'דוג\'ו פרדסיה (סנסיי אופיר הורוביץ)' },
        { value: 'דוג\'ו קרית השרון', display: 'דוג\'ו קרית השרון (סנסיי בועז הייליג)' },
        { value: 'דוג\'ו רמת השרון', display: 'דוג\'ו רמת השרון (סנסיי אופיר הורוביץ)' },
        { value: 'דוג\'ו תל אביב', display: 'דוג\'ו תל אביב (סנסיי יפתח גוברין)' }
    ];

    // Builds a dojo <select>. Shared by the exam form, the examinee detail form
    // and the student registration form — each just passes its own element id.
    function buildClubSelect(id, currentVal, labelText) {
        var html = '<div class="form-group">';
        if (labelText) html += '<label for="' + id + '">' + labelText + '</label>';
        html += '<select id="' + id + '">';
        html += '<option value=""></option>';
        CLUBS.forEach(function (club) {
            var selected = currentVal === club.value ? ' selected' : '';
            html += '<option value="' + escapeHtml(club.value) + '"' + selected + '>' + escapeHtml(club.display) + '</option>';
        });
        html += '</select>';
        html += '</div>';
        return html;
    }

    // Each group is a separate belt ladder, not just a label. `key` is the stable
    // identifier stored on an exam in `beltSystems` — never store the array index,
    // which would break if these are ever reordered.
    var RANK_GROUPS = [
        {
            key: 'adults',
            label: 'בוגרים (גיל 16 ומעלה)',
            ranks: [
                'חגורה לבנה',
                'קיו 10 לבנה פס אחד',
                'קיו 9 לבנה שני פסים',
                'קיו 8 לבנה שלושה פסים',
                'קיו 7 צהובה',
                'קיו 6 צהובה פס',
                'קיו 5 ירוקה',
                'קיו 4 ירוקה פס',
                'קיו 3 חומה',
                'קיו 2 חומה פס',
                'קיו 1 חומה שני פסים',
                'חגורה שחורה דאן 1',
                'חגורה שחורה דאן 2',
                'חגורה שחורה דאן 3',
                'חגורה שחורה דאן 4'
            ]
        },
        {
            key: 'kids10plus',
            label: 'ילדים מגיל 10 (פסים כחולים)',
            ranks: _expand(['לבנה', 'כתומה', 'אדומה', 'סגולה', 'כחולה', 'אפורה'], _blueStripes)
        },
        {
            key: 'kidsUnder10',
            label: 'ילדים עד גיל 10 (פסים ירוקים)',
            ranks: _expand(['לבנה', 'לבנה-צהובה', 'צהובה-כתומה', 'כתומה-ירוקה'], _greenStripes)
        }
    ];

    function _rankOptionsHtml(groups, currentVal) {
        var esc = escapeHtml;
        var html = '<option value=""></option>';
        groups.forEach(function (group) {
            html += '<optgroup label="' + esc(group.label) + '">';
            group.ranks.forEach(function (rank) {
                html += '<option value="' + esc(rank) + '"' + (currentVal === rank ? ' selected' : '') + '>' + esc(rank) + '</option>';
            });
            html += '</optgroup>';
        });
        return html;
    }

    // An exam can name several belt systems, so this is always a list. Accepts
    // the current array form, the single-string form written by exams created
    // before multi-select, or nothing at all — an empty list means "no filter,
    // show every belt".
    function toBeltSystems(value) {
        if (Array.isArray(value)) {
            return value.filter(function (k) { return !!k; });
        }
        if (typeof value === 'string' && value) return [value];
        return [];
    }

    // Which groups to show for the given belt systems, always including the group
    // that contains currentVal.
    //
    // That last part is the important bit: a student on a ladder the exam did not
    // select (imported from another group, or training outside their age bracket)
    // must never have their existing belt disappear from the dropdown, because an
    // absent option silently deselects and the next save would wipe their rank.
    function _groupsForBeltSystems(beltSystems, currentVal) {
        var keys = toBeltSystems(beltSystems);
        if (!keys.length) return RANK_GROUPS;
        var picked = RANK_GROUPS.filter(function (g) { return keys.indexOf(g.key) !== -1; });
        if (!picked.length) return RANK_GROUPS;
        var covered = picked.some(function (g) { return g.ranks.indexOf(currentVal) !== -1; });
        if (currentVal && !covered) {
            var holder = RANK_GROUPS.filter(function (g) {
                return keys.indexOf(g.key) === -1 && g.ranks.indexOf(currentVal) !== -1;
            });
            if (holder.length) picked = picked.concat(holder);
        }
        return picked;
    }

    // All groups, with the exam's own ladders first. For dense contexts like the
    // in-table awarded-rank dropdown, where hiding groups behind a per-cell
    // checkbox would be clutter — nothing is removed, the relevant belts are
    // just at the top.
    function rankGroupsOrdered(beltSystems) {
        var keys = toBeltSystems(beltSystems);
        if (!keys.length) return RANK_GROUPS;
        var first = RANK_GROUPS.filter(function (g) { return keys.indexOf(g.key) !== -1; });
        if (!first.length) return RANK_GROUPS;
        return first.concat(RANK_GROUPS.filter(function (g) { return keys.indexOf(g.key) === -1; }));
    }

    // opts.beltSystems — RANK_GROUPS keys (array, or a legacy single string);
    // narrows the list to those ladders and renders a "show all belts" escape
    // hatch beside the select.
    function buildRankSelect(id, currentVal, labelText, opts) {
        opts = opts || {};
        var esc = escapeHtml;
        var keys = toBeltSystems(opts.beltSystems !== undefined ? opts.beltSystems : opts.beltSystem);
        var groups = _groupsForBeltSystems(keys, currentVal);
        var isFiltered = groups.length < RANK_GROUPS.length;

        var html = '<div class="form-group">';
        if (labelText) html += '<label for="' + id + '">' + labelText + '</label>';
        html += '<select id="' + id + '" data-belt-systems="' + esc(keys.join(',')) + '">';
        html += _rankOptionsHtml(groups, currentVal);
        html += '</select>';
        if (isFiltered) {
            html += '<label class="rank-showall-label">';
            html += '<input type="checkbox" class="rank-showall-cb" data-target="' + esc(id) + '"> ';
            html += App.I18n.t('showAllRanks');
            html += '</label>';
        }
        html += '</div>';
        return html;
    }

    // Wires every "show all belts" checkbox on the page. Rebuilds the select's
    // options in place and re-applies the previous selection, so toggling can
    // never lose the value the user had chosen.
    function bindRankShowAll(root) {
        var scope = root || document;
        scope.querySelectorAll('.rank-showall-cb').forEach(function (cb) {
            if (cb.dataset.bound) return;
            cb.dataset.bound = '1';
            cb.addEventListener('change', function () {
                var select = document.getElementById(cb.dataset.target);
                if (!select) return;
                var keep = select.value;
                var stored = (select.dataset.beltSystems || '').split(',').filter(Boolean);
                var groups = cb.checked ? RANK_GROUPS : _groupsForBeltSystems(stored, keep);
                select.innerHTML = _rankOptionsHtml(groups, keep);
                select.value = keep;
            });
        });
    }

    function getEmptyGrades() {
        var grades = {};
        CATEGORIES.forEach(function (cat) {
            grades[cat.key] = '';
        });
        return grades;
    }

    function getCategoriesOrdered(orderArray, customCategories) {
        var custom = customCategories || {};
        var catMap = {};
        CATEGORIES.forEach(function (c) { catMap[c.key] = c; });

        if (!orderArray || !orderArray.length) {
            // No explicit order — return all built-in with custom name overrides applied
            return CATEGORIES.map(function (c) {
                return custom[c.key] ? Object.assign({}, c, custom[c.key], { key: c.key }) : c;
            });
        }

        return orderArray.map(function (key) {
            var base = catMap[key] || null;
            var override = custom[key] || null;
            if (override) {
                return Object.assign({}, base || { key: key }, override, { key: key });
            }
            return base || null;
        }).filter(Boolean);
    }

    function isBlackBeltRank(rank) {
        return typeof rank === 'string' && rank.indexOf('דאן') !== -1;
    }

    // --- Shared location+date list widget ---
    // Used by both gasshukus and belt-trainings. Both share the same shape — [{ location, date }].

    function _renderLDRow(rowClass, removeBtnClass, idx, location, date, locationPlaceholder) {
        var t = App.I18n.t;
        var html = '<div class="' + rowClass + '" data-idx="' + idx + '">';
        html += '<input type="text" class="' + rowClass + '-location" placeholder="' + locationPlaceholder + '" value="' + escapeHtml(location || '') + '">';
        html += '<input type="date" class="' + rowClass + '-date" value="' + escapeHtml(date || '') + '">';
        html += '<button type="button" class="btn btn-sm btn-danger ' + removeBtnClass + '" title="' + t('removeGasshuku') + '">&#10005;</button>';
        html += '</div>';
        return html;
    }

    function renderLocationDateList(listEl, addBtnEl, initial, opts) {
        if (!listEl) return;
        opts = opts || {};
        var rowClass = opts.rowClass || 'gasshuku-row';
        var removeBtnClass = opts.removeBtnClass || 'gasshuku-remove-btn';
        var locationPlaceholder = opts.locationPlaceholder || App.I18n.t('gasshukuLocation');
        var gList = Array.isArray(initial) && initial.length ? initial : [{ location: '', date: '' }];
        var html = '';
        gList.forEach(function (g, idx) { html += _renderLDRow(rowClass, removeBtnClass, idx, g.location || '', g.date || '', locationPlaceholder); });
        listEl.innerHTML = html;

        function attachRemoveHandlers() {
            listEl.querySelectorAll('.' + removeBtnClass).forEach(function (btn) {
                if (btn.dataset.bound) return;
                btn.dataset.bound = '1';
                btn.addEventListener('click', function () {
                    var row = btn.closest('.' + rowClass);
                    if (row) row.remove();
                    if (listEl.querySelectorAll('.' + rowClass).length === 0) {
                        listEl.insertAdjacentHTML('beforeend', _renderLDRow(rowClass, removeBtnClass, 0, '', '', locationPlaceholder));
                        attachRemoveHandlers();
                    }
                });
            });
        }
        attachRemoveHandlers();

        if (addBtnEl && !addBtnEl.dataset.bound) {
            addBtnEl.dataset.bound = '1';
            addBtnEl.addEventListener('click', function () {
                var idx = listEl.querySelectorAll('.' + rowClass).length;
                listEl.insertAdjacentHTML('beforeend', _renderLDRow(rowClass, removeBtnClass, idx, '', '', locationPlaceholder));
                attachRemoveHandlers();
            });
        }
    }

    function readLocationDateList(listEl, opts) {
        opts = opts || {};
        var rowClass = opts.rowClass || 'gasshuku-row';
        var rows = listEl ? listEl.querySelectorAll('.' + rowClass) : [];
        var result = [];
        rows.forEach(function (row) {
            var loc = row.querySelector('.' + rowClass + '-location').value.trim();
            var dt = row.querySelector('.' + rowClass + '-date').value;
            if (loc || dt) result.push({ location: loc, date: dt });
        });
        return result;
    }

    function renderGasshukuList(listEl, addBtnEl, initial) {
        renderLocationDateList(listEl, addBtnEl, initial);
    }
    function readGasshukuList(listEl) {
        return readLocationDateList(listEl);
    }
    function renderBeltTrainingsList(listEl, addBtnEl, initial) {
        renderLocationDateList(listEl, addBtnEl, initial, {
            rowClass: 'belt-row',
            removeBtnClass: 'belt-remove-btn'
        });
    }
    function readBeltTrainingsList(listEl) {
        return readLocationDateList(listEl, { rowClass: 'belt-row' });
    }

    // --- Student directory key normalization ---
    // Used to build the exact-match document IDs for the public studentDirectory
    // collection, so a returning student can identify themselves on the invite
    // page without us ever exposing a listable/queryable collection.
    //
    // looseName collapses the spelling variants that actually cause misses in
    // Hebrew: niqqud, geresh/gershayim, spaces & hyphens, final letter forms,
    // and doubled ו/י (כהן/כוהן, רועי/רועי, בן-אור/בן אור).
    function looseName(s) {
        return (s || '').trim().toLowerCase()
            .replace(/[֑-ׇ]/g, '')
            .replace(/['"׳״`‘’]/g, '')
            // "/" also goes: these strings become Firestore document IDs, where a
            // slash would be read as a path separator.
            .replace(/[\s\-_\/]/g, '')
            .replace(/ם/g, 'מ')   // ם -> מ
            .replace(/ן/g, 'נ')   // ן -> נ
            .replace(/ץ/g, 'צ')   // ץ -> צ
            .replace(/ף/g, 'פ')   // ף -> פ
            .replace(/ך/g, 'כ')   // ך -> כ
            .replace(/ו{2,}/g, 'ו')
            .replace(/י{2,}/g, 'י');
    }

    // The consonant skeleton: looseName with vav/yod matres lectionis removed.
    // This is what catches the single most common Hebrew variant — an optional
    // vav or yod, as in כהן/כוהן or דוד/דויד — which looseName alone cannot,
    // since only doubled letters collapse there.
    //
    // It is deliberately NOT used as the primary key, because it also collapses
    // genuinely different names (שרה/שירה). It is only ever a fallback alias,
    // tried after the exact key misses, so precision always wins when both exist.
    function skeletonName(s) {
        return looseName(s).replace(/[וי]/g, '');
    }

    function _isoDate(y, mo, d) {
        if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return '';
        // Reject impossible dates like 31/02 instead of letting them roll over.
        var dt = new Date(Date.UTC(y, mo - 1, d));
        if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return '';
        return y + '-' + (mo < 10 ? '0' : '') + mo + '-' + (d < 10 ? '0' : '') + d;
    }

    // Any date this app might hold, as YYYY-MM-DD — the format <input type="date">
    // reads and writes. Returns '' for anything it cannot interpret with confidence.
    //
    // Needed because spreadsheet imports stored dates verbatim. SheetJS hands Excel
    // date cells back as serial numbers, so a birthdate came through as "40640"
    // rather than 2011-04-07: blank in every date field, and impossible to match
    // against the date a returning student types. Text dates arrive day-first
    // (07/04/2011, 7.4.2011) as is usual here.
    function normalizeDate(value) {
        if (value == null) return '';
        var s = String(value).trim();
        if (!s) return '';

        var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (m) return _isoDate(+m[1], +m[2], +m[3]);

        // Excel serial: days since 1899-12-30. Bounded to 1902–2118 so a stray
        // small number is never mistaken for a date.
        if (/^\d+(\.\d+)?$/.test(s)) {
            var n = Math.floor(parseFloat(s));
            if (n < 1000 || n > 80000) return '';
            var dt = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
            return _isoDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
        }

        m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
        if (m) {
            var a = +m[1], b = +m[2], y = +m[3];
            if (y < 100) y += (y > 30 ? 1900 : 2000);
            // Day first, unless the second number can only be a day (e.g. 4/23/2011).
            if (b > 12 && a <= 12) return _isoDate(y, a, b);
            return _isoDate(y, b, a);
        }
        return '';
    }

    // Date of birth as a key fragment: normalized first, then reduced to digits, so
    // the same birthday always yields the same key however it was entered or imported.
    function dobDigits(dob) {
        var iso = normalizeDate(dob);
        return iso ? iso.replace(/\D/g, '') : '';
    }

    // Clubs come from a fixed dropdown, but normalize anyway so a stored value
    // with different spacing still keys consistently.
    function looseClub(club) {
        return looseName(club);
    }

    // Identity key for one person, used to spot a student who is already in an
    // exam before importing them again. Names are folded, so 'בן-אור' and
    // 'בן אור' match; the birthdate goes through normalizeDate, so '2011-04-07',
    // '07/04/2011' and an Excel serial for that day all key the same.
    //
    // Deliberately stronger than findExamineeHistory's own keyFor, which compares
    // raw birthdate strings — that one is left alone, since changing how an
    // existing feature matches people is a separate decision.
    //
    // Two students sharing a name with no recorded birthdate collide here. That is
    // why a match only unticks and labels a row rather than hiding it: the trainer
    // can see the call and override it.
    function examineeMatchKey(d) {
        d = d || {};
        return looseName(d.firstName) + '|' + looseName(d.lastName) + '|' + dobDigits(d.dateOfBirth);
    }

    // --- Pre-exam training sessions (אימון הכנה) ---
    //
    // A prep session is graded like an exam, but it is not one: nobody is
    // promoted by it, it is never anyone's "last exam", and its final category
    // records a recommendation to sit the rank exam rather than a pass/fail.
    // The stored values stay 'pass' | 'fail' | 'conditional:<text>' so every
    // existing grading path works unchanged; only their meaning and labels differ.

    function isPrepExam(exam) {
        return !!exam && exam.examType === 'prep';
    }

    // Overall recommendation from every trainer's rank_approval value:
    // 'recommended' | 'conditional' | 'notyet' | 'mixed' (trainers disagree) | 'none'.
    function prepVerdict(trainerGrades) {
        var yes = false, cond = false, no = false;
        (trainerGrades || []).forEach(function (g) {
            var v = (g && g.rank_approval) || '';
            if (v === 'pass') yes = true;
            else if (v.indexOf('conditional:') === 0) cond = true;
            else if (v === 'fail') no = true;
        });
        if (no && (yes || cond)) return 'mixed';
        if (no) return 'notyet';
        if (cond) return 'conditional';
        if (yes) return 'recommended';
        return 'none';
    }

    // One person, as a document-ID-safe string: folded first name, folded last
    // name, birthdate digits. '' unless all three are present, since a partial key
    // could collide between different people. Used for the per-exam registration
    // marker that stops the same person registering twice.
    function personKey(firstName, lastName, dob) {
        var f = looseName(firstName);
        var l = looseName(lastName);
        var d = dobDigits(dob);
        return (f && l && d) ? f + '_' + l + '_' + d : '';
    }

    // Groups of examinees that look like the same person, for the trainer to
    // review. Deliberately broader than the registration marker, because a human
    // confirms each one:
    //   - same folded names, birthdates equal or at least one missing — this is
    //     what catches a trainer-added student who also registered themselves
    //   - same consonant skeleton (כהן / כוהן) with the same birthdate
    //   - first and last name swapped, with the same birthdate
    // Two records with different birthdates are never flagged.
    // notDuplicates: pair keys ("idA|idB", sorted) the trainer already dismissed.
    function findDuplicateGroups(examinees, notDuplicates) {
        var dismissed = {};
        (notDuplicates || []).forEach(function (k) { dismissed[k] = true; });
        var list = (examinees || []).filter(function (e) { return e && e.id; });

        // Each group carries the one birthdate its members have (or none yet).
        // Two groups with different birthdates are never joined: otherwise a
        // record with no birthdate would chain "Yossi Cohen 2010" and "Yossi
        // Cohen 2012" — two different children — into one group to merge.
        var parent = {};
        var groupDob = {};
        function find(x) { while (parent[x] !== x) x = parent[x] = parent[parent[x]]; return x; }
        function union(a, b) {
            var ra = find(a), rb = find(b);
            if (ra === rb) return true;
            var da = groupDob[ra], db = groupDob[rb];
            if (da && db && da !== db) return false;
            parent[ra] = rb;
            groupDob[rb] = db || da;
            return true;
        }
        list.forEach(function (e) { parent[e.id] = e.id; });

        var info = list.map(function (e) {
            return {
                id: e.id,
                f: looseName(e.firstName), l: looseName(e.lastName),
                sf: skeletonName(e.firstName), sl: skeletonName(e.lastName),
                d: dobDigits(e.dateOfBirth)
            };
        });

        info.forEach(function (x) { groupDob[x.id] = x.d; });

        // Matches with equal birthdates are joined first, so a record with none
        // attaches to an established group rather than deciding which one forms.
        var strong = [], weak = [];
        for (var i = 0; i < info.length; i++) {
            for (var j = i + 1; j < info.length; j++) {
                var a = info[i], b = info[j];
                if (!a.f || !a.l || !b.f || !b.l) continue;
                var pair = [a.id, b.id].sort().join('|');
                if (dismissed[pair]) continue;
                var dobEqual = a.d && a.d === b.d;
                var dobCompatible = !a.d || !b.d || a.d === b.d;
                if ((a.f === b.f && a.l === b.l && dobEqual) ||
                    (a.sf === b.sf && a.sl === b.sl && dobEqual) ||
                    (a.f === b.l && a.l === b.f && dobEqual)) {
                    strong.push([a.id, b.id]);
                } else if (a.f === b.f && a.l === b.l && dobCompatible) {
                    weak.push([a.id, b.id]);
                }
            }
        }
        var hit = false;
        strong.concat(weak).forEach(function (p) {
            if (union(p[0], p[1])) hit = true;
        });
        if (!hit) return [];

        var groups = {};
        list.forEach(function (e) {
            var root = find(e.id);
            (groups[root] = groups[root] || []).push(e.id);
        });
        return Object.keys(groups)
            .map(function (k) { return groups[k]; })
            .filter(function (ids) { return ids.length > 1; });
    }

    // Identity of a dojo+class group, used to find "the previous exam of this
    // group". The class name is free text, so it is normalized — otherwise
    // 'בוגרים' and 'בוגרים ' would look like two different classes.
    // Returns '' when either half is missing: an untagged exam belongs to no group.
    function examGroupKey(dojo, classGroup) {
        var d = looseName(dojo || '');
        var c = looseName(classGroup || '');
        return (d && c) ? d + '|' + c : '';
    }

    // Returns a CSS class name representing the belt color of the given rank.
    // Used to color-code examinee row headers in the exam table.
    // Order matters: check more-specific keywords first. For gradient ranks like
    // 'לבנה-צהובה' we want to show the "transitioning to" color (later in the gradient).
    function getRankColorClass(rank) {
        if (!rank) return 'rank-color-white';
        if (rank.indexOf('דאן') !== -1) return 'rank-color-black';
        if (rank.indexOf('חומה') !== -1) return 'rank-color-brown';
        if (rank.indexOf('ירוקה') !== -1) return 'rank-color-green';
        if (rank.indexOf('כתומה') !== -1) return 'rank-color-orange';
        if (rank.indexOf('צהובה') !== -1) return 'rank-color-yellow';
        if (rank.indexOf('אפורה') !== -1) return 'rank-color-gray';
        if (rank.indexOf('כחולה') !== -1) return 'rank-color-blue';
        if (rank.indexOf('סגולה') !== -1) return 'rank-color-purple';
        if (rank.indexOf('אדומה') !== -1) return 'rank-color-red';
        return 'rank-color-white';
    }

    return {
        generateId: generateId,
        calculateAge: calculateAge,
        formatDate: formatDate,
        debounce: debounce,
        escapeHtml: escapeHtml,
        CATEGORIES: CATEGORIES,
        DEFAULT_CATEGORY_ORDER: DEFAULT_CATEGORY_ORDER,
        getCategoriesOrdered: getCategoriesOrdered,
        getEmptyGrades: getEmptyGrades,
        RANK_GROUPS: RANK_GROUPS,
        buildRankSelect: buildRankSelect,
        bindRankShowAll: bindRankShowAll,
        rankGroupsOrdered: rankGroupsOrdered,
        toBeltSystems: toBeltSystems,
        CLUBS: CLUBS,
        buildClubSelect: buildClubSelect,
        examGroupKey: examGroupKey,
        examineeMatchKey: examineeMatchKey,
        personKey: personKey,
        isPrepExam: isPrepExam,
        prepVerdict: prepVerdict,
        findDuplicateGroups: findDuplicateGroups,
        renderGasshukuList: renderGasshukuList,
        readGasshukuList: readGasshukuList,
        renderLocationDateList: renderLocationDateList,
        readLocationDateList: readLocationDateList,
        renderBeltTrainingsList: renderBeltTrainingsList,
        readBeltTrainingsList: readBeltTrainingsList,
        isBlackBeltRank: isBlackBeltRank,
        getRankColorClass: getRankColorClass,
        looseName: looseName,
        skeletonName: skeletonName,
        normalizeDate: normalizeDate,
        dobDigits: dobDigits,
        looseClub: looseClub
    };
})();
