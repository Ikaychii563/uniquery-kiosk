"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useRouter } from "next/router";
import { auth } from "../firebase/clientApp";
import { onAuthStateChanged } from "firebase/auth";
import toast from "react-hot-toast";
import {
  getUserProfile,
  createThread,
  getRecentThreads,
  getThreadMessages,
  appendThreadMessage,
  keepOnlyLastNThreads,
  touchThread,
  deleteThread,
} from "../lib/firestoreHelpers";

// IMPORT VIRTUAL KEYBOARD
import Keyboard from "react-simple-keyboard";
import "react-simple-keyboard/build/css/index.css";

const layout = {
  qwerty: {
    default: [
      "0 1 2 3 4 5 6 7 8 9",
      "q w e r t y u i o p {backspace}",
      "a s d f g h j k l {enter}",
      "{shift} z x c v b n m {shift}",
      "{@} {%} {?} {space} {,} {.}",
    ],
    shift: [
      "0 1 2 3 4 5 6 7 8 9",
      "Q W E R T Y U I O P {backspace}",
      "A S D F G H J K L {enter}",
      "{shift} Z X C V B N M {shift}",
      "{@} {%} {?} {space} {,} {.}",
    ],
  },
};

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
        parts.push(<span key={`${index}-${lastIndex}`}>{content.substring(lastIndex, match.index)}</span>);
      }
      parts.push(<strong key={`${index}-bold-${match.index}`}>{match[1]}</strong>);
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < content.length) {
      parts.push(<span key={`${index}-remaining`}>{content.substring(lastIndex)}</span>);
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
      cleaned = json.generated_text || json.response || json.answer || json.output || json.text || json.message || JSON.stringify(json);
    } catch {}
  }
  return cleaned.replace(/^"|"$/g, "").replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\t/g, "  ");
}

