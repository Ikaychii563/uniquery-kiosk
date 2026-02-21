AIChatbot_Tailwind - Starter (Frontend + Backend with Tailwind)
--------------------------------------------------------------

How to run:

1) Backend (port 5000)
   cd backend
   npm install
   copy .env.example .env   (Windows) or cp .env.example .env (mac/linux)
   npm start

2) Frontend (Next.js, port 3000)
   cd frontend
   npm install
   npm run dev

Open http://localhost:3000
- Click "Campus Navigation" or "General Information" to open chat page for that model.
- The backend currently uses mock model endpoints. Replace them in backend/.env to point to your real model servers.
