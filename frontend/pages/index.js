import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { useRef } from "react";

// Swap to our optimized Flipbook component
const FlipbookAvatar = dynamic(() => import("../components/FlipbookAvatar"), { ssr: false });

export default function Home() {
  const router = useRouter();
  const avatarRef = useRef();

  const handlePublicModelClick = (model) => {
    // ✅ SWITCHED: Routes to character.js first instead of chat.js
    router.push(`/character?model=${model}&public=true`);
  };

  const handleGestureClick = (gestureName) => {
    if (avatarRef.current && typeof avatarRef.current.switchGesture === "function") {
      avatarRef.current.switchGesture(gestureName);
    }
  };

  // Matched exactly to the keys in FlipbookAvatar.js
  const availableAnimations = [
    { name: "Idle State", value: "Idle" },
    { name: "Chicken Dance", value: "ChickenDance" },
    { name: "Look Around", value: "LookAround" },
    { name: "Look Around Alternative", value: "LookAround1" },
    { name: "Macarena", value: "MacarenaDance" },
    { name: "Replay Entrance", value: "Entrance" },
  ];

  return (
    <div className="relative w-full font-poppins h-screen overflow-hidden">

      {/* BACKGROUND */}
      <div
        className="absolute inset-0 bg-cover bg-center -z-10"
        style={{ backgroundImage: "url('/bg.png')" }}
      />
      <div className="absolute inset-0 bg-[rgba(245,245,245,0.18)] backdrop-blur-sm -z-10" />

      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/30 text-white py-1.5 px-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <img src="/tuplogo.png" alt="TUP Logo" className="h-7 w-7" />
          <h1 className="text-xs md:text-sm font-bold">
            TECHNOLOGICAL UNIVERSITY OF THE PHILIPPINES
          </h1>
        </div>
      </header>

      {/* MAIN */}
      <main className="relative z-20 flex flex-col justify-start items-center h-full pt-[70px] px-2 md:px-6">

        <h2 className="text-xl md:text-3xl font-bold drop-shadow mb-6 text-center w-full">
          From Campus Corners to ECE Queries —{" "}
          <span className="text-[#aa3636]">UniQwery</span> Knows It All.
        </h2>

        <div className="flex flex-col md:flex-row justify-center items-stretch w-full h-[calc(100%-140px)] gap-4 md:gap-8">

          {/* LEFT COLUMN */}
          <div className="flex flex-col w-full md:w-1/2 h-[calc(100%-60px)] justify-between pb-6 pt-4">

            {/* AVATAR CONTAINER */}
            <div className="w-full flex-1 flex justify-center items-end min-h-0">
              <div className="w-full h-full max-h-[850px] max-w-[850px] flex justify-center items-end">
                <FlipbookAvatar customAvatarRef={avatarRef} />
              </div>
            </div>

            {/* DROPDOWN CONTAINER */}
            <div className="absolute bottom-16 left-4 md:left-8 z-20">
              <select
                onChange={(e) => handleGestureClick(e.target.value)}
                className="bg-[#faa029] text-black font-bold px-3 py-2 rounded-lg shadow-md text-sm w-[180px] outline-none"
              >
                {availableAnimations.map((anim) => (
                  <option key={anim.value} value={anim.value}>
                    {anim.name}
                  </option>
                ))}
              </select>
            </div>

          </div>

          {/* RIGHT COLUMN */}
          <div className="flex flex-col justify-center items-center w-full md:w-2/5 h-full gap-6">

            <div className="bg-white border-2 border-gray-300 rounded-2xl shadow-xl w-full h-2/5 flex justify-center items-center p-4 md:p-6">
              <p className="text-black text-base md:text-xl leading-relaxed text-center">
                Lost on campus or stuck with ECE queries?{" "}
                <span className="text-[#aa3636] font-bold">UniQwery</span> is here
                to power up your day with fast, smart, and accurate answers!
              </p>
            </div>

            <div className="flex justify-center items-center gap-4 w-full">

              <button
                onClick={() => handlePublicModelClick("nav")}
                className="bg-[#aa3636] text-white font-bold text-lg px-6 md:px-10 py-3 md:py-4 rounded-3xl shadow-xl flex-1 max-w-[150px] flex flex-col justify-center items-center text-center"
              >
                Campus <br /> Navigation
              </button>

              <button
                onClick={() => handlePublicModelClick("info")}
                className="bg-[#aa3636] text-white font-bold text-lg px-6 md:px-10 py-3 md:py-4 rounded-3xl shadow-xl flex-1 max-w-[150px] flex flex-col justify-center items-center text-center"
              >
                General <br /> Information
              </button>

              <button
                onClick={() => handlePublicModelClick("ece")}
                className="bg-[#aa3636] text-white font-bold text-lg px-6 md:px-10 py-3 md:py-4 rounded-3xl shadow-xl flex-1 max-w-[150px] flex flex-col justify-center items-center text-center"
              >
                ECE <br /> Queries
              </button>

            </div>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="fixed bottom-0 w-full text-center py-1.5 text-white bg-black/30 text-xs z-40">
        Designed by: Electronics Engineering Department
      </footer>

    </div>
  );
}