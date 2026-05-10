import Navigation from '@/components/navigation';
import Hero from '@/components/hero';
import SignalStrip from '@/components/signal-strip';
import AgentCouncil from '@/components/agent-council';
import Architecture from '@/components/architecture';
import PipelineHealth from '@/components/pipeline-health';
import ReportPreview from '@/components/report-preview';
import Backtest from '@/components/backtest';
import Roadmap from '@/components/roadmap';
import Footer from '@/components/footer';
import ScrollBgProvider from '@/components/scroll-bg-provider';

export default function Home() {
  return (
    <ScrollBgProvider>
      <main className="w-full overflow-x-hidden">
        <Navigation />
        <Hero />
        <SignalStrip />
        <AgentCouncil />
        <Architecture />
        <PipelineHealth />
        <ReportPreview />
        <Backtest />
        <Roadmap />
        <Footer />
      </main>
    </ScrollBgProvider>
  );
}
