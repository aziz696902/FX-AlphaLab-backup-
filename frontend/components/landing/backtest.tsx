export default function Backtest() {
  const backtestStats = [
    { label: 'SIGNALS TESTED', value: '1,247' },
    { label: 'WIN RATE', value: '54.2%' },
    { label: 'MAX DRAWDOWN', value: '-8.3%' },
    { label: 'SHARPE RATIO', value: '1.41' },
    { label: 'TEST PERIOD', value: 'Jan 2022 – Oct 2024' },
  ];

  return (
    <section className="w-full bg-[#161D22] py-20 border-b border-[rgba(143,147,156,0.10)]">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <h2 className="text-[#B3902E] font-mono text-xs uppercase tracking-widest mb-3">Research Backtest</h2>
        <p className="text-[#604732] text-xs mb-8">
          Research-grade only. Not live trading results. Based on historical signal simulation.
        </p>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {backtestStats.map((stat) => (
            <div
              key={stat.label}
              className="p-4 rounded-lg border border-[rgba(143,147,156,0.15)] bg-[#111519] text-center"
            >
              <p className="text-[#8F939C] text-[10px] font-mono uppercase mb-3">{stat.label}</p>
              <p className="text-[#E8ECF0] font-mono text-lg font-bold">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <p className="text-[#8F939C] text-xs text-center mt-8">
          All results are backtested historical simulations. Past performance is not indicative of future results.
        </p>
      </div>
    </section>
  );
}
