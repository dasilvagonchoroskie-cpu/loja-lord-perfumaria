// PLACEHOLDER — substituir pelos dados reais assim que o Firebase
// da loja Lord Perfumaria for criado (ver PROJETO-lord-perfumaria.md,
// seção 7, passo 2).
const firebaseConfig = {
  apiKey: "COLOQUE_AQUI",
  authDomain: "COLOQUE_AQUI",
  projectId: "COLOQUE_AQUI",
  storageBucket: "COLOQUE_AQUI",
  messagingSenderId: "COLOQUE_AQUI",
  appId: "COLOQUE_AQUI"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
