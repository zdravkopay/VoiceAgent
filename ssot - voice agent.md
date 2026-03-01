# Single Source of Truth (SSOT) - Voice Agent Dashboard

## Project Overview
The "Voice Agent Dashboard" is a comprehensive Next.js web application designed to demonstrate and manage a low-latency, real-time B2B inbound/outbound AI sales representative. It leverages Google's **Gemini 2.5 Flash Native Audio** model to conduct natural human-level phone conversations, complete with barge-in (interruption handling), tone matching, and dynamic language adaptation.

## Architecture

### 1. Frontend (Next.js React Client)
- **UI Framework:** Next.js (App Router), React, styled with inline styles / Tailwind elements.
- **Audio Processing:** Uses standard Web Audio API (`AudioContext`, `ScriptProcessorNode`) and `getUserMedia` to capture raw 16kHz PCM audio from the user's microphone.
- **Live Streaming (`VoiceAgentClient.tsx`):** Maintains a WebSocket connection to the local Node proxy. Sends base64-encoded PCM audio chunks and receives binary audio chunks to play back through the browser. Handles UI state (live status, transcript, call timer) and barge-in (stopping audio playback when the user interrupts).
- **Dashboard (`Dashboard.tsx`):** Displays real-time metrics (Total Calls, Active Leads, Conversion Rate) and a live-updating table of past calls synced via Supabase Realtime.
- **Persona Configurator (`SettingsModal.tsx`):** A UI to let admins configure the agent's identity, voice, tone, and knowledge base dynamically. Provides a TTS preview button for voices.

### 2. Backend (Node + Next.js Server)
- **Custom Server (`server.js`):** A custom Node HTTP server wrapping Next.js. This is **critical** because standard Next.js API routes do not support persistent WebSockets required for the Gemini Live API. It proxies the WebSocket connection from the browser (`/api/gemini-live-stream`) to the Google Generative Language API.
- **Dynamic Persona Injection:** When a call connects, `server.js` fetches the active persona from Supabase (`agent_config`), constructs the `systemInstruction` with custom rules and knowledge base, and sends the `setup` message to Gemini.

### 3. API Routes (`/src/app/api/`)
- `/api/call-history`: Called by the client at the end of a session. Inserts a record into the Supabase `calls` table and triggers a post-call summary email.
- `/api/book-demo`: Called dynamically by the AI during a conversation (via Gemini Tool Calling/Function Calls). Books a demo.
- `/api/parse-pdf`: Takes a PDF file upload, extracts the text using `pdf-parse`, and uses Gemini to summarize and distill it into a concise 1-page knowledge base.
- `/api/tts-preview`: Uses Gemini WebSocket TTS to generate a preview audio clip of the selected voice for the Settings Modal.

### 4. Database (Supabase PostgreSQL)
- **`calls` table**: Stores call metadata (`id`, `caller_number`, `duration_seconds`, `transcript`, `status`, `created_at`).
- **`agent_config` table**: Stores the dynamic persona.
  - `id` (UUID)
  - `agent_name` (Target identity, e.g., "Alex")
  - `company_name` (Company represented)
  - `voice_id` (Gemini voice: Aoede, Puck, Charon, Kore, Fenrir)
  - `tone` (Conversational style)
  - `custom_instructions` (Specific guardrails)
  - `company_knowledge` (The plain-text knowledge base injected into the prompt).

## Key Features & Capabilities
1. **Low-Latency Voice:** Audio is streamed chunk-by-chunk directly to Gemini, with no intermediate STT/TTS latencies.
2. **Native Barge-In:** The AI stops speaking instantly if the user interrupts.
3. **Function Calling:** The AI can execute server-side functions mid-conversation (e.g., booking a demo via `bookCalendarDemo` tool).
4. **Auto-Language Switching:** Gemini natively detects the speaker's language and switches fluidly while maintaining persona.
5. **Real-time Dashboard:** Supabase Realtime channel bindings ensure new calls pop up on the dashboard instantly without refreshing.
6. **PDF Parsing pipeline:** Users can upload massive company documents, which are automatically distilled by Gemini into an optimized, pure-text knowledge base for the real-time agent to use without suffering RAG latencies.

## Configuration & Setup
1. **Environment Variables (`.env.local`):**
   ```env
   GEMINI_API_KEY=your_google_ai_studio_key
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key
   RESEND_API_KEY=your_resend_api_key (optional, for emails)
   NOTIFICATION_EMAIL=target_email@example.com
   ```
2. **Database Schema:** Setup using the provided `supabase-schema.sql` file in the Supabase REST/SQL editor.
3. **Execution:** Due to the custom WebSocket proxy, the app **must** be run utilizing the custom `server.js` file:
   - Development: `node server.js` (or `npm run dev` if `dev` script in `package.json` points to `node server.js`)
   - Production: `NODE_ENV=production node server.js`

## Known Limitations / Trade-offs
- **Audio Quality:** Current Web implementation captures mic data at 16kHz PCM to send to Gemini, and receives 24kHz PCM back.
- **RAG vs Context Window:** For ultra-low latency, this system prioritizes injecting the entire knowledge base directly into the system prompt rather than blocking the voice response to perform vector searches (RAG). The PDF parser compresses documents strictly to fit this requirement.
