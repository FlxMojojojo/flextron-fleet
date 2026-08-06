/**
 * Alert email notifications.
 *
 * When a new battery alert opens (see alertLog), an email is sent to the care
 * team with the customer, device, and alert details. SMTP settings come from
 * env (same Outlook SMTP account as the loaderbike-ads project):
 *
 *   SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM
 *   ALERT_EMAIL_TO   (default care@flextronev.com)
 *   ALERT_EMAIL_CC   (default Chandan@flextronev.com)
 *
 * If SMTP isn't configured, sending is skipped with a log line — alerts still
 * land in the dashboard's Alert Log regardless.
 */

import nodemailer from 'nodemailer';
import type { AlertLogEntry } from './alertLog';

const HOST = process.env.SMTP_HOST ?? '';
const PORT = Number(process.env.SMTP_PORT ?? 587);
const USER = process.env.SMTP_USER ?? '';
const PASS = process.env.SMTP_PASS ?? '';
const FROM = process.env.SMTP_FROM ?? USER;
const TO = process.env.ALERT_EMAIL_TO ?? 'care@flextronev.com';
const CC = process.env.ALERT_EMAIL_CC ?? 'Chandan@flextronev.com';

// Simple storm protection: cap outbound alert mails per hour.
const MAX_PER_HOUR = 30;
let windowStart = Date.now();
let sentInWindow = 0;

let transporter: nodemailer.Transporter | null = null;
function getTransport(): nodemailer.Transporter | null {
  if (!HOST || !USER || !PASS) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: HOST,
      port: PORT,
      secure: PORT === 465,          // 587 → STARTTLS
      auth: { user: USER, pass: PASS },
    });
  }
  return transporter;
}

export interface AlertEmailContext {
  entry: AlertLogEntry;
  customerName: string | null;
  customerMobile?: string | null;
}

export function sendAlertEmail(ctx: AlertEmailContext): void {
  const t = getTransport();
  if (!t) {
    console.warn('[mailer] SMTP not configured — skipping alert email for', ctx.entry.vehicleno, ctx.entry.code);
    return;
  }

  const now = Date.now();
  if (now - windowStart > 3_600_000) { windowStart = now; sentInWindow = 0; }
  if (sentInWindow >= MAX_PER_HOUR) {
    console.warn('[mailer] hourly alert-email cap reached — skipping', ctx.entry.code);
    return;
  }
  sentInWindow++;

  const { entry } = ctx;
  const when = new Date(entry.raised_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const customer = ctx.customerName ?? 'Not mapped';
  const sev = entry.severity;

  const subject = `[${sev}] Battery alert on ${entry.vehicleno}: ${entry.name}`;
  const text = [
    `A battery alert was raised on the Flextron fleet dashboard.`,
    ``,
    `Customer:        ${customer}${ctx.customerMobile ? ` (${ctx.customerMobile})` : ''}`,
    `Device ID:       ${entry.device_id}`,
    `Vehicle Number:  ${entry.vehicleno}`,
    `Alert Type:      ${entry.name} (${entry.code})`,
    `Severity:        ${sev}`,
    `Raised At:       ${when} IST`,
    `Status:          ${entry.status.toUpperCase()}`,
    ``,
    `View live details: https://track.ft.energy/bike/${encodeURIComponent(entry.vehicleno)}`,
    ``,
    `— Flextron Fleet Telemetry (automated alert)`,
  ].join('\n');

  const sevColor = sev === 'CRITICAL' ? '#C42B22' : '#B45711';
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:560px">
    <div style="background:#1E1638;color:#fff;padding:14px 18px;border-radius:8px 8px 0 0">
      <strong>Flextron Fleet Telemetry</strong> — Battery Alert
    </div>
    <div style="border:1px solid #e2e2e2;border-top:none;padding:18px;border-radius:0 0 8px 8px">
      <p style="margin:0 0 12px">
        <span style="background:${sevColor};color:#fff;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:bold">${sev}</span>
        &nbsp;<strong>${entry.name}</strong>
      </p>
      <table style="border-collapse:collapse;font-size:14px">
        <tr><td style="padding:4px 14px 4px 0;color:#666">Customer</td><td><strong>${customer}</strong>${ctx.customerMobile ? ` (${ctx.customerMobile})` : ''}</td></tr>
        <tr><td style="padding:4px 14px 4px 0;color:#666">Device ID</td><td>${entry.device_id}</td></tr>
        <tr><td style="padding:4px 14px 4px 0;color:#666">Vehicle No</td><td>${entry.vehicleno}</td></tr>
        <tr><td style="padding:4px 14px 4px 0;color:#666">Alert Code</td><td><code>${entry.code}</code></td></tr>
        <tr><td style="padding:4px 14px 4px 0;color:#666">Raised At</td><td>${when} IST</td></tr>
      </table>
      <p style="margin:16px 0 0">
        <a href="https://track.ft.energy/bike/${encodeURIComponent(entry.vehicleno)}"
           style="background:#1E5BFF;color:#fff;text-decoration:none;padding:9px 16px;border-radius:6px;font-size:14px">
          Open device dashboard
        </a>
      </p>
    </div>
  </div>`;

  t.sendMail({ from: FROM, to: TO, cc: CC, subject, text, html })
    .then(() => console.log(`[mailer] alert email sent: ${entry.vehicleno} ${entry.code}`))
    .catch(err => console.warn('[mailer] send failed:', (err as Error).message));
}

/** Send a password-reset link to a user's email. Returns false if SMTP is off. */
export function sendResetEmail(email: string, username: string, resetUrl: string): boolean {
  const t = getTransport();
  if (!t) { console.warn('[mailer] SMTP not configured — cannot send reset email to', email); return false; }
  const subject = 'Flextron Fleet — password reset';
  const text = [
    `Hi ${username},`,
    ``,
    `A password reset was requested for your Flextron Fleet Telemetry account.`,
    `Open this link to set a new password (valid for 1 hour):`,
    ``,
    resetUrl,
    ``,
    `If you didn't request this, you can ignore this email — your password won't change.`,
    ``,
    `— Flextron Fleet Telemetry`,
  ].join('\n');
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:520px">
    <div style="background:#1E1638;color:#fff;padding:14px 18px;border-radius:8px 8px 0 0"><strong>Flextron Fleet Telemetry</strong></div>
    <div style="border:1px solid #e2e2e2;border-top:none;padding:18px;border-radius:0 0 8px 8px">
      <p>Hi <strong>${username}</strong>,</p>
      <p>A password reset was requested for your account. Click below to set a new password (link valid for 1 hour):</p>
      <p><a href="${resetUrl}" style="background:#1E5BFF;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;display:inline-block">Reset my password</a></p>
      <p style="color:#666;font-size:13px">If you didn't request this, ignore this email — your password won't change.</p>
    </div>
  </div>`;
  t.sendMail({ from: FROM, to: email, subject, text, html })
    .then(() => console.log(`[mailer] reset email sent to ${email}`))
    .catch(err => console.warn('[mailer] reset send failed:', (err as Error).message));
  return true;
}
