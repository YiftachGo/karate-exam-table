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
    async function publish(examId, userId) {
        var draft = getDraft(examId, userId);
        var keys = Object.keys(draft);
        for (var i = 0; i < keys.length; i++) {
            var exId = keys[i];
            var catKeys = Object.keys(draft[exId]);
            for (var j = 0; j < catKeys.length; j++) {
                await App.Storage.updateGrade(examId, exId, catKeys[j], draft[exId][catKeys[j]]);
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
