"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useRouter } from "next/router";
import { auth } from "../firebase/clientApp";
import { onAuthStateChanged, signOut } from "firebase/auth";
import toast from "react-hot-toast";
import {
  getConversation,
  appendMessage,
  setConversation,
  getUserProfile,
} from "../lib/firestoreHelpers";

// IMPORT VIRTUAL KEYBOARD
import Keyboard from "react-simple-keyboard";
import "react-simple-keyboard/build/css/index.css";

// ✅ FIX: Define QWERTY keyboard layout
const layout = {
  qwerty: {
    default: [
      "0 1 2 3 4 5 6 7 8 9",
      "q w e r t y u i o p {backspace}",
      "a s d f g h j k l {enter}",
      "{shift} z x c v b n m",
      "{@} {%} {?} {space} {,} {.}",
    ],
    shift: [
      "0 1 2 3 4 5 6 7 8 9",
      "Q W E R T Y U I O P {backspace}",
      "A S D F G H J K L {enter}",
      "{shift} Z X C V B N M",
      "{@} {%} {?} {space} {,} {.}",
    ],
  },
};

// Simple markdown renderer without external dependencies
function SimpleMarkdownRenderer({ text }) {
  if (!text) return null;

  const lines = text.split("\n");
  return lines.map((line, index) => {
    if (line.trim() === "") return <br key={index} />;

    let content = line;
    const boldRegex = /\*\*(.*?)\*\*/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = boldRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <span key={`${index}-${lastIndex}`}>
            {content.substring(lastIndex, match.index)}
          </span>
        );
      }
      parts.push(
        <strong key={`${index}-bold-${match.index}`}>{match[1]}</strong>
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push(
        <span key={`${index}-remaining`}>{content.substring(lastIndex)}</span>
      );
    }

    if (parts.length === 0) {
      parts.push(<span key={`${index}-plain`}>{content}</span>);
    }

    return (
      <div key={index} className="mb-1 last:mb-0">
        {parts}
        {index < lines.length - 1 && <br />}
      </div>
    );
  });
}

