"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { db } from "../../firebase/clientApp";
import { doc, getDoc } from "firebase/firestore";

function SimpleMarkdown({ text }) {
  if (!text) return null;
  const lines = String(text).split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <div key={i} className="mb-1">
          {line}
        </div>
      ))}
    </>
  );
}

export default function SharePage() {
  const router = useRouter();
  const { id } = router.query;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!id) return;

    (async () => {
      try {
        setLoading(true);
        setErr("");

        const ref = doc(db, "sharedConversations", String(id));
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setErr("This shared conversation was not found (maybe expired or deleted).");
          setData(null);
          setLoading(false);
          return;
        }

        setData(snap.data());
        setLoading(false);
      } catch (e) {
        setErr(e?.message || "Failed to load shared conversation.");
        setLoading(false);
      }
    })();
  }, [id]);

  const messages = Array.isArray(data?.messages) ? data.messages : [];
  const createdAt =
    typeof data?.createdAt === "number" ? new Date(data.createdAt) : null;

  return (
    <div className="min-h-screen bg-[#f6f6f6] p-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-lg font-bold text-[#aa3636]">
              TUP Chat Share
            </h1>
            <p className="text-xs text-gray-600">
              {data?.modelKey ? `Model: ${String(data.modelKey).toUpperCase()}` : "Model: —"}
              {createdAt ? ` • Saved: ${createdAt.toLocaleString()}` : ""}
            </p>
          </div>

          <button
            onClick={() => window.print()}
            className="bg-[#faa029] text-black font-semibold text-xs px-4 py-2 rounded-xl shadow"
          >
            Save / Print
          </button>
        </div>

        {loading && (
          <p className="text-sm text-gray-700">Loading…</p>
        )}

        {!loading && err && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
            {err}
          </div>
        )}

        {!loading && !err && (
          <div className="space-y-3">
            {messages.length === 0 ? (
              <p className="text-sm text-gray-700">No messages.</p>
            ) : (
              messages.map((m, idx) => (
                <div key={idx} className="border border-gray-200 rounded-xl p-3">
                  <p className="text-xs font-bold mb-2">
                    {m.role === "assistant" ? "Assistant" : "User"}
                  </p>
                  <div className="text-sm text-gray-900" style={{ whiteSpace: "pre-wrap" }}>
                    <SimpleMarkdown text={m.content} />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <div className="mt-6 text-[11px] text-gray-500">
          Tip: Tap <b>Save / Print</b> to save as PDF on your phone.
        </div>
      </div>
    </div>
  );
}
