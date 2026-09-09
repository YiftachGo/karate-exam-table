var App = window.App || {};

// Per-user preferences cache, loaded from /users/{uid}.preferences after auth.
// Reads are synchronous so they're cheap to use during render. Writes go through
// App.Storage.updateUserPreferences and refresh the cache locally.

App.UserPrefs = (function () {
    var _prefs = null;
    var _loading = null;
    var _unsub = null;
    var _changeHandlers = [];
    var _reportedLoadFailure = false;

    // Preferences arrive over a live subscription rather than a single read, so
    // folders made on one device show up on this trainer's others without a
    // refresh — that is the whole point of keeping them in Firestore instead of
    // localStorage.
    //
    // A failed or premature read must NOT be cached. Leaving _prefs null keeps
    // "we don't know yet" distinct from "there are none", so the next render
    // retries and, crucially, every folder mutation refuses instead of writing an
    // empty cache over the stored list.
    function load() {
        if (_loading) return _loading;

        var attempt = new Promise(function (resolve) {
            var settled = false;
            function settle(value) {
                if (settled) return;
                settled = true;
                resolve(value);
            }
            function fail() {
                _prefs = null;
                if (!_reportedLoadFailure) {
                    _reportedLoadFailure = true;
                    console.error('UserPrefs: preferences could not be loaded');
                }
                settle(null);
            }

            var unsub;
            try {
                unsub = App.Storage.subscribeToUserPreferences(function (prefs) {
                    var changed = _prefs && JSON.stringify(_prefs) !== JSON.stringify(prefs);
                    _prefs = prefs;
                    _reportedLoadFailure = false;
                    settle(_prefs);
                    // Only notify on a genuine remote change — our own writes echo
                    // back through this listener and must not trigger a re-render.
                    if (changed) {
                        _changeHandlers.forEach(function (h) {
                            try { h(_prefs); } catch (e) { console.error(e); }
                        });
                    }
                }, fail);
            } catch (e) {
                console.error('UserPrefs subscribe threw:', e);
            }

            // No subscription means nobody is signed in yet. Stay unloaded so the
            // next call retries rather than caching an empty result.
            if (!unsub) { fail(); return; }
            _unsub = unsub;
        });

        _loading = attempt;
        // Cleared only once settled, and only if this is still the current
        // attempt. Clearing from inside the executor does not work: the
        // assignment to _loading happens after the executor has already run, so
        // it would put the resolved promise straight back and a later retry would
        // return that stale result instead of re-subscribing.
        attempt.then(function () {
            if (_loading === attempt) _loading = null;
        });
        return attempt;
    }

    // Await before reading anything that must reflect what is stored. Resolves
    // instantly once loaded, so it is safe to await on every render.
    function ensureLoaded() {
        if (_prefs) return Promise.resolve(_prefs);
        return load();
    }

    function isLoaded() { return _prefs !== null; }

    // Lets a screen re-render when this trainer's preferences change on another
    // device.
    function onChange(handler) {
        _changeHandlers.push(handler);
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

    // Every folder mutation goes through this first.
    //
    // A folder write replaces the whole stored list, so mutating before a load
    // has told us what is already there would silently destroy the trainer's
    // folders. Returning null makes each mutator a no-op in that state. The check
    // has to happen here rather than at write time, because _cache() would by
    // then have turned _prefs from null into {} and hidden the problem — and
    // would also have made ensureLoaded() skip its read.
    function _mutable() {
        if (_prefs === null) {
            console.error('preferences not loaded — folder change ignored');
            // Told directly, because the refusal is a response to something the
            // trainer just did. Without this, naming a new folder and pressing
            // save would appear to do nothing at all.
            if (typeof App.showToast === 'function') {
                App.showToast(App.I18n.t('folderLoadFailed'));
            }
            return null;
        }
        return _prefs;
    }

    // Persist in the background; the cache is already current when this is called.
    function _pushFolders() {
        var p = _cache();
        App.Storage.updateUserPreferences({
            examFolders: p.examFolders || [],
            examFolderAssign: p.examFolderAssign || {}
        }).catch(function (e) {
            // Surfaced, not just logged: a folder that silently fails to save
            // looks exactly like a folder that saved and then vanished.
            console.error('folder save failed:', e);
            if (typeof App.showToast === 'function') {
                App.showToast(App.I18n.t('folderSaveFailed'));
            }
        });
    }

    function saveFolders(folders, assignments) {
        var p = _mutable();
        if (!p) return;
        p.examFolders = folders;
        if (assignments) p.examFolderAssign = assignments;
        _pushFolders();
    }

    function addFolder(name) {
        var p = _mutable();
        if (!p) return null;
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
        var p = _mutable();
        if (!p) return false;
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
        var p = _mutable();
        if (!p) return;
        (p.examFolders || []).forEach(function (f) {
            if (f.id === folderId) f.name = (name || '').trim();
        });
        _pushFolders();
    }

    // Drops the folder AND every assignment pointing at it, so its exams fall
    // back to Unfiled instead of vanishing from a list that only renders folders
    // it knows about.
    function removeFolder(folderId) {
        var p = _mutable();
        if (!p) return;
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
        var p = _mutable();
        if (!p) return;
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

    function clear() {
        if (_unsub) { try { _unsub(); } catch (e) {} _unsub = null; }
        _prefs = null;
        _loading = null;
        _reportedLoadFailure = false;
    }

    return {
        load: load,
        ensureLoaded: ensureLoaded,
        isLoaded: isLoaded,
        onChange: onChange,
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
