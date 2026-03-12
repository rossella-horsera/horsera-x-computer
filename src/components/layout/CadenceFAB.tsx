interface CadenceFABProps {
  onClick: () => void;
}

export default function CadenceFAB({ onClick }: CadenceFABProps) {
  return (
    <div style={{
      position: 'fixed',
      bottom: '94px',
      right: '20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '6px',
      zIndex: 60,
    }}>

      {/* "Ask Cadence" label — always visible, soft invitation */}
      <div style={{
        background: 'rgba(28,21,16,0.72)',
        borderRadius: '8px',
        padding: '3px 9px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(201,169,110,0.22)',
        pointerEvents: 'none',
      }}>
        {/* Mic icon — SVG */}
        <svg width="9" height="11" viewBox="0 0 9 11" fill="none">
          <rect x="2.5" y="0.5" width="4" height="6" rx="2" fill="rgba(201,169,110,0.75)" />
          <path d="M1 5.5C1 7.43 2.57 9 4.5 9C6.43 9 8 7.43 8 5.5" stroke="rgba(201,169,110,0.75)" strokeWidth="1" strokeLinecap="round" />
          <line x1="4.5" y1="9" x2="4.5" y2="10.5" stroke="rgba(201,169,110,0.75)" strokeWidth="1" strokeLinecap="round" />
        </svg>
        <span style={{
          fontSize: '9px',
          color: 'rgba(201,169,110,0.85)',
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 500,
          letterSpacing: '0.04em',
          whiteSpace: 'nowrap',
        }}>
          Ask Cadence
        </span>
      </div>

      {/* FAB button */}
      <button
        onClick={onClick}
        aria-label="Open Cadence — your intelligent riding advisor"
        style={{
          position: 'relative',
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: '#1C1510',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'cadence-glow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          transition: 'transform 0.15s ease',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.07)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
      >
        {/* Sonar ripple — expands outward and fades */}
        <div style={{
          position: 'absolute',
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          border: '1.5px solid rgba(201,169,110,0.40)',
          animation: 'cadence-ripple 4s cubic-bezier(0.2, 0, 0.8, 1) infinite',
          pointerEvents: 'none',
        }} />

        {/* Inner orb — breathes with the organic timing */}
        <div style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 32% 32%, #E2C384 0%, #C9A96E 55%, #A8834E 100%)',
          boxShadow: '0 0 12px rgba(201,169,110,0.45), inset 0 1px 2px rgba(255,255,255,0.18)',
          animation: 'cadence-breathe 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {/* Pupil */}
          <div style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: '#1C1510',
            opacity: 0.85,
          }} />
        </div>
      </button>
    </div>
  );
}
