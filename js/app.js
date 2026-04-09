var App = window.App || {};

App.init = async function () {
    var settings = App.Storage.getSettings();
    App.I18n.setLang(settings.language || 'he');

    // Init auth and wait for first state
    App.Auth.init();
    await App.Auth.waitForAuth();

    App.updateHeader();

    document.getElementById('lang-toggle').addEventListener('click', function () {
        var newLang = App.I18n.getLang() === 'he' ? 'en' : 'he';
        App.I18n.setLang(newLang);
        App.Storage.saveSettings({ language: newLang });
        App.updateHeader();
        App.Router.resolve();
    });

    document.getElementById('btn-logout').addEventListener('click', function () {
        App.Auth.signOut();
    });

    // Routes
    App.Router.addRoute(/^#\/login$/, function () {
        if (App.Auth.isLoggedIn()) {
            App.Router.navigate('#/');
            return;
        }
        App.AuthPage.render();
    });

    App.Router.addRoute(/^#\/invite\/([^\/]+)$/, function (match) {
        // Invitation route - no auth required
        App.InvitePage.render(match[1]);
    });

    App.Router.addRoute(/^#\/$/, function () {
        if (!App.Auth.isLoggedIn()) {
            App.Router.navigate('#/login');
            return;
        }
        App.ExamList.render();
    });

    App.Router.addRoute(/^#\/exam\/([^\/]+)$/, function (match) {
        if (!App.Auth.isLoggedIn()) {
            App.Router.navigate('#/login');
            return;
        }
        return App.ExamTable.render(match[1]);
    });

    App.Router.addRoute(/^#\/exam\/([^\/]+)\/examinee\/([^\/]+)$/, function (match) {
        if (!App.Auth.isLoggedIn()) {
            App.Router.navigate('#/login');
            return;
        }
        App.ExamineeDetail.render(match[1], match[2]);
    });

    App.Router.init();
};

App.updateHeader = function () {
    var t = App.I18n.t;
    document.getElementById('app-title').textContent = t('appTitle');
    var langBtn = document.getElementById('lang-toggle');
    langBtn.textContent = App.I18n.getLang() === 'he' ? 'EN' : 'עב';

    App.updateHeaderAuth();
};

App.updateHeaderAuth = function () {
    var t = App.I18n.t;
    var userDisplay = document.getElementById('user-display');
    var logoutBtn = document.getElementById('btn-logout');

    if (App.Auth.isLoggedIn()) {
        userDisplay.textContent = App.Auth.getUserName();
        userDisplay.style.display = '';
        logoutBtn.textContent = t('logout');
        logoutBtn.style.display = '';
    } else {
        userDisplay.style.display = 'none';
        logoutBtn.style.display = 'none';
    }
};

App.showToast = function (message) {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function () { toast.classList.add('show'); }, 10);
    setTimeout(function () {
        toast.classList.remove('show');
        setTimeout(function () { toast.remove(); }, 300);
    }, 2000);
};

App.showLoading = function () {
    document.getElementById('app').innerHTML = '<div class="loading-screen"><div class="spinner"></div></div>';
};

document.addEventListener('DOMContentLoaded', App.init);
