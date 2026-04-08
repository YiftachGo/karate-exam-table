var App = window.App || {};

App.init = function () {
    var settings = App.Storage.getSettings();
    App.I18n.setLang(settings.language || 'he');
    App.updateHeader();

    document.getElementById('lang-toggle').addEventListener('click', function () {
        var newLang = App.I18n.getLang() === 'he' ? 'en' : 'he';
        App.I18n.setLang(newLang);
        App.Storage.saveSettings({ language: newLang });
        App.updateHeader();
        App.Router.resolve();
    });

    App.Router.addRoute(/^#\/$/, function () {
        App.ExamList.render();
    });

    App.Router.addRoute(/^#\/exam\/([^\/]+)$/, function (match) {
        App.ExamTable.render(match[1]);
    });

    App.Router.addRoute(/^#\/exam\/([^\/]+)\/examinee\/([^\/]+)$/, function (match) {
        App.ExamineeDetail.render(match[1], match[2]);
    });

    App.Router.init();
};

App.updateHeader = function () {
    document.getElementById('app-title').textContent = App.I18n.t('appTitle');
    var langBtn = document.getElementById('lang-toggle');
    langBtn.textContent = App.I18n.getLang() === 'he' ? 'EN' : 'עב';
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

document.addEventListener('DOMContentLoaded', App.init);
