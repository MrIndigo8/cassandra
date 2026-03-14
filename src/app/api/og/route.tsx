import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Параметры из URL
    const type = searchParams.get('type') || 'dream'; // 'dream' или 'premonition'
    const title = searchParams.get('title') || 'Сигнал Без Заголовка';
    const username = searchParams.get('username') || 'Аноним';
    const intensity = parseInt(searchParams.get('intensity') || '0', 10);
    const dateStr = searchParams.get('date') || '';

    // Определение стилей на основе типа записи
    const isDream = type === 'dream';
    const typeLabel = isDream ? 'СОН' : 'ПРЕДЧУВСТВИЕ';
    const primaryColor = isDream ? '#38BFF8' : '#10B981'; // Голубой для снов, зелёный для предчувствий

    // Генерация точек интенсивности
    const dotsArray = Array.from({ length: 10 }).map((_, i) => (
      <div
        key={i}
        style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: i < intensity ? primaryColor : '#E5E7EB',
          marginRight: '6px',
        }}
      />
    ));

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            backgroundColor: '#FFFFFF',
            padding: '60px 80px',
            fontFamily: 'sans-serif',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#1F2937', display: 'flex' }}>
              🔮 Кассандра
            </div>
            
            <div
              style={{
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: '0.1em',
                color: primaryColor,
                border: `2px solid ${primaryColor}`,
                padding: '8px 16px',
                borderRadius: '8px',
                display: 'flex'
              }}
            >
              {typeLabel}
            </div>
          </div>

          {/* Main Content (Title) */}
          <div
            style={{
              display: 'flex',
              fontSize: 64,
              fontWeight: 800,
              color: '#111827',
              lineHeight: 1.2,
              marginTop: '40px',
              marginBottom: '40px',
              maxWidth: '900px',
              // Троеточие для длинного заголовка
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {title}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: 28, fontWeight: 600, color: '#1F2937', marginRight: '16px', display: 'flex' }}>
                  {username}
                </div>
                {dateStr && (
                  <div style={{ fontSize: 24, color: '#6B7280', display: 'flex' }}>
                    • {dateStr}
                  </div>
                )}
              </div>

              {intensity > 0 && (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '0.1em', color: '#9CA3AF', marginRight: '16px', display: 'flex' }}>
                    ИНТЕНСИВНОСТЬ
                  </div>
                  <div style={{ display: 'flex' }}>
                    {dotsArray}
                  </div>
                </div>
              )}
            </div>

            <div style={{ fontSize: 24, fontWeight: 500, color: '#9CA3AF', display: 'flex' }}>
              cassandra.app
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: unknown) {
    console.error(e);
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}
