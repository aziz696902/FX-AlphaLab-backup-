'use client';

import { useEffect } from 'react';

interface BodyClassProps {
  className: string;
}

export default function BodyClass({ className }: BodyClassProps) {
  useEffect(() => {
    document.body.classList.add(className);
    return () => {
      document.body.classList.remove(className);
    };
  }, [className]);

  return null;
}
