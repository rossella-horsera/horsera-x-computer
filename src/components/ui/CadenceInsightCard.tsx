interface CadenceInsightCardProps {
  text: string;
  onAskMore?: () => void;
  compact?: boolean;
}

export default function CadenceInsightCard({
  text,
  onAskMore,
  compact = false,
}: CadenceInsightCardProps) {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #EAF0FB 0%, #F0F4FC 45%, #EEF2FA 100%)',
        borderRadius: '16px',
        padding: compact ? '12px 14px' : '14px 16px',
        border: '1px solid rgba(107,127,163,0.18)',
        boxShadow: [
          '0 2px 16px rgba(107,127,163,0.13)',
          '0 0 0 0.5px rgba(107,127,163,0.10)',
          'inset 0 1px 0 rgba(255,255,255,0.75)',
          'inset 0 0 32px rgba(107,127,163,0.05)',
        ].join(', '),
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle top-left luminescence */}
      <div style={{
        position: 'absolute', top: -20, left: -20,
        width: 100, height: 100, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(107,127,163,0.10) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '9px', position: 'relative' }}>
        {/* Cadence orb logo — with subtle glow ring */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            position: 'absolute', inset: -3,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(107,127,163,0.22) 0%, transparent 70%)',
          }} />
          <div style={{
            width: 22, height: 22,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #7B8FB5 0%, #6B7FA3 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 8px rgba(107,127,163,0.35)',
            position: 'relative',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#DCE6F5' }} />
          </div>
        </div>

        <span style={{
          fontSize: '10px', fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase' as const,
          color: '#5A6E90',
          fontFamily: "'DM Sans', sans-serif",
        }}>
          Cadence
        </span>

        <span style={{
          marginLeft: 'auto',
          fontSize: '9px',
          color: 'rgba(107,127,163,0.65)',
          fontFamily: "'DM Mono', monospace",
          letterSpacing: '0.06em',
        }}>
          AI insight
        </span>
      </div>

      <p style={{
        fontSize: compact ? '12.5px' : '13px',
        color: '#4A5568',
        lineHeight: 1.6,
        marginBottom: onAskMore ? '10px' : 0,
        fontFamily: "'DM Sans', sans-serif",
        position: 'relative',
      }}>
        {text}
      </p>

      {onAskMore && (
        <button
          onClick={onAskMore}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '12px', color: '#6B7FA3', fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif", padding: 0,
          }}
        >
          Ask Cadence more →
        </button>
      )}
    </div>
  );
}
