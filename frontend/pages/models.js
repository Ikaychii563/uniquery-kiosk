"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { auth, db } from "../firebase/clientApp";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export default function ModelsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return router.replace("/login");
      setUser(u);

      try {
        const docSnap = await getDoc(doc(db, "users", u.uid));
        if (docSnap.exists()) setProfile(docSnap.data());
      } catch (err) {
        console.warn("Failed to load profile:", err);
      } finally {
        setLoading(false);
      }
    });

    async function fetchAnnouncement() {
      try {
        const docSnap = await getDoc(doc(db, "announcements", "latest"));
        if (docSnap.exists()) setPreviewImage(docSnap.data().imageUrl);
      } catch (err) {
        console.warn("Failed to load announcement:", err);
      }
    }
    fetchAnnouncement();

    return () => unsub();
  }, [router]);

  const nickname = profile?.nickname || profile?.name || user?.email;

  function gotoModel(key) {
    router.push(`/chat?model=${encodeURIComponent(key)}`);
  }

  async function handleSignOut() {
    await signOut(auth);
    router.replace("/login");
  }

  async function uploadAnnouncement(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const idToken = await auth.currentUser.getIdToken();

    const res = await fetch("/api/announcement", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
      body: formData,
    });

    const data = await res.json();
    if (data.url) setPreviewImage(data.url);
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;

  return (
    <div className="relative w-full h-screen font-poppins">

      {/* BACKGROUND */}
      <div
        className="absolute inset-0 bg-cover bg-center -z-10"
        style={{ backgroundImage: "url('/bg.png')" }}
      />
      <div className="absolute inset-0 bg-[rgba(245,245,245,0.18)] backdrop-blur-sm -z-10" />

      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/30 text-white h-16 px-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <img src="/tuplogo.png" alt="TUP Logo" className="h-8 w-8" />
          <h1 className="text-xs md:text-sm font-bold tracking-wide">
            TECHNOLOGICAL UNIVERSITY OF THE PHILIPPINES
          </h1>
        </div>
        <button
          onClick={handleSignOut}
          className="bg-[#faa029] text-black font-semibold px-5 py-2 rounded-full shadow"
        >
          Sign Out
        </button>
      </header>

      {/* MAIN CONTENT */}
      <main className="absolute inset-0 z-40 pt-20 pb-20 px-6 overflow-auto flex flex-col lg:flex-row justify-between gap-6 max-w-6xl mx-auto">
        {/* Welcome Section */}
        <div className="flex flex-col w-full lg:w-[55%] gap-4">
          <h2 className="text-xl font-bold text-center">
            WELCOME, <span className="text-[#aa3636]">{nickname?.toUpperCase()}</span>!
          </h2>

          {/* Announcement */}
          <div className="bg-white w-full rounded-xl shadow-xl border border-gray-300 p-6 flex flex-col items-center">
            <div className="w-full h-64 bg-gray-100 border-2 border-gray-300 rounded-xl flex items-center justify-center overflow-hidden">
              {previewImage ? (
                <img src={previewImage} className="w-full h-full object-cover" />
              ) : (
                <p className="text-gray-600 text-lg">No announcement yet</p>
              )}
            </div>

            {profile?.role === "admin" && (
              <div className="mt-4">
                <input type="file" onChange={uploadAnnouncement} className="text-sm" />
              </div>
            )}
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex flex-col w-full lg:w-[40%] gap-6">
          <div className="flex flex-col items-center mb-6">
            <img src="/tupi-logo.png" alt="TUP Logo" className="h-16 w-16 mb-2" />
            <h2 className="text-2xl font-bold">
              <span className="text-black">TUP AI</span>{" "}
              <span className="text-[#aa3636]">Chatbot</span>
            </h2>
          </div>

          <button
            onClick={() => gotoModel("info")}
            className="w-full bg-[#aa3636] text-black text-2xl font-bold py-6 rounded-3xl shadow-xl transition"
          >
            General Information
          </button>
          <button
            onClick={() => gotoModel("nav")}
            className="w-full bg-[#aa3636] text-black text-2xl font-bold py-6 rounded-3xl shadow-xl transition"
          >
            Campus Navigation
          </button>
          <button
            onClick={() => gotoModel("ece")}
            className="w-full bg-[#aa3636] text-black text-2xl font-bold py-6 rounded-3xl shadow-xl transition"
          >
            ECE Queries
          </button>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="fixed bottom-0 w-full text-center py-1 text-white bg-black/30 text-xs z-50">
        Designed by: Electronics Engineering Department
      </footer>
    </div>
  );
}
