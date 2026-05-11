"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/trading/top-bar";
import { LeftSidebar } from "@/components/trading/left-sidebar";
import { CandlestickChart } from "@/components/trading/candlestick-chart";
import { RightPanel } from "@/components/trading/right-panel";
import { BottomPanel } from "@/components/trading/bottom-panel";
import { Splitter } from "@/components/trading/splitter";
import { useResizableLayout } from "@/hooks/use-resizable-layout";
import { useInferenceData } from "@/hooks/use-inference-data";
import { useMt5Status } from "@/hooks/use-mt5-status";
import { usePositions } from "@/hooks/use-positions";
import { UpgradeModalProvider } from "@/hooks/use-upgrade-modal";
import { UpgradeModal } from "@/components/trading/upgrade-modal";
import { ChatBubble } from "@/components/chat/ChatBubble";

export default function TradingDashboard() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("access_token")) {
      router.replace("/auth");
    } else {
      setAuthed(true);
    }
  }, [router]);

  const [activeInstrument, setActiveInstrument] = useState("EURUSD");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { sizes, handleMouseDown, resetLayout } = useResizableLayout();
  const inference = useInferenceData();
  const mt5Status = useMt5Status();
  const livePositions = usePositions();

  if (!authed) return null;

  return (
    <UpgradeModalProvider>
    <UpgradeModal />
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      <TopBar
        activeInstrument={activeInstrument}
        onInstrumentChange={setActiveInstrument}
        onResetLayout={resetLayout}
        report={inference.report}
      />

      <div className="flex-1 flex overflow-hidden">
        <LeftSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          activeInstrument={activeInstrument}
          onInstrumentChange={setActiveInstrument}
          width={sidebarCollapsed ? 40 : sizes.leftSidebar}
          coordinatorSignals={inference.coordinatorSignals}
          agentSignals={inference.agentSignals}
        />

        {!sidebarCollapsed && (
          <Splitter
            orientation="vertical"
            onMouseDown={(e) => handleMouseDown("left", e)}
          />
        )}

        <div className="flex-1 flex flex-col overflow-hidden p-2 gap-0 min-w-[300px]">
          <CandlestickChart
            symbol={activeInstrument}
            coordinatorSignal={inference.coordinatorSignals.get(activeInstrument) ?? null}
            report={inference.report}
          />

          <Splitter
            orientation="horizontal"
            onMouseDown={(e) => handleMouseDown("bottom", e)}
          />

          <BottomPanel
            height={sizes.bottomPanel}
            mt5Connected={mt5Status.connected}
            positions={livePositions.positions}
            pendingOrders={livePositions.pendingOrders}
            history={livePositions.history}
            loading={livePositions.loading}
            refresh={livePositions.refresh}
          />
        </div>

        <Splitter
          orientation="vertical"
          onMouseDown={(e) => handleMouseDown("right", e)}
        />

        <RightPanel
          symbol={activeInstrument}
          width={sizes.rightPanel}
          report={inference.report}
          coordinatorSignals={inference.coordinatorSignals}
          agentSignals={inference.agentSignals}
          mt5Connected={mt5Status.connected}
          positions={livePositions.positions}
          account={livePositions.account}
        />
      </div>
    </div>
      <ChatBubble />
    </UpgradeModalProvider>
  );
}
