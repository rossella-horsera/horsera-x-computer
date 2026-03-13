import { useState, useEffect } from 'react';
import { getUserProfile, saveUserProfile } from '../lib/userProfile';
import type { UserProfile } from '../lib/userProfile';

const COLORS = {
  parchment: '#FAF7F3',
  cognac: '#8C5A3C',
  champagne: '#C9A96E',
  charcoal: '#1A140E',
  muted: '#B5A898',
  border: '#EDE7DF',
  cardBg: '#FFFFFF',
};

const FONTS = {
  heading: "'Playfair Display', serif",
  body: "'DM Sans', sans-serif",
  mono: "'DM Mono', monospace",
};

const DISCIPLINES = [
  { value: 'usdf-dressage', label: 'USDF Dressage' },
  { value: 'pony-club', label: 'Pony Club' },
  { value: 'hunter-jumper', label: 'Hunter / Jumper' },
  { value: 'a-bit-of-everything', label: 'A Bit of Everything' },
] as const;

interface ProfileSettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function ProfileSettingsPanel({ open, onClose }: ProfileSettingsPanelProps) {
  const [profile, setProfile] = useState<UserProfile>(getUserProfile);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      setProfile(getUserProfile());
      setSaved(false);
    }
  }, [open]);

  const handleSave = () => {
    saveUserProfile(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(26,20,14,0.3)', zIndex: 60,
          animation: 'fadeInBackdrop 0.2s ease-out',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '100%', maxWidth: '360px',
        background: COLORS.parchment, zIndex: 61,
        boxShadow: '-8px 0 30px rgba(26,20,14,0.12)',
        animation: 'slideInFromRight 0.25s ease-out',
        overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
      }}>
        <style>{`
          @keyframes slideInFromRight {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
          @keyframes fadeInBackdrop {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}</style>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px', borderBottom: `1px solid ${COLORS.border}`,
        }}>
          <div style={{ fontFamily: FONTS.heading, fontSize: '18px', color: COLORS.charcoal }}>
            Profile & Settings
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 4,
              display: 'flex', alignItems: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke={COLORS.charcoal} strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div style={{ padding: '20px', flex: 1 }}>
          {/* Profile Section */}
          <SectionLabel>Profile</SectionLabel>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '28px' }}>
            <FieldGroup label="Your First Name">
              <input
                type="text"
                value={profile.firstName}
                onChange={e => setProfile(p => ({ ...p, firstName: e.target.value }))}
                style={inputStyle}
                placeholder="e.g. Rossella"
              />
            </FieldGroup>

            <FieldGroup label="Horse's Name">
              <input
                type="text"
                value={profile.horseName}
                onChange={e => setProfile(p => ({ ...p, horseName: e.target.value }))}
                style={inputStyle}
                placeholder="e.g. Allegra"
              />
            </FieldGroup>

            <FieldGroup label="Discipline">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {DISCIPLINES.map(d => (
                  <button
                    key={d.value}
                    onClick={() => setProfile(p => ({ ...p, discipline: d.value as UserProfile['discipline'] }))}
                    style={{
                      padding: '10px 8px', borderRadius: '10px', fontSize: '12px',
                      fontFamily: FONTS.body, fontWeight: 500, cursor: 'pointer',
                      border: profile.discipline === d.value
                        ? `2px solid ${COLORS.cognac}`
                        : `1px solid ${COLORS.border}`,
                      background: profile.discipline === d.value ? `${COLORS.cognac}10` : COLORS.cardBg,
                      color: profile.discipline === d.value ? COLORS.cognac : COLORS.charcoal,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </FieldGroup>

            <button
              onClick={handleSave}
              style={{
                width: '100%', padding: '13px', borderRadius: '12px',
                background: saved ? '#7D9B76' : COLORS.cognac,
                color: COLORS.parchment, border: 'none', cursor: 'pointer',
                fontSize: '14px', fontWeight: 600, fontFamily: FONTS.body,
                transition: 'background 0.2s ease',
              }}
            >
              {saved ? '✓ Saved' : 'Save Changes'}
            </button>
          </div>

          {/* Settings Section */}
          <SectionLabel>Settings</SectionLabel>

          <div style={{
            display: 'flex', flexDirection: 'column', gap: '1px',
            background: COLORS.border, borderRadius: '12px', overflow: 'hidden',
            marginBottom: '28px',
          }}>
            <SettingRow label="Notifications" value="Coming soon" disabled />
            <SettingRow label="Units" value="Metric" disabled />
          </div>

          {/* About Section */}
          <SectionLabel>About</SectionLabel>

          <div style={{
            background: COLORS.cardBg, borderRadius: '12px', padding: '16px',
            border: `1px solid ${COLORS.border}`,
          }}>
            <div style={{
              fontFamily: FONTS.mono, fontSize: '11px', color: COLORS.muted,
              marginBottom: '6px',
            }}>
              Horsera MVP 0.1
            </div>
            <div style={{
              fontFamily: FONTS.body, fontSize: '12px', color: '#6B5E50',
            }}>
              Made with ♞ for riders
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Helper components ────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '10px', fontWeight: 600, letterSpacing: '0.14em',
      textTransform: 'uppercase' as const, color: '#B5A898',
      fontFamily: "'DM Sans', sans-serif", marginBottom: '12px',
    }}>
      {children}
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em',
        textTransform: 'uppercase' as const, color: '#B5A898',
        fontFamily: "'DM Sans', sans-serif", marginBottom: '6px',
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function SettingRow({ label, value, disabled }: { label: string; value: string; disabled?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '14px 16px', background: '#FFFFFF',
      opacity: disabled ? 0.5 : 1,
    }}>
      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#1A140E' }}>
        {label}
      </span>
      <span style={{
        fontFamily: "'DM Mono', monospace", fontSize: '11px',
        color: '#B5A898',
      }}>
        {value}
      </span>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: '10px',
  border: '1px solid #EDE7DF', background: '#FFFFFF',
  fontSize: '14px', fontFamily: "'DM Sans', sans-serif",
  color: '#1A140E', outline: 'none',
};
