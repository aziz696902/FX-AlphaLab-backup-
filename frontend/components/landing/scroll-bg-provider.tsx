'use client';

import { useEffect, useState } from 'react';

interface ImageOpacities {
  img1: number;
  img2: number;
  img3: number;
}

function getImageOpacities(p: number): ImageOpacities {
  // Zone 1:  0–28% fully visible, 28–34% fade out, >34% gone
  const img1 =
    p < 0.28 ? 1 :
    p < 0.34 ? (0.34 - p) / 0.06 :
    0;

  // Zone 2:  35–40% fade in, 40–60% fully visible, 60–66% fade out, else gone
  const img2 =
    p < 0.35 ? 0 :
    p < 0.40 ? (p - 0.35) / 0.05 :
    p < 0.60 ? 1 :
    p < 0.66 ? (0.66 - p) / 0.06 :
    0;

  // Zone 3:  67–72% fade in, 72–100% fully visible
  const img3 =
    p < 0.67 ? 0 :
    p < 0.72 ? (p - 0.67) / 0.05 :
    1;

  return { img1, img2, img3 };
}

export default function ScrollBgProvider({ children }: { children: React.ReactNode }) {
  const [opacities, setOpacities] = useState<ImageOpacities>({ img1: 1, img2: 0, img3: 0 });

  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? scrollY / max : 0;
      setOpacities(getImageOpacities(p));
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const bgStyle = (src: string, opacity: number): React.CSSProperties => ({
    position: 'fixed',
    inset: 0,
    zIndex: 0,
    backgroundImage: `url('${src}')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    opacity,
    transition: 'opacity 0.15s linear',
    pointerEvents: 'none',
  });

  return (
    <div className="relative w-full min-h-screen">
      {/* Pure black base — visible in the gaps between images */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, background: '#000', pointerEvents: 'none' }} />

      <div style={bgStyle('/hero-bg.png', opacities.img1)} />
      <div style={bgStyle('/bg-scroll-1.png', opacities.img2)} />
      <div style={bgStyle('/bg-scroll-2.png', opacities.img3)} />

      {/* Dark overlay for text readability */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
          background: 'linear-gradient(180deg, rgba(14,20,26,0.55) 0%, rgba(14,20,26,0.72) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Page content */}
      <div className="relative" style={{ zIndex: 2 }}>
        {children}
      </div>
    </div>
  );
}
