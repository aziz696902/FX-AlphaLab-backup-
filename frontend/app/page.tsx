import Navigation from "@/components/landing/navigation";
import Hero from "@/components/landing/hero";
import SignalStrip from "@/components/landing/signal-strip";
import AgentCouncil from "@/components/landing/agent-council";
import Architecture from "@/components/landing/architecture";
import PipelineHealth from "@/components/landing/pipeline-health";
import ReportPreview from "@/components/landing/report-preview";
import Backtest from "@/components/landing/backtest";
import Roadmap from "@/components/landing/roadmap";
import Footer from "@/components/landing/footer";
import { BgZone } from "@/components/landing/scroll-bg-provider";

export default function LandingPage() {
  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", background: '#000' }}>
      <Navigation />

      {/* Zone 1 — hero background pinned */}
      <BgZone bg="/hero-bg.png">
        <Hero />
      </BgZone>

      {/* Black gap */}
      <div style={{ height: 320, background: '#000' }} />

      {/* Zone 2 — second background pinned */}
      <BgZone bg="/bg-scroll-1.png">
        <SignalStrip />
        <AgentCouncil />
        <Architecture />
      </BgZone>

      {/* Black gap */}
      <div style={{ height: 320, background: '#000' }} />

      {/* Zone 3 — third background pinned */}
      <BgZone bg="/bg-scroll-2.png">
        <PipelineHealth />
        <ReportPreview />
        <Backtest />
        <Roadmap />
        <Footer />
      </BgZone>
    </div>
  );
}
