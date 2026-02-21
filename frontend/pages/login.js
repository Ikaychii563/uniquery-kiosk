"use client";

import React, { useState } from "react";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "../firebase/clientApp";
import { useRouter } from "next/router";
import toast from "react-hot-toast";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setShowReset(false);

    try {
      await signInWithEmailAndPassword(auth, email.toLowerCase(), password);
      toast.success("Login successful! Redirecting...");
      setTimeout(() => router.push("/models"), 1200);
    } catch (err) {
      const code = err?.code || "unknown";
      if (code === "auth/user-not-found" || code === "auth/wrong-password") {
        toast.error("Invalid email or password.");
        setShowReset(true);
      } else if (code === "auth/invalid-email") {
        toast.error("Invalid email format.");
      } else {
        toast.error(`Error: ${code}`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="relative min-h-screen bg-cover bg-center"
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
      <div className="relative z-20 flex flex-col items-center justify-center min-h-screen px-4">

        {/* Centered TUPI Logo */}
        <img
          src="/tupi-logo.png"
          alt="TUPI Logo"
          className="h-20 w-auto mb-4 drop-shadow-lg"
        />

        {/* LOGIN CARD */}
        <form
          onSubmit={handleLogin}
          className="bg-[#aa3636]/90 w-full max-w-md p-10 rounded-[32px] shadow-xl border border-black/30 relative"
        >

          {/* BACK ARROW + TEXT */}
          <div
            className="absolute top-4 left-4 flex items-center gap-1 text-[#faa029] cursor-pointer hover:opacity-80"
            onClick={() => router.push("/")}
          >
            <span className="text-lg">←</span>
            <span className="text-md font-semibold">Back</span>
          </div>

          <h2 className="text-3xl font-bold text-center text-black mt-1">
            Sign In
          </h2>

          <p className="text-center text-black mt-1 mb-5">
            Don’t have an account yet?{" "}
            <span
              onClick={() => router.push("/register")}
              className="text-[#faa029] cursor-pointer font-semibold"
            >
              Click here
            </span>
          </p>

          <input
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            className="w-full p-3 mb-4 rounded-xl bg-white/90 outline-none"
          />

          <input
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            className="w-full p-3 mb-6 rounded-xl bg-white/90 outline-none"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#faa029] text-black py-3 rounded-full font-bold text-lg shadow-md"
          >
            {loading ? "Logging in..." : "Proceed"}
          </button>

          {showReset && (
            <button
              type="button"
              onClick={() => sendPasswordResetEmail(auth, email)}
              className="w-full mt-4 bg-white text-[#7a1919] py-2 rounded font-semibold"
            >
              Send Password Reset Email
            </button>
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
