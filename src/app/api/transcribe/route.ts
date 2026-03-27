import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not configured' }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
    }

    const upstreamFormData = new FormData();
    upstreamFormData.append('model', 'whisper-1');
    upstreamFormData.append('file', file);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: upstreamFormData,
    });

    if (!response.ok) {
      const message = await response.text();
      return NextResponse.json({ error: `Transcription failed: ${message}` }, { status: 502 });
    }

    const data = await response.json();
    return NextResponse.json({ text: data.text ?? '' });
  } catch (error) {
    console.error('API /transcribe error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
