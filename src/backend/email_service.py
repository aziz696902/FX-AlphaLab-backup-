"""Email service — sends transactional emails via SMTP (Outlook / STARTTLS)."""

from __future__ import annotations

import logging
import smtplib
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from src.shared.config import Config

logger = logging.getLogger(__name__)


def _build_welcome_html(full_name: str, email: str) -> str:
    display_name = full_name.strip() if full_name else email.split("@")[0]
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Welcome to FX-AlphaLab</title>
</head>
<body style="margin:0;padding:0;background:#0f1117;font-family:'Segoe UI',Arial,sans-serif;color:#e5e7eb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="580" cellpadding="0" cellspacing="0" style="background:#1a1d27;border-radius:12px;overflow:hidden;border:1px solid #2a2d3a;">

          <!-- Top accent bar -->
          <tr>
            <td style="background:linear-gradient(90deg,#1f4aa8,#0d9488 60%,transparent);height:4px;"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td align="center" style="padding:36px 40px 24px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#1f4aa8;border-radius:8px;width:44px;height:44px;text-align:center;vertical-align:middle;">
                    <span style="color:#ffffff;font-weight:700;font-size:16px;line-height:44px;">FX</span>
                  </td>
                  <td style="padding-left:12px;vertical-align:middle;">
                    <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;">AlphaLab</p>
                    <p style="margin:0;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#6b7280;">Intelligent FX Platform</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="padding:0 40px 32px;">
              <p style="margin:0 0 8px;font-size:26px;font-weight:700;color:#ffffff;line-height:1.3;">
                Welcome aboard, {display_name}!
              </p>
              <p style="margin:0;font-size:15px;color:#9ca3af;line-height:1.6;">
                Your FX-AlphaLab account is active and ready. You now have access to one of the most advanced
                AI-driven FX intelligence platforms available.
              </p>
            </td>
          </tr>

          <!-- Stats row -->
          <tr>
            <td style="padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="32%" style="background:#0f1117;border-radius:8px;border:1px solid #2a2d3a;padding:16px;text-align:center;">
                    <p style="margin:0;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#6b7280;">Agents</p>
                    <p style="margin:6px 0 0;font-size:22px;font-weight:700;color:#1f4aa8;">4</p>
                    <p style="margin:2px 0 0;font-size:10px;color:#6b7280;">Always aligned</p>
                  </td>
                  <td width="4%"></td>
                  <td width="32%" style="background:#0f1117;border-radius:8px;border:1px solid #2a2d3a;padding:16px;text-align:center;">
                    <p style="margin:0;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#6b7280;">Uptime</p>
                    <p style="margin:6px 0 0;font-size:22px;font-weight:700;color:#0d9488;">99.98%</p>
                    <p style="margin:2px 0 0;font-size:10px;color:#6b7280;">Live system</p>
                  </td>
                  <td width="4%"></td>
                  <td width="32%" style="background:#0f1117;border-radius:8px;border:1px solid #2a2d3a;padding:16px;text-align:center;">
                    <p style="margin:0;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#6b7280;">Latency</p>
                    <p style="margin:6px 0 0;font-size:22px;font-weight:700;color:#0d9488;">74ms</p>
                    <p style="margin:2px 0 0;font-size:10px;color:#6b7280;">Signal routing</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- What you get -->
          <tr>
            <td style="padding:0 40px 32px;">
              <p style="margin:0 0 16px;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#6b7280;">
                What's waiting for you
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #2a2d3a;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:28px;font-size:16px;">📈</td>
                        <td>
                          <p style="margin:0;font-size:14px;font-weight:600;color:#ffffff;">Multi-agent Alpha Signals</p>
                          <p style="margin:2px 0 0;font-size:12px;color:#9ca3af;">Technical, macro, geopolitical and sentiment agents working in concert.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #2a2d3a;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:28px;font-size:16px;">⚡</td>
                        <td>
                          <p style="margin:0;font-size:14px;font-weight:600;color:#ffffff;">Real-time Market Intelligence</p>
                          <p style="margin:2px 0 0;font-size:12px;color:#9ca3af;">Live OHLCV data, macro calendars and institutional flow — all in one view.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:28px;font-size:16px;">🔒</td>
                        <td>
                          <p style="margin:0;font-size:14px;font-weight:600;color:#ffffff;">Enterprise Security</p>
                          <p style="margin:2px 0 0;font-size:12px;color:#9ca3af;">End-to-end encrypted sessions, JWT token rotation, and full audit trail.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:0 40px 36px;">
              <a href="http://localhost:3000"
                 style="display:inline-block;background:#1f4aa8;color:#ffffff;font-size:14px;font-weight:600;
                        text-decoration:none;padding:14px 40px;border-radius:8px;letter-spacing:0.5px;">
                Open the Dashboard →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #2a2d3a;">
              <p style="margin:0;font-size:11px;color:#4b5563;text-align:center;">
                You received this email because an account was created for <strong style="color:#6b7280;">{email}</strong>.<br/>
                FX-AlphaLab · Intelligent FX Platform
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _send(to_email: str, full_name: str) -> None:
    """Send welcome email. Called from a background thread — never raises."""
    plain = (
        f"Welcome to FX-AlphaLab, {full_name or to_email}!\n\n"
        "Your account is active. Sign in at http://localhost:3000\n\n"
        "— The FX-AlphaLab Team"
    )
    _send_transactional(
        to_email,
        "Welcome to FX-AlphaLab — your account is live",
        plain,
        _build_welcome_html(full_name or "", to_email),
    )


