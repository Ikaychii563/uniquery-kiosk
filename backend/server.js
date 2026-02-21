// backend/server.js
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch"); // npm i node-fetch@2
const admin = require("firebase-admin");
const multer = require("multer"); // npm i multer
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN || "@tup.edu.ph";

const MODEL_NAV_URL = process.env.MODEL_NAV_URL || "http://localhost:5000/mock/model-nav";
const MODEL_INFO_URL = process.env.MODEL_INFO_URL || "http://localhost:5000/mock/model-info";
const MODEL_NAV_KEY = process.env.MODEL_NAV_KEY || "";
const MODEL_INFO_KEY = process.env.MODEL_INFO_KEY || "";

// 🔹 Initialize Firebase Admin
try {
  const serviceAccount = require("./serviceAccountKey.json"); // place JSON here
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "your-bucket-name.appspot.com" // replace with your Firebase Storage bucket
  });
  console.log("✅ Firebase admin initialized");
} catch (err) {
  console.error("❌ Firebase Admin init error:", err.message);
}

// Multer setup
const upload = multer({ storage: multer.memoryStorage() });

// 🔒 Firebase token verification middleware
async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) return res.status(401).json({ error: "Missing auth token" });

  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const email = decoded.email || "";
    if (!email.endsWith(ALLOWED_DOMAIN)) return res.status(403).json({ error: "Only TUP accounts allowed" });

    const userDoc = await admin.firestore().doc(`users/${decoded.uid}`).get();
    if (!userDoc.exists) return res.status(403).json({ error: "User profile not found in Firestore" });

    req.user = { uid: decoded.uid, email };
    next();
  } catch (err) {
    console.error("❌ Token verify error:", err.message || err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// 🔹 Mock endpoints
app.post("/mock/model-nav", (req, res) => {
  const last = req.body?.messages?.slice(-1)[0]?.content || "";
  return res.json({ choices: [{ message: { content: `[CampusNav mock] You asked: ${last}` } }] });
});

app.post("/mock/model-info", (req, res) => {
  const last = req.body?.messages?.slice(-1)[0]?.content || "";
  return res.json({ choices: [{ message: { content: `[GenInfo mock] You asked: ${last}` } }] });
});

// 🔐 AI model route
app.post("/api/chat", verifyFirebaseToken, async (req, res) => {
  try {
    const { model, messages, max_tokens } = req.body || {};
    if (!model || !messages) return res.status(400).json({ error: "model and messages required" });

    const targetUrl = model === "info" ? MODEL_INFO_URL : MODEL_NAV_URL;
    const apiKey = model === "info" ? MODEL_INFO_KEY : MODEL_NAV_KEY;

    const r = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify({ messages, max_tokens: max_tokens || 512 }),
      timeout: 120000
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error("❌ Model server error:", txt);
      return res.status(502).json({ error: "Model server error", details: txt });
    }

    const data = await r.json();
    return res.json(data);
  } catch (err) {
    console.error("❌ Proxy error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// 🖼️ Announcement upload (admin only)
app.post("/api/announcement", verifyFirebaseToken, upload.single("file"), async (req, res) => {
  try {
    const adminUID = "ADMIN_UID_HERE"; // replace with actual admin UID
    if (req.user.uid !== adminUID) return res.status(403).json({ error: "Only admin can upload announcements" });

    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const bucket = admin.storage().bucket();
    const fileName = `announcements/${Date.now()}_${req.file.originalname}`;
    const file = bucket.file(fileName);

    await file.save(req.file.buffer, { contentType: req.file.mimetype });
    await file.makePublic();

    const publicUrl = file.publicUrl();
    await admin.firestore().doc("announcements/latest").set({ imageUrl: publicUrl });

    res.json({ success: true, url: publicUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to upload announcement" });
  }
});

// 🔹 Root
app.get("/", (req, res) => res.send("Backend proxy running ✅"));

// ✅ Avoid EADDRINUSE: check if port is in use
const server = app.listen(PORT, () => console.log(`🚀 Backend running at http://localhost:${PORT}`));
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use. Use another port or kill the existing process.`);
  } else {
    console.error(err);
  }
});
