import { auditLog } from "./audit";

type Mail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  category?: string;
  userId?: string;
  request?: Request;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char] || char));
}

function buttonEmail({ title, intro, buttonText, url, outro }: { title: string; intro: string; buttonText: string; url: string; outro: string }) {
  const safeUrl = escapeHtml(url);
  return `<!doctype html>
<html><body style="margin:0;background:#080a13;color:#f8fafc;font-family:Inter,Arial,sans-serif;padding:32px">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:auto;background:#111827;border:1px solid rgba(255,255,255,.12);border-radius:24px;overflow:hidden">
    <tr><td style="padding:28px;background:linear-gradient(135deg,#a855f7,#ec4899);font-size:24px;font-weight:900">Creator Connect</td></tr>
    <tr><td style="padding:28px">
      <h1 style="margin:0 0 12px;font-size:28px;line-height:1.1">${escapeHtml(title)}</h1>
      <p style="color:#cbd5e1;line-height:1.6">${escapeHtml(intro)}</p>
      <p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;background:linear-gradient(135deg,#a855f7,#ec4899);color:white;text-decoration:none;border-radius:999px;padding:13px 18px;font-weight:800">${escapeHtml(buttonText)}</a></p>
      <p style="color:#94a3b8;line-height:1.6">${escapeHtml(outro)}</p>
      <p style="color:#64748b;font-size:13px;line-height:1.6;word-break:break-all">If the button does not work, copy this link:<br>${safeUrl}</p>
    </td></tr>
  </table>
</body></html>`;
}

async function sendConsole(mail: Mail) {
  console.log("\n--- Creator Connect Mail ---");
  console.log(`To: ${mail.to}`);
  console.log(`Subject: ${mail.subject}`);
  console.log(mail.text);
  console.log("--- End Mail ---\n");
  return { provider: "console", delivered: true, id: null };
}

async function sendResend(mail: Mail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || "Creator Connect <onboarding@resend.dev>";
  if (!apiKey) throw new Error("RESEND_API_KEY is required when MAIL_PROVIDER=resend.");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || "Resend email delivery failed.");
  return { provider: "resend", delivered: true, id: data.id || null };
}

export async function sendMail(mail: Mail) {
  const provider = (process.env.MAIL_PROVIDER || "console").toLowerCase();
  try {
    const result = provider === "resend" ? await sendResend(mail) : await sendConsole(mail);
    await auditLog({ actorId: mail.userId, action: "mail.sent", targetType: "email", targetId: mail.to, metadata: { provider: result.provider, category: mail.category, id: result.id }, request: mail.request });
    return result;
  } catch (error) {
    await auditLog({ actorId: mail.userId, action: "mail.failed", targetType: "email", targetId: mail.to, metadata: { provider, category: mail.category, error: (error as Error).message }, request: mail.request });
    if (provider !== "console" && process.env.MAIL_FALLBACK_TO_CONSOLE !== "false") {
      const fallback = await sendConsole(mail);
      await auditLog({ actorId: mail.userId, action: "mail.fallback_console", targetType: "email", targetId: mail.to, metadata: { category: mail.category }, request: mail.request });
      return fallback;
    }
    throw error;
  }
}

export async function sendVerificationEmail(user: { id?: string; email: string; name: string }, token: string, request?: Request) {
  const origin = request ? new URL(request.url).origin : (process.env.APP_URL || "http://localhost:3000");
  const url = `${origin}/verify-email/${encodeURIComponent(token)}`;
  return sendMail({
    to: user.email,
    subject: "Verify your Creator Connect email",
    text: `Hi ${user.name}, verify your email here: ${url}`,
    html: buttonEmail({
      title: "Verify your email",
      intro: `Hi ${user.name}, confirm this email address to secure your Creator Connect account.`,
      buttonText: "Verify email",
      url,
      outro: "This verification link expires in 24 hours."
    }),
    category: "email_verification",
    userId: user.id,
    request
  });
}

export async function sendPasswordResetEmail(user: { id?: string; email: string; name: string }, token: string, request?: Request) {
  const origin = request ? new URL(request.url).origin : (process.env.APP_URL || "http://localhost:3000");
  const url = `${origin}/reset-password/${encodeURIComponent(token)}`;
  return sendMail({
    to: user.email,
    subject: "Reset your Creator Connect password",
    text: `Hi ${user.name}, reset your password here: ${url}\nThis link expires soon.`,
    html: buttonEmail({
      title: "Reset your password",
      intro: `Hi ${user.name}, use this secure link to choose a new password.`,
      buttonText: "Reset password",
      url,
      outro: "This password reset link expires in 1 hour. If you did not request it, ignore this email."
    }),
    category: "password_reset",
    userId: user.id,
    request
  });
}
