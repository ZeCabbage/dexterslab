/**
 * STT (Speech-to-Text) API Route
 *
 * Accepts audio data from the browser's MediaRecorder,
 * sends it to Gemini for transcription, and returns the text.
 *
 * POST /api/stt
 * Body: FormData with 'audio' file (WebM/WAV)
 * Response: { text: string } or { text: '', error: string }
 */

import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

let genai: GoogleGenAI | null = null;
if (GEMINI_API_KEY) {
  genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
}

export async function POST(request: Request) {
  if (!genai) {
    return NextResponse.json(
      { text: '', error: 'Gemini API key not configured' },
      { status: 503 }
    );
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { text: '', error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Convert the file to a buffer and then to base64
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Audio = buffer.toString('base64');

    // Determine MIME type (MediaRecorder typically gives audio/webm)
    const mimeType = audioFile.type || 'audio/webm';

    // Call Gemini with audio for transcription
    const response = await genai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Audio,
              },
            },
            {
              text: 'Transcribe this audio to text. Return ONLY the exact spoken words, nothing else. If there is no speech or it is unintelligible, return an empty string. Do not add any commentary, punctuation marks beyond what was spoken, or formatting.',
            },
          ],
        },
      ],
      config: {
        temperature: 0.0,
        maxOutputTokens: 256,
      },
    });

    const transcription = (response.text || '').trim();

    // Filter out meta-responses from Gemini (e.g., "There is no speech")
    const metaPatterns = [
      /no speech/i,
      /no audio/i,
      /unintelligible/i,
      /silence/i,
      /cannot transcribe/i,
      /empty/i,
      /there is nothing/i,
      /no spoken words/i,
    ];

    const isMetaResponse = metaPatterns.some((p) => p.test(transcription));

    return NextResponse.json({
      text: isMetaResponse ? '' : transcription,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('STT error:', message);
    return NextResponse.json(
      { text: '', error: message },
      { status: 500 }
    );
  }
}