def send_welcome_email(to_email: str, full_name: str | None = None) -> None:
    """Fire-and-forget welcome email in a background thread."""
    threading.Thread(
        target=_send,
        args=(to_email, full_name or ""),
        daemon=True,
        name=f"welcome-email-{to_email}",
    ).start()


# ── Email verification ─────────────────────────────────────────────────────────


def _build_verify_html(display_name: str, verify_url: str, email: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Verify your FX-AlphaLab account</title></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:'Segoe UI',Arial,sans-serif;color:#e5e7eb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#1a1d27;border-radius:12px;overflow:hidden;border:1px solid #2a2d3a;">
        <tr><td style="background:linear-gradient(90deg,#1f4aa8,#0d9488 60%,transparent);height:4px;"></td></tr>
        <tr><td align="center" style="padding:36px 40px 24px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:#1f4aa8;border-radius:8px;width:44px;height:44px;text-align:center;vertical-align:middle;">
              <span style="color:#fff;font-weight:700;font-size:16px;line-height:44px;">FX</span>
            </td>
            <td style="padding-left:12px;vertical-align:middle;">
              <p style="margin:0;font-size:18px;font-weight:700;color:#fff;">AlphaLab</p>
              <p style="margin:0;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#6b7280;">Intelligent FX Platform</p>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:0 40px 32px;">
          <p style="margin:0 0 8px;font-size:26px;font-weight:700;color:#fff;line-height:1.3;">Verify your email</p>
          <p style="margin:0 0 24px;font-size:15px;color:#9ca3af;line-height:1.6;">
            Hi {display_name}, click the button below to activate your FX-AlphaLab account.
            This link expires in <strong style="color:#e5e7eb;">24 hours</strong>.
          </p>
          <a href="{verify_url}" style="display:inline-block;background:#1f4aa8;color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:14px 40px;border-radius:8px;letter-spacing:0.5px;">
            Verify my account →
          </a>
          <p style="margin:20px 0 0;font-size:12px;color:#6b7280;">
            Or copy this link: <span style="color:#9ca3af;">{verify_url}</span>
          </p>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #2a2d3a;">
          <p style="margin:0;font-size:11px;color:#4b5563;text-align:center;">
            You received this because an account was created for <strong style="color:#6b7280;">{email}</strong>.<br/>
            If you didn't sign up, you can safely ignore this email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


def _build_reset_html(display_name: str, reset_url: str, email: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Reset your FX-AlphaLab password</title></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:'Segoe UI',Arial,sans-serif;color:#e5e7eb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#1a1d27;border-radius:12px;overflow:hidden;border:1px solid #2a2d3a;">
        <tr><td style="background:linear-gradient(90deg,#1f4aa8,#0d9488 60%,transparent);height:4px;"></td></tr>
        <tr><td align="center" style="padding:36px 40px 24px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:#1f4aa8;border-radius:8px;width:44px;height:44px;text-align:center;vertical-align:middle;">
              <span style="color:#fff;font-weight:700;font-size:16px;line-height:44px;">FX</span>
            </td>
            <td style="padding-left:12px;vertical-align:middle;">
              <p style="margin:0;font-size:18px;font-weight:700;color:#fff;">AlphaLab</p>
              <p style="margin:0;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#6b7280;">Intelligent FX Platform</p>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:0 40px 32px;">
          <p style="margin:0 0 8px;font-size:26px;font-weight:700;color:#fff;line-height:1.3;">Reset your password</p>
          <p style="margin:0 0 24px;font-size:15px;color:#9ca3af;line-height:1.6;">
            Hi {display_name}, we received a password reset request for your account.
            This link expires in <strong style="color:#e5e7eb;">15 minutes</strong>.
          </p>
          <a href="{reset_url}" style="display:inline-block;background:#1f4aa8;color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:14px 40px;border-radius:8px;letter-spacing:0.5px;">
            Reset my password →
          </a>
          <p style="margin:20px 0 0;font-size:12px;color:#6b7280;">
            Or copy this link: <span style="color:#9ca3af;">{reset_url}</span>
          </p>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #2a2d3a;">
          <p style="margin:0;font-size:11px;color:#4b5563;text-align:center;">
            If you didn't request a password reset, ignore this email — your account is safe.<br/>
            FX-AlphaLab · Intelligent FX Platform
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


def _send_transactional(to_email: str, subject: str, plain_text: str, html_body: str) -> None:
    """Send a transactional email via SMTP. Called from a background thread — never raises."""
    if not Config.SMTP_USER or not Config.SMTP_PASSWORD:
        logger.warning(
            "SMTP not configured — skipping email to %s (subject: %s)", to_email, subject
        )
        return
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = Config.EMAIL_FROM or Config.SMTP_USER
        msg["To"] = to_email
        msg.attach(MIMEText(plain_text, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        with smtplib.SMTP("smtp.gmail.com", 587, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(Config.SMTP_USER, Config.SMTP_PASSWORD.replace(" ", ""))
            server.sendmail(Config.SMTP_USER, to_email, msg.as_string())

        logger.info("Email sent to %s (subject: %s)", to_email, subject)
    except Exception:
        logger.exception("Failed to send email to %s (subject: %s)", to_email, subject)


def send_verification_email(to_email: str, full_name: str | None, token: str) -> None:
    """Fire-and-forget email verification link."""
    from src.shared.config import Config as _Cfg  # local import avoids circular at module load

    verify_url = f"{_Cfg.FRONTEND_URL}/auth/verify-email?token={token}"
    display_name = (full_name or to_email.split("@")[0]).strip()
    threading.Thread(
        target=_send_transactional,
        args=(
            to_email,
            "Verify your FX-AlphaLab account",
            f"Hi {display_name},\n\nVerify your account:\n{verify_url}\n\nLink expires in 24 hours.\n\n— FX-AlphaLab",
            _build_verify_html(display_name, verify_url, to_email),
        ),
        daemon=True,
        name=f"verify-email-{to_email}",
    ).start()


def send_password_reset_email(to_email: str, full_name: str | None, token: str) -> None:
    """Fire-and-forget password reset link."""
    from src.shared.config import Config as _Cfg

    reset_url = f"{_Cfg.FRONTEND_URL}/auth/reset-password?token={token}"
    display_name = (full_name or to_email.split("@")[0]).strip()
    threading.Thread(
        target=_send_transactional,
        args=(
            to_email,
            "Reset your FX-AlphaLab password",
            f"Hi {display_name},\n\nReset your password:\n{reset_url}\n\nLink expires in 15 minutes.\n\n— FX-AlphaLab",
            _build_reset_html(display_name, reset_url, to_email),
        ),
        daemon=True,
        name=f"reset-email-{to_email}",
    ).start()


# ── Daily report emails (Elite tier) ──────────────────────────────────────────


def _action_badge_style(action: str | None) -> str:
    """Inline CSS color for action badge."""
    a = (action or "").upper()
    if a == "BUY":
        return "background:#0d9488;color:#fff;"
    if a == "SELL":
        return "background:#dc2626;color:#fff;"
    return "background:#374151;color:#9ca3af;"


def _confidence_color(tier: str | None) -> str:
    t = (tier or "").lower()
    if t == "high":
        return "#0d9488"
    if t == "medium":
        return "#f59e0b"
    return "#6b7280"


def _build_report_plain(
    date_str: str,
    overall_action: str,
    top_pick: str | None,
    global_regime: str | None,
    hold_reason: str | None,
    signal_rows: list[dict],
    display_name: str,
) -> str:
    lines = [
        f"FX-AlphaLab Daily Brief — {date_str}",
        f"Hi {display_name},",
        "",
        f"Global Regime: {global_regime or 'N/A'}",
        f"Overall Action: {overall_action.upper()}",
    ]
    if overall_action == "hold" and hold_reason:
        lines.append(f"Hold Reason: {hold_reason}")
    if top_pick:
        lines.append(f"Top Pick: {top_pick}")
    lines += ["", "Pair Breakdown:"]
    for s in signal_rows:
        rr = f"R:R {s['risk_reward_ratio']:.1f}" if s.get("risk_reward_ratio") else ""
        tp_flag = " ★" if s.get("is_top_pick") else ""
        lines.append(
            f"  {s['pair']}{tp_flag}: {s['action'] or 'FLAT'} | "
            f"{s.get('confidence_tier','—')} | "
            f"Conviction {s.get('conviction_score', 0):.2f} | "
            f"Horizon {s.get('direction_horizon','—')} | "
            f"Est.Vol {s.get('estimated_vol_pct', 0):.2f}% {rr}"
        )
    lines += ["", "Open dashboard: {FRONTEND_URL}/dashboard", "", "— FX-AlphaLab Elite"]
    return "\n".join(lines)


def _build_report_html(
    date_str: str,
    overall_action: str,
    top_pick: str | None,
    global_regime: str | None,
    hold_reason: str | None,
    signal_rows: list[dict],
    display_name: str,
    to_email: str,
    dashboard_url: str,
) -> str:
    # ── Top pick / hold section ────────────────────────────────────────────────
    if overall_action == "trade" and top_pick:
        top = next(
            (s for s in signal_rows if s["pair"] == top_pick),
            signal_rows[0] if signal_rows else None,
        )
        if top:
            action_color = "#0d9488" if (top.get("action") or "").upper() == "BUY" else "#dc2626"
            sl = f"{top['sl_pct']:.2f}%" if top.get("sl_pct") is not None else "—"
            tp = f"{top['tp_pct']:.2f}%" if top.get("tp_pct") is not None else "—"
            rr = (
                f"{top['risk_reward_ratio']:.1f}x"
                if top.get("risk_reward_ratio") is not None
                else "—"
            )
            conviction = (
                f"{top['conviction_score']:.2f}" if top.get("conviction_score") is not None else "—"
            )
            horizon = top.get("direction_horizon") or "—"
            hero_section = f"""
        <tr><td style="padding:0 40px 28px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1f3a;border-radius:10px;border:1px solid #1f4aa8;overflow:hidden;">
            <tr><td style="background:#1f4aa8;padding:8px 20px;">
              <p style="margin:0;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#93c5fd;font-weight:600;">Top Pick</p>
            </td></tr>
            <tr><td style="padding:20px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;font-size:28px;font-weight:700;color:#fff;">{top["pair"]}</p>
                    <p style="margin:4px 0 0;font-size:12px;color:#93c5fd;">Horizon: {horizon} · Conviction: {conviction}</p>
                  </td>
                  <td align="right">
                    <span style="display:inline-block;background:{action_color};color:#fff;font-size:16px;font-weight:700;padding:8px 24px;border-radius:6px;">
                      {(top.get("action") or "FLAT").upper()}
                    </span>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                <tr>
                  <td width="33%" style="text-align:center;background:#0f1a2e;border-radius:6px;padding:10px;border:1px solid #1e3a5f;">
                    <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">Stop Loss</p>
                    <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#dc2626;">{sl}</p>
                  </td>
                  <td width="2%"></td>
                  <td width="33%" style="text-align:center;background:#0f1a2e;border-radius:6px;padding:10px;border:1px solid #1e3a5f;">
                    <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">Take Profit</p>
                    <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#0d9488;">{tp}</p>
                  </td>
                  <td width="2%"></td>
                  <td width="33%" style="text-align:center;background:#0f1a2e;border-radius:6px;padding:10px;border:1px solid #1e3a5f;">
                    <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">Risk:Reward</p>
                    <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#e5e7eb;">{rr}</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </td></tr>"""
        else:
            hero_section = ""
    elif overall_action == "hold":
        reason_text = hold_reason or "Market conditions do not support a trade today."
        hero_section = f"""
        <tr><td style="padding:0 40px 28px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1c1500;border-radius:10px;border:1px solid #854d0e;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#fbbf24;font-weight:600;">Hold — No Trade Today</p>
              <p style="margin:8px 0 0;font-size:14px;color:#fde68a;line-height:1.6;">{reason_text}</p>
            </td></tr>
          </table>
        </td></tr>"""
    else:
        hero_section = ""

    # ── Per-pair table rows ────────────────────────────────────────────────────
    pair_rows_html = ""
    for s in signal_rows:
        action = (s.get("action") or "FLAT").upper()
        badge_style = _action_badge_style(action)
        conf_color = _confidence_color(s.get("confidence_tier"))
        conviction_val = (
            f"{s['conviction_score']:.2f}" if s.get("conviction_score") is not None else "—"
        )
        vol_val = (
            f"{s['estimated_vol_pct']:.2f}%" if s.get("estimated_vol_pct") is not None else "—"
        )
        horizon = s.get("direction_horizon") or "—"
        star = "★ " if s.get("is_top_pick") else ""
        pair_rows_html += f"""
              <tr>
                <td style="padding:10px 12px;border-bottom:1px solid #1f2937;font-size:13px;font-weight:600;color:#fff;">{star}{s["pair"]}</td>
                <td style="padding:10px 8px;border-bottom:1px solid #1f2937;text-align:center;">
                  <span style="display:inline-block;{badge_style}font-size:11px;font-weight:700;padding:3px 10px;border-radius:4px;">{action}</span>
                </td>
                <td style="padding:10px 8px;border-bottom:1px solid #1f2937;text-align:center;font-size:12px;font-weight:600;color:{conf_color};">{s.get("confidence_tier","—").capitalize()}</td>
                <td style="padding:10px 8px;border-bottom:1px solid #1f2937;text-align:center;font-size:12px;color:#e5e7eb;">{conviction_val}</td>
                <td style="padding:10px 8px;border-bottom:1px solid #1f2937;text-align:center;font-size:12px;color:#9ca3af;">{horizon}</td>
                <td style="padding:10px 12px;border-bottom:1px solid #1f2937;text-align:right;font-size:12px;color:#9ca3af;">{vol_val}</td>
              </tr>"""

    regime_badge = global_regime or "Unknown"

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>FX-AlphaLab Daily Brief — {date_str}</title></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:'Segoe UI',Arial,sans-serif;color:#e5e7eb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#1a1d27;border-radius:12px;overflow:hidden;border:1px solid #2a2d3a;">

        <!-- Accent bar -->
        <tr><td style="background:linear-gradient(90deg,#1f4aa8,#0d9488 60%,transparent);height:4px;"></td></tr>

        <!-- Header -->
        <tr><td align="center" style="padding:32px 40px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td>
              <table cellpadding="0" cellspacing="0"><tr>
                <td style="background:#1f4aa8;border-radius:8px;width:40px;height:40px;text-align:center;vertical-align:middle;">
                  <span style="color:#fff;font-weight:700;font-size:14px;line-height:40px;">FX</span>
                </td>
                <td style="padding-left:10px;vertical-align:middle;">
                  <p style="margin:0;font-size:16px;font-weight:700;color:#fff;">AlphaLab</p>
                  <p style="margin:0;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#6b7280;">Elite Daily Brief</p>
                </td>
              </tr></table>
            </td>
            <td align="right" style="vertical-align:middle;">
              <p style="margin:0;font-size:12px;color:#6b7280;">{date_str}</p>
              <span style="display:inline-block;margin-top:4px;background:#0f1117;border:1px solid #374151;color:#9ca3af;font-size:10px;font-weight:600;padding:3px 10px;border-radius:4px;letter-spacing:1px;text-transform:uppercase;">{regime_badge}</span>
            </td>
          </tr></table>
        </td></tr>

        <!-- Greeting -->
        <tr><td style="padding:0 40px 20px;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#fff;">Good morning, {display_name}.</p>
          <p style="margin:6px 0 0;font-size:14px;color:#9ca3af;line-height:1.6;">
            Your AI coordinator has analysed all four FX pairs. Here's today's alpha brief.
          </p>
        </td></tr>

        <!-- Hero: top pick or hold -->
        {hero_section}

        <!-- All-pairs table -->
        <tr><td style="padding:0 40px 28px;">
          <p style="margin:0 0 12px;font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#6b7280;">All Pairs</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid #2a2d3a;">
            <tr style="background:#0f1117;">
              <th style="padding:8px 12px;text-align:left;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#4b5563;font-weight:600;">Pair</th>
              <th style="padding:8px 8px;text-align:center;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#4b5563;font-weight:600;">Action</th>
              <th style="padding:8px 8px;text-align:center;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#4b5563;font-weight:600;">Confidence</th>
              <th style="padding:8px 8px;text-align:center;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#4b5563;font-weight:600;">Conviction</th>
              <th style="padding:8px 8px;text-align:center;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#4b5563;font-weight:600;">Horizon</th>
              <th style="padding:8px 12px;text-align:right;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#4b5563;font-weight:600;">Est. Vol</th>
            </tr>
            {pair_rows_html}
          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td align="center" style="padding:0 40px 32px;">
          <a href="{dashboard_url}"
             style="display:inline-block;background:#1f4aa8;color:#fff;font-size:14px;font-weight:600;
                    text-decoration:none;padding:13px 36px;border-radius:8px;letter-spacing:0.5px;">
            Open Full Analysis →
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 40px;border-top:1px solid #2a2d3a;">
          <p style="margin:0;font-size:11px;color:#4b5563;text-align:center;line-height:1.7;">
            You receive this as an <strong style="color:#6b7280;">Elite</strong> member of FX-AlphaLab.<br/>
            Manage your preferences at <a href="{dashboard_url.replace('/dashboard','/profile')}" style="color:#6b7280;">{dashboard_url.replace('/dashboard','/profile')}</a><br/>
            FX-AlphaLab · Intelligent FX Platform
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>"""


def send_daily_report_emails(target_date: object) -> None:
    """Query Elite users and send daily alpha brief emails.

    Called from the scheduler threadpool after a successful inference run.
    Opens its own DB session — never raises, logs all errors.
    """
    import datetime as _dt

    from src.shared.config import Config as _Cfg
    from src.shared.db.models import CoordinatorReportRow, CoordinatorSignalRow, UserAccount
    from src.shared.db.session import get_db

    date_obj: _dt.date = (
        target_date.date()  # type: ignore[union-attr]
        if hasattr(target_date, "date")
        else target_date
    )
    date_str = str(date_obj)
    dashboard_url = f"{_Cfg.FRONTEND_URL}/dashboard"

    try:
        with get_db() as db:
            report = (
                db.query(CoordinatorReportRow).filter(CoordinatorReportRow.date == date_obj).first()
            )
            if report is None:
                logger.warning("No CoordinatorReport for %s — skipping daily emails", date_str)
                return

            signals = (
                db.query(CoordinatorSignalRow).filter(CoordinatorSignalRow.date == date_obj).all()
            )
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
                            round(s.estimated_vol_3d * 100, 3)
                            if s.estimated_vol_3d is not None
                            else None
                        ),
                    }
                    for s in signals
                ],
                key=lambda x: x["conviction_score"] or 0,
                reverse=True,
            )

            users = (
                db.query(UserAccount)
                .filter(
                    UserAccount.tier == "elite",
                    UserAccount.is_active == True,  # noqa: E712
                    UserAccount.email_verified_at != None,  # noqa: E711
                )
                .all()
            )

            if not users:
                logger.info("No active Elite users to email for %s", date_str)
                return

            overall_action = report.overall_action or "hold"
            top_pick = report.top_pick
            global_regime = report.global_regime
            hold_reason = report.hold_reason

            for user in users:
                display_name = (user.full_name or user.email.split("@")[0]).strip()
                plain = _build_report_plain(
                    date_str,
                    overall_action,
                    top_pick,
                    global_regime,
                    hold_reason,
                    signal_rows,
                    display_name,
                )
                html = _build_report_html(
                    date_str,
                    overall_action,
                    top_pick,
                    global_regime,
                    hold_reason,
                    signal_rows,
                    display_name,
                    user.email,
                    dashboard_url,
                )
                threading.Thread(
                    target=_send_transactional,
                    args=(user.email, f"FX-AlphaLab Daily Brief — {date_str}", plain, html),
                    daemon=True,
                    name=f"report-email-{date_str}-{user.id}",
                ).start()

            logger.info(
                "Queued daily report emails for %d Elite user(s) (%s)", len(users), date_str
            )

    except Exception:
        logger.exception("Failed to dispatch daily report emails for %s", date_str)
