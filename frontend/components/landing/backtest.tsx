export default function Backtest() {
  const backtestStats = [
    { label: 'SIGNALS TESTED', value: '150' },
    { label: 'PROFIT FACTOR', value: '1.48' },
    { label: 'MAX DRAWDOWN', value: '-0.13%' },
    { label: 'SHARPE RATIO', value: '1.077' },
    { label: 'TEST PERIOD', value: '2022 – 2025' },
  ];

  return (
    <section className="w-full py-20 border-b border-[rgba(143,147,156,0.10)]">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <h2 className="text-[#B3902E] font-mono text-base uppercase tracking-widest mb-3">Research Backtest</h2>
        <p className="text-[#604732] text-sm mb-8">
          Research-grade only. Not live trading results. Based on historical signal simulation.
        </p>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {backtestStats.map((stat) => (
            <div
              key={stat.label}
              className="p-4 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(10,15,20,0.45)] backdrop-blur-md text-center"
            >
              <p className="text-[#8F939C] text-xs font-mono uppercase mb-3">{stat.label}</p>
              <p className="text-[#E8ECF0] font-mono text-xl font-bold">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <p className="text-[#8F939C] text-sm text-center mt-8">
          All results are backtested historical simulations. Past performance is not indicative of future results.
        </p>
      </div>
    </section>
  );
}
