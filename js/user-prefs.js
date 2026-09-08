var App = window.App || {};

// Per-user preferences cache, loaded from /users/{uid}.preferences after auth.
// Reads are synchronous so they're cheap to use during render. Writes go through
// App.Storage.updateUserPreferences and refresh the cache locally.

App.UserPrefs = (function () {
    var _prefs = null;

    async function load() {
        try {
            _prefs = await App.Storage.getUserPreferences();
        } catch (e) {
            console.error('UserPrefs.load failed:', e);
            _prefs = {};
        }
    }

    function getQuickTags(catKey) {
        if (!_prefs || !_prefs.quickTags) return [];
        return _prefs.quickTags[catKey] || [];
    }

    async function setQuickTags(catKey, tags) {
        var patch = {};
        patch['quickTags.' + catKey] = tags;
        await App.Storage.updateUserPreferences(patch);
        if (!_prefs) _prefs = {};
        if (!_prefs.quickTags) _prefs.quickTags = {};
        _prefs.quickTags[catKey] = tags;
    }

    // --- Exam list folders ---
    //
    // Free-text folders the trainer files exams into by hand. Private to this
    // trainer: they live in their own preferences rather than on the exam doc, so
    // reorganizing never changes what a co-trainer sees and works on exams this
    // trainer doesn't own (filing needs no write access to the exam).
    //
    //   examFolders      [{ id, name, order }]
    //   examFolderAssign { [examId]: folderId }   — a map, so an exam can only
    //                                               ever be in one folder
    //
    // Writes are cache-first: the caller updates state and re-renders straight
    // away, and persistence happens in the background. Dragging a card has to
    // feel instant, and a failed write should leave the screen as the trainer
    // left it rather than snapping back.

    function getFolders() {
        if (!_prefs || !Array.isArray(_prefs.examFolders)) return [];
        return _prefs.examFolders.slice().sort(function (a, b) {
            return (a.order || 0) - (b.order || 0);
        });
    }

    function getFolderAssignments() {
        return (_prefs && _prefs.examFolderAssign) || {};
    }

    function getExamFolderId(examId) {
        return getFolderAssignments()[examId] || '';
    }

    function _cache() {
        if (!_prefs) _prefs = {};
        return _prefs;
    }

    // Persist in the background; the cache is already current when this is called.
    function _pushFolders() {
        var p = _cache();
        App.Storage.updateUserPreferences({
            examFolders: p.examFolders || [],
            examFolderAssign: p.examFolderAssign || {}
        }).catch(function (e) {
            console.error('folder save failed:', e);
        });
    }

    function saveFolders(folders, assignments) {
        var p = _cache();
        p.examFolders = folders;
        if (assignments) p.examFolderAssign = assignments;
        _pushFolders();
    }

    function addFolder(name) {
        var p = _cache();
        if (!Array.isArray(p.examFolders)) p.examFolders = [];
        var maxOrder = -1;
        p.examFolders.forEach(function (f) {
            if (typeof f.order === 'number' && f.order > maxOrder) maxOrder = f.order;
        });
        var folder = {
            id: App.Utils.generateId('fld'),
            name: (name || '').trim(),
            order: maxOrder + 1
        };
        p.examFolders.push(folder);
        _pushFolders();
        return folder;
    }

    // Swaps a folder with its neighbour. delta -1 moves it earlier, +1 later.
    // Returns true if anything moved, so the caller can skip a pointless repaint.
    //
    // Rewrites every order value as 0..n-1 afterwards rather than just swapping
    // the two numbers — that also heals folders whose orders had gone duplicate
    // or gappy, which a bare swap would leave broken forever.
    function moveFolder(folderId, delta) {
        var p = _cache();
        var sorted = getFolders();
        var from = -1;
        sorted.forEach(function (f, i) { if (f.id === folderId) from = i; });
        var to = from + delta;
        if (from === -1 || to < 0 || to >= sorted.length) return false;

        var moved = sorted.splice(from, 1)[0];
        sorted.splice(to, 0, moved);
        sorted.forEach(function (f, i) { f.order = i; });
        p.examFolders = sorted;
        _pushFolders();
        return true;
    }

    function renameFolder(folderId, name) {
        var p = _cache();
        (p.examFolders || []).forEach(function (f) {
            if (f.id === folderId) f.name = (name || '').trim();
        });
        _pushFolders();
    }

    // Drops the folder AND every assignment pointing at it, so its exams fall
    // back to Unfiled instead of vanishing from a list that only renders folders
    // it knows about.
    function removeFolder(folderId) {
        var p = _cache();
        p.examFolders = (p.examFolders || []).filter(function (f) { return f.id !== folderId; });
        var assign = p.examFolderAssign || {};
        Object.keys(assign).forEach(function (examId) {
            if (assign[examId] === folderId) delete assign[examId];
        });
        p.examFolderAssign = assign;
        _pushFolders();
    }

    // folderId '' removes the exam from whatever folder it was in.
    // knownExamIds (optional) prunes assignments for exams that no longer exist,
    // so a deleted exam can't leave the map growing forever.
    function setExamFolder(examId, folderId, knownExamIds) {
        var p = _cache();
        var assign = p.examFolderAssign || {};
        if (folderId) assign[examId] = folderId;
        else delete assign[examId];

        if (Array.isArray(knownExamIds) && knownExamIds.length) {
            var live = {};
            knownExamIds.forEach(function (id) { live[id] = true; });
            Object.keys(assign).forEach(function (id) {
                if (!live[id]) delete assign[id];
            });
        }
        p.examFolderAssign = assign;
        _pushFolders();
    }

    function getAll() { return _prefs || {}; }

    function clear() { _prefs = null; }

    return {
        load: load,
        getQuickTags: getQuickTags,
        setQuickTags: setQuickTags,
        getFolders: getFolders,
        getFolderAssignments: getFolderAssignments,
        getExamFolderId: getExamFolderId,
        saveFolders: saveFolders,
        addFolder: addFolder,
        moveFolder: moveFolder,
        renameFolder: renameFolder,
        removeFolder: removeFolder,
        setExamFolder: setExamFolder,
        getAll: getAll,
        clear: clear
    };
})();
