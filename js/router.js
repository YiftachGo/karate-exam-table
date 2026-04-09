var App = window.App || {};

App.Router = (function () {
    var routes = [];
    var currentCleanup = null;

    function addRoute(pattern, handler) {
        routes.push({ pattern: pattern, handler: handler });
    }

    function navigate(hash) {
        window.location.hash = hash;
    }

    function resolve() {
        // Cleanup previous view listeners if any
        if (currentCleanup && typeof currentCleanup === 'function') {
            currentCleanup();
            currentCleanup = null;
        }

        var hash = window.location.hash || '#/';
        if (hash === '#' || hash === '') hash = '#/';

        for (var i = 0; i < routes.length; i++) {
            var match = hash.match(routes[i].pattern);
            if (match) {
                var result = routes[i].handler(match);
                // If handler returns a cleanup function, store it
                if (result && typeof result.then === 'function') {
                    result.then(function (cleanup) {
                        if (typeof cleanup === 'function') currentCleanup = cleanup;
                    });
                } else if (typeof result === 'function') {
                    currentCleanup = result;
                }
                return;
            }
        }
        navigate('#/');
    }

    function init() {
        window.addEventListener('hashchange', resolve);
        resolve();
    }

    return {
        addRoute: addRoute,
        navigate: navigate,
        resolve: resolve,
        init: init
    };
})();
