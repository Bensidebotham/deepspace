'use client'

import { useMemo } from 'react'

const RINGS = [
  { radius: 54,  count: 3, duration: 5.5, color: '#a5b4fc', size: 5 },
  { radius: 94,  count: 5, duration: 9,   color: '#818cf8', size: 4 },
  { radius: 138, count: 4, duration: 15,  color: '#6366f1', size: 3 },
]

const SIZE = 320

export default function GalaxyLoader({ repoName, onCancel }: { repoName: string; onCancel?: () => void }) {
  const stars = useMemo(() =>
    Array.from({ length: 80 }, (_, i) => ({
      id: i,
      x: (i * 137.508) % 100,
      y: (i * 97.3) % 100,
      size: 0.5 + (i % 5) * 0.35,
      opacity: 0.08 + (i % 7) * 0.07,
      duration: 1.5 + (i % 6),
      delay: (i % 9) * 0.4,
    }))
  , [])

  return (
    <>
      <style>{`
        @keyframes ds-twinkle {
          0%, 100% { opacity: var(--op); }
          50% { opacity: calc(var(--op) * 0.1); }
        }
        @keyframes ds-orbit {
          to { transform: rotate(360deg); }
        }
        @keyframes ds-breathe {
          0%, 100% {
            box-shadow:
              0 0 10px 3px rgba(129,140,248,0.45),
              0 0 30px 8px rgba(99,102,241,0.2),
              0 0 60px 18px rgba(79,70,229,0.08);
          }
          50% {
            box-shadow:
              0 0 16px 5px rgba(129,140,248,0.65),
              0 0 46px 14px rgba(99,102,241,0.3),
              0 0 90px 28px rgba(79,70,229,0.14);
          }
        }
        @keyframes ds-ring-glow {
          0%, 100% { opacity: 0.08; }
          50% { opacity: 0.22; }
        }
        @keyframes ds-appear {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{
        position: 'fixed', inset: 0,
        background: '#02020a',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>

        {/* Starfield — positions computed once, never re-rendered */}
        {stars.map(s => (
          <div key={s.id} style={{
            position: 'absolute',
            left: `${s.x}%`, top: `${s.y}%`,
            width: s.size, height: s.size,
            borderRadius: '50%',
            background: '#fff',
            '--op': s.opacity,
            opacity: s.opacity,
            animation: `ds-twinkle ${s.duration}s ${s.delay}s ease-in-out infinite`,
          } as React.CSSProperties} />
        ))}

        {/* Orbital system */}
        <div style={{ position: 'relative', width: SIZE, height: SIZE }}>

          {/* Nebula ambient glow */}
          <div style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 65%)',
            pointerEvents: 'none',
          }} />

          {/* Ring tracks */}
          {RINGS.map((ring, i) => (
            <div key={`track-${i}`} style={{
              position: 'absolute',
              width: ring.radius * 2, height: ring.radius * 2,
              borderRadius: '50%',
              border: `1px solid ${ring.color}`,
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              animation: `ds-ring-glow ${3 + i * 1.2}s ${i * 0.7}s ease-in-out infinite`,
            }} />
          ))}

          {/* Orbiting particles */}
          {RINGS.flatMap((ring, ri) =>
            Array.from({ length: ring.count }, (_, pi) => (
              <div key={`orbit-${ri}-${pi}`} style={{
                position: 'absolute',
                width: SIZE, height: SIZE,
                top: 0, left: 0,
                animation: `ds-orbit ${ring.duration}s ${-(pi / ring.count) * ring.duration}s linear infinite`,
              }}>
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: `calc(50% + ${ring.radius}px)`,
                  transform: 'translate(-50%, -50%)',
                  width: ring.size, height: ring.size,
                  borderRadius: '50%',
                  background: ring.color,
                  boxShadow: `0 0 ${ring.size * 2}px ${ring.size}px ${ring.color}55`,
                }} />
              </div>
            ))
          )}

          {/* Core */}
          <div style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 12, height: 12,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #e0e7ff 0%, #818cf8 60%, #4f46e5 100%)',
            animation: 'ds-breathe 2.5s ease-in-out infinite',
          }} />
        </div>

        {/* Label */}
        <div style={{
          marginTop: 52,
          textAlign: 'center',
          animation: 'ds-appear 0.9s 0.4s ease both',
          opacity: 0,
        }}>
          <p style={{
            color: '#3f3f46',
            fontSize: 10,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            marginBottom: 10,
            fontFamily: 'ui-monospace, "SF Mono", Consolas, monospace',
          }}>
            mapping constellation
          </p>
          <p style={{
            color: '#71717a',
            fontSize: 13,
            letterSpacing: '0.04em',
            fontFamily: 'ui-monospace, "SF Mono", Consolas, monospace',
          }}>
            {repoName}
          </p>
          {onCancel && (
            <button
              onClick={onCancel}
              style={{
                marginTop: 24,
                color: '#3f3f46',
                fontSize: 11,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                fontFamily: 'ui-monospace, "SF Mono", Consolas, monospace',
                background: 'none',
                border: '1px solid #27272a',
                borderRadius: 6,
                padding: '6px 16px',
                cursor: 'pointer',
                transition: 'color 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => {
                (e.target as HTMLButtonElement).style.color = '#a1a1aa'
                ;(e.target as HTMLButtonElement).style.borderColor = '#52525b'
              }}
              onMouseLeave={e => {
                (e.target as HTMLButtonElement).style.color = '#3f3f46'
                ;(e.target as HTMLButtonElement).style.borderColor = '#27272a'
              }}
            >
              cancel
            </button>
          )}
        </div>
      </div>
    </>
  )
}
