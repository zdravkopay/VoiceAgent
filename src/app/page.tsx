import Dashboard from '@/components/Dashboard/Dashboard';
import VoiceAgentClient from '@/components/Dashboard/VoiceAgentClient';
import { Cpu, Shield, BrainCircuit, CalendarCheck, BarChart3 } from 'lucide-react';

export const metadata = {
  title: 'Voice Agent — AI Sales Console',
  description: 'Real-time B2B voice SDR powered by Gemini Native Audio',
};

export default function Home() {
  return (
    <>
      <div className="bg-orbs" aria-hidden="true" />

      <main className="relative z-10 min-h-screen">

        {/* ── NAV BAR ─────────────────────────────────────── */}
        <nav style={{
          position: 'sticky', top: 0, zIndex: 50,
          borderBottom: '1px solid #222228',
          backgroundColor: 'rgba(10,10,11,0.95)',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 32px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '6px',
                backgroundColor: '#1c1c22', border: '1px solid #222228',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#71717a', fontWeight: 600, fontSize: '11px'
              }}>
                VA
              </div>
              <span style={{ fontWeight: 500, color: '#e4e4e7', fontSize: '14px', letterSpacing: '-0.01em' }}>Voice Agent</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '4px 10px', borderRadius: '6px',
                backgroundColor: '#141417', border: '1px solid #222228'
              }}>
                <span className="status-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#34d399' }} />
                <span style={{ fontSize: '12px', color: '#71717a' }}>Online</span>
              </div>
              <span className="hidden md:block" style={{ fontSize: '12px', color: '#52525b', fontFamily: 'monospace' }}>
                gemini-2.5-flash
              </span>
            </div>
          </div>
        </nav>

        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '64px 32px' }}>

          {/* ── HERO HEADER ─────────────────────────────────── */}
          <div className="animate-fade-in-up" style={{ textAlign: 'center', marginBottom: '64px' }}>
            <h1 style={{ fontSize: '48px', fontWeight: 700, letterSpacing: '-0.03em', color: '#e4e4e7', lineHeight: 1.1, marginBottom: '16px' }}>
              AI Sales Agent
            </h1>
            <p style={{ fontSize: '16px', color: '#71717a', maxWidth: '480px', margin: '0 auto', lineHeight: 1.6 }}>
              Meet <strong style={{ color: '#a1a1aa' }}>Alex</strong> — an autonomous B2B SDR that
              qualifies leads, handles objections, and books demos in real time.
            </p>
          </div>

          {/* ── MAIN GRID ────────────────────────────────────── */}
          <div className="animate-fade-in-up" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '32px', alignItems: 'start', animationDelay: '0.1s', marginBottom: '80px' }}>

            <VoiceAgentClient />

            {/* Right: How It Works */}
            <div style={{ backgroundColor: '#141417', border: '1px solid #222228', borderRadius: '16px', padding: '32px' }}>
              <div style={{ marginBottom: '28px' }}>
                <p style={{ fontSize: '11px', fontWeight: 500, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>How It Works</p>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#e4e4e7' }}>Architecture Flow</h2>
              </div>

              <ol style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {[
                  { Icon: Cpu, title: 'Mic Capture', desc: 'Browser streams 16kHz PCM audio via Web Audio API ScriptProcessor.' },
                  { Icon: Shield, title: 'Secure WS Proxy', desc: 'Your API key never touches the browser. Node.js proxy forwards to Gemini.' },
                  { Icon: BrainCircuit, title: 'Gemini Native Audio', desc: 'gemini-2.5-flash processes raw audio — no STT/TTS pipeline, true end-to-end.' },
                  { Icon: CalendarCheck, title: 'Function Calling', desc: 'Say "Book a demo" → Gemini calls bookCalendarDemo → Google Calendar invite sent.' },
                  { Icon: BarChart3, title: 'Live Analytics', desc: 'Post-call analysis hits Supabase. Dashboard updates in real-time via WebSocket.' }
                ].map((step, i) => (
                  <li key={i} style={{ display: 'flex', gap: '16px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0,
                      backgroundColor: '#1c1c22', border: '1px solid #222228',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <step.Icon style={{ width: '16px', height: '16px', color: '#71717a' }} />
                    </div>
                    <div style={{ paddingTop: '2px' }}>
                      <p style={{ fontSize: '14px', fontWeight: 500, color: '#e4e4e7' }}>{step.title}</p>
                      <p style={{ fontSize: '12px', color: '#71717a', lineHeight: 1.5, marginTop: '4px' }}>{step.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>

              {/* Tech badges */}
              <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #222228' }}>
                <p style={{ fontSize: '11px', color: '#52525b', marginBottom: '12px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Powered By</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {['Gemini 2.5', 'Next.js', 'Supabase', 'Google Calendar', 'Web Audio API'].map(t => (
                    <span key={t} style={{
                      fontSize: '11px', padding: '4px 10px', borderRadius: '6px',
                      backgroundColor: '#1c1c22', border: '1px solid #222228',
                      color: '#52525b', fontFamily: 'monospace'
                    }}>{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── SEPARATOR ────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '48px' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#222228' }} />
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Analytics</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#222228' }} />
          </div>

          {/* ── DASHBOARD ────────────────────────────────────── */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <Dashboard />
          </div>

        </div>

        {/* ── FOOTER ───────────────────────────────────────── */}
        <footer style={{ borderTop: '1px solid #222228', marginTop: '80px', padding: '32px', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: '#52525b', fontFamily: 'monospace' }}>
            Voice Agent Console&nbsp;·&nbsp;
            Gemini Native Audio&nbsp;·&nbsp;
            Next.js + Supabase
          </p>
        </footer>

      </main>
    </>
  );
}
