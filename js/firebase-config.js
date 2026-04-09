var App = window.App || {};

App.firebaseConfig = {
    apiKey: "AIzaSyBkXc2hRgq6g0vZt-FrFCgDnjhex1Kb9YI",
    authDomain: "karate-exam.firebaseapp.com",
    projectId: "karate-exam",
    storageBucket: "karate-exam.firebasestorage.app",
    messagingSenderId: "734091859361",
    appId: "1:734091859361:web:392d839dabe9280689e7e0"
};

firebase.initializeApp(App.firebaseConfig);

App.db = firebase.firestore();
App.auth = firebase.auth();
