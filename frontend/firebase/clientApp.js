import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyArvT2SfDLJTTkZdeAYrR7nXkrFL-gqJhM",
  authDomain: "tupaichatbot.firebaseapp.com",
  projectId: "tupaichatbot",
  storageBucket: "tupaichatbot.firebasestorage.app",
  messagingSenderId: "414193187817",
  appId: "1:414193187817:web:95988b9ae18a2081536978",
  measurementId: "G-PYBPYG4D8R"
};

const app = initializeApp(firebaseConfig);

// debug: log config check (remove later)
if (typeof window !== "undefined") {
  console.log("Firebase clientApp initialized, apiKey:", firebaseConfig.apiKey?.slice?.(0,8) + "...");
}

export const auth = getAuth(app);
export const db = getFirestore(app);