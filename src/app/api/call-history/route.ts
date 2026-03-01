import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// System Instruction for the post-call analysis
const SYSTEM_INSTRUCTION = `
You are a top-tier Sales Development Representative (SDR) Manager for a B2B SaaS product.
Your job is to analyze transcripts of inbound phone calls handled by your Voice AI Agent.
The caller reached out after reading a lead generation case study.

Analyze the transcript and provide a structured JSON response extracting the following:
1. "summary": A 2-3 sentence summary of the call.
2. "leadScore": Either "A", "B", or "C". A=Hot/Booked/Qualified. B=Warm/Might Need Followup. C=Cold/Unqualified/Dropped off.
3. "budget": Extracted budget indication if mentioned, otherwise null.
4. "need": The pain point or primary need the caller mentioned, otherwise null.
5. "timeline": When they need a solution, otherwise null.
6. "interest": Yes/No depending on if they showed clear interest.
7. "dropOffReason": If they didn't book a demo, why did they end the call or drop off? (e.g., "Too expensive", "No time"). Otherwise null.
8. "demoBooked": Boolean true/false if they successfully booked a demo.

Respond strictly in valid JSON format.
`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { callId, transcript, durationSeconds, callerNumber } = body;

    if (!transcript) {
      return NextResponse.json({ error: 'Transcript is required' }, { status: 400 });
    }

    // 1. Analyze Transcript with Gemini 2.5 Pro
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: transcript,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        temperature: 0.1, // Low temperature for consistent JSON
      }
    });

    const analysisResult = response.text ? JSON.parse(response.text) : null;

    if (!analysisResult) {
      throw new Error("Failed to parse Gemini analysis.");
    }

    // 2. Save into Supabase Database
    const { data, error } = await supabase
      .from('calls')
      .insert([
        {
          call_id: callId,
          caller_number: callerNumber,
          duration_seconds: durationSeconds,
          transcript: transcript,
          summary: analysisResult.summary,
          lead_score: analysisResult.leadScore,
          budget: analysisResult.budget,
          need: analysisResult.need,
          timeline: analysisResult.timeline,
          interest: analysisResult.interest,
          drop_off_reason: analysisResult.dropOffReason,
          demo_booked: analysisResult.demoBooked,
          created_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) {
      console.error('Supabase Error:', error);
      throw error;
    }

    // ── POST-CALL EMAIL PLACEHOLDER ──────────────────
    // TODO: Integrate email provider (Resend, Nodemailer, etc.)
    // When ready, uncomment and configure:
    //
    // const emailRecipient = process.env.NOTIFICATION_EMAIL;
    // if (emailRecipient && analysisResult) {
    //   await sendPostCallEmail({
    //     to: emailRecipient,
    //     summary: analysisResult.summary,
    //     leadScore: analysisResult.leadScore,
    //     demoBooked: analysisResult.demoBooked,
    //     callerNumber,
    //     duration: durationSeconds,
    //   });
    // }
    console.log(`[PostCall] Analysis complete — Lead Score: ${analysisResult.leadScore}, Demo: ${analysisResult.demoBooked}`);

    return NextResponse.json({ success: true, data: data[0] }, { status: 200 });

  } catch (error) {
    console.error('Error processing call:', error);
    return NextResponse.json({ error: 'Failed to process call' }, { status: 500 });
  }
}
