'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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
        <div className="flex items-center gap-2 cursor-pointer">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Candlestick icon */}
            <rect x="3" y="12" width="3" height="8" fill="#B3902E" />
            <line x1="4.5" y1="10" x2="4.5" y2="20" stroke="#B3902E" strokeWidth="0.5" />
            <rect x="9" y="8" width="3" height="12" fill="#B3902E" />
            <line x1="10.5" y1="5" x2="10.5" y2="20" stroke="#B3902E" strokeWidth="0.5" />
            <rect x="15" y="10" width="3" height="10" fill="#B3902E" />
            <line x1="16.5" y1="8" x2="16.5" y2="20" stroke="#B3902E" strokeWidth="0.5" />
          </svg>
          <span className="text-[#E8ECF0] font-semibold text-sm">FX-AlphaLab</span>
        </div>

        {/* Center nav links */}
        <div className="hidden md:flex items-center gap-8">
          {[
            { label: 'Dashboard', id: 'hero' },
            { label: 'Agents', id: 'agents' },
            { label: 'Architecture', id: 'architecture' },
            { label: 'Reports', id: 'reports' },
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
          <span className="text-[#8F939C] text-xs font-mono hidden sm:inline">v0.4 · W4</span>
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
