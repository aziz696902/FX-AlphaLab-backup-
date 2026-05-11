export default function Footer() {
  return (
    <footer className="w-full bg-[#0E1418] border-t border-[rgba(143,147,156,0.10)] py-8">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
        {/* Left */}
        <div className="text-center md:text-left">
          <p className="text-[#E8ECF0] font-semibold mb-1">FX-AlphaLab</p>
          <p className="text-[#8F939C]">© 2026 · FX-AlphaLab · Research-grade only</p>
        </div>

        {/* Right */}
        <p className="text-[#8F939C] text-center md:text-right font-mono">
          Multi-Agent FX Intelligence
        </p>
      </div>
    </footer>
  );
}
