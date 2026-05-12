'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-[#0E1418] border-b border-[rgba(143,147,156,0.10)] backdrop-blur-[12px]'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.png" alt="FX AlphaLab" width={48} height={30} className="h-auto w-12" />
          <span className="font-semibold text-[#E8ECF0]">FX-AlphaLab</span>
        </Link>

        {/* Center nav links */}
        <div className="hidden md:flex items-center gap-8">
          {[
            { label: 'Markets', id: 'signals' },
            { label: 'Features', id: 'features' },
            { label: 'Data Sources', id: 'data' },
            { label: 'Explainability', id: 'reports' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className="text-[#8F939C] hover:text-[#E8ECF0] text-sm transition-colors"
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[rgba(61,153,112,0.15)] border border-[rgba(61,153,112,0.3)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3D9970]" />
            <span className="text-[#3D9970] text-xs font-mono">LIVE</span>
          </div>
          <Link
            href="/auth"
            className="px-4 py-1.5 rounded-md bg-[#B3902E] hover:bg-[#C9A33A] text-[#0E1418] text-sm font-semibold transition-colors"
          >
            Login
          </Link>
        </div>
      </div>
    </nav>
  );
}
