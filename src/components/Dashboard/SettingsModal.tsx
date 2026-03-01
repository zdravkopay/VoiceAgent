import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Save, Mic, Settings as SettingsIcon, Check, Play, Square } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Fallback init so we don't crash if env vars are missing during render
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'anon'
);

type AgentConfig = {
    id: string;
    agent_name: string;
    company_name: string;
    voice_id: string;
    tone: string;
    company_knowledge: string;
    custom_instructions: string;
};

const DEFAULT_CONFIG_ID = '11111111-1111-1111-1111-111111111111';
const GEMINI_VOICES = ['Aoede', 'Puck', 'Charon', 'Kore', 'Fenrir'];
const TONES = ['Professional yet conversational', 'Warm & Empathetic', 'High-Energy Sales', 'Direct & Authoritative'];

export function SettingsModal({ onClose }: { onClose: () => void }) {
    const [config, setConfig] = useState<AgentConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [parsingPdf, setParsingPdf] = useState(false);

    // Audio Preview State
    const [playingVoice, setPlayingVoice] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const playPreview = async (voice: string, agentName: string) => {
        if (playingVoice === voice) {
            // Stop playing
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
            setPlayingVoice(null);
            return;
        }

        // Stop current if any
        if (audioRef.current) {
            audioRef.current.pause();
        }

        setPlayingVoice(voice);
        try {
            const text = `Hi, I'm ${agentName || 'Alex'}. How can I help you today?`;
            const res = await fetch('/api/tts-preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ voice_id: voice, text })
            });
            const data = await res.json();

            if (data.success && data.audioBase64) {
                const audioUrl = `data:${data.mimeType};base64,${data.audioBase64}`;
                const audio = new Audio(audioUrl);
                audioRef.current = audio;

                audio.onended = () => setPlayingVoice(null);
                await audio.play();
            } else {
                setPlayingVoice(null);
            }
        } catch (error) {
            console.error('Failed to play preview:', error);
            setPlayingVoice(null);
        }
    };

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('agent_config').select('*').eq('id', DEFAULT_CONFIG_ID).single();
        if (data) setConfig(data);
        setLoading(false);
    };

    const handleSave = async () => {
        if (!config) return;
        setSaving(true);
        const { error } = await supabase.from('agent_config').upsert({ ...config, id: DEFAULT_CONFIG_ID });
        setSaving(false);
        if (!error) onClose();
    };

    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setParsingPdf(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/parse-pdf', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success && config) {
                setConfig({ ...config, company_knowledge: data.knowledgeBase });
            } else {
                alert(data.error || 'Failed to parse PDF.');
            }
        } catch (error) {
            console.error(error);
            alert('An error occurred while uploading.');
        } finally {
            setParsingPdf(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    if (loading) {
        return (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ color: '#a1a1aa' }}>Loading configuration...</div>
            </div>
        );
    }

    if (!config) {
        return (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ backgroundColor: '#18181b', padding: '32px', borderRadius: '16px', color: '#f4f4f5', maxWidth: '400px', textAlign: 'center' }}>
                    <p>Configuration not found. Please run the SQL migration.</p>
                    <button onClick={onClose} style={{ marginTop: '16px', padding: '8px 16px', backgroundColor: '#3f3f46', borderRadius: '6px', cursor: 'pointer', border: 'none', color: 'white' }}>Close</button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '20px', width: '100%', maxWidth: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>

                {/* Header */}
                <div style={{ padding: '24px 32px', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#2dd4bf20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <SettingsIcon style={{ color: '#2dd4bf', width: '20px', height: '20px' }} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#f4f4f5' }}>Agent Persona</h2>
                            <p style={{ margin: 0, fontSize: '14px', color: '#a1a1aa' }}>Configure identity, voice, and knowledge base</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a1a1aa' }}><X size={20} /></button>
                </div>

                {/* Body */}
                <div style={{ padding: '32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

                    {/* Grid 1: Identity */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '14px', fontWeight: 500, color: '#e4e4e7' }}>Agent Name</label>
                            <input
                                value={config.agent_name} onChange={e => setConfig({ ...config, agent_name: e.target.value })}
                                style={{ backgroundColor: '#09090b', border: '1px solid #27272a', padding: '12px 16px', borderRadius: '8px', color: 'white', outline: 'none', fontFamily: 'inherit' }}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '14px', fontWeight: 500, color: '#e4e4e7' }}>Company Name</label>
                            <input
                                value={config.company_name} onChange={e => setConfig({ ...config, company_name: e.target.value })}
                                style={{ backgroundColor: '#09090b', border: '1px solid #27272a', padding: '12px 16px', borderRadius: '8px', color: 'white', outline: 'none', fontFamily: 'inherit' }}
                            />
                        </div>
                    </div>

                    {/* Grid 2: Persona */}
                    <div style={{ borderTop: '1px solid #27272a', paddingTop: '32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ fontSize: '14px', fontWeight: 500, color: '#e4e4e7', display: 'block', marginBottom: '8px' }}>AI Voice model</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {GEMINI_VOICES.map(voice => (
                                        <div key={voice} style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                onClick={() => setConfig({ ...config, voice_id: voice })}
                                                style={{
                                                    flex: 1, display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s',
                                                    backgroundColor: config.voice_id === voice ? '#2dd4bf20' : '#09090b',
                                                    border: config.voice_id === voice ? '1px solid #2dd4bf50' : '1px solid #27272a',
                                                    color: config.voice_id === voice ? '#2dd4bf' : '#a1a1aa'
                                                }}
                                            >
                                                <Mic size={14} />
                                                <span style={{ fontSize: '13px', fontWeight: 500 }}>{voice}</span>
                                            </button>
                                            <button
                                                onClick={() => playPreview(voice, config.agent_name)}
                                                title={`Preview ${voice}`}
                                                style={{
                                                    width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s',
                                                    backgroundColor: playingVoice === voice ? '#2dd4bf20' : '#09090b',
                                                    border: playingVoice === voice ? '1px solid #2dd4bf50' : '1px solid #27272a',
                                                    color: playingVoice === voice ? '#2dd4bf' : '#a1a1aa'
                                                }}
                                            >
                                                {playingVoice === voice ? <Square size={14} /> : <Play size={14} />}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label style={{ fontSize: '14px', fontWeight: 500, color: '#e4e4e7', display: 'block', marginBottom: '8px' }}>Conversational Tone</label>
                                <select
                                    value={config.tone} onChange={e => setConfig({ ...config, tone: e.target.value })}
                                    style={{ width: '100%', backgroundColor: '#09090b', border: '1px solid #27272a', padding: '12px 16px', borderRadius: '8px', color: 'white', outline: 'none', fontFamily: 'inherit', appearance: 'none' }}
                                >
                                    {TONES.map(t => <option key={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Custom Instructions */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={{ fontSize: '14px', fontWeight: 500, color: '#e4e4e7' }}>Custom Instructions</label>
                            </div>
                            <textarea
                                value={config.custom_instructions || ''} onChange={e => setConfig({ ...config, custom_instructions: e.target.value })}
                                placeholder="E.g., Never offer discounts. Always mention the summer promotion. Do not ask more than 3 questions."
                                style={{ backgroundColor: '#09090b', border: '1px solid #27272a', padding: '16px', borderRadius: '8px', color: '#e4e4e7', outline: 'none', fontFamily: 'inherit', height: '100%', minHeight: '160px', resize: 'none', fontSize: '13px', lineHeight: '1.5' }}
                            />
                        </div>
                    </div>

                    {/* Knowledge Base */}
                    <div style={{ borderTop: '1px solid #27272a', paddingTop: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <div>
                                <label style={{ fontSize: '14px', fontWeight: 500, color: '#e4e4e7', display: 'block' }}>Company Knowledge Base</label>
                                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#71717a' }}>This text is injected instantly into the AI's brain. For fast response times, keep it under 600 words.</p>
                            </div>

                            <input type="file" ref={fileInputRef} onChange={handlePdfUpload} accept=".pdf" style={{ display: 'none' }} />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={parsingPdf}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', cursor: parsingPdf ? 'not-allowed' : 'pointer',
                                    backgroundColor: '#27272a', border: 'none', color: '#f4f4f5', fontSize: '13px', fontWeight: 500, transition: 'background-color 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#3f3f46'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#27272a'}
                            >
                                {parsingPdf ? (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                        <span className="spinner" style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                        Analyzing PDF...
                                    </span>
                                ) : (
                                    <>
                                        <Upload size={16} /> Auto-Extract from PDF
                                    </>
                                )}
                            </button>
                        </div>
                        <textarea
                            value={config.company_knowledge || ''} onChange={e => setConfig({ ...config, company_knowledge: e.target.value })}
                            placeholder="Paste your product facts, pricing, objection handling, and unique selling points here..."
                            style={{ backgroundColor: '#09090b', border: '1px solid #27272a', padding: '16px', borderRadius: '8px', color: '#e4e4e7', outline: 'none', fontFamily: 'inherit', minHeight: '200px', resize: 'vertical', fontSize: '13px', lineHeight: '1.6' }}
                        />
                    </div>

                </div>

                {/* Footer */}
                <div style={{ padding: '24px 32px', borderTop: '1px solid #27272a', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#141417', borderRadius: '0 0 20px 20px' }}>
                    <button onClick={onClose} style={{ padding: '10px 20px', backgroundColor: 'transparent', border: '1px solid #3f3f46', color: '#e4e4e7', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                        Cancel
                    </button>
                    <button
                        onClick={handleSave} disabled={saving}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', backgroundColor: '#2dd4bf', border: 'none', color: '#09090b', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 600, opacity: saving ? 0.7 : 1 }}
                    >
                        {saving ? 'Saving...' : <><Save size={16} /> Save Active Persona</>}
                    </button>
                </div>

                <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
            </div>
        </div>
    );
}
