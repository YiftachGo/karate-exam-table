var App = window.App || {};

App.Auth = (function () {
    var currentUser = null;
    var authReadyResolve = null;
    var authReady = new Promise(function (resolve) {
        authReadyResolve = resolve;
    });

    function init() {
        App.auth.onAuthStateChanged(function (user) {
            currentUser = user;
            if (user) {
                // Ensure user doc exists in Firestore
                App.db.collection('users').doc(user.uid).set({
                    displayName: user.displayName || user.email.split('@')[0],
                    email: user.email,
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true }).catch(function (err) {
                    console.warn('Failed to update user doc:', err);
                });
            }
            authReadyResolve(user);
            if (typeof App.updateHeaderAuth === 'function') {
                App.updateHeaderAuth();
            }
        });
    }

    function waitForAuth() {
        return authReady;
    }

    function getUser() {
        return currentUser;
    }

    function getUserId() {
        return currentUser ? currentUser.uid : null;
    }

    function getUserName() {
        if (!currentUser) return '';
        return currentUser.displayName || currentUser.email.split('@')[0];
    }

    function isLoggedIn() {
        return currentUser !== null;
    }

    function signInWithGoogle() {
        var provider = new firebase.auth.GoogleAuthProvider();
        return App.auth.signInWithPopup(provider);
    }

    function signInWithEmail(email, password) {
        return App.auth.signInWithEmailAndPassword(email, password);
    }

    function signUpWithEmail(email, password, displayName) {
        return App.auth.createUserWithEmailAndPassword(email, password)
            .then(function (cred) {
                return cred.user.updateProfile({ displayName: displayName }).then(function () {
                    return cred;
                });
            });
    }

    function signOut() {
        return App.auth.signOut().then(function () {
            currentUser = null;
            window.location.hash = '#/login';
        });
    }

    return {
        init: init,
        waitForAuth: waitForAuth,
        getUser: getUser,
        getUserId: getUserId,
        getUserName: getUserName,
        isLoggedIn: isLoggedIn,
        signInWithGoogle: signInWithGoogle,
        signInWithEmail: signInWithEmail,
        signUpWithEmail: signUpWithEmail,
        signOut: signOut
    };
})();
