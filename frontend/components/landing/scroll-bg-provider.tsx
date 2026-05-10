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
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(14,20,26,0.68)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}

export default function ScrollBgProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
