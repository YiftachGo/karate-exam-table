var App = window.App || {};

App.AuthPage = (function () {
    function render() {
        var t = App.I18n.t;
        var container = document.getElementById('app');

        var html = '<div class="auth-page">';
        html += '<div class="auth-card">';
        html += '<div class="auth-logo">&#129354;</div>';
        html += '<h2>' + t('appTitle') + '</h2>';
        html += '<p class="auth-subtitle">' + t('loginSubtitle') + '</p>';

        // Google button
        html += '<button class="btn btn-google" id="btn-google-login">';
        html += '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>';
        html += t('signInWithGoogle');
        html += '</button>';

        html += '<div class="auth-divider"><span>' + t('or') + '</span></div>';

        // Email form
        html += '<div class="auth-form" id="auth-form">';
        html += '<div class="form-group">';
        html += '<label>' + t('email') + '</label>';
        html += '<input type="email" id="auth-email" placeholder="email@example.com">';
        html += '</div>';
        html += '<div class="form-group">';
        html += '<label>' + t('password') + '</label>';
        html += '<input type="password" id="auth-password" placeholder="••••••••">';
        html += '</div>';
        html += '<div class="form-group" id="name-field" style="display:none">';
        html += '<label>' + t('displayName') + '</label>';
        html += '<input type="text" id="auth-name" placeholder="' + t('displayName') + '">';
        html += '</div>';

        html += '<div id="auth-error" class="auth-error" style="display:none"></div>';

        html += '<button class="btn btn-primary btn-block" id="btn-email-login">' + t('login') + '</button>';
        html += '<button class="btn btn-outline btn-block" id="btn-toggle-signup">' + t('noAccount') + '</button>';
        html += '</div>';

        html += '</div>';
        html += '</div>';

        container.innerHTML = html;
        bindEvents();
    }

    function bindEvents() {
        var t = App.I18n.t;
        var isSignUp = false;

        document.getElementById('btn-google-login').addEventListener('click', function () {
            clearError();
            App.Auth.signInWithGoogle()
                .then(function () {
                    window.location.hash = '#/';
                })
                .catch(function (err) {
                    showError(err.message);
                });
        });

        document.getElementById('btn-email-login').addEventListener('click', function () {
            handleEmailAuth(isSignUp);
        });

        document.getElementById('auth-password').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') handleEmailAuth(isSignUp);
        });

        document.getElementById('btn-toggle-signup').addEventListener('click', function () {
            isSignUp = !isSignUp;
            var nameField = document.getElementById('name-field');
            var loginBtn = document.getElementById('btn-email-login');
            var toggleBtn = document.getElementById('btn-toggle-signup');

            if (isSignUp) {
                nameField.style.display = '';
                loginBtn.textContent = t('signup');
                toggleBtn.textContent = t('hasAccount');
            } else {
                nameField.style.display = 'none';
                loginBtn.textContent = t('login');
                toggleBtn.textContent = t('noAccount');
            }
            clearError();
        });
    }

    function handleEmailAuth(isSignUp) {
        clearError();
        var email = document.getElementById('auth-email').value.trim();
        var password = document.getElementById('auth-password').value;

        if (!email || !password) {
            showError(App.I18n.t('fillAllFields'));
            return;
        }

        if (password.length < 6) {
            showError(App.I18n.t('passwordTooShort'));
            return;
        }

        var promise;
        if (isSignUp) {
            var name = document.getElementById('auth-name').value.trim() || email.split('@')[0];
            promise = App.Auth.signUpWithEmail(email, password, name);
        } else {
            promise = App.Auth.signInWithEmail(email, password);
        }

        promise.then(function () {
            window.location.hash = '#/';
        }).catch(function (err) {
            var msg = err.message;
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                msg = App.I18n.t('invalidCredentials');
            } else if (err.code === 'auth/email-already-in-use') {
                msg = App.I18n.t('emailInUse');
            }
            showError(msg);
        });
    }

    function showError(msg) {
        var el = document.getElementById('auth-error');
        if (el) {
            el.textContent = msg;
            el.style.display = '';
        }
    }

    function clearError() {
        var el = document.getElementById('auth-error');
        if (el) el.style.display = 'none';
    }

    return { render: render };
})();
