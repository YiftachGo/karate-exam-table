var App = window.App || {};

App.Router = (function () {
    var routes = [];
    var currentView = null;

    function addRoute(pattern, handler) {
        routes.push({ pattern: pattern, handler: handler });
    }

    function navigate(hash) {
        window.location.hash = hash;
    }

    function resolve() {
        var hash = window.location.hash || '#/';
        if (hash === '#' || hash === '') hash = '#/';

        for (var i = 0; i < routes.length; i++) {
            var match = hash.match(routes[i].pattern);
            if (match) {
                currentView = routes[i].handler;
                routes[i].handler(match);
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
