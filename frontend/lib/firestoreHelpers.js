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
  limit, // ✅ added
} from "firebase/firestore";
import { db } from "../firebase/clientApp";



/**
 * =========================
 * ✅ EXISTING (single-thread per model)
 * (kept so nothing breaks)
 * =========================
 */

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
  const messagesCol = collection(
    db,
    "users",
    uid,
    "conversations",
    model,
    "messages"
  );

  // Get all existing messages to delete them
  const existingMessages = await getDocs(messagesCol);
  const batch = writeBatch(db);

  // Delete all existing messages
  existingMessages.docs.forEach((d) => {
    batch.delete(d.ref);
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

/**
 * =========================
 * ✅ NEW (Option B: multi-thread conversations with Recents)
 * Path:
 * users/{uid}/conversations/{model}/threads/{threadId}
 * users/{uid}/conversations/{model}/threads/{threadId}/messages/{messageId}
 * =========================
 */


function threadsCol(uid, model) {
  return collection(db, "users", uid, "conversations", model, "threads");
}

function threadDoc(uid, model, threadId) {
  return doc(db, "users", uid, "conversations", model, "threads", threadId);
}

function threadMessagesCol(uid, model, threadId) {
  return collection(
    db,
    "users",
    uid,
    "conversations",
    model,
    "threads",
    threadId,
    "messages"
  );
}

/**
 * Create a new empty thread and return its id
 * ✅ IMPORTANT: updatedAt is NULL so it won't appear in Recents until finalized
 */
export async function createThread(uid, model) {
  const threadId = Date.now().toString();

  await setDoc(threadDoc(uid, model, threadId), {
    title: "New Chat",
    createdAt: serverTimestamp(),
    updatedAt: null, // ✅ don't make it "recent" yet
  });

  return threadId;
}

/**
 * Finalize / touch a thread so it becomes a Recent
 * ✅ Call this ONLY on "+ New Chat"
 */
export async function touchThread(uid, model, threadId) {
  const tRef = threadDoc(uid, model, threadId);
  await setDoc(tRef, { updatedAt: serverTimestamp() }, { merge: true });
}

/**
 * Get last N threads (Recents)
 * ✅ Only threads with updatedAt != null are included
 */
export async function getRecentThreads(uid, model, limitCount = 3) {
  const q = query(
    threadsCol(uid, model),
    where("updatedAt", "!=", null),
    orderBy("updatedAt", "desc"),
    limit(limitCount)
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Get messages for a specific thread (sorted oldest->newest)
 */
export async function getThreadMessages(uid, model, threadId) {
  const col = threadMessagesCol(uid, model, threadId);
  const q = query(col, orderBy("createdAt", "asc"));
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Append message into a thread
 * ✅ DOES NOT update updatedAt anymore (so Recents doesn't reorder while chatting)
 * ✅ Still sets title from first user msg
 */
export async function appendThreadMessage(uid, model, threadId, message) {
  const col = threadMessagesCol(uid, model, threadId);

  // Add message
  await addDoc(col, { ...message, createdAt: serverTimestamp() });

  // Update thread title if still default
  const tRef = threadDoc(uid, model, threadId);
  const tSnap = await getDoc(tRef);

  const prevTitle = tSnap.exists() ? tSnap.data().title : "New Chat";
  const nextTitle =
    prevTitle === "New Chat" && message.role === "user"
      ? (message.content || "New Chat").slice(0, 30)
      : prevTitle;

  await setDoc(
    tRef,
    {
      title: nextTitle,
      createdAt: tSnap.exists() ? tSnap.data().createdAt : serverTimestamp(),
      // ❌ DO NOT update updatedAt here
    },
    { merge: true }
  );
}

/**
 * Keep only last N threads (deletes older threads and their messages)
 * ✅ Only considers finalized threads (updatedAt != null)
 */
export async function keepOnlyLastNThreads(uid, model, n = 3) {
  const q = query(
    threadsCol(uid, model),
    where("updatedAt", "!=", null),
    orderBy("updatedAt", "desc")
  );

  const snap = await getDocs(q);
  const docs = snap.docs;

  if (docs.length <= n) return;

  const toDelete = docs.slice(n);
  const batch = writeBatch(db);

  for (const t of toDelete) {
    // delete thread messages
    const msgSnap = await getDocs(threadMessagesCol(uid, model, t.id));
    msgSnap.docs.forEach((m) => batch.delete(m.ref));

    // delete thread doc
    batch.delete(t.ref);
  }

  await batch.commit();
}