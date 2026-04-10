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

    function getEmptyGrades() {
        var grades = {};
        CATEGORIES.forEach(function (cat) {
            grades[cat.key] = '';
        });
        return grades;
    }

    function getCategoriesOrdered(orderArray) {
        if (!orderArray || !orderArray.length) return CATEGORIES;
        var catMap = {};
        CATEGORIES.forEach(function (c) { catMap[c.key] = c; });
        var ordered = [];
        orderArray.forEach(function (key) {
            if (catMap[key]) ordered.push(catMap[key]);
        });
        // Add any missing categories at the end
        CATEGORIES.forEach(function (c) {
            if (orderArray.indexOf(c.key) === -1) ordered.push(c);
        });
        return ordered;
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
        getEmptyGrades: getEmptyGrades
    };
})();
