import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getReactNativePersistence , initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from 'firebase/database';
const firebaseConfig = {
  apiKey: "AIzaSyBK7ykhDKHl36rdE8KJRpCKmohvdKFGxhA",
  authDomain: "khang123-fd4f9.firebaseapp.com",
  projectId: "khang123-fd4f9",
  storageBucket: "khang123-fd4f9.firebasestorage.app",
  messagingSenderId: "561710918740",
  appId: "1:561710918740:web:2b0876fc03c792eda591c1",
  measurementId: "G-9XLY1WQYEH",
  databaseURL: "https://khang123-fd4f9-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);
export const rtdb = getDatabase(app);