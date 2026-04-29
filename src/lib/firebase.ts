import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyAMvM08QovvDx3ox9pLeqT632reeFvk9CI",
  authDomain: "sistema-financas.firebaseapp.com",
  projectId: "sistema-financas",
  storageBucket: "sistema-financas.firebasestorage.app",
  messagingSenderId: "1004458226419",
  appId: "1:1004458226419:web:7ba8b55e9f75666f593d86",
};

export const app = initializeApp(firebaseConfig);