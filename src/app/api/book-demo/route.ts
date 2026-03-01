import { NextResponse } from 'next/server';

// Initialize Resend conditionally if API key exists
let resend: any = null;
if (process.env.RESEND_API_KEY) {
    const { Resend } = require('resend');
    resend = new Resend(process.env.RESEND_API_KEY);
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { userEmail, demoTopic } = body;

        if (!userEmail) {
            return NextResponse.json({ error: 'userEmail is required' }, { status: 400 });
        }

        console.log(`[Demo Booking] Preparing to send demo invite to ${userEmail} for topic: "${demoTopic}"`);

        // If Resend is configured, send actual email
        if (resend) {
            try {
                const data = await resend.emails.send({
                    from: 'Alex (Acme Corp) <onboarding@resend.dev>', // Update with a verified domain later
                    to: [userEmail],
                    subject: 'Demo Booking Confirmation: Acme Corp',
                    html: `
                        <h2>Hi there,</h2>
                        <p>This is Alex from Acme Corp confirming your demo booking!</p>
                        <p><strong>Topic:</strong> ${demoTopic || 'Platform Overview'}</p>
                        <p>I will send a formal calendar invite shortly. Looking forward to speaking with you!</p>
                        <br/>
                        <p>Best,<br/>Alex (AI Voice Agent)</p>
                    `
                });
                console.log('[Demo Booking] Email sent via Resend API:', data.id);
            } catch (emailError: any) {
                console.error('[Demo Booking] Failed to send via Resend:', emailError.message);
                // Don't fail the whole request, maybe just log it
            }
        } else {
            // Simulated email (Fallback if no API key)
            console.log('\n======================================================');
            console.log(`✉️ MOCK EMAIL SENT`);
            console.log(`To: ${userEmail}`);
            console.log(`Subject: Demo Booking Confirmation: Acme Corp`);
            console.log(`Body: Hi there, this is Alex from Acme Corp confirming your demo booking! Topic: ${demoTopic}`);
            console.log('======================================================\n');
            console.log('[Demo Booking] Note: Add RESEND_API_KEY in .env.local to send real emails.');
        }

        return NextResponse.json({ success: true, message: 'Demo booked successfully' }, { status: 200 });

    } catch (error) {
        console.error('Error booking demo:', error);
        return NextResponse.json({ error: 'Failed to book demo' }, { status: 500 });
    }
}
