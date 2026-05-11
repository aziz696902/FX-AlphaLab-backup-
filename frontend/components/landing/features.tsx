export default function Features() {
  const items = [
    {
      title: 'Live Multi-Pair Signals',
      description:
        'BUY / SELL / HOLD signals with conviction scores across EUR/USD, GBP/USD, USD/JPY, and USD/CHF — updated each analysis run.',
      tag: 'Signals',
    },
    {
      title: 'Explainable Agent Reasoning',
      description:
        'Every signal is backed by four independent agents — Technical, Macro, Sentiment, and Geopolitical — each with its own evidence trail.',
      tag: 'Explainability',
    },
    {
      title: 'Research-Grade Reports',
      description:
        'Structured LLM-generated briefs per pair: coordinator verdict, per-agent summaries, risk notes, and key calendar events.',
      tag: 'Reports',
    },
    {
      title: 'Backtested Performance',
      description:
        'Signal history validated against 2022–2025 historical data. Sharpe ratio, win rate, and drawdown metrics available per run.',
      tag: 'Backtest',
    },
  ];

  return (
    <section id="features" className="w-full py-20 border-b border-[rgba(143,147,156,0.10)]">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-[#B3902E] font-mono text-base uppercase tracking-widest mb-3">
          What Analysts Get
        </h2>
        <p className="text-[#8F939C] text-lg mb-12 max-w-2xl">
          From raw market data to structured, explainable research output — in one platform.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <div
              key={item.title}
              className="p-6 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(10,15,20,0.45)] backdrop-blur-md flex flex-col gap-4"
            >
              <span className="self-start px-2 py-0.5 rounded text-xs font-mono font-semibold text-[#B3902E] border border-[rgba(179,144,46,0.35)] bg-[rgba(179,144,46,0.08)]">
                {item.tag}
              </span>
              <h3 className="text-[#E8ECF0] font-semibold text-base leading-snug">{item.title}</h3>
              <p className="text-[#8F939C] text-sm leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
