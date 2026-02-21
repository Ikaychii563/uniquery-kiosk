// frontend/lib/api.js
import { getAuth } from "firebase/auth";

const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";

export async function callChatBackend({ model, messages, max_tokens }) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const idToken = await user.getIdToken(true);

  let res;
  try {
    res = await fetch("https://tiyupi-ece-ece-api.hf.space/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ model, messages, max_tokens: max_tokens || 512 }),
    });
  } catch (err) {
    throw new Error("Network error: " + (err.message || err));
  }

  const text = await res.text().catch(() => "");
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new Error(`Backend error ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}
