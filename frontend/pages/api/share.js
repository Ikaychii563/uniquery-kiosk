import admin from "firebase-admin";

function initAdmin() {
  if (admin.apps.length) return;

  // Put your service account JSON string in env var:
  // FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account", ... }'
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_KEY env var");
  }

  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    initAdmin();
    const db = admin.firestore();

    const { modelKey, messages, createdAt } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Messages are required" });
    }

    // keep it safe and small
    const safeMessages = messages
      .filter((m) => m && typeof m === "object")
      .slice(-40)
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || "").slice(0, 4000),
      }));

    const docRef = await db.collection("sharedConversations").add({
      modelKey: String(modelKey || "nav"),
      messages: safeMessages,
      createdAt: typeof createdAt === "number" ? createdAt : Date.now(),
    });

    return res.status(200).json({ id: docRef.id });
    } catch (err) {
    console.error("Share API error:", err);
    return res.status(500).json({
      error: "Failed to create share link",
      details: err?.message || String(err),
    });
  }

}
