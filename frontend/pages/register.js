"use client";

import React, { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase/clientApp";
import { createUserProfile } from "../lib/firestoreHelpers";
import { useRouter } from "next/router";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const ALLOWED_DOMAIN = "@tup.edu.ph";

  async function handleRegister(e) {
    e.preventDefault();
    setStatus(null);

    if (!email.toLowerCase().endsWith(ALLOWED_DOMAIN)) {
      setStatus({ type: "error", text: "Invalid email address" });
      return;
    }
    if (!name.trim()) {
      setStatus({ type: "error", text: "Please enter your full name." });
      return;
    }
    if (password.length < 6) {
      setStatus({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }

    setLoading(true);
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email.toLowerCase(), password);
      const uid = userCred.user.uid;

      await createUserProfile(uid, {
        name: name.trim(),
        nickname: nickname.trim(),
        email: email.toLowerCase(),
      });

      setStatus({ type: "success", text: "Registered! Redirecting to login..." });
      setTimeout(() => router.push("/login"), 900);
    } catch (err) {
      console.error("Register error:", err);
      setStatus({
        type: "error",
        text: `Error: ${err.message || "Unexpected error"}`,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen w-full flex flex-col bg-cover bg-center"
      style={{ backgroundImage: "url('/bg.png')" }}
    >
      {/* HEADER */}
      <header className="absolute top-0 w-full bg-black/30 text-white py-1.5 px-4 flex items-center gap-2">
        <img src="/tuplogo.png" alt="TUP Logo" className="h-7 w-7" />
        <h1 className="text-xs md:text-sm font-bold">
          TECHNOLOGICAL UNIVERSITY OF THE PHILIPPINES
        </h1>
      </header>

      {/* MAIN CONTENT */}
      <div className="flex flex-1 items-center justify-center px-6 py-10 gap-16">

        {/* LEFT SIDE LOGO */}
        <div className="hidden md:flex flex-col items-center">
          <img src="/tupi-logo.png" className="w-[300px]" alt="TUP AI Logo" />
          <h2 className="text-3xl font-bold text-black mt-4">
            TUP AI <span className="text-red-700">Chatbot</span>
          </h2>
        </div>

        {/* REGISTER CARD */}
        <form
          onSubmit={handleRegister}
          className="w-full max-w-sm bg-[#aa3636] bg-opacity-95 rounded-3xl p-5 shadow-lg"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-black text-center mb-6">
            Register
          </h2>

          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full Name"
            className="w-full p-3 mb-4 rounded-xl bg-white text-black focus:outline-none"
          />

          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Nickname"
            className="w-full p-3 mb-4 rounded-xl bg-white text-black focus:outline-none"
          />

          <input
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            className="w-full p-3 mb-4 rounded-xl bg-white text-black focus:outline-none"
          />

          <input
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            className="w-full p-3 mb-6 rounded-xl bg-white text-black focus:outline-none"
          />

          <div className="flex flex-col items-center gap-4">
            <button
              type="submit"
              disabled={loading}
              className="bg-[#faa029] text-black px-8 py-2 rounded-full font-bold w-32"
            >
              {loading ? "Loading..." : "Go"}
            </button>

            <p
              className="text-sm text-white underline cursor-pointer"
              onClick={() => router.push("/login")}
            >
              Already have an account?
            </p>
          </div>

          {status && (
            <div
              className={`mt-4 text-center text-sm ${
                status.type === "error" ? "text-red-700" : "text-green-800"
              }`}
            >
              {status.text}
            </div>
          )}
        </form>
      </div>

      {/* FOOTER */}
      <footer className="absolute bottom-0 w-full text-center py-1 text-white bg-black/30 text-xs">
        Designed by: Electronics Engineering Department
      </footer>
    </div>
  );
}
