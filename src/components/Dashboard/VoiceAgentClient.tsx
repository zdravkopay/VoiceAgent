"use client";

import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Settings as SettingsIcon } from 'lucide-react';
import { SettingsModal } from './SettingsModal';

type Message = { role: 'ai' | 'user'; text: string; ts: Date };

export default function VoiceAgentClient() {
    const [isCalling, setIsCalling] = useState(false);
    const [status, setStatus] = useState<'idle' | 'requesting' | 'connecting' | 'live' | 'error'>('idle');
    const [statusMsg, setStatusMsg] = useState('');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [callSeconds, setCallSeconds] = useState(0);
    const transcriptRef = useRef<HTMLDivElement>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const isCallingRef = useRef(false);
    const nextPlayTimeRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── RECORDING STATE ──────────────────────────────
    const callIdRef = useRef<string>('');
    const userAudioChunks = useRef<Float32Array[]>([]);
    const aiAudioChunks = useRef<Float32Array[]>([]);
    const callStartTimeRef = useRef<number>(0);

    useEffect(() => {
        if (transcriptRef.current) {
            transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        if (isCalling) {
            setCallSeconds(0);
            timerRef.current = setInterval(() => setCallSeconds(s => s + 1), 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [isCalling]);

    const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

    const toBase64 = (buf: ArrayBuffer): string => {
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    };

    // ── WAV ENCODING UTILITY ─────────────────────────
    const encodeWAV = (samples: Float32Array, sampleRate: number): ArrayBuffer => {
        const buffer = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(buffer);
        const writeString = (offset: number, str: string) => {
            for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
        };
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + samples.length * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, 1, true); // mono
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true); // byte rate
        view.setUint16(32, 2, true); // block align
        view.setUint16(34, 16, true); // bits per sample
        writeString(36, 'data');
        view.setUint32(40, samples.length * 2, true);
        for (let i = 0; i < samples.length; i++) {
            const s = Math.max(-1, Math.min(1, samples[i]));
            view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
        return buffer;
    };

    const mixAndUploadRecording = async (callId: string, durationSeconds: number) => {
        const userChunks = userAudioChunks.current;
        const aiChunks = aiAudioChunks.current;
        if (userChunks.length === 0 && aiChunks.length === 0) return;

        // Concatenate user audio (16kHz)
        const totalUserSamples = userChunks.reduce((sum, c) => sum + c.length, 0);
        const userAudio = new Float32Array(totalUserSamples);
        let offset = 0;
        for (const chunk of userChunks) {
            userAudio.set(chunk, offset);
            offset += chunk.length;
        }

        // Concatenate AI audio (24kHz) -> resample to 16kHz
        const totalAiSamples = aiChunks.reduce((sum, c) => sum + c.length, 0);
        const aiAudioRaw = new Float32Array(totalAiSamples);
        offset = 0;
        for (const chunk of aiChunks) {
            aiAudioRaw.set(chunk, offset);
            offset += chunk.length;
        }

        // Resample AI from 24kHz to 16kHz
        const ratio = 16000 / 24000;
        const resampledLength = Math.floor(aiAudioRaw.length * ratio);
        const aiAudio16k = new Float32Array(resampledLength);
        for (let i = 0; i < resampledLength; i++) {
            const srcIdx = i / ratio;
            const idx = Math.floor(srcIdx);
            const frac = srcIdx - idx;
            const s1 = aiAudioRaw[idx] || 0;
            const s2 = aiAudioRaw[idx + 1] || 0;
            aiAudio16k[i] = s1 + frac * (s2 - s1);
        }

        // Mix both channels (simple average, pad shorter to length of longer)
        const mixLength = Math.max(userAudio.length, aiAudio16k.length);
        const mixed = new Float32Array(mixLength);
        for (let i = 0; i < mixLength; i++) {
            const u = i < userAudio.length ? userAudio[i] : 0;
            const a = i < aiAudio16k.length ? aiAudio16k[i] : 0;
            mixed[i] = (u + a) * 0.5;
        }

        // Encode to WAV
        const wavBuffer = encodeWAV(mixed, 16000);
        const wavBase64 = toBase64(wavBuffer);

        // Upload
        try {
            await fetch('/api/upload-recording', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callId, audioBase64: wavBase64 }),
            });
            console.log(`[Recording] Uploaded ${(wavBuffer.byteLength / 1024).toFixed(0)}KB for call ${callId}`);
        } catch (err) {
            console.error('[Recording] Upload failed:', err);
        }
    };

    const startCall = async () => {
        if (isCallingRef.current) return;
        setStatus('requesting');
        setStatusMsg('Requesting microphone access...');
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
            });
        } catch (err: any) {
            setStatus('error');
            setStatusMsg(err?.name === 'NotAllowedError'
                ? 'Microphone blocked — allow access in browser settings.'
                : `Mic error: ${err?.message}`);
            return;
        }
        mediaStreamRef.current = stream;
        isCallingRef.current = true;
        setIsCalling(true);
        setStatus('connecting');
        setStatusMsg('Connecting to Gemini...');

        // ── RESET RECORDING ──
        callIdRef.current = `call_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        userAudioChunks.current = [];
        aiAudioChunks.current = [];
        callStartTimeRef.current = Date.now();

        const playCtx = new AudioContext({ sampleRate: 24000 });
        audioContextRef.current = playCtx;
        await playCtx.resume();
        nextPlayTimeRef.current = 0;

        const micCtx = new AudioContext({ sampleRate: 16000 });
        const micSource = micCtx.createMediaStreamSource(stream);
        // Reduce chunk size from 2048 to 512 mapping to ~32ms of audio for faster API ingestion
        const processor = micCtx.createScriptProcessor(512, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
            if (!isCallingRef.current || wsRef.current?.readyState !== WebSocket.OPEN) return;
            const float32 = e.inputBuffer.getChannelData(0);

            // ── RECORD USER AUDIO ──
            userAudioChunks.current.push(new Float32Array(float32));

            const pcm16 = new Int16Array(float32.length);
            for (let i = 0; i < float32.length; i++) {
                pcm16[i] = Math.max(-32768, Math.min(32767, Math.round(float32[i] * 32767)));
            }
            wsRef.current!.send(JSON.stringify({
                realtimeInput: { mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: toBase64(pcm16.buffer) }] }
            }));
        };

        micSource.connect(processor);
        processor.connect(micCtx.destination);

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${window.location.host}/api/gemini-live-stream?configId=11111111-1111-1111-1111-111111111111`);
        wsRef.current = ws;

        ws.onopen = () => { setStatus('live'); setStatusMsg(''); };

        // Keep track of active audio nodes for barge-in (interruption)
        const activeSources: AudioBufferSourceNode[] = [];

        ws.onmessage = async (event) => {
            try {
                const text = event.data instanceof Blob ? await event.data.text() : event.data;
                const msg = JSON.parse(text);

                // ── BARGE-IN HANDLING ──
                // If the API signals that the user interrupted, immediately stop playing the current agent response
                if (msg?.serverContent?.interrupted) {
                    activeSources.forEach(source => {
                        try { source.stop(); } catch (e) { }
                    });
                    activeSources.length = 0; // clear the array
                    if (audioContextRef.current) {
                        nextPlayTimeRef.current = audioContextRef.current.currentTime;
                    }
                }

                const parts = msg?.serverContent?.modelTurn?.parts;
                if (parts) {
                    for (const part of parts) {
                        if (part.inlineData?.data) {
                            // Queue audio and track the source node
                            const ctx = audioContextRef.current;
                            if (!ctx) continue;
                            if (ctx.state !== 'running') ctx.resume();

                            const binary = atob(part.inlineData.data);
                            const bytes = new Uint8Array(binary.length);
                            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                            const pcm16 = new Int16Array(bytes.buffer);
                            const float32 = new Float32Array(pcm16.length);
                            for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;

                            aiAudioChunks.current.push(new Float32Array(float32));

                            const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
                            audioBuffer.getChannelData(0).set(float32);
                            const source = ctx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(ctx.destination);

                            const startAt = Math.max(ctx.currentTime, nextPlayTimeRef.current);
                            source.start(startAt);
                            nextPlayTimeRef.current = startAt + audioBuffer.duration;

                            activeSources.push(source);
                            source.onended = () => {
                                const idx = activeSources.indexOf(source);
                                if (idx > -1) activeSources.splice(idx, 1);
                            };
                        }
                        if (part.text) {
                            setMessages(prev => [...prev, { role: 'ai', text: part.text, ts: new Date() }]);
                        }
                    }
                }
                const fnCall = msg?.toolCall?.functionCalls?.[0];
                if (fnCall?.name === 'bookCalendarDemo') {
                    const { userEmail, demoTopic } = fnCall.args;
                    setMessages(prev => [...prev, {
                        role: 'ai',
                        text: `Booking demo for ${userEmail}: "${demoTopic}"`,
                        ts: new Date()
                    }]);
                    fetch('/api/book-demo', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userEmail, demoTopic })
                    }).catch(console.error);
                    wsRef.current?.send(JSON.stringify({
                        tool_response: {
                            function_responses: [{
                                id: fnCall.id,
                                name: fnCall.name,
                                response: { result: "Demo booked successfully." }
                            }]
                        }
                    }));
                }
            } catch { /* ignore malformed */ }
        };

        ws.onerror = () => { setStatus('error'); setStatusMsg('Connection error.'); };
        ws.onclose = () => {
            if (isCallingRef.current) {
                setStatusMsg('Connection lost.');
                stopCall();
            }
        };
    };

    const stopCall = async () => {
        const callId = callIdRef.current;
        const durationSeconds = Math.round((Date.now() - callStartTimeRef.current) / 1000);
        const transcript = messages.map(m => `${m.role === 'ai' ? 'Alex' : 'Caller'}: ${m.text}`).join('\n');

        isCallingRef.current = false;
        setIsCalling(false);
        setStatus('idle');
        wsRef.current?.close();
        wsRef.current = null;
        processorRef.current?.disconnect();
        processorRef.current = null;
        audioContextRef.current?.close();
        audioContextRef.current = null;
        mediaStreamRef.current?.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
        nextPlayTimeRef.current = 0;

        // ── POST-CALL: Upload recording + trigger analysis ──
        if (callId && durationSeconds > 2) {
            // Upload recording (fire and forget)
            mixAndUploadRecording(callId, durationSeconds);

            // Trigger post-call analysis
            if (transcript.trim()) {
                fetch('/api/call-history', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        callId,
                        transcript,
                        durationSeconds,
                        callerNumber: 'web-client',
                    }),
                }).catch(err => console.error('[PostCall] Analysis failed:', err));
            }
        }
    };

    useEffect(() => () => { stopCall(); }, []);

    const statusPillStyle = () => {
        if (status === 'live') return { backgroundColor: 'rgba(52,211,153,0.1)', borderColor: 'rgba(52,211,153,0.25)', color: '#34d399' };
        if (status === 'error') return { backgroundColor: 'rgba(248,113,113,0.1)', borderColor: 'rgba(248,113,113,0.25)', color: '#f87171' };
        if (status === 'connecting' || status === 'requesting') return { backgroundColor: 'rgba(251,191,36,0.1)', borderColor: 'rgba(251,191,36,0.25)', color: '#fbbf24' };
        return { backgroundColor: '#1c1c22', borderColor: '#222228', color: '#52525b' };
    };

    const statusDotColor = () => {
        if (status === 'live') return '#34d399';
        if (status === 'error') return '#f87171';
        if (status === 'connecting' || status === 'requesting') return '#fbbf24';
        return '#52525b';
    };

    return (
        <div style={{ backgroundColor: '#141417', border: '1px solid #222228', borderRadius: '16px', overflow: 'hidden' }}>

            {/* ── AGENT HEADER ─────────────────────────────── */}
            <div style={{ padding: '32px 32px 0 32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div className="relative">
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '12px',
                                backgroundColor: '#1c1c22', border: `1px solid ${isCalling ? 'rgba(94,234,212,0.3)' : '#222228'}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#71717a', fontWeight: 700, fontSize: '18px'
                            }}>
                                A
                            </div>
                            {isCalling && (
                                <>
                                    <span className="absolute inset-0 rounded-xl pulse-ring-1" style={{ backgroundColor: 'rgba(94,234,212,0.15)' }} />
                                    <span className="absolute inset-0 rounded-xl pulse-ring-2" style={{ backgroundColor: 'rgba(94,234,212,0.08)' }} />
                                </>
                            )}
                        </div>
                        <div>
                            <p style={{ fontSize: '14px', fontWeight: 600, color: '#e4e4e7' }}>Alex</p>
                            <p style={{ fontSize: '12px', color: '#52525b' }}>AI Sales Agent</p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            title="Configure Persona"
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: '32px', height: '32px', borderRadius: '8px',
                                backgroundColor: '#1c1c22', border: '1px solid #27272a',
                                color: '#a1a1aa', cursor: 'pointer', transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#27272a'; e.currentTarget.style.color = '#e4e4e7'; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#1c1c22'; e.currentTarget.style.color = '#a1a1aa'; }}
                        >
                            <SettingsIcon size={16} />
                        </button>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 500,
                            border: '1px solid', ...statusPillStyle()
                        }}>
                            <span className={status === 'live' || status === 'connecting' || status === 'requesting' ? 'status-dot' : ''}
                                style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: statusDotColor() }} />
                            {status === 'idle' ? 'Ready' :
                                status === 'requesting' ? 'Mic…' :
                                    status === 'connecting' ? 'Connecting…' :
                                        status === 'live' ? `Live · ${formatTime(callSeconds)}` :
                                            'Error'}
                        </div>
                    </div>
                </div>

                {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}

                <div className={`flex items-center justify-center gap-1 transition-opacity duration-500 ${isCalling ? 'opacity-100' : 'opacity-0'}`}
                    style={{ height: '56px' }}>
                    {[32, 48, 36, 56, 44, 60, 40, 56, 36, 48, 32].map((h, i) => (
                        <div key={i} className="wave-bar" style={{
                            width: '4px', borderRadius: '9999px',
                            backgroundColor: '#5eead4', opacity: 0.5, height: `${h}%`
                        }} />
                    ))}
                </div>

                {statusMsg && (
                    <p style={{ textAlign: 'center', fontSize: '12px', paddingBottom: '16px', color: status === 'error' ? '#f87171' : '#71717a' }}>
                        {statusMsg}
                    </p>
                )}
            </div>

            {/* ── TRANSCRIPT ───────────────────────────────── */}
            <div ref={transcriptRef}
                style={{ margin: '24px 32px', height: '224px', overflowY: 'auto', paddingRight: '8px' }}
                className="space-y-3">
                {messages.length === 0 ? (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#52525b' }}>
                        <Mic style={{ width: '20px', height: '20px' }} />
                        <p style={{ fontSize: '14px' }}>Start a call — Alex will greet you</p>
                    </div>
                ) : (
                    messages.map((m, i) => (
                        <div key={i} className="animate-fade-in-up"
                            style={{ display: 'flex', justifyContent: m.role === 'ai' ? 'flex-start' : 'flex-end' }}>
                            <div style={{
                                maxWidth: '85%', padding: '12px 16px', fontSize: '14px', lineHeight: 1.6,
                                borderRadius: m.role === 'ai' ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
                                backgroundColor: m.role === 'ai' ? '#1c1c22' : 'rgba(94,234,212,0.08)',
                                border: m.role === 'ai' ? '1px solid #222228' : '1px solid rgba(94,234,212,0.15)',
                                color: m.role === 'ai' ? '#a1a1aa' : '#e4e4e7'
                            }}>
                                {m.text}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* ── CONTROLS ─────────────────────────────────── */}
            <div style={{ padding: '16px 32px 32px 32px', borderTop: '1px solid #222228' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '12px', color: '#52525b', fontFamily: 'monospace' }}>
                        {isCalling ? `${messages.length} message${messages.length !== 1 ? 's' : ''}` : 'Click to start'}
                    </div>

                    {!isCalling ? (
                        <button id="start-call-btn" onClick={startCall}
                            className="cursor-pointer"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '12px 24px', borderRadius: '10px', fontWeight: 600, fontSize: '14px',
                                backgroundColor: '#5eead4', color: '#0a0a0b', border: 'none',
                                transition: 'transform 0.15s, filter 0.15s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.filter = 'brightness(1.1)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.filter = 'brightness(1)'; }}
                        >
                            <Phone style={{ width: '16px', height: '16px' }} />
                            Start Voice Call
                        </button>
                    ) : (
                        <button id="end-call-btn" onClick={stopCall}
                            className="cursor-pointer"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '12px 24px', borderRadius: '10px', fontWeight: 600, fontSize: '14px',
                                backgroundColor: 'rgba(248,113,113,0.1)', color: '#f87171',
                                border: '1px solid rgba(248,113,113,0.25)',
                                transition: 'transform 0.15s, background-color 0.15s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.2)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.1)'; }}
                        >
                            <PhoneOff style={{ width: '16px', height: '16px' }} />
                            End Call
                        </button>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: isCalling ? '#34d399' : '#52525b' }}>
                        {isCalling ? <Mic style={{ width: '14px', height: '14px' }} /> : <MicOff style={{ width: '14px', height: '14px' }} />}
                        <span>{isCalling ? 'Live' : 'Muted'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
