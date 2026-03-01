"use client";

import React, { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Phone, Calendar, Target, Clock, Check, X, Mic, Play, Pause, ChevronDown, ChevronUp } from 'lucide-react';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

type Call = {
    call_id: string;
    caller_number: string;
    caller_name?: string;
    duration_seconds: number;
    lead_score: 'A' | 'B' | 'C';
    summary: string;
    demo_booked: boolean;
    drop_off_reason?: string;
    created_at: string;
    recording_url?: string;
    transcript?: string;
};

type Metrics = {
    totalCalls: number;
    demosBooked: number;
    conversionRate: string;
    avgDuration: string;
    scores: { A: number; B: number; C: number };
};

export default function Dashboard() {
    const [calls, setCalls] = useState<Call[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [metrics, setMetrics] = useState<Metrics>({
        totalCalls: 0, demosBooked: 0, conversionRate: '—', avgDuration: '—',
        scores: { A: 0, B: 0, C: 0 }
    });

    useEffect(() => {
        fetchCalls();
        const channel = supabase
            .channel('calls-realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calls' }, () => fetchCalls())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchCalls = async () => {
        setLoading(true);
        const { data } = await supabase.from('calls').select('*').order('created_at', { ascending: false });
        if (data) {
            setCalls(data);
            computeMetrics(data);
        }
        setLoading(false);
    };

    const computeMetrics = (data: Call[]) => {
        const total = data.length;
        if (total === 0) return;
        const booked = data.filter(c => c.demo_booked).length;
        const totalSec = data.reduce((s, c) => s + (c.duration_seconds || 0), 0);
        const avg = Math.round(totalSec / total);
        const scores = { A: 0, B: 0, C: 0 };
        data.forEach(c => { if (c.lead_score in scores) scores[c.lead_score as 'A' | 'B' | 'C']++; });
        setMetrics({
            totalCalls: total,
            demosBooked: booked,
            conversionRate: total ? `${((booked / total) * 100).toFixed(1)}%` : '—',
            avgDuration: avg >= 60 ? `${Math.floor(avg / 60)}m ${avg % 60}s` : `${avg}s`,
            scores
        });
    };

    const scoreMax = Math.max(metrics.scores.A, metrics.scores.B, metrics.scores.C, 1);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

            {/* ── KPI CARDS ────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                <KpiCard label="Total Calls" value={loading ? '—' : metrics.totalCalls.toString()} sub="All time" accent="#5eead4" Icon={Phone} />
                <KpiCard label="Demos Booked" value={loading ? '—' : metrics.demosBooked.toString()} sub="Confirmed" accent="#34d399" Icon={Calendar} />
                <KpiCard label="Conversion" value={loading ? '—' : metrics.conversionRate} sub="Call → Demo" accent="#60a5fa" Icon={Target} />
                <KpiCard label="Avg. Duration" value={loading ? '—' : metrics.avgDuration} sub="Per call" accent="#fbbf24" Icon={Clock} />
            </div>

            {/* ── LEAD SCORE BARS ──────────────────────────── */}
            <div style={{ backgroundColor: '#141417', border: '1px solid #222228', borderRadius: '16px', padding: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <div>
                        <p style={{ fontSize: '11px', color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500, marginBottom: '4px' }}>BANT Qualification</p>
                        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#e4e4e7' }}>Lead Score Distribution</h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '12px', color: '#71717a' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#34d399' }} />Hot (A)</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#fbbf24' }} />Warm (B)</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f87171' }} />Cold (C)</span>
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {([
                        { label: 'Score A — Hot', count: metrics.scores.A, color: '#34d399' },
                        { label: 'Score B — Warm', count: metrics.scores.B, color: '#fbbf24' },
                        { label: 'Score C — Cold', count: metrics.scores.C, color: '#f87171' },
                    ]).map(({ label, count, color }) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <span style={{ fontSize: '12px', color: '#71717a', width: '112px', flexShrink: 0 }}>{label}</span>
                            <div style={{ flex: 1, height: '8px', backgroundColor: '#1c1c22', borderRadius: '9999px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', borderRadius: '9999px', backgroundColor: color, width: `${(count / scoreMax) * 100}%`, transition: 'width 0.7s ease' }} />
                            </div>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: '#e4e4e7', width: '24px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── CALLS TABLE ──────────────────────────────── */}
            <div style={{ backgroundColor: '#141417', border: '1px solid #222228', borderRadius: '16px', overflow: 'hidden' }}>
                <div style={{ padding: '20px 32px', borderBottom: '1px solid #222228', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <p style={{ fontSize: '11px', color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500, marginBottom: '4px' }}>Feed</p>
                        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#e4e4e7' }}>Live Call Activity</h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="status-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#34d399' }} />
                        <span style={{ fontSize: '12px', color: '#71717a' }}>Realtime</span>
                    </div>
                </div>

                {loading ? (
                    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {[1, 2, 3].map(i => (<div key={i} className="shimmer" style={{ height: '48px', borderRadius: '8px' }} />))}
                    </div>
                ) : calls.length === 0 ? (
                    <div style={{ padding: '80px 32px', textAlign: 'center' }}>
                        <Mic style={{ width: '24px', height: '24px', margin: '0 auto 12px', color: '#52525b' }} />
                        <p style={{ fontSize: '14px', color: '#71717a' }}>No calls yet. Start a conversation with Alex.</p>
                    </div>
                ) : (
                    <div>
                        <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #222228' }}>
                                    {['', 'Time', 'Caller', 'Duration', 'Score', 'Summary', 'Result', ''].map((h, i) => (
                                        <th key={i} style={{ padding: '16px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 500, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.08em', width: i === 0 ? '40px' : i === 7 ? '50px' : 'auto' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {calls.map((call, idx) => {
                                    const isExpanded = expandedCallId === call.call_id;
                                    const hasTranscript = !!call.transcript;
                                    return (
                                        <React.Fragment key={call.call_id}>
                                            <tr
                                                onClick={() => hasTranscript && setExpandedCallId(isExpanded ? null : call.call_id)}
                                                style={{
                                                    borderBottom: isExpanded ? 'none' : (idx < calls.length - 1 ? '1px solid rgba(34,34,40,0.5)' : 'none'),
                                                    cursor: hasTranscript ? 'pointer' : 'default',
                                                    transition: 'background-color 0.15s',
                                                    backgroundColor: isExpanded ? '#1a1a1f' : 'transparent'
                                                }}
                                                onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLTableRowElement).style.backgroundColor = '#18181d'; }}
                                                onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'transparent'; }}
                                            >
                                                {/* Expand indicator */}
                                                <td style={{ padding: '16px 12px 16px 20px', width: '40px' }}>
                                                    {hasTranscript && (
                                                        isExpanded
                                                            ? <ChevronUp style={{ width: '14px', height: '14px', color: '#5eead4' }} />
                                                            : <ChevronDown style={{ width: '14px', height: '14px', color: '#52525b' }} />
                                                    )}
                                                </td>
                                                <td style={{ padding: '16px 20px', fontSize: '12px', color: '#71717a', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                                                    {new Date(call.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td style={{ padding: '16px 20px', fontSize: '14px', color: '#a1a1aa', fontFamily: 'monospace' }}>
                                                    {call.caller_name || call.caller_number || 'Unknown'}
                                                </td>
                                                <td style={{ padding: '16px 20px', fontSize: '12px', color: '#71717a', fontVariantNumeric: 'tabular-nums' }}>
                                                    {call.duration_seconds >= 60
                                                        ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s`
                                                        : `${call.duration_seconds}s`}
                                                </td>
                                                <td style={{ padding: '16px 20px' }}>
                                                    <ScoreBadge score={call.lead_score} />
                                                </td>
                                                <td style={{ padding: '16px 20px', maxWidth: '220px' }}>
                                                    <p style={{ fontSize: '12px', color: '#71717a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={call.summary}>
                                                        {call.summary || <span style={{ color: '#52525b', fontStyle: 'italic' }}>No summary</span>}
                                                    </p>
                                                </td>
                                                <td style={{ padding: '16px 20px' }}>
                                                    {call.demo_booked ? (
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#34d399', fontWeight: 500 }}>
                                                            <Check style={{ width: '14px', height: '14px' }} />
                                                            Booked
                                                        </span>
                                                    ) : (
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#52525b' }}>
                                                            <X style={{ width: '14px', height: '14px' }} />
                                                            {call.drop_off_reason || '—'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '16px 20px' }} onClick={e => e.stopPropagation()}>
                                                    {call.recording_url && <PlayButton url={call.recording_url} />}
                                                </td>
                                            </tr>

                                            {/* ── EXPANDED TRANSCRIPT ROW ───── */}
                                            {isExpanded && call.transcript && (
                                                <tr key={`${call.call_id}-transcript`}>
                                                    <td colSpan={8} style={{ padding: '0 20px 20px 20px', backgroundColor: '#1a1a1f', borderBottom: idx < calls.length - 1 ? '1px solid rgba(34,34,40,0.5)' : 'none' }}>
                                                        <div style={{
                                                            backgroundColor: '#141417', border: '1px solid #222228', borderRadius: '12px',
                                                            padding: '24px', maxHeight: '400px', overflowY: 'auto'
                                                        }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                                                <p style={{ fontSize: '12px', fontWeight: 600, color: '#e4e4e7' }}>Call Transcript</p>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                    {call.recording_url && <PlayButton url={call.recording_url} />}
                                                                    <span style={{ fontSize: '11px', color: '#52525b', fontFamily: 'monospace' }}>
                                                                        {call.duration_seconds}s · Score {call.lead_score}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                                {call.transcript.split('\n').filter(line => line.trim()).map((line, li) => {
                                                                    const isAlex = line.startsWith('Alex:');
                                                                    const isCaller = line.startsWith('Caller:');
                                                                    const speaker = isAlex ? 'Alex' : isCaller ? 'Caller' : null;
                                                                    const content = speaker ? line.substring(line.indexOf(':') + 1).trim() : line;

                                                                    return (
                                                                        <div key={li} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                                                            {speaker && (
                                                                                <span style={{
                                                                                    fontSize: '10px', fontWeight: 600, textTransform: 'uppercase',
                                                                                    letterSpacing: '0.05em', flexShrink: 0, width: '52px', paddingTop: '3px',
                                                                                    color: isAlex ? '#5eead4' : '#a1a1aa'
                                                                                }}>
                                                                                    {speaker}
                                                                                </span>
                                                                            )}
                                                                            <p style={{
                                                                                fontSize: '13px', lineHeight: 1.6,
                                                                                color: isAlex ? '#a1a1aa' : '#e4e4e7',
                                                                                padding: '6px 12px', borderRadius: '8px',
                                                                                backgroundColor: isAlex ? '#1c1c22' : 'rgba(94,234,212,0.05)',
                                                                                border: `1px solid ${isAlex ? '#222228' : 'rgba(94,234,212,0.1)'}`,
                                                                                flex: 1
                                                                            }}>
                                                                                {content}
                                                                            </p>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── PLAY BUTTON ──────────────────────────────────── */
function PlayButton({ url }: { url: string }) {
    const [playing, setPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const toggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!audioRef.current) {
            audioRef.current = new Audio(url);
            audioRef.current.onended = () => setPlaying(false);
        }
        if (playing) {
            audioRef.current.pause();
            setPlaying(false);
        } else {
            audioRef.current.play().catch(() => { });
            setPlaying(true);
        }
    };

    return (
        <button onClick={toggle} title={playing ? 'Pause' : 'Play recording'}
            className="cursor-pointer"
            style={{
                width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #222228',
                backgroundColor: playing ? 'rgba(94,234,212,0.1)' : '#1c1c22',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: playing ? '#5eead4' : '#71717a',
                transition: 'all 0.15s'
            }}
            onMouseEnter={e => { if (!playing) e.currentTarget.style.borderColor = '#333'; }}
            onMouseLeave={e => { if (!playing) e.currentTarget.style.borderColor = '#222228'; }}
        >
            {playing ? <Pause style={{ width: '14px', height: '14px' }} /> : <Play style={{ width: '14px', height: '14px' }} />}
        </button>
    );
}

function KpiCard({ label, value, sub, accent, Icon }: {
    label: string; value: string; sub: string;
    accent: string; Icon: React.ComponentType<{ style?: React.CSSProperties }>
}) {
    return (
        <div style={{
            backgroundColor: '#141417', border: '1px solid #222228', borderRadius: '16px',
            padding: '24px', position: 'relative', overflow: 'hidden',
            transition: 'border-color 0.2s'
        }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#333338'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#222228'; }}
        >
            <div style={{
                position: 'absolute', left: 0, top: '12px', bottom: '12px',
                width: '3px', borderRadius: '9999px', backgroundColor: accent
            }} />
            <div style={{ paddingLeft: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 500, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
                    <Icon style={{ width: '16px', height: '16px', color: '#52525b' }} />
                </div>
                <p style={{ fontSize: '30px', fontWeight: 700, letterSpacing: '-0.02em', color: '#e4e4e7', marginBottom: '4px', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
                <p style={{ fontSize: '12px', color: '#52525b' }}>{sub}</p>
            </div>
        </div>
    );
}

function ScoreBadge({ score }: { score: 'A' | 'B' | 'C' }) {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
        A: { bg: 'rgba(52,211,153,0.1)', text: '#34d399', border: 'rgba(52,211,153,0.2)' },
        B: { bg: 'rgba(251,191,36,0.1)', text: '#fbbf24', border: 'rgba(251,191,36,0.2)' },
        C: { bg: 'rgba(248,113,113,0.1)', text: '#f87171', border: 'rgba(248,113,113,0.2)' },
    };
    const c = colors[score] || colors.C;
    const labels: Record<string, string> = { A: 'Hot', B: 'Warm', C: 'Cold' };
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
            backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}`
        }}>
            {score} · {labels[score] || '?'}
        </span>
    );
}