function formatAIResponse(text) {
  if (!text) return "";
  let cleaned = text.trim();

  if (cleaned.startsWith("{") && cleaned.endsWith("}")) {
    try {
      const json = JSON.parse(cleaned);
      cleaned =
        json.generated_text ||
        json.response ||
        json.answer ||
        json.output ||
        json.text ||
        json.message ||
        JSON.stringify(json);
    } catch {}
  }

  cleaned = cleaned.replace(/^"|"$/g, "");
  cleaned = cleaned.replace(/\\n/g, "\n");
  cleaned = cleaned.replace(/\\"/g, '"');
  cleaned = cleaned.replace(/\\t/g, "  ");

  return cleaned;
}

export default function ChatPage() {
  const router = useRouter();
  const { model, public: isPublic } = router.query;

  const modelConfigs = {
    ece: { url: "https://tiyupi-ece-ece-api.hf.space/generate", token: "" },
    nav: { url: "https://tiyupi-ece-somi-cali.hf.space/chat", token: "" },
    info: { url: "https://tiyupi-ece-hitupi.hf.space/chat", token: "" },
  };

  const modelKey = model || "ece";
  const selectedModel = modelConfigs[modelKey] || {};
  const isPublicAccess = isPublic === "true";

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [nickname, setNickname] = useState("");
  const [realName, setRealName] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [shiftActive, setShiftActive] = useState(false);
  const endRef = useRef();

  const [sidebarOpen, setSidebarOpen] = useState(true);

  // VIRTUAL KEYBOARD STATE
  const [showKeyboard, setShowKeyboard] = useState(false);
  const keyboardRef = useRef(null);
  const lastScrollTopRef = useRef(0);
  const keyboardScrollThreshold = 20;
  const chatContainerRef = useRef(null);
  const inputBarRef = useRef(null);
  const keyboardInputRef = useRef("");
  const inputRef = useRef(null);
  const caretPositionRef = useRef(0);

  // ✅ SHARE / QR STATE (added)
  const [shareId, setShareId] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);

  /* AUTH */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (isPublicAccess && !u) {
        setUser(null);
        setNickname("Guest");
        setRealName("Guest");
        setMessages([]);
        setLoading(false);
        return;
      }

      if (!isPublicAccess && !u) {
        router.replace("/login");
        return;
      }

      setUser(u);

      try {
        if (u) {
          const profile = await getUserProfile(u.uid);
          const name =
            profile?.name ||
            u.displayName ||
            profile?.nickname ||
            u.email?.split("@")[0] ||
            "User";
          setRealName(name);

          const nick =
            profile?.nickname ||
            profile?.name ||
            u.displayName ||
            u.email?.split("@")[0] ||
            "User";
          setNickname(nick);

          const conv = await getConversation(u.uid, modelKey);
          setMessages(conv?.messages || []);
        }
      } catch {}

      setLoading(false);
    });

    return () => unsub();
  }, [router, modelKey, isPublicAccess]);

  // Get references on mount
  useEffect(() => {
    chatContainerRef.current = document.querySelector(
      ".absolute.inset-0.px-6.overflow-y-auto.flex.flex-col"
    );
    inputBarRef.current = document.querySelector("form.fixed.left-0.z-50");
  }, []);

  // Handle scroll to auto-hide keyboard
  const handleScroll = useCallback(() => {
    if (!showKeyboard) return;

    const chatContainer = chatContainerRef.current;
    if (!chatContainer) return;

    const currentScrollTop = chatContainer.scrollTop;
    const scrollDiff = Math.abs(currentScrollTop - lastScrollTopRef.current);

    if (scrollDiff > keyboardScrollThreshold) {
      setShowKeyboard(false);
      const inputElement = document.querySelector('input[placeholder*="Ask"]');
      if (inputElement) inputElement.blur();
    }

    lastScrollTopRef.current = currentScrollTop;
  }, [showKeyboard]);

  // Attach scroll event listener
  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (!chatContainer) return;

    chatContainer.addEventListener("scroll", handleScroll);
    return () => {
      chatContainer.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll]);

  // Reset scroll tracking when keyboard shows
  useEffect(() => {
    if (showKeyboard && chatContainerRef.current) {
      lastScrollTopRef.current = chatContainerRef.current.scrollTop;
    }
  }, [showKeyboard]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* SEND MESSAGE */
  async function handleSend(e) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMsg = { role: "user", content: trimmed };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setSending(true);
    setShowKeyboard(false);
    keyboardInputRef.current = "";

    toast.loading("Sending...", { id: "send" });

    try {
      if (user && !isPublicAccess)
        await appendMessage(user.uid, modelKey, userMsg);

      if (!selectedModel.url) {
        const errorMsg = { role: "assistant", content: "Model unavailable." };
        setMessages([...updatedMessages, errorMsg]);
        if (user && !isPublicAccess)
          await appendMessage(user.uid, modelKey, errorMsg);
        toast.dismiss("send");
        setSending(false);
        return;
      }

      const requestOptions = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      };

      const requestFormats = [
        {
          inputs: trimmed,
          parameters: { max_new_tokens: 500, temperature: 0.7 },
        },
        { query: trimmed, max_new_tokens: 500, temperature: 0.7 },
        { input: trimmed, max_length: 500, temperature: 0.7 },
      ];

      let reply = "";
      let lastError = null;

      for (let i = 0; i < requestFormats.length; i++) {
        try {
          requestOptions.body = JSON.stringify(requestFormats[i]);
          const res = await fetch(selectedModel.url, requestOptions);

          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          const raw = await res.text();
          reply = formatAIResponse(raw);

          if (reply && reply !== "{}") break;
        } catch (err) {
          lastError = err;
        }
      }

      if (!reply && lastError) throw lastError;
      if (!reply) throw new Error("No response");

      reply = reply.trim();
      const aiMsg = { role: "assistant", content: reply };
      setMessages([...updatedMessages, aiMsg]);

      if (user && !isPublicAccess)
        await appendMessage(user.uid, modelKey, aiMsg);

      toast.success("Reply received", { id: "send" });
    } catch (err) {
      const errorMsg = {
        role: "assistant",
        content: `**Error:** ${err.message}`,
      };
      setMessages([...messages, userMsg, errorMsg]);
      toast.error("Send failed", { id: "send" });
    }

    setSending(false);
  }

  async function handleNewChat() {
    if (user && !isPublicAccess) await setConversation(user.uid, modelKey, []);
    setMessages([]);
    // ✅ reset share state too (added)
    setShareId(null);
    setShareOpen(false);
  }

  function handleSignOut() {
    signOut(auth).then(() => router.push("/login"));
  }

  // NEW: Handle sign in redirect
  function handleSignIn() {
    router.push("/login");
  }

  // ✅ Generate QR (added)
  async function handleGenerateQR() {
    try {
      if (!messages || messages.length === 0) {
        toast.error("No conversation to share yet.");
        return;
      }

      toast.loading("Generating QR...", { id: "share" });

      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelKey,
          createdAt: Date.now(),
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data?.id) throw new Error("No share id returned.");

      setShareId(data.id);
      setShareOpen(true);

      toast.success("QR ready!", { id: "share" });
    } catch (e) {
      toast.error(`Failed: ${e.message}`, { id: "share" });
    }
  }

  if (loading)
    return (
      <div className="h-screen flex items-center justify-center text-xl">
        Loading…
      </div>
    );

  const headerHeight = 48;
  const footerHeight = 32;
  const sidebarWidth = 224;
  const keyboardHeight = 280;
  const inputBarHeight = 60;
  const keyboardPadding = 4; // REDUCED FROM 8 TO 4

  const shareUrl =
    shareId && typeof window !== "undefined"
      ? `${window.location.origin}/share/${shareId}`
      : "";

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url('/bg.png')" }}
    >
      <div className="absolute inset-0 bg-[rgba(245,245,245,0.18)] backdrop-blur-sm" />

      {/* HEADER */}
      <header
        className="fixed top-0 left-0 right-0 z-50 bg-black/30 text-white py-1.5 px-4 flex justify-between items-center shadow-sm"
        style={{ height: `${headerHeight}px` }}
      >
        <div className="flex items-center gap-2">
          <img src="/tuplogo.png" alt="TUP Logo" className="h-7 w-7" />
          <h1 className="text-xs md:text-sm font-bold">
            TECHNOLOGICAL UNIVERSITY OF THE PHILIPPINES
          </h1>
        </div>

        {/* Sign In/Out stays in header (unchanged) */}
        <button
          onClick={user ? handleSignOut : handleSignIn}
          className="bg-[#faa029] text-black font-semibold px-5 py-2 rounded-full shadow"
        >
          {user ? "Sign Out" : "Sign In"}
        </button>
      </header>

      {/* FOOTER */}
      <footer
        className="fixed bottom-0 left-0 right-0 z-50 bg-black/30 text-center py-1 text-white text-xs"
        style={{ height: `${footerHeight}px` }}
      >
        Designed by: Electronics Engineering Department
      </footer>

      {/* SEPARATE KEYBOARD CONTAINER - ADJUSTED POSITION */}
      {showKeyboard && (
        <div
          className="fixed left-0 right-0 bg-white shadow-2xl border-t border-gray-300"
          style={{
            bottom: `${footerHeight + 4}px`,
            left: sidebarOpen ? `${sidebarWidth}px` : "0px",
            height: `${keyboardHeight}px`,
            zIndex: 55,
          }}
        >
          
          <div className="flex justify-end p-1 bg-gray-100">
  <button
    type="button"
    onMouseDown={(e) => {
      // PREVENT input blur from firing
      e.preventDefault();
    }}
    onClick={(e) => {
      e.stopPropagation();

      // 1️⃣ Clear React state
      setInput("");

      // 2️⃣ Clear refs
      keyboardInputRef.current = "";
      caretPositionRef.current = 0;

      // 3️⃣ Clear keyboard internal value
      if (keyboardRef.current) {
        keyboardRef.current.setInput("");
        keyboardRef.current.setCaretPosition(0);
      }

      // 4️⃣ Restore focus safely
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange(0, 0);
        }
      });
    }}
    className="text-red-600 hover:text-red-800 font-semibold px-3 py-1 rounded text-xs"
  >
    Clear All
  </button>
