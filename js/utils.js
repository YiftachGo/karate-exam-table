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

    var RANK_GROUPS = [
        {
            label: 'בוגרים (גיל 16 ומעלה)',
            ranks: [
                'קיו 10 לבנה',
                'קיו 9 לבנה עם פס אדום',
                'קיו 8 לבנה שני פסים',
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
            label: 'ילדים מגיל 10 (פסים כחולים)',
            ranks: _expand(['לבנה', 'כתומה', 'אדומה', 'סגולה', 'כחולה', 'אפורה'], _blueStripes)
        },
        {
            label: 'ילדים עד גיל 10 (פסים ירוקים)',
            ranks: _expand(['לבנה', 'לבנה-צהובה', 'צהובה-כתומה', 'כתומה-ירוקה'], _greenStripes)
        }
    ];

    function buildRankSelect(id, currentVal, labelText) {
        var esc = escapeHtml;
        var html = '<div class="form-group">';
        if (labelText) html += '<label for="' + id + '">' + labelText + '</label>';
        html += '<select id="' + id + '">';
        html += '<option value=""></option>';
        RANK_GROUPS.forEach(function (group) {
            html += '<optgroup label="' + esc(group.label) + '">';
            group.ranks.forEach(function (rank) {
                html += '<option value="' + esc(rank) + '"' + (currentVal === rank ? ' selected' : '') + '>' + esc(rank) + '</option>';
            });
            html += '</optgroup>';
        });
        html += '</select>';
        html += '</div>';
        return html;
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
        renderGasshukuList: renderGasshukuList,
        readGasshukuList: readGasshukuList,
        renderLocationDateList: renderLocationDateList,
        readLocationDateList: readLocationDateList,
        renderBeltTrainingsList: renderBeltTrainingsList,
        readBeltTrainingsList: readBeltTrainingsList,
        isBlackBeltRank: isBlackBeltRank
    };
})();
