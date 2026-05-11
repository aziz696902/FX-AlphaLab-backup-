"use client";

import { useState } from "react";
import { Link2, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { closeTrade, cancelOrder, LivePosition, LivePendingOrder, HistoricalTrade } from "@/lib/api";
import { usePositions } from "@/hooks/use-positions";

function formatPrice(price: number): string {
  return price > 0 ? price.toFixed(5) : "—";
}

function formatPnl(profit: number): string {
  return (profit >= 0 ? "+" : "") + profit.toFixed(2);
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
      {message}
    </div>
  );
}

function OpenPositionRow({
  position,
  onClose,
}: {
  position: LivePosition;
  onClose: (ticket: number) => void;
}) {
  const isBuy = position.side === "BUY";
  const isProfitable = position.profit >= 0;

  return (
    <tr className="hover:bg-accent/50 transition-colors">
      <td className="p-2 font-medium">{position.symbol}</td>
      <td className="p-2">
        <Badge
          variant="secondary"
          className={cn(
            "text-[9px] px-1.5 h-4",
            isBuy ? "bg-[var(--buy)]/10 text-[var(--buy)]" : "bg-[var(--sell)]/10 text-[var(--sell)]"
          )}
        >
          {position.side}
        </Badge>
      </td>
      <td className="p-2 font-mono text-right">{position.volume.toFixed(2)}</td>
      <td className="p-2 font-mono text-right">{formatPrice(position.openPrice)}</td>
      <td className="p-2 font-mono text-right">{formatPrice(position.currentPrice)}</td>
      <td
        className={cn(
          "p-2 font-mono text-right font-medium",
          isProfitable ? "text-[var(--profit)]" : "text-[var(--loss)]"
        )}
      >
        {formatPnl(position.profit)}
      </td>
      <td className="p-2 font-mono text-right text-muted-foreground text-[10px]">
        {position.swap !== 0 ? position.swap.toFixed(2) : "—"}
      </td>
      <td className="p-2 font-mono text-right text-[var(--short)]">
        {position.sl > 0 ? formatPrice(position.sl) : "—"}
      </td>
      <td className="p-2 font-mono text-right text-[var(--long)]">
        {position.tp > 0 ? formatPrice(position.tp) : "—"}
      </td>
      <td className="p-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-muted-foreground hover:text-destructive"
          onClick={() => onClose(position.ticket)}
        >
          <X className="h-3 w-3" />
        </Button>
      </td>
    </tr>
  );
}

function PendingOrderRow({
  order,
  onCancel,
}: {
  order: LivePendingOrder;
  onCancel: (ticket: number) => void;
}) {
  const isBuy = order.type.startsWith("BUY");

  return (
    <tr className="hover:bg-accent/50 transition-colors">
      <td className="p-2 font-medium">{order.symbol}</td>
      <td className="p-2">
        <Badge
          variant="secondary"
          className={cn(
            "text-[9px] px-1.5 h-4",
            isBuy ? "bg-[var(--buy)]/10 text-[var(--buy)]" : "bg-[var(--sell)]/10 text-[var(--sell)]"
          )}
        >
          {order.type}
        </Badge>
      </td>
      <td className="p-2 font-mono text-right">{order.volume.toFixed(2)}</td>
      <td className="p-2 font-mono text-right">{formatPrice(order.price)}</td>
      <td className="p-2 font-mono text-right text-[var(--short)]">
        {order.sl > 0 ? formatPrice(order.sl) : "—"}
      </td>
      <td className="p-2 font-mono text-right text-[var(--long)]">
        {order.tp > 0 ? formatPrice(order.tp) : "—"}
      </td>
      <td className="p-2 font-mono text-right text-muted-foreground text-[10px]">
        {formatDate(order.timeSetup)}
      </td>
      <td className="p-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-muted-foreground hover:text-destructive"
          onClick={() => onCancel(order.ticket)}
        >
          <X className="h-3 w-3" />
        </Button>
      </td>
    </tr>
  );
}

function HistoryRow({ trade }: { trade: HistoricalTrade }) {
  const isBuy = trade.side === "BUY";
  const isProfitable = trade.profit >= 0;

  return (
    <tr className="hover:bg-accent/50 transition-colors">
      <td className="p-2 font-medium">{trade.symbol}</td>
      <td className="p-2">
        <Badge
          variant="secondary"
          className={cn(
            "text-[9px] px-1.5 h-4",
            isBuy ? "bg-[var(--buy)]/10 text-[var(--buy)]" : "bg-[var(--sell)]/10 text-[var(--sell)]"
          )}
        >
          {trade.side}
        </Badge>
      </td>
      <td className="p-2 font-mono text-right">{trade.volume.toFixed(2)}</td>
      <td className="p-2 font-mono text-right">{formatPrice(trade.entryPrice)}</td>
      <td className="p-2 font-mono text-right">
        {trade.exitPrice != null ? formatPrice(trade.exitPrice) : "—"}
      </td>
      <td
        className={cn(
          "p-2 font-mono text-right font-medium",
          isProfitable ? "text-[var(--profit)]" : "text-[var(--loss)]"
        )}
      >
        {formatPnl(trade.profit)}
      </td>
      <td className="p-2 font-mono text-right text-muted-foreground text-[10px]">
        {formatDate(trade.entryTime)}
      </td>
      <td className="p-2 font-mono text-right text-muted-foreground text-[10px]">
        {trade.exitTime ? formatDate(trade.exitTime) : "—"}
      </td>
    </tr>
  );
}

