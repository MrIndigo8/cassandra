import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Deprecated endpoint. Use /api/noosphere-data.
export async function GET() {
  return NextResponse.json(
    {
      error: 'Deprecated endpoint. Use /api/noosphere-data',
    },
    { status: 410 }
  );
}
