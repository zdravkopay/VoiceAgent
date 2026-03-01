import { NextResponse } from 'next/server';
import WebSocket from 'ws';

export async function POST(req: Request) {
    try {
        const { voice_id, text } = await req.json();

        if (!voice_id || !text) {
            return NextResponse.json({ error: 'Missing voice_id or text' }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return NextResponse.json({ error: 'Missing GEMINI_API_KEY' }, { status: 500 });

        return new Promise((resolve) => {
            const host = 'generativelanguage.googleapis.com';
            const uri = `wss://${host}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

            const ws = new WebSocket(uri);
            let combinedAudioBase64 = "";

            ws.on('open', () => {
                const setupMessage = {
                    setup: {
                        model: "models/gemini-2.5-flash-native-audio-preview-12-2025",
                        generation_config: {
                            response_modalities: ["AUDIO"],
                            speech_config: { voice_config: { prebuilt_voice_config: { voice_name: voice_id } } }
                        }
                    }
                };
                ws.send(JSON.stringify(setupMessage));
            });

            ws.on('message', (data) => {
                const str = typeof data === 'string' ? data : data.toString('utf8');
                try {
                    const msg = JSON.parse(str);

                    if (msg.setupComplete) {
                        // After setup, send the text we want it to say
                        ws.send(JSON.stringify({
                            clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true }
                        }));
                    }

                    const parts = msg?.serverContent?.modelTurn?.parts;
                    if (parts) {
                        for (const part of parts) {
                            if (part.inlineData?.data) {
                                combinedAudioBase64 += part.inlineData.data;
                            }
                        }
                    }

                    if (msg?.serverContent?.turnComplete) {
                        ws.close();
                        resolve(NextResponse.json({
                            success: true,
                            audioBase64: combinedAudioBase64,
                            mimeType: 'audio/pcm;rate=24000'
                        }));
                    }
                } catch (e) { }
            });

            ws.on('error', (err) => resolve(NextResponse.json({ error: err.message }, { status: 500 })));

            // Timeout after 10s
            setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN) ws.close();
                resolve(NextResponse.json({ error: 'Timeout generating audio' }, { status: 500 }));
            }, 10000);
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Failed to generate audio preview' }, { status: 500 });
    }
}
