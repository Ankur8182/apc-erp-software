// Firebase SDK
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD0HgH1Ws4HoH_2kEC1qjAf8FdYZABzDU0",
  authDomain: "a-p-construction-erp.firebaseapp.com",
  projectId: "a-p-construction-erp",
  storageBucket: "a-p-construction-erp.firebasestorage.app",
  messagingSenderId: "833019048433",
  appId: "1:833019048433:web:22cb87b0f930801d4c1450"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;