const SIGNAL_COLOR: Record<string, string> = {
  BUY: '#3D9970',
  SELL: '#C0392B',
  HOLD: '#8F939C',
};

const agents = [
  {
    name: 'Technical',
    signal: 'SELL',
    weight: '25%',
    sources: ['RSI overbought at 71.4', 'Price rejected at 1.0940 resistance', 'MACD bearish crossover on H4'],
  },
  {
    name: 'Macro',
    signal: 'SELL',
    weight: '30%',
    sources: ['Fed hawkish tone — two more hikes priced in', 'US NFP beat: +243k vs +185k forecast', 'EUR PMI contracting at 47.2'],
  },
  {
    name: 'Sentiment',
    signal: 'HOLD',
    weight: '25%',
    sources: ['StockTwits: neutral positioning', 'Reddit: mixed bias, no strong lean', 'Google Trends: no search spike detected'],
  },
  {
    name: 'Geopolitical',
    signal: 'SELL',
    weight: '20%',
    sources: ['GDELT: elevated EU political risk tone', 'Energy import tensions flagged', 'Global stress index above threshold'],
  },
];

export default function ReportPreview() {
  return (
    <section id="reports" className="w-full py-20 border-b border-[rgba(143,147,156,0.10)]">
      <div className="max-w-7xl mx-auto px-6">

        <h2 className="text-[#B3902E] font-mono text-base uppercase tracking-widest mb-3">
          Explainability
        </h2>
        <p className="text-[#8F939C] text-lg mb-2 max-w-2xl">
          Every signal comes with a full reasoning trail. See which agent drove the call, what data triggered it, and how the coordinator weighted the votes.
        </p>
        <p className="text-[#604732] text-xs font-mono mb-12">Sample output — login to view live analysis</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Agent columns */}
          {agents.map((agent) => (
            <div
              key={agent.name}
              className="p-5 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(10,15,20,0.45)] backdrop-blur-md flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#8F939C] text-xs font-mono uppercase">Agent</p>
                  <p className="text-[#E8ECF0] font-semibold text-base">{agent.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-[#8F939C] text-xs font-mono uppercase">Weight</p>
                  <p className="text-[#B3902E] font-mono text-base font-semibold">{agent.weight}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className="px-2 py-0.5 rounded text-sm font-mono font-bold text-[#0E1418]"
                  style={{ backgroundColor: SIGNAL_COLOR[agent.signal] }}
                >
                  {agent.signal}
                </span>
                <span className="text-[#8F939C] text-xs font-mono">verdict</span>
              </div>

              <div className="flex flex-col gap-1.5 pt-2 border-t border-[rgba(255,255,255,0.06)]">
                {agent.sources.map((s, i) => (
                  <p key={i} className="text-[#8F939C] text-sm leading-relaxed">
                    · {s}
                  </p>
                ))}
              </div>
            </div>
          ))}

          {/* Coordinator card */}
          <div
            className="p-5 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(10,15,20,0.55)] backdrop-blur-md flex flex-col gap-3"
            style={{ borderTop: '2px solid #B3902E' }}
          >
            <div>
              <p className="text-[#B3902E] text-xs font-mono uppercase tracking-widest">Coordinator</p>
              <p className="text-[#E8ECF0] font-semibold text-base mt-0.5">Final Synthesis</p>
            </div>

            <div className="flex items-center gap-2">
              <span
                className="px-2 py-0.5 rounded text-sm font-mono font-bold text-[#0E1418]"
                style={{ backgroundColor: SIGNAL_COLOR['SELL'] }}
              >
                SELL
              </span>
              <span className="text-[#8F939C] text-sm font-mono">EUR/USD</span>
            </div>

            <div className="flex flex-col gap-1.5 pt-2 border-t border-[rgba(255,255,255,0.06)]">
              <p className="text-[#8F939C] text-sm leading-relaxed">
                ·3 of 4 agents aligned on SELL
              </p>
              <p className="text-[#8F939C] text-sm leading-relaxed">
                ·Macro + Technical carry 55% combined weight
              </p>
              <p className="text-[#8F939C] text-sm leading-relaxed">
                ·Geopolitical stress confirms downside bias
              </p>
              <p className="text-[#8F939C] text-sm leading-relaxed">
                ·Sentiment neutral — no contrarian signal
              </p>
            </div>

            <div className="mt-auto pt-3 border-t border-[rgba(255,255,255,0.06)]">
              <p className="text-[#8F939C] text-xs font-mono uppercase mb-1">Risk Note</p>
              <p className="text-[#BBC0CB] text-sm leading-relaxed">
                ECB press conference Thursday — hold size until post-event.
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
