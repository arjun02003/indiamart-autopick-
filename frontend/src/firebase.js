import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCHnltApcC7-vE9FDf8cfSiAIKDDRYLnrs",
  authDomain: "indiamart-autopick.firebaseapp.com",
  projectId: "indiamart-autopick",
  storageBucket: "indiamart-autopick.firebasestorage.app",
  messagingSenderId: "808123480775",
  appId: "1:808123480775:web:2bf2e06bd942568925dce2",
  measurementId: "G-D6WP3J7G5Z"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export default app;
