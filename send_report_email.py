"""Send the daily deep-dive report email to a specific address.

Usage:
    python send_report_email.py                            # latest date, default recipient
    python send_report_email.py --to user@example.com
    python send_report_email.py --date 2026-05-10 --to user@example.com
"""

from __future__ import annotations

import argparse
import datetime
import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    stream=sys.stdout,
)

parser = argparse.ArgumentParser()
parser.add_argument("--date", type=str, help="Target date YYYY-MM-DD (default: latest in DB)")
parser.add_argument(
    "--to",
    type=str,
    default="yassinebrahem.dev1@gmail.com",
    help="Recipient email address",
)
args = parser.parse_args()

from src.shared.config import Config  # noqa: E402
from src.shared.db.models import (  # noqa: E402
    CoordinatorReportRow,
    CoordinatorSignalRow,
    DailyReport,
)
from src.shared.db.session import SessionLocal  # noqa: E402

db = SessionLocal()
try:
    if args.date:
        target_date = datetime.date.fromisoformat(args.date)
    else:
        row = db.query(CoordinatorReportRow).order_by(CoordinatorReportRow.date.desc()).first()
        if row is None:
            print("Error: no coordinator reports in DB. Run the inference pipeline first.")
            sys.exit(1)
        target_date = row.date
        print(f"No --date specified, using latest: {target_date}")

    report_row = (
        db.query(CoordinatorReportRow).filter(CoordinatorReportRow.date == target_date).first()
    )
    if report_row is None:
        print(f"Error: no coordinator report for {target_date}.")
        sys.exit(1)

    signals = db.query(CoordinatorSignalRow).filter(CoordinatorSignalRow.date == target_date).all()
    signal_rows = sorted(
        [
            {
                "pair": s.pair,
                "action": s.suggested_action,
                "confidence_tier": s.confidence_tier,
                "conviction_score": s.conviction_score,
                "direction_horizon": s.direction_horizon,
                "sl_pct": s.sl_pct,
                "tp_pct": s.tp_pct,
                "risk_reward_ratio": s.risk_reward_ratio,
                "is_top_pick": s.is_top_pick,
                "estimated_vol_pct": (
                    round(s.estimated_vol_3d * 100, 3) if s.estimated_vol_3d is not None else None
                ),
            }
            for s in signals
        ],
        key=lambda x: x["conviction_score"] or 0,
        reverse=True,
    )

    # Pull per-pair LLM narrative from stored daily_reports HTML
    daily_reports: dict[str, DailyReport] = {
        r.pair: r for r in db.query(DailyReport).filter(DailyReport.date == target_date).all()
    }

finally:
    db.close()

# ── Build enhanced email ───────────────────────────────────────────────────────

import re  # noqa: E402

FRONTEND_URL = Config.FRONTEND_URL or "http://localhost:3000"
date_str = (
    target_date.strftime("%-d %B %Y")
    if sys.platform != "win32"
    else (f"{target_date.day} {target_date.strftime('%B %Y')}")
)


def _extract_meta(html: str, tag_id: str) -> str:
    """Extract inner text from first element with given class or id."""
    m = re.search(r'class="hero-thesis"[^>]*>(.*?)</p>', html, re.DOTALL)
    if tag_id == "hero_thesis" and m:
        return m.group(1).strip()
    m = re.search(r'class="hero-subtitle"[^>]*>(.*?)</p>', html, re.DOTALL)
    if tag_id == "hero_subtitle" and m:
        return m.group(1).strip()
    return ""


