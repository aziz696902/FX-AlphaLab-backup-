'use client';

import { useEffect, useState, useRef } from 'react';

export default function ScrollBgProvider({ children }: { children: React.ReactNode }) {
  const [currentBg, setCurrentBg] = useState('/hero-bg.jpg');
  const [nextBg, setNextBg] = useState('/bg-scroll-1.jpg');
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
        setCurrentBg('/hero-bg.jpg');
        setNextBg('/bg-scroll-1.jpg');
        setBgOpacity(scrollPercent / 0.33);
      } else if (scrollPercent < 0.66) {
        // Second third: transition from bg-scroll-1 to bg-scroll-2
        setCurrentBg('/bg-scroll-1.jpg');
        setNextBg('/bg-scroll-2.jpg');
        setBgOpacity((scrollPercent - 0.33) / 0.33);
      } else {
        // Last third: stay on bg-scroll-2
        setCurrentBg('/bg-scroll-2.jpg');
        setNextBg('');
        setBgOpacity(1);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full min-h-screen">
      {/* Fixed background layer - current image */}
      <div
        className="fixed inset-0 z-[-2] w-full h-screen"
        style={{
          backgroundImage: `url('${currentBg}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}
      />

      {/* Fixed background layer - next image with opacity for fade effect */}
      {nextBg && (
        <div
          className="fixed inset-0 z-[-1] w-full h-screen"
          style={{
            backgroundImage: `url('${nextBg}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed',
            opacity: bgOpacity,
          }}
        />
      )}

      {/* Dark overlay for readability */}
      <div
        className="fixed inset-0 z-[-1] w-full h-screen"
        style={{
          background: `linear-gradient(
            180deg,
            rgba(14, 20, 26, 0.7) 0%,
            rgba(14, 20, 26, 0.8) 50%,
            rgba(14, 20, 26, 0.85) 100%
          )`,
        }}
      />

      {/* Content */}
      <div className="relative z-0 bg-black/30">
        {children}
      </div>
    </div>
  );
}
