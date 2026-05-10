'use client';

import { useEffect, useState, useRef } from 'react';

export default function ScrollBgProvider({ children }: { children: React.ReactNode }) {
  const [currentBg, setCurrentBg] = useState('/hero-bg.png');
  const [nextBg, setNextBg] = useState('/bg-scroll-1.png');
  const [bgOpacity, setBgOpacity] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = docHeight > 0 ? scrollY / docHeight : 0;

      // Determine which backgrounds to show based on scroll progress
      if (scrollPercent < 0.33) {
        // First third: transition from hero-bg to bg-scroll-1
        setCurrentBg('/hero-bg.png');
        setNextBg('/bg-scroll-1.png');
        setBgOpacity(scrollPercent / 0.33);
      } else if (scrollPercent < 0.66) {
        // Second third: transition from bg-scroll-1 to bg-scroll-2
        setCurrentBg('/bg-scroll-1.png');
        setNextBg('/bg-scroll-2.png');
        setBgOpacity((scrollPercent - 0.33) / 0.33);
      } else {
        // Last third: stay on bg-scroll-2
        setCurrentBg('/bg-scroll-2.png');
        setNextBg('');
        setBgOpacity(1);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full min-h-screen">
      {/* Base image layer */}
      <div
        className="fixed inset-0 w-full h-screen"
        style={{
          zIndex: 0,
          backgroundImage: `url('${currentBg}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* Next image fading in on scroll */}
      {nextBg && (
        <div
          className="fixed inset-0 w-full h-screen"
          style={{
            zIndex: 1,
            backgroundImage: `url('${nextBg}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: bgOpacity,
          }}
        />
      )}

      {/* Dark overlay for readability */}
      <div
        className="fixed inset-0 w-full h-screen"
        style={{
          zIndex: 2,
          background: `linear-gradient(
            180deg,
            rgba(14, 20, 26, 0.7) 0%,
            rgba(14, 20, 26, 0.8) 50%,
            rgba(14, 20, 26, 0.85) 100%
          )`,
        }}
      />

      {/* Content above all background layers */}
      <div className="relative" style={{ zIndex: 3 }}>
        {children}
      </div>
    </div>
  );
}
