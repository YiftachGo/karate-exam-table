var App = window.App || {};

// Per-trainer private draft mode.
// When a trainer switches to "private/draft", their grade note writes go to
// localStorage instead of Firestore. Other trainers' grades are always read
// live from Firestore (via the real-time subscription).
// On "Publish", all local grades are batch-written to Firestore and the draft
// is cleared.

App.Draft = (function () {

    function _modeKey(examId) { return 'krt_draftmode_' + examId; }
    function _draftKey(examId, userId) { return 'krt_draft_' + examId + '_' + userId; }

    // --- Mode ---

    function isPrivate(examId) {
        return localStorage.getItem(_modeKey(examId)) === 'private';
    }

    function setMode(examId, mode) { // 'private' | 'published'
        localStorage.setItem(_modeKey(examId), mode);
    }

    // --- Draft data ---

    function getDraft(examId, userId) {
        try {
            return JSON.parse(localStorage.getItem(_draftKey(examId, userId)) || '{}');
        } catch (e) { return {}; }
    }

    // Write a single grade into the local draft.
    function setGrade(examId, userId, examineeId, catKey, value) {
        var draft = getDraft(examId, userId);
        if (!draft[examineeId]) draft[examineeId] = {};
        draft[examineeId][catKey] = value;
        localStorage.setItem(_draftKey(examId, userId), JSON.stringify(draft));
    }

    // How many individual grade entries are waiting to be published.
    function pendingCount(examId, userId) {
        var draft = getDraft(examId, userId);
        var n = 0;
        Object.values(draft).forEach(function (ex) { n += Object.keys(ex).length; });
        return n;
    }

    // Batch-push all local draft grades to Firestore.
    // onProgress (optional) is called with { done, total, currentKey } after each write.
    async function publish(examId, userId, onProgress) {
        var draft = getDraft(examId, userId);
        // Flatten to a list of writes so the caller sees accurate total count
        var writes = [];
        Object.keys(draft).forEach(function (exId) {
            Object.keys(draft[exId]).forEach(function (catKey) {
                writes.push({ exId: exId, catKey: catKey, value: draft[exId][catKey] });
            });
        });
        var total = writes.length;
        for (var i = 0; i < writes.length; i++) {
            var w = writes[i];
            await App.Storage.updateGrade(examId, w.exId, w.catKey, w.value);
            if (typeof onProgress === 'function') {
                try { onProgress({ done: i + 1, total: total, currentKey: w.catKey }); }
                catch (e) { /* ignore handler errors */ }
            }
        }
        localStorage.removeItem(_draftKey(examId, userId));
    }

    function clearDraft(examId, userId) {
        localStorage.removeItem(_draftKey(examId, userId));
    }

    return {
        isPrivate: isPrivate,
        setMode: setMode,
        getDraft: getDraft,
        setGrade: setGrade,
        pendingCount: pendingCount,
        publish: publish,
        clearDraft: clearDraft
    };
})();
