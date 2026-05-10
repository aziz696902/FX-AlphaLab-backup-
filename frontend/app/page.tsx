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
import ScrollBgProvider from "@/components/landing/scroll-bg-provider";

export default function LandingPage() {
  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
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
    </div>
  );
}
