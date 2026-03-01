import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import pdfParse from 'pdf-parse';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SUMMARIZATION_PROMPT = `
You are an expert AI knowledge architect. Your task is to compress the provided company document into a strict 1-page plain-text knowledge base, specifically optimized to be injected into the system prompt of a real-time AI Voice Agent.

RULES for the output:
1. MAX 600 WORDS.
2. Use absolute plain text. No markdown, no bolding, no complex tables. Just clean, easily readable lists and paragraphs.
3. Extract ONLY the core facts an SDR agent needs:
   - What the product is and who it's for.
   - Core value propositions / benefits.
   - Exact pricing or tier structures (if mentioned).
   - Common objections and their rebuttals.
   - Key FAQs.
4. Omit all marketing fluff, history, team bios, legal jargon, or table of contents. Focus purely on sales-enablement facts.

Format it cleanly so a voice AI can instantly read and understand it mid-conversation without structural confusion.
`;

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
            return NextResponse.json({ error: 'Please upload a valid PDF file.' }, { status: 400 });
        }

        // 1. Read file into buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 2. Extract raw text from PDF
        console.log(`[PDF Parser] Extracting text from ${file.name} (${buffer.byteLength} bytes)...`);
        const pdfData = await pdfParse(buffer);
        const rawText = pdfData.text;

        if (!rawText || rawText.trim() === '') {
            return NextResponse.json({ error: 'Could not extract text from this PDF. It may be an image-based scan.' }, { status: 400 });
        }

        console.log(`[PDF Parser] Extracted ${rawText.length} characters of raw text. Summarizing with Gemini...`);

        // 3. Summarize / Compress using Gemini 2.5 Pro
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: rawText,
            config: {
                systemInstruction: SUMMARIZATION_PROMPT,
                temperature: 0.1, // Keep it factual
            }
        });

        const summarizedKnowledge = response.text;

        if (!summarizedKnowledge) {
            throw new Error("Failed to generate knowledge base summary.");
        }

        console.log(`[PDF Parser] Success. Generated compressed knowledge base of ${summarizedKnowledge.length} chars.`);

        return NextResponse.json({ success: true, knowledgeBase: summarizedKnowledge }, { status: 200 });

    } catch (error: any) {
        console.error('[PDF Parser Error]:', error);
        return NextResponse.json({ error: error.message || 'Failed to parse PDF' }, { status: 500 });
    }
}
