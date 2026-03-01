import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

export async function createCalendarEvent(
    summary: string,
    description: string,
    startTimeIso: string,
    endTimeIso: string,
    attendeesEmails: string[]
) {
    // If no email configured, assume it's incomplete
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
        throw new Error('Google Calendar is not fully configured yet!');
    }

    // Handle the potentially escaped newlines from .env variables
    const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY || '';
    const formattedPrivateKey = rawPrivateKey.replace(/\\n/g, '\n');

    const auth = new google.auth.JWT(
        process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        undefined,
        formattedPrivateKey,
        SCOPES
    );

    const calendar = google.calendar({ version: 'v3', auth });

    const event = {
        summary: summary,
        description: description,
        start: {
            dateTime: startTimeIso,
            timeZone: 'Europe/Berlin',
        },
        end: {
            dateTime: endTimeIso,
            timeZone: 'Europe/Berlin',
        },
        attendees: attendeesEmails.map(email => ({ email })),
        conferenceData: {
            createRequest: {
                requestId: crypto.randomUUID(),
                conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
        },
    };

    try {
        const response = await calendar.events.insert({
            calendarId: 'primary',
            conferenceDataVersion: 1,
            sendUpdates: 'all',
            requestBody: event,
        });
        return response.data;
    } catch (error) {
        console.error('Error creating Calendar event:', error);
        throw error;
    }
}
