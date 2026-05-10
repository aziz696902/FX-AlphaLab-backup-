export default function Roadmap() {
  const phases = [
    { name: 'Business Understanding', status: 'completed', week: null },
    { name: 'Data Acquisition & Understanding', status: 'current', week: 'W4' },
    { name: 'Agent Modeling & Feature Engineering', status: 'upcoming', week: null },
    { name: 'Alpha Generation & Evaluation', status: 'upcoming', week: null },
    { name: 'Deployment & Reporting', status: 'upcoming', week: null },
  ];

  return (
    <section className="w-full py-20 border-b border-[rgba(143,147,156,0.10)]">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <h2 className="text-[#B3902E] font-mono text-xs uppercase tracking-widest mb-3">
          Project Roadmap · CRISP-DM
        </h2>
        <p className="text-[#8F939C] text-sm mb-12">
          Academic research project — University delivery track.
        </p>

        {/* Timeline */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-12">
          {phases.map((phase, idx) => {
            const isCompleted = phase.status === 'completed';
            const isCurrent = phase.status === 'current';

            return (
              <div key={idx} className="flex flex-col">
                <div
                  className={`p-4 rounded-lg border transition-all ${
                    isCurrent
                      ? 'border-[#B3902E] bg-[rgba(179,144,46,0.1)] animate-pulse-border'
                      : isCompleted
                        ? 'border-[#3D9970] bg-[rgba(61,153,112,0.05)]'
                        : 'border-[rgba(143,147,156,0.15)] bg-[#111519]'
                  }`}
                >
                  {/* Status icon */}
                  <div className="mb-3">
                    {isCompleted && (
                      <span className="text-[#3D9970] text-lg">✓</span>
                    )}
                    {isCurrent && (
                      <span className="text-[#B3902E] text-lg font-bold">●</span>
                    )}
                    {phase.status === 'upcoming' && (
                      <span className="text-[#8F939C] text-lg">○</span>
                    )}
                  </div>

                  <p className="text-[#E8ECF0] text-xs font-semibold leading-tight mb-2">
                    {phase.name}
                  </p>

                  {phase.week && (
                    <p className="text-[#B3902E] text-[10px] font-mono font-bold">{phase.week}</p>
                  )}
                </div>

                {/* Arrow for next phase */}
                {idx < phases.length - 1 && (
                  <div className="hidden md:flex justify-center py-2">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M10 18 L18 10 L10 2" stroke="rgba(143,147,156,0.3)" strokeWidth="1" fill="none" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Current deliverable */}
        <div className="p-4 rounded-lg bg-[#111519] border border-[rgba(143,147,156,0.15)]">
          <p className="text-[#8F939C] text-xs font-mono uppercase mb-2">Current Deliverable</p>
          <p className="text-[#BBC0CB] text-sm">
            Data pipeline operational · Bronze/Silver/Gold validated · Collector agents deployed
          </p>
        </div>
      </div>
    </section>
  );
}