def _pair_narrative_block(pair: str, dr: DailyReport | None, sig: dict) -> str:
    if dr is None:
        return ""
    html = dr.html
    thesis = _extract_meta(html, "hero_thesis")
    subtitle = _extract_meta(html, "hero_subtitle")
    report_url = f"{FRONTEND_URL}/reports/{pair}"
    action = (sig.get("action") or "FLAT").upper()
    action_color = "#0d9488" if action == "LONG" else "#dc2626" if action == "SHORT" else "#374151"
    sl = f"{sig['sl_pct']:.4f}%" if sig.get("sl_pct") is not None else "—"
    tp = f"{sig['tp_pct']:.4f}%" if sig.get("tp_pct") is not None else "—"
    rr = f"{sig['risk_reward_ratio']:.2f}x" if sig.get("risk_reward_ratio") else "—"
    star = "★ " if sig.get("is_top_pick") else ""

    thesis_row = (
        f"""<tr><td colspan="2" style="padding:0 0 10px;">
          <p style="margin:0;font-size:15px;font-weight:600;color:#e5e7eb;line-height:1.4;">{thesis}</p>
          <p style="margin:6px 0 0;font-size:12px;color:#9ca3af;line-height:1.5;">{subtitle}</p>
        </td></tr>"""
        if thesis
        else ""
    )

    return f"""
        <tr><td style="padding:0 40px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="background:#0f1117;border-radius:10px;border:1px solid #2a2d3a;overflow:hidden;">
            <tr>
              <td style="background:#161b26;padding:10px 18px;border-bottom:1px solid #2a2d3a;">
                <table width="100%" cellpadding="0" cellspacing="0"><tr>
                  <td>
                    <p style="margin:0;font-size:16px;font-weight:700;color:#fff;">{star}{pair}</p>
                    <p style="margin:2px 0 0;font-size:10px;letter-spacing:1px;text-transform:uppercase;
                               color:#6b7280;">{sig.get('confidence_tier','—')} conviction</p>
                  </td>
                  <td align="right">
                    <span style="display:inline-block;background:{action_color};color:#fff;
                                 font-size:13px;font-weight:700;padding:5px 16px;border-radius:5px;">
                      {action}
                    </span>
                  </td>
                </tr></table>
              </td>
            </tr>
            <tr><td style="padding:14px 18px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                {thesis_row}
                <tr>
                  <td width="33%" style="text-align:center;padding:0 4px 12px 0;">
                    <p style="margin:0;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">Stop Loss</p>
                    <p style="margin:3px 0 0;font-size:15px;font-weight:700;color:#dc2626;">{sl}</p>
                  </td>
                  <td width="33%" style="text-align:center;padding:0 4px 12px;">
                    <p style="margin:0;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">Take Profit</p>
                    <p style="margin:3px 0 0;font-size:15px;font-weight:700;color:#0d9488;">{tp}</p>
                  </td>
                  <td width="33%" style="text-align:center;padding:0 0 12px 4px;">
                    <p style="margin:0;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">Risk:Reward</p>
                    <p style="margin:3px 0 0;font-size:15px;font-weight:700;color:#e5e7eb;">{rr}</p>
                  </td>
                </tr>
                <tr><td colspan="3" style="padding-top:4px;border-top:1px solid #1f2937;">
                  <a href="{report_url}"
                     style="display:block;text-align:center;color:#93c5fd;font-size:12px;
                            font-weight:600;text-decoration:none;padding:8px 0;">
                    View full {pair} deep-dive report →
                  </a>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </td></tr>"""


overall_action = report_row.overall_action or "hold"
top_pick = report_row.top_pick
global_regime = report_row.global_regime or "normal"
hold_reason = report_row.hold_reason
regime_badge = global_regime.capitalize()

pair_blocks = "\n".join(
    _pair_narrative_block(s["pair"], daily_reports.get(s["pair"]), s) for s in signal_rows
)

if overall_action == "hold":
    hold_banner = f"""
        <tr><td style="padding:0 40px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="background:#1c1500;border-radius:10px;border:1px solid #854d0e;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;
                         color:#fbbf24;font-weight:600;">Hold — No Trade Today</p>
              <p style="margin:8px 0 0;font-size:14px;color:#fde68a;line-height:1.6;">
                {hold_reason or "Market conditions do not support a trade at this time."}
              </p>
            </td></tr>
          </table>
        </td></tr>"""
else:
    hold_banner = ""

