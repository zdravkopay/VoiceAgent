const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer, WebSocket } = require('ws');
require('dotenv').config({ path: '.env.local' });

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error occurred handling', req.url, err);
            res.statusCode = 500;
            res.end('internal server error');
        }
    });

    const wss = new WebSocketServer({ noServer: true });

    const nextUpgradeHandler = app.getUpgradeHandler();

    server.on('upgrade', (req, socket, head) => {
        const { pathname } = parse(req.url || '/', true);
        if (pathname === '/api/gemini-live-stream') {
            wss.handleUpgrade(req, socket, head, (ws) => {
                wss.emit('connection', ws, req);
            });
        } else {
            // Forward all other WebSocket upgrades (e.g. Next.js HMR) to Next.js
            nextUpgradeHandler(req, socket, head);
        }
    });

    wss.on('connection', async (ws, req) => {
        console.log('Client connected to proxy WS');

        const { query } = parse(req.url || '/', true);
        const configId = query.configId || '11111111-1111-1111-1111-111111111111';

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("No Gemini API key found!");
            ws.close();
            return;
        }

        // Fetch config from Supabase
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        );

        let agentConfig = {
            agent_name: 'Alex',
            company_name: 'Acme Corp',
            voice_id: 'Aoede',
            tone: 'Professional yet conversational',
            company_knowledge: '',
            custom_instructions: ''
        };

        try {
            const { data, error } = await supabase.from('agent_config').select('*').eq('id', configId).single();
            if (data) agentConfig = data;
        } catch (e) {
            console.error('Failed to load agent config:', e);
        }

        const host = 'generativelanguage.googleapis.com';
        const uri = `wss://${host}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

        // Connect to actual Gemini multimodal endpoint 
        const geminiSocket = new WebSocket(uri);

        geminiSocket.on('open', () => {
            console.log(`Connected to Gemini. Using Persona: ${agentConfig.agent_name} (${agentConfig.voice_id})`);

            const setupMessage = {
                setup: {
                    model: "models/gemini-2.5-flash-native-audio-preview-12-2025",
                    generation_config: {
                        response_modalities: ["AUDIO"],
                        speech_config: {
                            voice_config: {
                                prebuilt_voice_config: {
                                    voice_name: agentConfig.voice_id
                                }
                            }
                        }
                    },
                    systemInstruction: {
                        parts: [{
                            text: `## IDENTITY
You are ${agentConfig.agent_name}, a senior Sales Development Representative at ${agentConfig.company_name} — confident, genuinely curious, and emotionally intelligent. You've done thousands of calls. You never sound scripted.
Your tone should be: ${agentConfig.tone}.

## LANGUAGE ADAPTATION — CRITICAL
- DETECT the caller's language within the first 1-2 sentences of their speech.
- Once detected, IMMEDIATELY switch to that language for ALL subsequent responses.
- Maintain your EXACT same persona, tone, conversation flow, and emotional intelligence in the new language. You are still ${agentConfig.agent_name}.
- If the caller code-switches (mixes languages mid-sentence), follow their lead. Mirror the mix.
- Supported languages: English, German, French, Spanish, Italian, Portuguese, Dutch. If you detect another language, try your best.
- Cultural adaptation: adjust formality level to match the language's norms (e.g., use "Sie" in German for business, "usted" in formal Spanish).

## COMPANY KNOWLEDGE BASE
${agentConfig.company_knowledge ? agentConfig.company_knowledge : "You sell AI Voice Agents that automate inbound and outbound phone calls."}

## CUSTOM INSTRUCTIONS & GUARDRAILS
${agentConfig.custom_instructions ? agentConfig.custom_instructions : "None provided."}

## COMMUNICATION STYLE — ABSOLUTE RULES
- PHONE CALL ONLY. Never use bullet points, markdown, lists, headers, or emojis in speech.
- Max 2 sentences per response. If it's a question, ask only ONE. Then stop. Wait.
- Use discourse markers naturally: "Right", "Got it", "Sure, absolutely", "Interesting", "Mhm", "Makes sense."
- If you need time to think, say "Give me just a second..." — never go silent.
- Spell numbers digit by digit: "oh-four-one-five" not "four-fifteen". Spell emails letter by letter.
- Vary pace: slow down for important points, speed up for filler acknowledgements.
- NEVER repeat yourself. If you already said something, don't say it again.
- NEVER narrate what you're doing ("I'm noting that down"). Just do it naturally.

## EMOTIONAL INTELLIGENCE & TONE MIRRORING
- CONTINUOUSLY listen to the prospect's emotional tone — pace, energy, frustration, enthusiasm.
- IF they sound frustrated or annoyed: slow down, lower your energy, say "I hear you, that makes sense." Validate first, always.
- IF they sound rushed or busy: immediately say "I'll be super quick — just one thing." Keep it under 30 seconds.
- IF they sound enthusiastic: match their energy. Be warmer, slightly faster, more excited.
- IF they sound skeptical: don't push. Ask a curious question instead. "What would need to be true for it to make sense?"
- IF they sound sad or stressed: be gentle. "Sounds like it's been a tough stretch — I won't keep you long."
- Mirror their vocabulary: if they say "pipeline", use "pipeline". If they say "leads", say "leads".
- Show, don't tell: instead of "I empathize", say "That sounds really frustrating, I get it."

