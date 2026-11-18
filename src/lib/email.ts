import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";

interface SendStaffInviteOptions {
  toEmail: string;
  toName: string;
  orgName: string;
  inviterName: string;
  role: string;
  inviteUrl: string;
}

interface SendPasswordResetOptions {
  toEmail: string;
  toName?: string;
  resetUrl: string;
}

export function formatRoleTitle(role: string): string {
  switch (role) {
    case "admin":
      return "Administrator";
    case "receptionist":
      return "Receptionist";
    case "viewer":
      return "Viewer";
    case "owner":
      return "Organization Owner";
    default:
      return role;
  }
}

/**
 * Dispatches an official staff invitation email with activation link.
 */
export async function sendStaffInviteEmail(opts: SendStaffInviteOptions) {
  const roleTitle = formatRoleTitle(opts.role);
  const subject = `You've been invited to join ${opts.orgName} on Echo.ai`;

  const bodyText = `
Hi ${opts.toName || "there"},

${opts.inviterName} has invited you to join the ${opts.orgName} workspace on Echo.ai as an ${roleTitle}.

To accept this invitation and choose your secure password, click the link below:
${opts.inviteUrl}

This invitation link is valid for 48 hours.

If you weren't expecting this invitation, you can safely ignore this email.

Best regards,
The Echo.ai Team
https://echo.ai
`.trim();

  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.04); }
    .header { background: #4f46e5; padding: 28px; text-align: center; color: #ffffff; }
    .logo { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
    .content { padding: 32px 28px; font-size: 14px; line-height: 1.6; color: #334155; }
    .cta-btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 10px; margin: 20px 0; }
    .details { background: #f1f5f9; border-radius: 10px; padding: 14px; margin: 16px 0; font-size: 13px; }
    .footer { border-top: 1px solid #e2e8f0; padding: 16px 28px; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo">Echo.ai</div>
    </div>
    <div class="content">
      <h2 style="margin-top: 0; color: #0f172a; font-size: 18px;">Welcome to the Team, ${opts.toName}!</h2>
      <p><b>${opts.inviterName}</b> has invited you to join the <b>${opts.orgName}</b> team on Echo.ai.</p>
      
      <div class="details">
        <div><b>Organization:</b> ${opts.orgName}</div>
        <div><b>Assigned Role:</b> ${roleTitle}</div>
        <div><b>Email:</b> ${opts.toEmail}</div>
      </div>

      <p>Click below to choose your password and activate your account:</p>
      <div style="text-align: center;">
        <a href="${opts.inviteUrl}" class="cta-btn">Set Password & Activate Account →</a>
      </div>
      <p style="font-size: 12px; color: #64748b;">Or copy this link into your browser:<br><span style="font-family: monospace; word-break: break-all;">${opts.inviteUrl}</span></p>
      <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;">This invitation link will expire in 48 hours.</p>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} Echo.ai • Virtual Receptionist & Practice Automation
    </div>
  </div>
</body>
</html>
`.trim();

  const emailId = "msg_" + randomBytes(6).toString("hex");

  db.prepare(`
    INSERT INTO dispatched_emails (id, to_email, to_name, subject, body_text, body_html, action_url, email_type, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'invite', 'delivered')
  `).run(emailId, opts.toEmail, opts.toName, subject, bodyText, bodyHtml, opts.inviteUrl);

  console.log(`[EMAIL DISPATCHED] To: ${opts.toEmail} | Subject: "${subject}" | Setup Link: ${opts.inviteUrl}`);

  return {
    success: true,
    emailId,
    actionUrl: opts.inviteUrl,
    subject,
  };
}

/**
 * Dispatches an official password reset email.
 */
export async function sendPasswordResetEmail(opts: SendPasswordResetOptions) {
  const subject = `Reset your Echo.ai password`;
  const name = opts.toName || "there";

  const bodyText = `
Hi ${name},

We received a request to reset the password for your Echo.ai account (${opts.toEmail}).

To reset your password, click the link below:
${opts.resetUrl}

This link is valid for 1 hour. If you didn't request a password reset, you can safely ignore this email.

Best regards,
The Echo.ai Security Team
`.trim();

  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.04); }
    .header { background: #0f172a; padding: 28px; text-align: center; color: #ffffff; }
    .logo { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
    .content { padding: 32px 28px; font-size: 14px; line-height: 1.6; color: #334155; }
    .cta-btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 10px; margin: 20px 0; }
    .footer { border-top: 1px solid #e2e8f0; padding: 16px 28px; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo">Echo.ai Security</div>
    </div>
    <div class="content">
      <h2 style="margin-top: 0; color: #0f172a; font-size: 18px;">Password Reset Request</h2>
      <p>Hi ${name},</p>
      <p>We received a request to reset the password for your Echo.ai account (<b>${opts.toEmail}</b>).</p>
      <div style="text-align: center;">
        <a href="${opts.resetUrl}" class="cta-btn">Choose New Password →</a>
      </div>
      <p style="font-size: 12px; color: #64748b;">Or copy this link into your browser:<br><span style="font-family: monospace; word-break: break-all;">${opts.resetUrl}</span></p>
      <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;">This password reset link will expire in 1 hour. If you did not request this, you can safely disregard this message.</p>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} Echo.ai • Account Security
    </div>
  </div>
</body>
</html>
`.trim();

  const emailId = "msg_" + randomBytes(6).toString("hex");

  db.prepare(`
    INSERT INTO dispatched_emails (id, to_email, to_name, subject, body_text, body_html, action_url, email_type, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'password_reset', 'delivered')
  `).run(emailId, opts.toEmail, opts.toName || null, subject, bodyText, bodyHtml, opts.resetUrl);

  console.log(`[EMAIL DISPATCHED] To: ${opts.toEmail} | Subject: "${subject}" | Reset Link: ${opts.resetUrl}`);

  return {
    success: true,
    emailId,
    actionUrl: opts.resetUrl,
    subject,
  };
}
