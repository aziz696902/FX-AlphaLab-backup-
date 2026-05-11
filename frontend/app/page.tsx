import Navigation from "@/components/landing/navigation";
import Hero from "@/components/landing/hero";
import SignalStrip from "@/components/landing/signal-strip";
import Features from "@/components/landing/features";
import DataSources from "@/components/landing/data-sources";
import ReportPreview from "@/components/landing/report-preview";
import Backtest from "@/components/landing/backtest";
import Footer from "@/components/landing/footer";
import { BgZone } from "@/components/landing/scroll-bg-provider";

export default function LandingPage() {
  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", background: '#000' }}>
      <Navigation />

      {/* Zone 1 — hero */}
      <BgZone bg="/hero-bg.png">
        <Hero />
      </BgZone>

      {/* Black gap */}
      <div style={{ height: 120, background: '#000' }} />

      {/* Zone 2 */}
      <BgZone bg="/bg-scroll-1.png">
        <SignalStrip />
        <Features />
      </BgZone>

      {/* Black gap */}
      <div style={{ height: 120, background: '#000' }} />

      {/* Zone 3 */}
      <BgZone bg="/bg-scroll-2.png">
        <DataSources />
        <ReportPreview />
        <Backtest />
        <Footer />
      </BgZone>
    </div>
  );
}
