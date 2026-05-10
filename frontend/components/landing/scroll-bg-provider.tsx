'use client';

interface ZoneProps {
  bg: string;
  children: React.ReactNode;
}

export function BgZone({ bg, children }: ZoneProps) {
  return (
    <div
      style={{
        backgroundImage: `url('${bg}')`,

        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative',
      }}
    >
      {/* dark tint */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(14,20,26,0.68)', pointerEvents: 'none' }} />
      {/* fade from black at top */}
      <div style={{ position: 'absolute', inset: 0, top: 0, height: 220, background: 'linear-gradient(to bottom, #000 0%, transparent 100%)', pointerEvents: 'none', zIndex: 1 }} />
      {/* fade to black at bottom */}
      <div style={{ position: 'absolute', inset: 0, top: 'auto', bottom: 0, height: 220, background: 'linear-gradient(to top, #000 0%, transparent 100%)', pointerEvents: 'none', zIndex: 1 }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}

export default function ScrollBgProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
