import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('type') || 'dream';

    if (mode === 'match') {
      const score = Math.max(0, Math.min(100, Number(searchParams.get('score') || 0)));
      const quote = searchParams.get('quote') || 'Сигнал пользователя';
      const eventTitle = searchParams.get('event_title') || 'Совпадение с событием';
      const author = searchParams.get('author') || 'Аноним';
      const dateStr = searchParams.get('date') || '';
      const size = searchParams.get('size') === 'story' ? 'story' : 'og';

      const width = size === 'story' ? 1080 : 1200;
      const height = size === 'story' ? 1920 : 630;
      const titleSize = size === 'story' ? 54 : 42;
      const scoreSize = size === 'story' ? 112 : 88;
      const pad = size === 'story' ? 72 : 56;

      return new ImageResponse(
        (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              background: 'linear-gradient(180deg, #0B0F1A 0%, #131B2E 100%)',
              color: '#E2E8F0',
              padding: `${pad}px`,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: size === 'story' ? 46 : 34, fontWeight: 700, display: 'flex' }}>🔮 Cassandra</div>
              <div style={{ fontSize: 24, color: '#A78BFA', display: 'flex' }}>match</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ fontSize: titleSize, fontWeight: 700, lineHeight: 1.25, display: 'flex' }}>
                “{quote.length > 160 ? `${quote.slice(0, 157)}...` : quote}”
              </div>
              <div style={{ fontSize: 24, color: '#94A3B8', display: 'flex' }}>
                {author}{dateStr ? ` • ${dateStr}` : ''}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ fontSize: scoreSize, fontWeight: 800, color: '#10B981', display: 'flex' }}>{score}%</div>
                <div style={{ fontSize: 22, color: '#A78BFA', display: 'flex' }}>подтверждено</div>
              </div>
              <div style={{ fontSize: 28, lineHeight: 1.25, color: '#E2E8F0', display: 'flex' }}>
                {eventTitle.length > 120 ? `${eventTitle.slice(0, 117)}...` : eventTitle}
              </div>
              <div style={{ fontSize: 22, color: '#94A3B8', display: 'flex' }}>cassandra.app</div>
            </div>
          </div>
        ),
        { width, height }
      );
    }

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
