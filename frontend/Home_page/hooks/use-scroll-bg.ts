'use client';

import { useEffect, useState } from 'react';

export function useScrollBg() {
  const [bgIndex, setBgIndex] = useState(0);
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;

      // First transition: hero to bg-scroll-1 (0-800px)
      if (scrollY < 800) {
        setBgIndex(0);
        setOpacity(1 - scrollY / 800);
      }
      // Second transition: bg-scroll-1 to bg-scroll-2 (800-1600px)
      else if (scrollY < 1600) {
        setBgIndex(1);
        const transitionProgress = (scrollY - 800) / 800;
        setOpacity(1 - transitionProgress);
      }
      // Stay at bg-scroll-2
      else {
        setBgIndex(2);
        setOpacity(1);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const backgrounds = [
    '/hero-bg.jpg',
    '/bg-scroll-1.jpg',
    '/bg-scroll-2.jpg',
  ];

  return {
    backgrounds,
    currentBg: backgrounds[bgIndex],
    nextBg: bgIndex < backgrounds.length - 1 ? backgrounds[bgIndex + 1] : null,
    opacity,
  };
}
