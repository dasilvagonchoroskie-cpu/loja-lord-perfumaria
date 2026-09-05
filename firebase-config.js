const firebaseConfig = {
  apiKey: "AIzaSyAGuOxDpye_kiyHxutNRRNs3Drrv46Bdb4",
  authDomain: "lord-perfumaria-51e77.firebaseapp.com",
  projectId: "lord-perfumaria-51e77",
  storageBucket: "lord-perfumaria-51e77.firebasestorage.app",
  messagingSenderId: "737028905393",
  appId: "1:737028905393:web:552a4989923ff06dda0590"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

