import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();

  const handlePublicModelClick = (model) => {
    router.push(`/chat?model=${model}&public=true`);
  };

  return (
    <div className="relative w-full font-poppins">

      {/* MAIN CENTERED CONTENT */}
      <main
        className="
          relative z-20
          flex flex-col items-center justify-start
          w-full
          min-h-screen
          text-center
          px-8
          pt-20 pb-20
          overflow-auto
        "
      >
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

          <button
            onClick={() => router.push("/login")}
            className="bg-[#faa029] text-black font-semibold px-5 py-2 rounded-full shadow"
          >
            Sign In
          </button>
        </header>

        {/* HEADLINE */}
        <h2 className="text-xl md:text-3xl font-bold drop-shadow mb-4">
          From Campus Corners to ECE Queries —{" "}
          <span className="text-[#aa3636]">UniQwery</span> Knows It All.
        </h2>

        {/* CONTENT ROW */}
        <div className="flex flex-col md:flex-row justify-center items-center gap-8 mt-2">

          {/* LEFT SIDE */}
          <div className="flex flex-col items-center">
            <img
              src="/tupi-logo.png"
              alt="TUPi Logo"
              className="h-36 md:h-40 drop-shadow-xl"
            />
            <p className="text-xl font-bold mt-2">
              Uni<span className="text-[#aa3636]">Qwery</span>
            </p>
          </div>

          {/* RIGHT SIDE */}
          <div className="bg-white border-2 border-gray-300 rounded-2xl p-5 md:p-6 shadow-xl max-w-md">
            <p className="text-black text-base md:text-lg leading-relaxed">
              Lost on campus or stuck with ECE queries?{" "}
              <span className="text-[#aa3636] font-bold">UniQwery</span> is here
              to power up your day with fast, smart, and electrifyingly 
              accurate answers—sparking knowledge and guidance anytime 
              you need it!
            </p>
          </div>

        </div>

        {/* BUTTONS */}
        <div className="flex justify-center gap-6 mt-8 flex-wrap">
          <button
            onClick={() => handlePublicModelClick("nav")}
            className="bg-[#aa3636] text-white font-bold text-lg px-10 py-5 rounded-3xl shadow-xl"
          >
            Campus <br /> Navigation
          </button>

          <button
            onClick={() => handlePublicModelClick("info")}
            className="bg-[#aa3636] text-white font-bold text-lg px-10 py-5 rounded-3xl shadow-xl"
          >
            General <br /> Information
          </button>

          <button
            onClick={() => handlePublicModelClick("ece")}
            className="bg-[#aa3636] text-white font-bold text-lg px-10 py-5 rounded-3xl shadow-xl"
          >
            ECE <br /> Queries
          </button>

        </div>
      </main>

      {/* FOOTER */}
      <footer className="fixed bottom-0 w-full text-center py-1.5 text-white bg-black/30 text-xs z-40">
        Designed by: Electronics Engineering Department
      </footer>
    </div>
  );
}
