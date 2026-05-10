import DashboardLayout from "@/components/layout/DashboardLayout";
import TradingDashboard from "@/components/templates/TradingDashboard";

export default function HomePage() {
  return (
    <DashboardLayout>
      <TradingDashboard />
    </DashboardLayout>
  );
}
