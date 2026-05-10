export default function PipelineHealth() {
  const healthTiles = [
    { label: 'COLLECTORS', value: '5 / 5 Online', status: 'healthy' },
    { label: 'LAST INGESTION', value: '2024-11-03 08:42 UTC', status: 'healthy' },
    { label: 'DATA FRESHNESS', value: '< 15 min', status: 'healthy' },
    { label: 'VALIDATION', value: 'Passed · 0 errors', status: 'healthy' },
    { label: 'CI / TESTS', value: '✓ 47/47 passing', status: 'healthy' },
    { label: 'LATEST RUN ID', value: 'RUN-2024-11-03-0842', status: 'neutral' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return '#3D9970';
      case 'warning':
        return '#B3902E';
      case 'neutral':
      default:
        return '#8F939C';
    }
  };

  return (
    <section className="w-full bg-[#161D22] py-20 border-b border-[rgba(143,147,156,0.10)]">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <h2 className="text-[#B3902E] font-mono text-xs uppercase tracking-widest mb-8">Pipeline Health</h2>

        {/* Status card */}
        <div className="p-8 rounded-lg border border-[rgba(143,147,156,0.15)] bg-[#111519]">
          {/* Tiles grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 mb-8">
            {healthTiles.map((tile) => (
              <div key={tile.label}>
                <p className="text-[#8F939C] text-[10px] font-mono uppercase mb-2">{tile.label}</p>
                <p className="text-[#E8ECF0] font-mono text-sm font-semibold mb-2">{tile.value}</p>
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getStatusColor(tile.status) }}
                />
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="pt-6 border-t border-[rgba(143,147,156,0.10)]">
            <p className="text-[#8F939C] text-xs font-mono">
              Next scheduled run: 2024-11-03 09:00 UTC
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
