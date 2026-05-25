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

    function getAll() { return _prefs || {}; }

    function clear() { _prefs = null; }

    return {
        load: load,
        getQuickTags: getQuickTags,
        setQuickTags: setQuickTags,
        getAll: getAll,
        clear: clear
    };
})();