</div>

          <Keyboard
          keyboardRef={(r) => {
            keyboardRef.current = r;
          }}
          layoutName={shiftActive ? "shift" : "default"}
          layout={layout.qwerty}
          onKeyPress={(button) => {
            let currentText = input;
            let caretPos = caretPositionRef.current;
            
            const updateText = (newText, newCaretPos) => {
            setInput(newText);
            keyboardInputRef.current = newText;
            caretPositionRef.current = newCaretPos;
            
            requestAnimationFrame(() => {
              if (inputRef.current) {
                inputRef.current.focus();
                inputRef.current.setSelectionRange(newCaretPos, newCaretPos)
              }
            });
          };
          
          // ===== SHIFT =====
          // 
          if (button === "{shift}" || button === "{lock}") {
            const newShiftState = !shiftActive;
            setShiftActive(newShiftState);
            
            keyboardRef.current?.setOptions({
              layoutName: newShiftState ? "shift" : "default",
            });
            return;
          }
          // ===== ENTER =====
          // 
          if (button === "{enter}") {
            handleSend({ preventDefault: () => {} });
            return;
          }
          
          // ===== BACKSPACE =====
          // 
          if (button === "{backspace}") {
            if (caretPos > 0) {
              const newText =
              currentText.slice(0, caretPos - 1) +
              currentText.slice(caretPos);
              
              updateText(newText, caretPos - 1);
            }
            return;
          }
          
          // ===== SPACE =====
          // 
          if (button === "{space}") {
            const newText =
            currentText.slice(0, caretPos) +
            " " +
            currentText.slice(caretPos);
            
            updateText(newText, caretPos + 1);
            return;
          }
          
          // ===== SPECIAL TOKENS FROM YOUR LAYOUT =====
          // 
          const specialTokens = {
            "{@}": "@",
            "{%}": "%",
            "{?}": "?",
            "{,}": ",",
            "{.}": ".",
          };
          if (specialTokens[button]) {
            const char = specialTokens[button];
            
            const newText =
            currentText.slice(0, caretPos) +
            char +
            currentText.slice(caretPos);
            
            updateText(newText, caretPos + 1);
            return;
          }

    // ===== Ignore unknown control buttons =====
    if (button.startsWith("{") && button.endsWith("}")) {
      return;
    }

    // ===== Normal characters (letters & numbers) =====
    const newText =
      currentText.slice(0, caretPos) +
      button +
      currentText.slice(caretPos);

    updateText(newText, caretPos + button.length);
  }}
  theme="hg-theme-default hg-theme-custom"
  display={{
    "{backspace}": "⌫",
    "{enter}": "↵",
    "{shift}": "⇧",
    "{space}": "Space",
    "{@}": "@",
    "{%}": "%",
    "{?}": "?",
    "{,}": ",",
    "{.}": ".",
    "{#}": "#"
  }}
  preventMouseDownDefault={true}
  preventMouseUpDefault={true}
  newLineOnEnter={false}
  autoUseTouchEvents={true}
