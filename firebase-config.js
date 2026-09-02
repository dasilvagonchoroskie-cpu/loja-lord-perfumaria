const firebaseConfig = {
  apiKey: "AIzaSyCuMcwoWZcTKavvYd1HCPsGYWLWQoFmXqY",
  authDomain: "lord-perfumaria-156f1.firebaseapp.com",
  projectId: "lord-perfumaria-156f1",
  storageBucket: "lord-perfumaria-156f1.firebasestorage.app",
  messagingSenderId: "788098923932",
  appId: "1:788098923932:web:9fb840866c38f987839c59"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
