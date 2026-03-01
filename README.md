# Voice Agent Dashboard

The **Voice Agent Dashboard** is a comprehensive Next.js web application designed to demonstrate and manage a low-latency, real-time B2B inbound/outbound AI sales representative. It leverages Google's **Gemini 2.5 Flash Native Audio** model to conduct natural human-level phone conversations, complete with barge-in (interruption handling), tone matching, and dynamic language adaptation.

## Quick Start

### 1. Environment Setup
Copy the `.env.example` file to create your local `.env.local` file:
```bash
cp .env.example .env.local
```
Fill in the required keys, primarily:
- `GEMINI_API_KEY`: Get this from Google AI Studio.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Get these from your Supabase project dashboard.

### 2. Database Setup (Supabase)
Run the SQL script provided in `supabase-schema.sql` within your Supabase project's SQL Editor. This will configure the necessary tables (`calls`, `agent_config`) and RLS policies for the dashboard to function.

### 3. Install Dependencies
```bash
npm install
```

### 4. Run the Development Server
Because this project utilizes a custom WebSocket proxy for real-time native audio via the Gemini Multimodal Live API, it requires a custom Node server (`server.js`) rather than standard Next.js API routes.

Start the dashboard using:
```bash
npm run dev
# Note: Ensure this runs the custom `server.js` or `node server.js`
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Documentation
For a full architectural breakdown, feature set, and technical details, please see the Single Source of Truth document:
- [SSOT - Voice Agent.md](./ssot%20-%20voice%20agent.md)