html_body = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>FX-AlphaLab Daily Brief — {date_str}</title>
</head>
<body style="margin:0;padding:0;background:#0f1117;font-family:'Segoe UI',Arial,sans-serif;color:#e5e7eb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;padding:40px 0;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0"
             style="background:#1a1d27;border-radius:14px;overflow:hidden;border:1px solid #2a2d3a;">

        <!-- Accent bar -->
        <tr><td style="background:linear-gradient(90deg,#1f4aa8,#0d9488 60%,transparent);height:4px;"></td></tr>

        <!-- Header -->
        <tr><td style="padding:32px 40px 22px;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td>
              <table cellpadding="0" cellspacing="0"><tr>
                <td style="background:#1f4aa8;border-radius:8px;width:40px;height:40px;
                           text-align:center;vertical-align:middle;">
                  <span style="color:#fff;font-weight:700;font-size:14px;line-height:40px;">FX</span>
                </td>
                <td style="padding-left:10px;vertical-align:middle;">
                  <p style="margin:0;font-size:16px;font-weight:700;color:#fff;">AlphaLab</p>
                  <p style="margin:0;font-size:9px;letter-spacing:2px;text-transform:uppercase;
                             color:#6b7280;">Elite Daily Brief</p>
                </td>
              </tr></table>
            </td>
            <td align="right" style="vertical-align:middle;">
              <p style="margin:0;font-size:12px;color:#6b7280;">{date_str}</p>
              <span style="display:inline-block;margin-top:4px;background:#0f1117;
                           border:1px solid #374151;color:#9ca3af;font-size:10px;font-weight:600;
                           padding:3px 10px;border-radius:4px;letter-spacing:1px;
                           text-transform:uppercase;">{regime_badge} regime</span>
            </td>
          </tr></table>
        </td></tr>

        <!-- Greeting -->
        <tr><td style="padding:0 40px 24px;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#fff;">Good morning.</p>
          <p style="margin:6px 0 0;font-size:14px;color:#9ca3af;line-height:1.6;">
            Your AI coordinator has run full inference across all four FX pairs.
            Here is today's alpha brief with the top pick and per-pair deep-dive links.
          </p>
        </td></tr>

        {hold_banner}

        <!-- Per-pair blocks -->
        <tr><td style="padding:0 40px 8px;">
          <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:1.5px;
                     text-transform:uppercase;color:#6b7280;">Pair Analysis</p>
        </td></tr>
        {pair_blocks}

        <!-- CTA -->
        <tr><td align="center" style="padding:8px 40px 32px;">
          <a href="{FRONTEND_URL}/dashboard"
             style="display:inline-block;background:#1f4aa8;color:#fff;font-size:14px;font-weight:600;
                    text-decoration:none;padding:13px 36px;border-radius:8px;letter-spacing:0.5px;">
            Open Dashboard →
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 40px;border-top:1px solid #2a2d3a;">
          <p style="margin:0;font-size:11px;color:#4b5563;text-align:center;line-height:1.7;">
            You receive this as an <strong style="color:#6b7280;">Elite</strong> member of FX-AlphaLab.<br/>
            FX-AlphaLab · Intelligent FX Platform
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""

plain_body = (
    f"FX-AlphaLab Daily Brief — {date_str}\n\n"
    f"Global regime: {regime_badge}\n"
    f"Overall action: {overall_action.upper()}\n"
    + (f"Top pick: {top_pick}\n" if top_pick else "")
    + "\nPair signals:\n"
    + "\n".join(
        f"  {s['pair']}{' ★' if s.get('is_top_pick') else ''}: "
        f"{(s.get('action') or 'FLAT').upper()} | "
        f"{s.get('confidence_tier','—')} | "
        f"conviction {s.get('conviction_score',0):.4f} | "
        f"horizon {s.get('direction_horizon','—')}"
        for s in signal_rows
    )
    + f"\n\nDashboard: {FRONTEND_URL}/dashboard\n— FX-AlphaLab Elite"
)

# ── Send ───────────────────────────────────────────────────────────────────────

from src.backend.email_service import _send_transactional  # noqa: E402

subject = f"FX-AlphaLab Daily Brief — {date_str}"
print(f"Sending to {args.to} …")
_send_transactional(args.to, subject, plain_body, html_body)
print("Done.")
