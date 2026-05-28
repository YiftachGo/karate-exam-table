var App = window.App || {};

// Autocomplete suggestions sourced from the current trainer's own past grade notes,
// keyed by category. Built lazily on first use and cached for the session.
// Used by exam-table.js to drive Gmail-style ghost-text completion on grade textareas.

App.Autocomplete = (function () {
    var _phraseIndex = {}; // { catKey: { phrase: count } }
    var _built = false;
    var _building = null; // in-flight Promise so concurrent calls share work

    // Fields on a grade doc that are NOT free-text notes (mark, drawing, metadata).
    // Anything not matching these patterns and being a string is treated as notes.
    function _isNoteField(key, value) {
        if (typeof value !== 'string' || !value.trim()) return false;
        if (key === 'trainerId' || key === 'trainerName') return false;
        if (key === 'updatedAt') return false;
        if (key.endsWith('_mark')) return false;
        if (key.endsWith('_drawing')) return false;
        if (key.endsWith('_mode')) return false;
        if (key.endsWith('_newRank')) return false;
        // For pass/fail value (e.g. catKey 'rank_approval' = 'pass'|'fail'|'conditional:...'),
        // the value 'pass' / 'fail' itself isn't useful; conditional:<text> we strip.
        return true;
    }

    function _phrasesFromText(text) {
        // Split on common separators; keep phrases of meaningful length.
        return text.split(/[,\n.;]+/)
            .map(function (p) { return p.trim(); })
            .filter(function (p) { return p.length >= 3 && p.length <= 80; });
    }

    async function buildIndex() {
        if (_built) return;
        if (_building) return _building;
        _building = (async function () {
            try {
                var uid = App.Auth.getUserId();
                if (!uid) { _built = true; return; }
                var exams = await App.Storage.getExamIndex();
                for (var i = 0; i < exams.length; i++) {
                    var gradesSnap;
                    try {
                        gradesSnap = await App.db.collection('exams').doc(exams[i].id)
                            .collection('grades').where('trainerId', '==', uid).get();
                    } catch (e) {
                        continue; // skip exams we can't read
                    }
                    gradesSnap.docs.forEach(function (d) {
                        var data = d.data();
                        Object.keys(data).forEach(function (key) {
                            if (!_isNoteField(key, data[key])) return;
                            var text = data[key];
                            // Strip the conditional: prefix on pass/fail value
                            if (text.indexOf('conditional:') === 0) text = text.slice(12);
                            if (!text.trim()) return;
                            // The catKey is the field name itself for normal categories;
                            // for catKey containing colon, this is conditional value — index under that key.
                            var phrases = _phrasesFromText(text);
                            if (!_phraseIndex[key]) _phraseIndex[key] = {};
                            phrases.forEach(function (p) {
                                _phraseIndex[key][p] = (_phraseIndex[key][p] || 0) + 1;
                            });
                        });
                    });
                }
            } catch (err) {
                console.warn('Autocomplete.buildIndex failed:', err);
            } finally {
                _built = true;
                _building = null;
            }
        })();
        return _building;
    }

    // Returns { fragment, completion, fullPhrase } or null.
    // fullText: the entire textarea value. We work on the fragment after the last separator.
    function suggest(catKey, fullText) {
        var index = _phraseIndex[catKey] || {};
        if (!fullText) return null;
        var lastSep = Math.max(
            fullText.lastIndexOf(','),
            fullText.lastIndexOf('\n'),
            fullText.lastIndexOf('.'),
            fullText.lastIndexOf(';')
        );
        var fragment = fullText.slice(lastSep + 1).replace(/^\s+/, '');
        if (fragment.length < 2) return null;
        var fragLower = fragment.toLowerCase();
        var best = null, bestCount = -1;
        Object.keys(index).forEach(function (phrase) {
            if (phrase.length <= fragment.length) return;
            if (phrase.toLowerCase().indexOf(fragLower) !== 0) return;
            var count = index[phrase];
            if (count > bestCount) { best = phrase; bestCount = count; }
        });
        if (!best) return null;
        return {
            fragment: fragment,
            completion: best.slice(fragment.length),
            fullPhrase: best
        };
    }

    // Allow adding a phrase to the index without rebuilding (called from autosave so
    // newly written notes become candidates immediately).
    function noteWritten(catKey, text) {
        if (!_isNoteField(catKey, text)) return;
        if (text && text.indexOf('conditional:') === 0) text = text.slice(12);
        var phrases = _phrasesFromText(text);
        if (!_phraseIndex[catKey]) _phraseIndex[catKey] = {};
        phrases.forEach(function (p) {
            _phraseIndex[catKey][p] = (_phraseIndex[catKey][p] || 0) + 1;
        });
    }

    function isBuilt() { return _built; }
    function clear() { _phraseIndex = {}; _built = false; _building = null; }

    return {
        buildIndex: buildIndex,
        suggest: suggest,
        noteWritten: noteWritten,
        isBuilt: isBuilt,
        clear: clear
    };
})();
