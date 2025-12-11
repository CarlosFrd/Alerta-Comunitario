// ===== CONFIGURAÇÃO DO FIREBASE =====
// INSTRUÇÕES:
// 1. Renomeie este arquivo para 'config.js'
// 2. Substitua os valores abaixo pelas suas credenciais do Firebase

const firebaseConfig = {
  apiKey: "SUA_API_KEY_AQUI",
  authDomain: "SEU_AUTH_DOMAIN_AQUI",
  projectId: "SEU_PROJECT_ID_AQUI",
  storageBucket: "SEU_STORAGE_BUCKET_AQUI",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID_AQUI",
  appId: "SEU_APP_ID_AQUI",
  measurementId: "SEU_MEASUREMENT_ID_AQUI"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ===== VARIÁVEIS GLOBAIS =====
let currentUser = null;
let currentUserRole = null;
