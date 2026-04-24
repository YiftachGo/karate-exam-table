var App = window.App || {};

// Session-scoped undo manager.
// Usage: App.Undo.push('examineeDeleted', undoFn)
// Shows a toast for UNDO_TTL ms with an Undo button.
// Only one pending undo at a time — a new push cancels the previous.

App.Undo = (function () {
    var UNDO_TTL = 8000; // ms the toast stays visible

    var _timer = null;
    var _currentToast = null;

    function push(labelKey, undoFn) {
        var t = App.I18n.t;

        // Cancel any previous undo
        _cancel();

        var toast = document.createElement('div');
        toast.className = 'toast toast-undo';

        var msgSpan = document.createElement('span');
        msgSpan.textContent = t(labelKey);

        var undoBtn = document.createElement('button');
        undoBtn.className = 'btn-undo-inline';
        undoBtn.textContent = t('undo');

        toast.appendChild(msgSpan);
        toast.appendChild(undoBtn);
        document.body.appendChild(toast);
        _currentToast = toast;

        // Animate in
        requestAnimationFrame(function () {
            requestAnimationFrame(function () { toast.classList.add('show'); });
        });

        undoBtn.addEventListener('click', function () {
            _cancel();
            try { undoFn(); } catch (e) { console.error('Undo failed:', e); }
        });

        _timer = setTimeout(function () {
            _dismiss(toast);
        }, UNDO_TTL);
    }

    function _dismiss(toast) {
        if (!toast) return;
        toast.classList.remove('show');
        setTimeout(function () {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
            if (_currentToast === toast) _currentToast = null;
        }, 300);
    }

    function _cancel() {
        if (_timer) { clearTimeout(_timer); _timer = null; }
        if (_currentToast) { _dismiss(_currentToast); }
    }

    return { push: push };
})();
