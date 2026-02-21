// frontend/lib/firestoreHelpers.js
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  query,
  orderBy,
  getDocs,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase/clientApp";

/**
 * Read conversation messages (returns array sorted by createdAt)
 */
export async function getConversationMessages(uid, model) {
  const col = collection(db, "users", uid, "conversations", model, "messages");
  const q = query(col, orderBy("createdAt", "asc"));
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Append a message as a document (uses serverTimestamp)
 * message: { role, content }
 */
export async function appendMessageDoc(uid, model, message) {
  const col = collection(db, "users", uid, "conversations", model, "messages");
  await addDoc(col, { ...message, createdAt: serverTimestamp() });
}

/**
 * Clear conversation: top-level marker to indicate cleared
 */
export async function clearConversationMarker(uid, model) {
  const ref = doc(db, "users", uid, "conversations", model);
  await setDoc(ref, { clearedAt: serverTimestamp() }, { merge: true });
}

/**
 * Get conversation object with messages and clearedAt timestamp
 * Returns: { messages: [...], clearedAt: Timestamp | null }
 */
export async function getConversation(uid, model) {
  const [messages, convSnap] = await Promise.all([
    getConversationMessages(uid, model),
    getDoc(doc(db, "users", uid, "conversations", model)),
  ]);

  const clearedAt = convSnap.exists() ? convSnap.data().clearedAt || null : null;

  // Filter messages if clearedAt exists
  const filteredMessages = clearedAt
    ? messages.filter((msg) => msg.createdAt?.toMillis() > clearedAt.toMillis())
    : messages;

  return { messages: filteredMessages, clearedAt };
}

/**
 * Set conversation - reset to empty or specific messages
 */
export async function setConversation(uid, model, messages = []) {
  const convRef = doc(db, "users", uid, "conversations", model);
  const messagesCol = collection(db, "users", uid, "conversations", model, "messages");
  
  // Get all existing messages to delete them
  const existingMessages = await getDocs(messagesCol);
  const batch = writeBatch(db);
  
  // Delete all existing messages
  existingMessages.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  
  // Set clearedAt timestamp
  batch.set(convRef, { clearedAt: serverTimestamp() }, { merge: true });
  
  // Add new messages if provided
  messages.forEach((message) => {
    const newMessageRef = doc(messagesCol);
    batch.set(newMessageRef, { ...message, createdAt: serverTimestamp() });
  });
  
  await batch.commit();
}

/**
 * Create a user profile with name, nickname and email
 * uid: user uid
 * userData: { name, nickname, email }
 */
export async function createUserProfile(uid, userData) {
  try {
    await setDoc(doc(db, "users", uid), {
      name: userData.name || "",
      nickname: userData.nickname || "",
      email: userData.email || "",
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("Error creating user profile:", err);
    throw err;
  }
}

/**
 * Get user profile data
 */
export async function getUserProfile(uid) {
  try {
    const userDocRef = doc(db, "users", uid);
    const userDocSnap = await getDoc(userDocRef);
    
    if (userDocSnap.exists()) {
      return userDocSnap.data();
    }
    return null;
  } catch (err) {
    console.error("Error getting user profile:", err);
    throw err;
  }
}

/**
 * Aliases for frontend code consistency
 */
export const appendMessage = appendMessageDoc;