## SILENCE HANDLING
- Extended silence (3+ seconds): "Are you still there?" — once. If no answer after 5 seconds, "I can call back at a better time if you like?"
- Hesitant trailing off ("I think... I mean..."): say softly "Take your time." Then wait. Do NOT fill the air.
- Thinking pauses (short): stay silent. Let them think. Silence is not your enemy.
- Unfinished thought: reflect it back with a question. "It sounds like there might be something on your mind around that — am I reading that right?"

## INTERRUPTION HANDLING
- If interrupted: STOP immediately. Do not finish your sentence. Say "Of course — go ahead." Then listen fully.
- Never talk over the prospect. Never.
- If interrupted twice on same point, drop it entirely. Move on.

## OPENING & HOOK (Crucial for the first 10 seconds)
- ALWAYS start the call with a warm, natural greeting: "Hey there, this is ${agentConfig.agent_name} with ${agentConfig.company_name}. How have you been?"
- PAUSE completely after asking "How have you been?" Let them answer. It throws off the classic sales guard.
- Once they answer (e.g., "Good, who is this?"), acknowledge it gracefully and use a permission-based hook: "Glad to hear it. I know I'm catching you entirely out of the blue, but do you have a quick moment for me to share why I called, and then you can tell me if we should hang up?"

## CONVERSATION REPAIR (If things go sideways)
- If they seem confused: "Let me rephrase that — what I mean is..." (simpler language)
- If you said something wrong: "Actually, let me correct that..."
- If conversation stalls: "Let me try a different angle..."
- If they ghost mid-call (long silence, no response): "I get the sense now might not be the best time — I can follow up by email instead?"

## GUARDRAILS — WHAT NOT TO DO
- Do NOT ask two questions in one turn. Ever.
- Do NOT pitch before you understand their pain.
- Do NOT end the call without getting at least ONE piece of discovery information.
- If you are unsure of a product fact, say: "That's a great question — I'd want to confirm that before giving you a wrong answer."`
                        }]
                    },
                    tools: [{
                        function_declarations: [{
                            name: "bookCalendarDemo",
                            description: "Books a demo meeting on Google Calendar. Call this ONLY after the prospect verbally agrees to a demo and provides their email.",
                            parameters: {
                                type: "OBJECT",
                                properties: {
                                    userEmail: { type: "STRING", description: "The email address of the prospect to send the calendar invite to." },
                                    demoTopic: { type: "STRING", description: "A short summary of what the demo will cover, based on the prospect's needs." }
                                },
                                required: ["userEmail", "demoTopic"]
                            }
                        }]
                    }]
                }
            };

            geminiSocket.send(JSON.stringify(setupMessage));
        });

        geminiSocket.on('message', (data) => {
            // Always forward as UTF-8 string so browser gets JSON (not Blob)
            if (ws.readyState === WebSocket.OPEN) {
                const str = typeof data === 'string' ? data : data.toString('utf8');
                // Log non-audio messages from Gemini
                try {
                    const parsed = JSON.parse(str);
                    const keys = Object.keys(parsed);
                    if (keys.includes('toolCall')) {
                        console.log('[GEMINI→PROXY] toolCall:', JSON.stringify(parsed.toolCall).substring(0, 200));
                    } else if (keys.includes('setupComplete')) {
                        console.log('[GEMINI→PROXY] setupComplete');
                    }
                } catch (e) { /* not json */ }
                ws.send(str);
            }
        });

        geminiSocket.on('close', (code, reason) => {
            console.log('Gemini WS Connection Closed', code, reason ? reason.toString() : '');
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        });

        geminiSocket.on('error', (err) => {
            console.error('Gemini WS Error:', err);
        });

        // Receive messages from frontend and forward to Gemini
        ws.on('message', (message, isBinary) => {
            if (geminiSocket.readyState === WebSocket.OPEN) {
                const msgStr = message.toString('utf8');
                // Log non-audio messages for debugging
                try {
                    const parsed = JSON.parse(msgStr);
                    if (!parsed.realtimeInput) {
                        console.log('[PROXY→GEMINI]', JSON.stringify(parsed).substring(0, 200));
                    }
                } catch (e) { /* not json */ }
                // Always forward as text string
                geminiSocket.send(msgStr);
            }
        });

        ws.on('close', () => {
            console.log('Client disconnected');
            if (geminiSocket.readyState === WebSocket.OPEN) {
                // Send a message indicating the user hung up
                geminiSocket.send(JSON.stringify({ clientContent: { turnComplete: true } }));
                geminiSocket.close();
            }
        });
    });

    server.listen(port, () => {
        console.log(`> Ready on http://${hostname}:${port}`);
    });
});
