import { Resend } from "resend";

const FROM_DEFAULT = process.env.RESEND_FROM || "GoaNow <hello@goanow.online>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://goanow.online";

function getClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export function getResendStatus() {
  return {
    configured: !!process.env.RESEND_API_KEY,
    from: FROM_DEFAULT,
    siteUrl: SITE_URL,
  };
}

export function isEmailValid(email) {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function shell(content, opts = {}) {
  const { unsubscribeUrl } = opts;
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>GoaNow</title></head>
<body style="margin:0;padding:0;background:#07090e;color:#e9ecf3;font-family:Inter,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#07090e;padding:24px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:linear-gradient(180deg,#0e1220,#0a0d18);border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden;">
        <tr><td style="padding:28px 28px 8px;">
          <div style="font-family:'Bebas Neue',Helvetica,Arial,sans-serif;font-size:32px;letter-spacing:2px;color:#FF3D81;">GoaNow</div>
        </td></tr>
        <tr><td style="padding:8px 28px 28px;color:#e9ecf3;font-size:15px;line-height:1.65;">
          ${content}
        </td></tr>
        <tr><td style="padding:18px 28px 28px;border-top:1px solid rgba(255,255,255,0.06);color:#9aa3b2;font-size:12px;line-height:1.6;">
          <div>Made for travellers in Goa.</div>
          <div style="margin-top:6px;"><a href="${SITE_URL}" style="color:#33D6C8;text-decoration:none;">goanow.online</a></div>
          ${unsubscribeUrl ? `<div style="margin-top:10px;"><a href="${unsubscribeUrl}" style="color:#9aa3b2;text-decoration:underline;">Unsubscribe from party alerts</a></div>` : ""}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function plain(text) {
  return text;
}

function normalizeResendError(error) {
  if (!error) return "Unknown Resend error";
  if (typeof error === "string") return error;
  return error.message || error.name || JSON.stringify(error);
}

export async function sendWelcomeEmail({ to, planName, expiryAt, source = "paid" }) {
  const client = getClient();
  if (!client || !isEmailValid(to)) return { sent: false, reason: "no_client_or_email" };

  const expiryStr = expiryAt
    ? new Date(expiryAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "your trip end";

  const intro = source === "trial"
    ? "Your trial pass is now active"
    : "Payment confirmed - your pass is now active";

  const html = shell(`
    <h2 style="margin:0 0 8px;color:#fff;font-size:24px;">${intro}</h2>
    <p style="margin:0 0 14px;color:#d8dce8;">Thanks for unlocking GoaNow${planName ? ` - <strong style="color:#33D6C8;">${escapeHtml(planName)}</strong>` : ""}.</p>
    <ul style="margin:0 0 18px;padding-left:18px;color:#d8dce8;">
      <li>Nearby cafes and restobars sorted by your real distance</li>
      <li>Live party intel with crowd-arrival timing</li>
      <li>AI itinerary tailored to your area, vibe and budget</li>
    </ul>
    <p style="margin:0 0 18px;color:#9aa3b2;font-size:13px;">Pass expires: <strong style="color:#fff;">${expiryStr}</strong></p>
    <a href="${SITE_URL}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#FF3D81,#FF6B6B);color:#fff;padding:13px 22px;border-radius:11px;text-decoration:none;font-weight:700;">Open Dashboard</a>
    <p style="margin:22px 0 0;color:#9aa3b2;font-size:13px;">Save the website to your home screen - works like an app.</p>
  `);

  try {
    const { data, error } = await client.emails.send({
      from: FROM_DEFAULT,
      to,
      subject: source === "trial" ? "Your GoaNow trial is live" : "Welcome to GoaNow",
      html,
      text: plain(`${intro}\n\nYour pass${planName ? ` (${planName})` : ""} is active until ${expiryStr}.\nOpen your dashboard: ${SITE_URL}/dashboard`),
    });
    if (error) {
      const reason = normalizeResendError(error);
      console.error("Resend welcome error", reason);
      return { sent: false, reason };
    }
    return { sent: true, id: data?.id };
  } catch (err) {
    const reason = normalizeResendError(err);
    console.error("Resend welcome exception", reason);
    return { sent: false, reason };
  }
}

export async function sendItineraryEmail({ to, itineraryText, userArea, shareId }) {
  const client = getClient();
  if (!client || !isEmailValid(to)) return { sent: false, reason: "no_client_or_email" };

  const safeText = String(itineraryText || "").slice(0, 12000);
  const escapedHtml = escapeHtml(safeText).replace(/\n/g, "<br>");
  const shareUrl = shareId ? `${SITE_URL}/plan/${shareId}` : null;

  const html = shell(`
    <h2 style="margin:0 0 6px;color:#fff;font-size:22px;">Your Goa plan is ready</h2>
    ${userArea ? `<p style="margin:0 0 18px;color:#9aa3b2;font-size:13px;">${escapeHtml(userArea)}</p>` : ""}
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:18px;color:#e9ecf3;font-size:14px;line-height:1.75;white-space:pre-wrap;">
      ${escapedHtml}
    </div>
    <div style="margin-top:22px;text-align:center;">
      <a href="${SITE_URL}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#FF3D81,#FF6B6B);color:#fff;padding:13px 24px;border-radius:11px;text-decoration:none;font-weight:700;font-size:14px;">Open Your Dashboard</a>
      <div style="margin-top:8px;color:#9aa3b2;font-size:12px;">Live nearby spots, tonight's parties, and your saved plans.</div>
    </div>
    ${shareUrl ? `
      <p style="margin:22px 0 0;color:#9aa3b2;font-size:13px;text-align:center;">
        Want to share this plan? <a href="${shareUrl}" style="color:#33D6C8;text-decoration:none;font-weight:600;">${shareUrl}</a>
      </p>
    ` : ""}
    <p style="margin:22px 0 0;color:#9aa3b2;font-size:12px;line-height:1.55;">
      Note: opening hours change. Confirm by phone or Google Maps before you head out, especially for late-night spots.
    </p>
  `);

  try {
    const { data, error } = await client.emails.send({
      from: FROM_DEFAULT,
      to,
      subject: `Your Goa plan${userArea ? ` - ${userArea}` : ""}`,
      html,
      text: plain(`Your Goa plan${userArea ? ` for ${userArea}` : ""}\n\n${safeText}\n\n${shareUrl ? `Share: ${shareUrl}` : ""}\n\n- GoaNow`),
    });
    if (error) return { sent: false, reason: normalizeResendError(error) };
    return { sent: true, id: data?.id };
  } catch (err) {
    return { sent: false, reason: normalizeResendError(err) };
  }
}

export async function sendPartyBlast({ to, events = [], unsubscribeUrl }) {
  const client = getClient();
  if (!client || !isEmailValid(to)) return { sent: false, reason: "no_client_or_email" };
  if (!events.length) return { sent: false, reason: "no_events" };

  const eventCards = events.slice(0, 6).map((ev) => `
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,61,129,0.18);border-radius:12px;padding:14px;margin-bottom:10px;">
      <div style="font-size:17px;font-weight:700;color:#fff;">${escapeHtml(ev.name || "Event")}</div>
      <div style="margin-top:4px;color:#d8dce8;font-size:13px;">${escapeHtml(ev.venue || "")}${ev.area ? `, ${escapeHtml(ev.area)}` : ""}</div>
      <div style="margin-top:4px;color:#9aa3b2;font-size:13px;">${escapeHtml(ev.start_time || "Tonight")} | ${escapeHtml(ev.entry_fee || "Check at venue")}</div>
      ${ev.vibe ? `<div style="margin-top:6px;color:#33D6C8;font-size:12px;">${escapeHtml(ev.vibe)}</div>` : ""}
      ${ev.insider_tip ? `<div style="margin-top:6px;color:#FFD93D;font-size:12px;font-style:italic;">${escapeHtml(ev.insider_tip)}</div>` : ""}
    </div>
  `).join("");

  const html = shell(`
    <h2 style="margin:0 0 6px;color:#fff;font-size:24px;">Tonight in Goa</h2>
    <p style="margin:0 0 16px;color:#9aa3b2;">${events.length} ${events.length === 1 ? "party" : "parties"} you might love.</p>
    ${eventCards}
    <p style="margin:14px 0 0;color:#9aa3b2;font-size:12px;">Real crowd usually arrives 1-2 hours after flyer time. Do not rush.</p>
    <a href="${SITE_URL}/dashboard" style="display:inline-block;margin-top:16px;background:linear-gradient(135deg,#FF3D81,#FF6B6B);color:#fff;padding:11px 18px;border-radius:11px;text-decoration:none;font-weight:700;font-size:14px;">See full party feed</a>
  `, { unsubscribeUrl });

  try {
    const { data, error } = await client.emails.send({
      from: FROM_DEFAULT,
      to,
      subject: `Tonight in Goa: ${events[0]?.name?.slice(0, 50) || "Party night"}`,
      html,
      text: plain(`Tonight in Goa\n\n${events.slice(0, 6).map((e) => `- ${e.name} @ ${e.venue} - ${e.start_time || "tonight"} - ${e.entry_fee || "check at venue"}`).join("\n")}\n\n${SITE_URL}/dashboard`),
    });
    if (error) return { sent: false, reason: normalizeResendError(error) };
    return { sent: true, id: data?.id };
  } catch (err) {
    return { sent: false, reason: normalizeResendError(err) };
  }
}
