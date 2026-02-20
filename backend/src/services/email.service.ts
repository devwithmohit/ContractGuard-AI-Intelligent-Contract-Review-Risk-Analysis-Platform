/**
 * email.service.ts
 *
 * Email delivery service using Resend (https://resend.com).
 *
 * Provides:
 *  - sendEmail()                  — generic send via Resend API
 *  - sendSignupConfirmationEmail() — branded confirmation email for new users
 *
 * Uses raw `fetch` to the Resend REST API (no SDK dependency).
 * Credentials are read from:
 *   RESEND_API_KEY — Resend API key
 *   EMAIL_FROM     — Sender address (default: onboarding@resend.dev)
 */
import { createLogger } from '../lib/logger.js';

const log = createLogger('service.email');

// ─── Core Send ────────────────────────────────────────────────

interface SendEmailOptions {
    to: string | string[];
    subject: string;
    html: string;
    from?: string;
    replyTo?: string;
}

interface ResendSuccessResponse {
    id: string;
}

interface ResendErrorResponse {
    statusCode: number;
    message: string;
    name: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<{ id: string }> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        throw new Error('RESEND_API_KEY is not configured');
    }

    const from = options.from ?? process.env.EMAIL_FROM ?? 'onboarding@resend.dev';

    log.info(
        { to: options.to, subject: options.subject, from },
        'Sending email via Resend',
    );

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from,
            to: Array.isArray(options.to) ? options.to : [options.to],
            subject: options.subject,
            html: options.html,
            reply_to: options.replyTo,
        }),
        signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as ResendErrorResponse | null;
        const detail = errorBody?.message ?? `HTTP ${response.status}`;
        log.error({ status: response.status, detail }, 'Resend API error');
        throw new Error(`Email send failed: ${detail}`);
    }

    const result = (await response.json()) as ResendSuccessResponse;
    log.info({ emailId: result.id, to: options.to }, 'Email sent successfully');
    return result;
}

// ─── Signup Confirmation Email ────────────────────────────────

export async function sendSignupConfirmationEmail(
    to: string,
    confirmUrl: string,
): Promise<{ id: string }> {
    const html = buildSignupEmailHtml(confirmUrl);

    return sendEmail({
        to,
        subject: 'Verify your ContractGuard AI account',
        html,
    });
}

// ─── HTML Template ────────────────────────────────────────────

function buildSignupEmailHtml(confirmUrl: string): string {
    const year = new Date().getFullYear();

    return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>Verify your ContractGuard AI account</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings xmlns:o="urn:schemas-microsoft-com:office:office">
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset */
    body, table, td, p, a, li, blockquote { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0; mso-table-rspace: 0; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; }

    /* Dark-mode support */
    @media (prefers-color-scheme: dark) {
      .email-bg { background-color: #0f172a !important; }
      .email-card { background-color: #1e293b !important; }
      .text-primary { color: #f1f5f9 !important; }
      .text-secondary { color: #94a3b8 !important; }
      .text-muted { color: #64748b !important; }
      .border-color { border-color: #334155 !important; }
      .feature-bg { background-color: #0f172a !important; }
    }
  </style>
</head>
<body class="email-bg" style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">

  <!-- Preheader (hidden) -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
    Welcome to ContractGuard AI — verify your email to get started with AI-powered contract analysis.
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px;">

          <!-- Logo Header -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 12px; padding: 10px 12px; vertical-align: middle;">
                    <span style="font-size: 20px; color: #ffffff;">&#x1F6E1;</span>
                  </td>
                  <td style="padding-left: 12px; vertical-align: middle;">
                    <span class="text-primary" style="font-size: 22px; font-weight: 700; color: #0f172a; letter-spacing: -0.3px;">
                      ContractGuard
                    </span>
                    <span style="font-size: 22px; font-weight: 700; color: #6366f1; letter-spacing: -0.3px;">
                      &nbsp;AI
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td class="email-card" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 24px rgba(0,0,0,0.04); overflow: hidden;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

                <!-- Gradient accent bar -->
                <tr>
                  <td style="height: 4px; background: linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa);"></td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 40px 36px;">
                    <!-- Heading -->
                    <h1 class="text-primary" style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #0f172a; line-height: 1.3;">
                      Verify your email address
                    </h1>
                    <p class="text-secondary" style="margin: 0 0 28px; font-size: 15px; color: #475569; line-height: 1.6;">
                      Thanks for signing up for ContractGuard AI! Click the button below to confirm
                      your email and activate your account.
                    </p>

                    <!-- CTA Button -->
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center" style="padding: 4px 0 32px;">
                          <!--[if mso]>
                          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${confirmUrl}" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="17%" fillcolor="#6366f1">
                            <w:anchorlock/>
                            <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:600;">Verify Email Address</center>
                          </v:roundrect>
                          <![endif]-->
                          <!--[if !mso]><!-->
                          <a href="${confirmUrl}" target="_blank"
                             style="display: inline-block; background: linear-gradient(135deg, #6366f1, #7c3aed);
                                    color: #ffffff; font-size: 15px; font-weight: 600;
                                    text-decoration: none; padding: 14px 36px;
                                    border-radius: 8px; letter-spacing: 0.2px;
                                    box-shadow: 0 2px 8px rgba(99,102,241,0.35);
                                    transition: opacity 0.2s;">
                            Verify Email Address
                          </a>
                          <!--<![endif]-->
                        </td>
                      </tr>
                    </table>

                    <!-- Divider -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td class="border-color" style="border-top: 1px solid #e2e8f0; padding-top: 24px;">
                          <p class="text-secondary" style="margin: 0 0 20px; font-size: 14px; color: #475569; line-height: 1.6;">
                            Once verified, you'll be able to:
                          </p>
                        </td>
                      </tr>
                    </table>

                    <!-- Feature list -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td class="feature-bg" style="background-color: #f8fafc; border-radius: 10px; padding: 20px 24px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding-bottom: 12px;">
                                <span style="color: #6366f1; font-size: 15px; margin-right: 10px;">&#10003;</span>
                                <span class="text-primary" style="font-size: 14px; color: #1e293b;">Upload and analyze contracts with AI in seconds</span>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding-bottom: 12px;">
                                <span style="color: #6366f1; font-size: 15px; margin-right: 10px;">&#10003;</span>
                                <span class="text-primary" style="font-size: 14px; color: #1e293b;">Get automatic risk scoring and clause detection</span>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding-bottom: 12px;">
                                <span style="color: #6366f1; font-size: 15px; margin-right: 10px;">&#10003;</span>
                                <span class="text-primary" style="font-size: 14px; color: #1e293b;">Receive real-time deadline and expiry alerts</span>
                              </td>
                            </tr>
                            <tr>
                              <td>
                                <span style="color: #6366f1; font-size: 15px; margin-right: 10px;">&#10003;</span>
                                <span class="text-primary" style="font-size: 14px; color: #1e293b;">Search semantically across your entire contract library</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Fallback link -->
                    <p class="text-muted" style="margin: 28px 0 0; font-size: 12px; color: #94a3b8; line-height: 1.6;">
                      If the button doesn't work, copy and paste this link into your browser:
                    </p>
                    <p style="margin: 6px 0 0; word-break: break-all;">
                      <a href="${confirmUrl}" style="font-size: 12px; color: #6366f1; text-decoration: underline;">${confirmUrl}</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 28px 16px 0;">
              <p class="text-muted" style="margin: 0 0 8px; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
              </p>
              <p class="text-muted" style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                &copy; ${year} ContractGuard AI &mdash; Intelligent Contract Review &amp; Risk Analysis
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}