export default function CharacterPage() {
  const router = useRouter();
  const { model, public: isPublic, threadId: urlThreadId } = router.query;

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
  const [recentThreads, setRecentThreads] = useState([]);
  const [threadId, setThreadId] = useState(null);
  const [thinking, setThinking] = useState(false);
  const [guestThreads, setGuestThreads] = useState([]);
  const [guestThreadId, setGuestThreadId] = useState(null);

  const [showKeyboard, setShowKeyboard] = useState(false);
  const keyboardRef = useRef(null);
  const chatContainerRef = useRef(null);
  const inputBarRef = useRef(null);
  const inputRef = useRef(null);
  const keyboardInputRef = useRef("");
  const caretPositionRef = useRef(0);
  const lastScrollTopRef = useRef(0);
  const keyboardScrollThreshold = 20;
  const [shareId, setShareId] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);

  // ==========================================
  // ANIMATION LOGIC (UNTOUCHED)
  // ==========================================
  const [avatarState, setAvatarState] = useState("idle"); 
  const [frameIndex, setFrameIndex] = useState(1);
  const [hasWaved, setHasWaved] = useState(false);

  const ANIMATIONS = {
    angry: 460, idle: 420, shrugging: 50, talking: 200,
    thinking: 160, thinking_1: 160, thoughtfulnod: 160, waving: 100
  };

  useEffect(() => {
    if (!loading && !hasWaved) {
      setAvatarState("waving");
      setFrameIndex(1);
      setHasWaved(true);
      const waveDuration = (100 / 24) * 1000;
      setTimeout(() => setAvatarState("idle"), waveDuration);
    }
  }, [loading, hasWaved]);

  useEffect(() => {
    const maxFrames = ANIMATIONS[avatarState] || 420;
    const timer = setInterval(() => {
      setFrameIndex((prev) => (prev >= maxFrames ? 1 : prev + 1));
    }, 42); 
    return () => clearInterval(timer);
  }, [avatarState]);

  useEffect(() => {
    if (thinking) {
      const thinkPool = ["thinking", "thinking_1", "thoughtfulnod"];
      const randomThink = thinkPool[Math.floor(Math.random() * thinkPool.length)];
      setAvatarState(randomThink);
      setFrameIndex(1);
    } else if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      const text = lastMsg.content;

      if (lastMsg.role === "assistant") {
        if (text.includes("⚠️ No response after 1 minute")) {
          setAvatarState("angry");
          setFrameIndex(1);
        } else if (text.toLowerCase().includes("sorry") || text.toLowerCase().includes("forgive")) {
          setAvatarState("shrugging");
          setFrameIndex(1);
          setTimeout(() => setAvatarState("idle"), 3000);
        } else {
          setAvatarState("talking");
          setFrameIndex(1);
          const talkDuration = (200 / 24) * 1000;
          const revert = setTimeout(() => setAvatarState("idle"), talkDuration); 
          return () => clearTimeout(revert);
        }
      }
    } else {
      if (hasWaved && avatarState !== "waving") setAvatarState("idle");
    }
  }, [thinking, messages]);

  /* AUTH & RECOVERY */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (isPublicAccess && !u) {
        setUser(null); setNickname("Guest"); setRealName("Guest");
        const raw = localStorage.getItem(`guest_threads_${modelKey}`);
        const threads = raw ? JSON.parse(raw) : [];
        setGuestThreads(threads);
        if (urlThreadId) {
          setGuestThreadId(urlThreadId);
          const found = threads.find(t => t.id === urlThreadId);
          if (found) setMessages(found.messages || []);
        }
        setLoading(false); return;
      }
      if (!isPublicAccess && !u) { router.replace("/login"); return; }
      setUser(u);
      try {
        if (u) {
          const profile = await getUserProfile(u.uid);
          setRealName(profile?.name || u.displayName || "User");
          const recents = await getRecentThreads(u.uid, modelKey, 3);
          setRecentThreads(recents);
          if (urlThreadId) {
            setThreadId(urlThreadId);
            const msgs = await getThreadMessages(u.uid, modelKey, urlThreadId);
            setMessages(msgs.map((m) => ({ role: m.role, content: m.content })));
          }
        }
      } catch {}
      setLoading(false);
    });
    return () => unsub();
  }, [router, modelKey, isPublicAccess, urlThreadId]);


  const handleScroll = useCallback(() => {
  if (!showKeyboard) return;

  const chatContainer = chatContainerRef.current;
  if (!chatContainer) return;

  const currentScrollTop = chatContainer.scrollTop;
  const scrollDiff = Math.abs(currentScrollTop - lastScrollTopRef.current);

  if (scrollDiff > keyboardScrollThreshold) {
    setShowKeyboard(false);
    inputRef.current?.blur();
  }

  lastScrollTopRef.current = currentScrollTop;
}, [showKeyboard]);

useEffect(() => {
  const chatContainer = chatContainerRef.current;
  if (!chatContainer) return;

  chatContainer.addEventListener("scroll", handleScroll);
  return () => chatContainer.removeEventListener("scroll", handleScroll);
}, [handleScroll]);