interface BottomPanelProps {
  height?: number;
  mt5Connected: boolean;
}

export function BottomPanel({ height = 190, mt5Connected }: BottomPanelProps) {
  const [activeTab, setActiveTab] = useState("open");
  const { positions, pendingOrders, history, loading, refresh } = usePositions();

  async function handleClose(ticket: number) {
    try {
      await closeTrade(ticket);
    } catch {
      // position will persist in next poll if close failed
    } finally {
      refresh();
    }
  }

  async function handleCancel(ticket: number) {
    try {
      await cancelOrder(ticket);
    } catch {
      // order will persist in next poll if cancel failed
    } finally {
      refresh();
    }
  }

  return (
    <div
      className="bg-card border-t border-border shrink-0 flex flex-col shadow-[var(--card-shadow)]"
      style={{ height: `${height}px` }}
    >
      {!mt5Connected ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-6">
          <Link2 className="h-4 w-4 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">
            Link your MT5 account in{" "}
            <a href="/profile" className="underline underline-offset-2 hover:text-foreground transition-colors">
              Profile
            </a>{" "}
            to view open positions, pending orders, and trade history.
          </p>
        </div>
      ) : (
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b border-border px-3">
          <TabsList className="h-9 bg-transparent p-0 gap-4">
            <TabsTrigger
              value="open"
              className="h-9 px-0 pb-0 data-[state=active]:shadow-none data-[state=active]:bg-transparent rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs"
            >
              OPEN
              <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                {positions.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="pending"
              className="h-9 px-0 pb-0 data-[state=active]:shadow-none data-[state=active]:bg-transparent rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs"
            >
              PENDING
              <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                {pendingOrders.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="closed"
              className="h-9 px-0 pb-0 data-[state=active]:shadow-none data-[state=active]:bg-transparent rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs"
            >
              CLOSED
              <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                {history.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Open Positions */}
        <TabsContent value="open" className="flex-1 m-0 overflow-auto">
          {loading ? (
            <EmptyState message="Loading…" />
          ) : positions.length === 0 ? (
            <EmptyState message="No open positions." />
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="text-muted-foreground text-[10px] uppercase tracking-wider border-b border-border">
                  <th className="text-left p-2 font-medium">Symbol</th>
                  <th className="text-left p-2 font-medium">Dir</th>
                  <th className="text-right p-2 font-medium">Size</th>
                  <th className="text-right p-2 font-medium">Entry</th>
                  <th className="text-right p-2 font-medium">Current</th>
                  <th className="text-right p-2 font-medium">P&L</th>
                  <th className="text-right p-2 font-medium">Swap</th>
                  <th className="text-right p-2 font-medium">SL</th>
                  <th className="text-right p-2 font-medium">TP</th>
                  <th className="p-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {positions.map((pos) => (
                  <OpenPositionRow key={pos.ticket} position={pos} onClose={handleClose} />
                ))}
              </tbody>
            </table>
          )}
        </TabsContent>

        {/* Pending Orders */}
        <TabsContent value="pending" className="flex-1 m-0 overflow-auto">
          {loading ? (
            <EmptyState message="Loading…" />
          ) : pendingOrders.length === 0 ? (
            <EmptyState message="No pending orders." />
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="text-muted-foreground text-[10px] uppercase tracking-wider border-b border-border">
                  <th className="text-left p-2 font-medium">Symbol</th>
                  <th className="text-left p-2 font-medium">Type</th>
                  <th className="text-right p-2 font-medium">Size</th>
                  <th className="text-right p-2 font-medium">Trigger</th>
                  <th className="text-right p-2 font-medium">SL</th>
                  <th className="text-right p-2 font-medium">TP</th>
                  <th className="text-right p-2 font-medium">Placed</th>
                  <th className="p-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {pendingOrders.map((order) => (
                  <PendingOrderRow key={order.ticket} order={order} onCancel={handleCancel} />
                ))}
              </tbody>
            </table>
          )}
        </TabsContent>

        {/* Closed / History */}
        <TabsContent value="closed" className="flex-1 m-0 overflow-auto">
          {history.length === 0 ? (
            <EmptyState message="No closed trades in the last 30 days." />
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="text-muted-foreground text-[10px] uppercase tracking-wider border-b border-border">
                  <th className="text-left p-2 font-medium">Symbol</th>
                  <th className="text-left p-2 font-medium">Dir</th>
                  <th className="text-right p-2 font-medium">Size</th>
                  <th className="text-right p-2 font-medium">Entry</th>
                  <th className="text-right p-2 font-medium">Exit</th>
                  <th className="text-right p-2 font-medium">P&L</th>
                  <th className="text-right p-2 font-medium">Opened</th>
                  <th className="text-right p-2 font-medium">Closed</th>
                </tr>
              </thead>
              <tbody>
                {history.map((trade) => (
                  <HistoryRow key={trade.ticket} trade={trade} />
                ))}
              </tbody>
            </table>
          )}
        </TabsContent>
      </Tabs>
      )}
    </div>
  );
}