/>

          {/* your existing keyboard styles remain unchanged */}
          <style jsx global>{`
            .simple-keyboard {
              background: white !important;
              padding: 10px !important;
              height: calc(100% - 30px) !important;
              width: 100% !important;
              box-sizing: border-box !important;
            }
            .hg-theme-custom {
              background-color: white !important;
              height: 100% !important;
              display: flex !important;
              flex-direction: column !important;
            }
            .hg-button {
              height: 45px !important;
              border-radius: 6px !important;
              font-weight: 500 !important;
              font-size: 14px !important;
              box-shadow: 0 2px 3px rgba(0, 0, 0, 0.15) !important;
              margin: 3px !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              transition: all 0.1s ease !important;
              min-width: 0 !important;
              flex: 1 !important;
            }
            .hg-row:nth-child(1) .hg-button {
              background: #f8f9fa !important;
              color: #333 !important;
              border: 1px solid #ddd !important;
            }
            .hg-row:nth-child(2)
              .hg-button:not(.hg-button-backspace):not(.hg-button-enter),
            .hg-row:nth-child(3) .hg-button:not(.hg-button-enter),
            .hg-row:nth-child(4) .hg-button:not(.hg-button-shift) {
              background: #aa3636 !important;
              color: white !important;
              border: 1px solid #8a2c2c !important;
            }
            .hg-row:nth-child(5) .hg-button {
              background: #faa029 !important;
              color: black !important;
              border: 1px solid #d88c20 !important;
              font-weight: bold !important;
            }
            .hg-button-shift,
            .hg-button-backspace,
            .hg-button-enter {
              background: #faa029 !important;
              color: black !important;
              border: 1px solid #d88c20 !important;
              font-weight: bold !important;
            }
            .hg-button-space {
              flex-grow: 3 !important;
              max-width: none !important;
            }
            .hg-button-backspace,
            .hg-button-enter,
            .hg-button-shift {
              min-width: 70px !important;
              flex-grow: 0.5 !important;
            }
            .hg-button-\\{@\\},
            .hg-button-\\{%\\},
            .hg-button-\\{\\?\\},
            .hg-button-\\{\\,\\},
            .hg-button-\\{\\.\\} {
              min-width: 35px !important;
              flex-grow: 0.3 !important;
            }
            .hg-button:active,
            .hg-button.hg-activeBtn {
              transform: translateY(2px) !important;
              box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1) !important;
            }
            .hg-row:nth-child(2)
              .hg-button:active:not(.hg-button-backspace):not(.hg-button-enter),
            .hg-row:nth-child(3) .hg-button:active:not(.hg-button-enter),
            .hg-row:nth-child(4) .hg-button:active:not(.hg-button-shift) {
              background: #8a2c2c !important;
            }
            .hg-button-shift:active,
            .hg-button-backspace:active,
            .hg-button-enter:active,
            .hg-row:nth-child(5) .hg-button:active,
            .hg-button-shift.hg-activeBtn {
              background: #d88c20 !important;
            }
            .hg-rows {
              height: 100% !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
              padding: 0 8px !important;
            }
            .hg-row {
              display: flex !important;
              justify-content: center !important;
              flex: 1 !important;
              min-height: 48px !important;
              margin-bottom: 5px !important;
            }
            .hg-button-standard {
              min-width: 35px !important;
              flex: 1 !important;
              max-width: 50px !important;
            }
            .hg-row:last-child {
              margin-bottom: 0 !important;
            }
            .hg-button-backspace {
              font-size: 16px !important;
            }
            .hg-button-enter {
              font-size: 16px !important;
            }
            .simple-keyboard.hg-layout-default .hg-row {
              flex-wrap: nowrap !important;
            }
            .hg-button span {
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
          `}</style>
        </div>
      )}

      {/* MAIN */}
      <div className="flex h-full relative z-10">
        {/* SIDEBAR */}
        <div
          className="fixed bg-[#aa3636] text-white shadow-xl flex flex-col px-4 py-3 transition-transform duration-300"
          style={{
            top: headerHeight,
            bottom: footerHeight,
            width: sidebarWidth,
            transform: sidebarOpen ? "translateX(0)" : `translateX(-100%)`,
            zIndex: 60,
          }}
        >
          {/* BACK BUTTON */}
          <button
            onClick={() => router.push(user ? "/models" : "/")}
            className="flex items-center gap-1 text-[#faa029] transition mb-3"
          >
            <span className="text-xl">←</span>
            <span className="text-sm font-semibold">
              {user ? "Back to Menu" : "Back to Home"}
            </span>
          </button>

          {/* "+ NEW CHAT" */}
          <button
            onClick={handleNewChat}
            className="w-full bg-white text-[#aa3636] font-bold py-1 rounded-full shadow mb-6 text-sm"
            style={{ marginTop: "-4px" }}
          >
            + New Chat
          </button>

          <p className="text-sm opacity-80 mb-3">Recents</p>
          <div className="h-[1px] bg-white/40 mb-4"></div>

          {/* USER INFO */}
          <div className="mt-auto flex items-center gap-3 border-t border-white/30 pt-4">
            <div className="h-10 w-10 bg-white/20 rounded-full flex items-center justify-center">
              <img src="/tupi-logo.png" className="h-8 w-8 rounded-full" />
            </div>
            <div>
              <p className="text-sm font-bold">{realName}</p>
              <p className="text-xs opacity-80">
                {user ? "Logged In" : "Guest Mode"}
              </p>
            </div>
          </div>
        </div>

        {/* SIDEBAR TOGGLE */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="fixed bg-[#aa3636] text-white px-2 py-3 rounded-r-full shadow transition-all duration-300"
          style={{
            top: `calc(${headerHeight}px + 30%)`,
            left: sidebarOpen ? `${sidebarWidth}px` : "0px",
            transform: "translateY(-50%)",
            zIndex: 70,
          }}
        >
          {sidebarOpen ? "◀" : "▶"}
        </button>

        {/* CHAT AREA */}
        <div
          className={`flex-1 relative transition-all duration-300 ${
            sidebarOpen ? `ml-[224px]` : "ml-0"
          }`}
          style={{
            marginTop: `${headerHeight}px`,
            marginBottom: showKeyboard
              ? `${footerHeight + keyboardHeight + keyboardPadding + inputBarHeight + 4}px`
              : `${footerHeight}px`,
            transition: "margin-bottom 0.3s ease-in-out",
          }}
        >
          {/* ✅ Generate QR button inside chat area (added) */}
          <div className="absolute top-3 right-6 z-40">
            <button
              onClick={handleGenerateQR}
              disabled={messages.length === 0}
              className={`px-4 py-2 rounded-full shadow font-semibold text-xs ${
                messages.length === 0
                  ? "bg-white/50 text-gray-700"
                  : "bg-white/90 text-black"
              }`}
              title={
                messages.length === 0
                  ? "Start a conversation first"
                  : "Generate QR for this conversation"
              }
            >
              Generate QR
            </button>
          </div>

          {/* MESSAGES */}
          <div
            className="absolute inset-0 px-6 overflow-y-auto flex flex-col"
            style={{
              paddingTop: "15px",
              paddingBottom: showKeyboard
                ? `${inputBarHeight + keyboardPadding + keyboardHeight}px`
                : `${inputBarHeight}px`,
            }}
          >
            {messages.length === 0 ? (
              <div className="flex-1 flex justify-center items-center text-center text-sm font-bold text-[#aa3636]">
                Hello, {nickname}!
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`mb-4 w-full ${
                    msg.role === "user" ? "text-right" : "text-left"
                  }`}
                >
                  <div
                    className={`inline-block px-4 py-3 rounded-2xl shadow-lg text-sm max-w-[85%] ${
                      msg.role === "user"
                        ? "bg-[#aa3636] text-white"
                        : "bg-white text-black border border-gray-200"
                    }`}
                    style={{
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      overflowWrap: "break-word",
                    }}
                  >
                    {msg.role === "user" ? (
                      <div className="whitespace-pre-wrap break-words">
                        {msg.content}
                      </div>
                    ) : (
                      <SimpleMarkdownRenderer text={msg.content} />
                    )}
                  </div>
                </div>
              ))
            )}

            <div ref={endRef} />
          </div>

          {/* ✅ QR MODAL (added) */}
          {shareOpen && shareId && (
            <div className="fixed inset-0 z-[90] flex items-center justify-center">
              <div
                className="absolute inset-0 bg-black/50"
                onClick={() => setShareOpen(false)}
              />
              <div className="relative bg-white rounded-2xl shadow-2xl border p-5 w-[320px] max-w-[90vw]">
                <p className="text-sm font-bold text-center mb-1">
                  Scan to view on phone
                </p>
                <p className="text-xs text-gray-600 text-center mb-3">
                  This opens a document-style page that can be saved as PDF.
                </p>

                <div className="flex justify-center">
                  <QRCodeCanvas value={shareUrl} size={220} includeMargin={true} />
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    className="flex-1 bg-[#aa3636] text-white text-xs font-semibold py-2 rounded-xl"
                    onClick={() => {
                      if (!shareUrl) return;
                      navigator.clipboard?.writeText(shareUrl);
                      toast.success("Link copied!");
                    }}
                  >
                    Copy Link
                  </button>

                  <button
                    className="flex-1 bg-gray-200 text-xs font-semibold py-2 rounded-xl"
                    onClick={() => setShareOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* INPUT BAR */}
          <form
            ref={inputBarRef}
            onSubmit={handleSend}
            className={`fixed left-0 z-50 flex items-center justify-center gap-3 transition-all duration-300 ${
              sidebarOpen
                ? "ml-[224px] w-[calc(100%-14rem)] px-6"
                : "ml-0 w-full px-6"
            }`}
            style={{
              bottom: showKeyboard
                ? `${footerHeight + keyboardHeight + keyboardPadding + 4}px`
                : `${footerHeight + 8}px`,
              transition: "bottom 0.3s ease-in-out",
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => {
                const value = e.target.value;
                 const caret = e.target.selectionStart;
                 
                 setInput(value);
                 keyboardInputRef.current = value;
                 caretPositionRef.current = caret;
                 
                 if (keyboardRef.current) {
                  keyboardRef.current.setInput(value);
                  keyboardRef.current.setCaretPosition(caret);
              }
            }}
            onClick={(e) => {
              const caret = e.target.selectionStart;
              caretPositionRef.current = caret;
              keyboardRef.current?.setCaretPosition(caret);
            }}
            onKeyUp={(e) => {
              const caret = e.target.selectionStart;
              caretPositionRef.current = caret;
              keyboardRef.current?.setCaretPosition(caret);
            }}
              onFocus={() => {
                setShowKeyboard(true);
                if (chatContainerRef.current) {
                  lastScrollTopRef.current = chatContainerRef.current.scrollTop;
                }
              }}
              onBlur={(e) => {
                const isKeyboardClick = e.relatedTarget?.closest(".simple-keyboard");
                const isInputClick = e.relatedTarget?.closest(
                  'input[placeholder*="Ask"]'
                );
                const isSidebarClick = e.relatedTarget?.closest(
                  ".fixed.bg-\\[\\#aa3636\\]"
                );
                const isSidebarToggleClick = e.relatedTarget?.closest(
                  "button.fixed.bg-\\[\\#aa3636\\]"
                );

                if (
                  !isKeyboardClick &&
                  !isInputClick &&
                  !isSidebarClick &&
                  !isSidebarToggleClick
                ) {
                  setTimeout(() => {
                    setShowKeyboard(false);
                  }, 100);
                }
              }}
              placeholder={`Ask ${modelKey.toUpperCase()}...`}
              className="w-full py-3 px-5 rounded-full bg-white/95 outline-none border border-gray-300 shadow-sm text-sm focus:border-[#aa3636] focus:ring-1 focus:ring-[#aa3636] transition"
              disabled={sending}
            />

            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="bg-[#aa3636] text-white px-5 py-3 rounded-full text-sm shadow"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
