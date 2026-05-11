const SOURCES = [
  {
    name: 'MetaTrader 5',
    category: 'Market Data',
    description: 'Live tick feed, OHLCV bars, and bid/ask spreads across all tracked pairs.',
  },
  {
    name: 'Dukascopy',
    category: 'Market Data',
    description: 'Historical OHLCV archive used for backtesting and Silver-layer enrichment.',
  },
  {
    name: 'FRED',
    category: 'Macro',
    description: 'Federal Reserve Economic Data — interest rates, CPI, employment, GDP.',
  },
  {
    name: 'ECB',
    category: 'Macro',
    description: 'European Central Bank exchange rate feeds and monetary policy indicators.',
  },
  {
    name: 'Bank of England',
    category: 'Macro',
    description: 'BoE policy releases, rate decisions, and sterling-related macro series.',
  },
  {
    name: 'ForexFactory',
    category: 'Events',
    description: 'Economic calendar — high-impact event timestamps, forecasts, and actuals.',
  },
  {
    name: 'GDELT',
    category: 'Geopolitical',
    description: 'Global event and media tone data used by the Geopolitical agent.',
  },
  {
    name: 'StockTwits',
    category: 'Sentiment',
    description: 'Retail trader sentiment on FX pairs — Bonferroni-validated volatility signal.',
  },
  {
    name: 'Reddit',
    category: 'Sentiment',
    description: 'r/Forex and related communities — directional bias and crowd positioning.',
  },
  {
    name: 'Google Trends',
    category: 'Sentiment',
    description: 'Search interest spikes as a macro attention and regime-shift indicator.',
  },
];

const CATEGORY_COLOR: Record<string, string> = {
  'Market Data': '#3D9970',
  Macro: '#294F69',
  Events: '#B3902E',
  Geopolitical: '#8F5A4A',
  Sentiment: '#6B5B8A',
};

export default function DataSources() {
  return (
    <section id="data" className="w-full py-20 border-b border-[rgba(143,147,156,0.10)]">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-[#B3902E] font-mono text-base uppercase tracking-widest mb-3">
          Data Sources
        </h2>
        <p className="text-[#8F939C] text-lg mb-12 max-w-2xl">
          10 verified feeds spanning market data, macro indicators, economic events, geopolitical signals, and retail sentiment.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {SOURCES.map((src) => (
            <div
              key={src.name}
              className="p-4 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(10,15,20,0.45)] backdrop-blur-md flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[#E8ECF0] font-semibold text-sm leading-snug">{src.name}</p>
                <span
                  className="shrink-0 px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold text-[#E8ECF0]"
                  style={{ backgroundColor: CATEGORY_COLOR[src.category] ?? '#294F69', opacity: 0.9 }}
                >
                  {src.category}
                </span>
              </div>
              <p className="text-[#8F939C] text-sm leading-relaxed">{src.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