useEffect(() => {
  if (showKeyboard && chatContainerRef.current) {
    lastScrollTopRef.current = chatContainerRef.current.scrollTop;
  }
}, [showKeyboard]);

  /* SEND MESSAGE */
  async function handleSend(e) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    const userMsg = { role: "user", content: trimmed };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages); setInput(""); setSending(true); setThinking(true); setShowKeyboard(false);
    toast.loading("Sending...", { id: "send" });
    let activeId = threadId;
    if (user && !isPublicAccess && !activeId) { activeId = await createThread(user.uid, modelKey); setThreadId(activeId); }
    try {
      if (user && !isPublicAccess && activeId) await appendThreadMessage(user.uid, modelKey, activeId, userMsg);
      const res = await fetch(selectedModel.url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: trimmed, parameters: { max_new_tokens: 500, temperature: 0.7 } }),
      });
      const raw = await res.text();
      const reply = formatAIResponse(raw);
      const aiMsg = { role: "assistant", content: reply };
      setMessages([...updatedMessages, aiMsg]);
      if (user && !isPublicAccess && activeId) await appendThreadMessage(user.uid, modelKey, activeId, aiMsg);
      else if (isPublicAccess) {
        let gid = guestThreadId || Date.now().toString(); setGuestThreadId(gid);
        const nt = { id: gid, title: updatedMessages[0].content.slice(0, 30), messages: [...updatedMessages, aiMsg], updatedAt: Date.now() };
        const up = [nt, ...guestThreads.filter(t => t.id !== gid)].slice(0, 3);
        setGuestThreads(up); localStorage.setItem(`guest_threads_${modelKey}`, JSON.stringify(up));
      }
      toast.success("Reply Received", { id: "send" });
    } catch (err) {
      const errorMsg = { role: "assistant", content: "⚠️ No response after 1 minute. Please try again." };
      setMessages([...updatedMessages, errorMsg]);
      toast.error("Send failed", { id: "send" });
    }
    setThinking(false); setSending(false);
  }

  const handleDeleteRecent = async (tid) => {
    if (user && !isPublicAccess) {
      await deleteThread(user.uid, modelKey, tid);
      setRecentThreads(recentThreads.filter(t => t.id !== tid));
    } else {
      const up = guestThreads.filter(t => t.id !== tid);
      setGuestThreads(up); localStorage.setItem(`guest_threads_${modelKey}`, JSON.stringify(up));
    }
  };

  const handleToggleMode = () => {
    const aid = isPublicAccess ? guestThreadId : threadId;
    const query = new URLSearchParams({ model: modelKey, public: isPublicAccess });
    if (aid) query.append("threadId", aid);
    router.push(`/chat?${query.toString()}`);
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-xl">Loading…</div>;

  const headerHeight = 48;
  const footerHeight = 32;
  const sidebarWidth = 224;
  const keyboardHeight = 280;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-cover bg-center" style={{ backgroundImage: "url('/bg.png')" }}>
      <div className="absolute inset-0 bg-[rgba(245,245,245,0.18)] backdrop-blur-sm" />

      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/30 text-white py-1.5 px-4 flex justify-between items-center shadow-sm" style={{ height: `${headerHeight}px` }}>
        <div className="flex items-center gap-2">
          <img src="/tuplogo.png" alt="TUP Logo" className="h-7 w-7" />
          <h1 className="text-xs md:text-sm font-bold">TECHNOLOGICAL UNIVERSITY OF THE PHILIPPINES</h1>
        </div>
      </header>

      {/* FOOTER */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 bg-black/30 text-center py-1 text-white text-xs" style={{ height: `${footerHeight}px` }}>
        Designed by: Electronics Engineering Department
      </footer>

      {/* ✅ CHARACTER LAYER - FIXED POSITION (Does not move sidewards) */}
      <div className="fixed inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
        <div className="relative h-full w-full flex items-end justify-center">
          <img 
            src={`/assets/AnimeModel_animation/${avatarState}/frame_${frameIndex.toString().padStart(3, '0')}.webp`} 
            alt="Character"
            className="h-full w-auto object-contain drop-shadow-2xl"
          />
        </div>
      </div>

      {/* UI LAYER */}
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
            onClick={() => {
              setMessages([]);
              setThreadId(null);
              setGuestThreadId(null);
            }}
            className="w-full bg-white text-[#aa3636] font-bold py-1 rounded-full shadow mb-6 text-sm"
            style={{ marginTop: "-4px" }}
          >
            + New Chat
          </button>

          <p className="text-sm opacity-80 mb-3">Recents</p>
          <div className="h-[1px] bg-white/40 mb-4"></div>

          <div className="flex flex-col gap-2 overflow-y-auto">
            {(user && !isPublicAccess ? recentThreads : guestThreads).map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between bg-white/10 hover:bg-white/20 px-2 py-2 rounded"
              >
                {/* THREAD BUTTON */}
                <button
                  className="text-left text-xs flex-1 truncate"
                  onClick={async () => {
                    if (user && !isPublicAccess) {
                      setThreadId(t.id);
                      const msgs = await getThreadMessages(user.uid, modelKey, t.id);
                      setMessages(msgs.map((m) => ({ role: m.role, content: m.content })));
                    } else {
                      setGuestThreadId(t.id);
                      setMessages(t.messages || []);
                    }
                  }}
                >
                  {t.title || "Chat"}
                </button>

                {/* ❌ DELETE BUTTON */}
                <button
                  onClick={() => handleDeleteRecent(t.id)}
                  className="text-red-300 hover:text-red-500 text-xs px-2"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

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

{/* INTERACTIVE AREA (Chatbox shortens when Sidebar is open) */}
        <div
          className={`flex-1 relative transition-all duration-300 flex flex-col ${
            sidebarOpen ? `ml-[224px]` : "ml-0"
          }`}
          style={{
            marginTop: `${headerHeight}px`,
            // ✅ Ported from reference: Container shifts up for the keyboard
            marginBottom: showKeyboard
              ? `${footerHeight + keyboardHeight}px` 
              : `${footerHeight}px`,
            transition: "margin-bottom 0.3s ease-in-out",
          }}
        >
          
          <div className="px-6 pt-3 flex justify-end gap-2 relative z-20">
            <button onClick={handleToggleMode} className="px-4 py-2 rounded-full shadow font-semibold text-xs bg-[#faa029] text-black hover:bg-[#d88c20] transition">💬 Chat Mode</button>
            <button 
              onClick={() => setShareOpen(true)} 
              disabled={messages.length === 0}
              className={`px-4 py-2 rounded-full shadow font-semibold text-xs transition ${
                messages.length === 0
                ? "bg-white/50 text-gray-700 cursor-not-allowed"
                : "bg-white/90 text-black hover:bg-white"
              }`}
            >
              Generate QR
            </button>
          </div>

          {/* BUBBLES AREA */}
          <div
          ref={chatContainerRef}
          className="flex-1 relative px-6 overflow-hidden pointer-events-none z-10">
            {/* 🔴 USER BUBBLE - RED/WHITE TEXT */}
            {(() => {
              const lastUser = [...messages].reverse().find(m => m.role === 'user');
              if (lastUser) return (
                <div className="absolute top-[55%] left-[5%] max-w-[30%] z-20 flex flex-col items-start transform -translate-y-1/2 pointer-events-auto">
                  <div className="bg-[#aa3636] text-white px-5 py-4 rounded-3xl rounded-bl-sm shadow-2xl text-sm font-medium border border-red-800">
                    {lastUser.content}
                  </div>
                  <div className="w-12 h-12 bg-black rounded-full mt-2 ml-[-10px] flex items-center justify-center text-white shadow-lg border-2 border-white">👤</div>
                </div>
              );
              return null;
            })()}

            {/* ⚪ AI BUBBLE - WHITE (Tail positioned at top-left pointing left) */}
            {(() => {
              if (thinking) return (
                <div className="absolute top-[12%] right-[6%] max-w-[55%] z-20 pointer-events-auto">
                  <div className="bg-white text-black border border-gray-100 px-8 py-5 rounded-[2rem] shadow-xl text-xl font-bold flex items-center gap-1 animate-bounce relative">
                    Thinking<span className="dot">.</span><span className="dot">.</span><span className="dot">.</span>
                    <div className="absolute top-[20px] left-[-14px] w-0 h-0 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-r-[15px] border-r-white"></div>
                  </div>
                </div>
              );
              const lastAI = [...messages].reverse().find(m => m.role === 'assistant');
              if (lastAI) return (
                <div className="absolute top-[12%] right-[6%] max-w-[55%] z-20 pointer-events-auto">
                  <div className="bg-white text-black border border-gray-100 px-8 py-6 rounded-[2rem] shadow-xl text-[15px] leading-relaxed relative">
                    <SimpleMarkdownRenderer text={lastAI.content} />
                    <div className="absolute top-[24px] left-[-14px] w-0 h-0 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-r-[15px] border-r-white"></div>
                  </div>
                </div>
              );
              return null;
            })()}
          </div>

          {/* ✅ WIDE RESPONSIVE CHATBOX */}
          <form 
            onSubmit={handleSend} 
            // ✅ Removed pb-20 and dynamic margin so it doesn't double-jump when the wrapper shifts!
            className="w-full flex items-center justify-center gap-3 px-6 pb-2 pt-2 transition-all duration-300"
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

    if (!isKeyboardClick) {
      setTimeout(() => setShowKeyboard(false), 100);
    }
  }}
  placeholder={`Message ${modelKey.toUpperCase()}...`}
  className="w-full py-3 px-5 rounded-full bg-white/95 outline-none border border-gray-300 shadow-sm text-sm focus:border-[#aa3636] focus:ring-1 focus:ring-[#aa3636] transition"
  disabled={sending}
/>
            <button type="submit" disabled={sending || !input.trim()} className="bg-[#aa3636] text-white px-5 py-3 rounded-full text-sm shadow hover:bg-red-800 transition">Send</button>
          </form>

        </div></div>

      {/* KEYBOARD - FULLY SYNCED WITH REFERENCE */}
      {showKeyboard && (
        <div
          className="fixed left-0 right-0 bg-white shadow-2xl border-t border-gray-300"
          style={{
            bottom: `${footerHeight + 4}px`,
            left: sidebarOpen ? `${sidebarWidth}px` : "0px",
            height: `${keyboardHeight}px`,
            zIndex: 100,
          }}
        >
          <div className="flex justify-end p-1 bg-gray-100">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                setInput("");
                keyboardInputRef.current = "";
                caretPositionRef.current = 0;
                if (keyboardRef.current) {
                  keyboardRef.current.setInput("");
                  keyboardRef.current.setCaretPosition(0);
                }
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
            keyboardRef={(r) => { keyboardRef.current = r; }}
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
        inputRef.current.setSelectionRange(newCaretPos, newCaretPos);
      }
    });
  };

  if (button === "{shift}" || button === "{lock}") {
    const newShiftState = !shiftActive;
    setShiftActive(newShiftState);
    keyboardRef.current?.setOptions({
      layoutName: newShiftState ? "shift" : "default",
    });
    return;
  }

  if (button === "{enter}") {
    handleSend({ preventDefault: () => {} });
    return;
  }

  if (button === "{backspace}") {
    if (caretPos > 0) {
      const newText =
        currentText.slice(0, caretPos - 1) +
        currentText.slice(caretPos);
      updateText(newText, caretPos - 1);
    }
    return;
  }

  if (button === "{space}") {
    const newText =
      currentText.slice(0, caretPos) +
      " " +
      currentText.slice(caretPos);
    updateText(newText, caretPos + 1);
    return;
  }

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

  if (button.startsWith("{") && button.endsWith("}")) return;

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
              font-size: 18px !important;
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
            .hg-button-backspace,
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
            .dot {
              display: inline-block;
              width: 6px;
              text-align: center;
              animation: dotBounce 1.1s infinite ease-in-out;
              opacity: 0.35;
            }
            .dot:nth-child(2) {
              animation-delay: 0.12s;
            }
            .dot:nth-child(3) {
              animation-delay: 0.24s;
            }
            @keyframes dotBounce {
              0%, 80%, 100% {
                transform: translateY(0);
                opacity: 0.35;
              }
              40% {
                transform: translateY(-4px);
                opacity: 1;
              }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}