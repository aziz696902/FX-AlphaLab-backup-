export default function ReportPreview() {
  const agentEvidence = [
    { agent: 'Technical', vote: 'HOLD', evidence: 'RSI neutral at 52. Price consolidating.' },
    { agent: 'Macro', vote: 'LONG', evidence: 'US CPI beat expectations. EUR stronger.' },
    { agent: 'Sentiment', vote: 'SHORT', evidence: 'Reddit bearish bias. Retail short.' },
  ];

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'LONG':
        return '#3D9970';
      case 'SHORT':
        return '#C0392B';
      case 'HOLD':
      default:
        return '#8F939C';
    }
  };

  return (
    <section id="reports" className="w-full py-20 border-b border-[rgba(143,147,156,0.10)]">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <h2 className="text-[#B3902E] font-mono text-xs uppercase tracking-widest mb-3">
          Latest Analysis Brief
        </h2>
        <p className="text-[#8F939C] text-sm mb-12 max-w-2xl">
          Generated after a completed multi-agent analysis run. Not a live feed — a structured research output.
        </p>

        {/* Report card */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="p-6 rounded-lg border border-[rgba(143,147,156,0.15)] bg-[#111519]">
            <p className="text-[#8F939C] text-xs font-mono mb-1">PAIR</p>
            <h3 className="text-[#E8ECF0] text-lg font-semibold mb-1">EUR/USD · Weekly Brief</h3>
            <p className="text-[#8F939C] text-xs font-mono mb-4">RUN-2024-11-03-0842 · Generated 2024-11-03 08:50 UTC</p>

            {/* Signal */}
            <div className="mb-4">
              <p className="text-[#8F939C] text-xs font-mono mb-2">SIGNAL</p>
              <div className="flex items-center gap-2 mb-4">
                <span
                  className="px-3 py-2 rounded text-xs font-mono font-bold text-[#161D22]"
                  style={{ backgroundColor: '#8F939C' }}
                >
                  HOLD
                </span>
                <span className="text-[#B3902E] font-mono font-semibold">61%</span>
              </div>
            </div>

            {/* Summary */}
            <p className="text-[#BBC0CB] text-sm leading-relaxed mb-4">
              EUR/USD trading in consolidation zone with mixed sentiment. Macro headwinds offset by technical support.
            </p>

            {/* Risk note */}
            <div
              className="p-3 rounded mb-4 border-l-2 border-[#604732]"
              style={{ background: '#0E1418' }}
            >
              <p className="text-[#8F939C] text-xs font-mono mb-1">RISK NOTE</p>
              <p className="text-[#BBC0CB] text-xs">ECB meeting scheduled for next week may cause volatility. Monitor Fed speakers.</p>
            </div>

            {/* CTA */}
            <button className="text-[#294F69] text-sm font-medium hover:text-[#3A5F7A] transition-colors">
              View Full Report →
            </button>
          </div>

          {/* Right column - Evidence table */}
          <div className="p-6 rounded-lg border border-[rgba(143,147,156,0.15)] bg-[#111519]">
            <p className="text-[#8F939C] text-xs font-mono uppercase mb-4">Agent Evidence</p>

            <div className="space-y-3">
              {agentEvidence.map((item) => (
                <div key={item.agent} className="pb-3 border-b border-[rgba(143,147,156,0.10)] last:border-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[#E8ECF0] text-xs font-semibold">{item.agent}</p>
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold text-[#161D22]"
                      style={{ backgroundColor: getSignalColor(item.vote) }}
                    >
                      {item.vote}
                    </span>
                  </div>
                  <p className="text-[#8F939C] text-xs leading-relaxed">{item.evidence}</p>
                </div>
              ))}
            </div>

            {/* Footer note */}
            <p className="text-[#8F939C] text-xs mt-4 pt-4 border-t border-[rgba(143,147,156,0.10)]">
              Research-grade analysis. Not for live trading.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
