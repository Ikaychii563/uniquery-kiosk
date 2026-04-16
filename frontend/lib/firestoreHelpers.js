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
  limit,
  where,
} from "firebase/firestore";

import { db } from "../firebase/clientApp";


// ======================================================
// ✅ OLD SINGLE-CONVERSATION SYSTEM (kept for safety)
// ======================================================

export async function getConversationMessages(uid, model) {
  const col = collection(db, "users", uid, "conversations", model, "messages");
  const q = query(col, orderBy("createdAt", "asc"));
  const snaps = await getDocs(q);

  return snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function appendMessageDoc(uid, model, message) {
  const col = collection(db, "users", uid, "conversations", model, "messages");
  await addDoc(col, { ...message, createdAt: serverTimestamp() });
}

export async function clearConversationMarker(uid, model) {
  const ref = doc(db, "users", uid, "conversations", model);
  await setDoc(ref, { clearedAt: serverTimestamp() }, { merge: true });
}

export async function getConversation(uid, model) {
  const [messages, convSnap] = await Promise.all([
    getConversationMessages(uid, model),
    getDoc(doc(db, "users", uid, "conversations", model)),
  ]);

  const clearedAt = convSnap.exists()
    ? convSnap.data().clearedAt || null
    : null;

  return {
    messages: clearedAt
      ? messages.filter(
          (m) => m.createdAt?.toMillis() > clearedAt.toMillis()
        )
      : messages,
    clearedAt,
  };
}

export async function setConversation(uid, model, messages = []) {
  const convRef = doc(db, "users", uid, "conversations", model);
  const messagesCol = collection(db, "users", uid, "conversations", model, "messages");

  const existing = await getDocs(messagesCol);
  const batch = writeBatch(db);

  existing.forEach((d) => batch.delete(d.ref));

  batch.set(convRef, { clearedAt: serverTimestamp() }, { merge: true });

  messages.forEach((m) => {
    const newRef = doc(messagesCol);
    batch.set(newRef, { ...m, createdAt: serverTimestamp() });
  });

  await batch.commit();
}

export const appendMessage = appendMessageDoc;


// ======================================================
// 👤 USER PROFILE
// ======================================================

export async function createUserProfile(uid, userData) {
  await setDoc(doc(db, "users", uid), {
    name: userData.name || "",
    nickname: userData.nickname || "",
    email: userData.email || "",
    createdAt: serverTimestamp(),
  });
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}


// ======================================================
// 🧵 THREAD SYSTEM (RECENTS)
// ======================================================

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


// Create new thread (NOT recent yet)
export async function createThread(uid, model) {
  const threadId = Date.now().toString();

  await setDoc(threadDoc(uid, model, threadId), {
    title: "New Chat",
    createdAt: serverTimestamp(),
    updatedAt: null,
  });

  return threadId;
}


// Mark thread as recent
export async function touchThread(uid, model, threadId) {
  await setDoc(
    threadDoc(uid, model, threadId),
    { updatedAt: serverTimestamp() },
    { merge: true }
  );
}


// Get recent threads (IMPORTANT FIX: avoids unstable query issues)
export async function getRecentThreads(uid, model, limitCount = 3) {
  const q = query(
    threadsCol(uid, model),
    orderBy("updatedAt", "desc"),
    limit(limitCount)
  );

  const snap = await getDocs(q);

  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((t) => t.updatedAt); // client-side safety filter
}


// Get messages of a thread
export async function getThreadMessages(uid, model, threadId) {
  const q = query(
    threadMessagesCol(uid, model, threadId),
    orderBy("createdAt", "asc")
  );

  const snap = await getDocs(q);

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}


// Append message to thread
export async function appendThreadMessage(uid, model, threadId, message) {
  const col = threadMessagesCol(uid, model, threadId);

  await addDoc(col, {
    ...message,
    createdAt: serverTimestamp(),
  });

  const tRef = threadDoc(uid, model, threadId);
  const tSnap = await getDoc(tRef);

  const prevTitle = tSnap.exists() ? tSnap.data().title : "New Chat";

  const nextTitle =
    prevTitle === "New Chat" && message.role === "user"
      ? message.content.slice(0, 30)
      : prevTitle;

  await setDoc(
    tRef,
    {
      title: nextTitle,
      createdAt: tSnap.exists()
        ? tSnap.data().createdAt
        : serverTimestamp(),
    },
    { merge: true }
  );
}


// Keep only last N threads
export async function keepOnlyLastNThreads(uid, model, n = 3) {
  const q = query(
    threadsCol(uid, model),
    orderBy("updatedAt", "desc")
  );

  const snap = await getDocs(q);

  const docs = snap.docs.filter((d) => d.data().updatedAt);

  if (docs.length <= n) return;

  const batch = writeBatch(db);
  const toDelete = docs.slice(n);

  for (const t of toDelete) {
    const msgs = await getDocs(threadMessagesCol(uid, model, t.id));

    msgs.forEach((m) => batch.delete(m.ref));
    batch.delete(t.ref);
  }

  await batch.commit();
}


// Delete thread completely
export async function deleteThread(uid, model, threadId) {
  const tRef = threadDoc(uid, model, threadId);
  const msgs = await getDocs(threadMessagesCol(uid, model, threadId));

  const batch = writeBatch(db);

  msgs.forEach((m) => batch.delete(m.ref));
  batch.delete(tRef);

  await batch.commit();
}