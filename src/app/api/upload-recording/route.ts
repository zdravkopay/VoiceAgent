import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(req: Request) {
    try {
        const { callId, audioBase64 } = await req.json();

        if (!callId || !audioBase64) {
            return NextResponse.json({ error: 'callId and audioBase64 are required' }, { status: 400 });
        }

        // Store recordings in /public/recordings/ (accessible via URL)
        const recordingsDir = path.join(process.cwd(), 'public', 'recordings');
        await mkdir(recordingsDir, { recursive: true });

        const fileName = `${callId}.wav`;
        const filePath = path.join(recordingsDir, fileName);

        // Decode base64 and write to disk
        const audioBuffer = Buffer.from(audioBase64, 'base64');
        await writeFile(filePath, audioBuffer);

        const recordingUrl = `/recordings/${fileName}`;
        console.log(`[Recording] Saved ${(audioBuffer.length / 1024).toFixed(0)}KB → ${filePath}`);

        // Try to update calls table with recording URL (if Supabase is available)
        try {
            const { createClient } = await import('@supabase/supabase-js');
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
                process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
            );
            await supabase
                .from('calls')
                .update({ recording_url: recordingUrl })
                .eq('call_id', callId);
        } catch {
            // Non-fatal — recording is still saved locally
        }

        return NextResponse.json({ success: true, recordingUrl }, { status: 200 });

    } catch (error: any) {
        console.error('Error saving recording:', error);
        return NextResponse.json({ error: error.message || 'Failed to save recording' }, { status: 500 });
    }
}
