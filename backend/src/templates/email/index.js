const colors = {
  background: '#f2f5f9', brand: '#0f766e', brandDark: '#115e59', brandSoft: '#ccfbf1',
  border: '#dbe4ee', heading: '#102a43', muted: '#627d98', text: '#334e68', white: '#ffffff',
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function paragraph(value) {
  return escapeHtml(value).replace(/\r?\n/g, '<br>');
}

function greeting(name) {
  return `<p style="margin:0 0 18px;font-size:16px;line-height:25px;color:${colors.text}">Hello <strong style="color:${colors.heading}">${escapeHtml(name || 'there')}</strong>,</p>`;
}

function callout(content, { background = '#f0fdfa', border = colors.brandSoft } = {}) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0"><tr><td style="padding:18px 20px;background:${background};border:1px solid ${border};border-radius:10px;color:${colors.text};font-size:15px;line-height:24px">${content}</td></tr></table>`;
}

function actionButton(label, url) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0"><tr><td bgcolor="${colors.brand}" style="border-radius:8px"><a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 24px;color:${colors.white};font-size:15px;font-weight:700;text-decoration:none;border-radius:8px">${escapeHtml(label)}</a></td></tr></table>`;
}

function layout(title, bodyHtml, bodyText) {
  return {
    html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:${colors.background};font-family:Arial,Helvetica,sans-serif;color:${colors.text}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(title)} · Support Center</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:${colors.background}"><tr><td align="center" style="padding:36px 14px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:${colors.white};border:1px solid ${colors.border};border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(16,42,67,.08)">
<tr><td style="padding:22px 30px;background:${colors.brand}"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="color:${colors.white};font-size:18px;font-weight:700;letter-spacing:.2px">Support Center</td><td align="right"><span style="display:inline-block;padding:5px 10px;border:1px solid rgba(255,255,255,.4);border-radius:999px;color:${colors.white};font-size:11px;font-weight:700;letter-spacing:1px">CUSTOMER CARE</span></td></tr></table></td></tr>
<tr><td style="padding:32px 30px 28px"><p style="margin:0 0 9px;color:${colors.brand};font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase">Support update</p><h1 style="margin:0 0 24px;color:${colors.heading};font-size:25px;line-height:33px;font-weight:700">${escapeHtml(title)}</h1>${bodyHtml}</td></tr>
<tr><td style="padding:20px 30px;background:#f8fafc;border-top:1px solid ${colors.border}"><p style="margin:0 0 6px;color:${colors.muted};font-size:12px;line-height:19px">This is an automated support email. Please do not share verification codes or passwords.</p><p style="margin:0;color:#829ab1;font-size:11px;line-height:18px">© ${new Date().getUTCFullYear()} Support Center · We’re here to help.</p></td></tr>
</table></td></tr></table></body></html>`,
    text: `${title}\n\n${bodyText}\n\nThis is an automated support email. Please do not share verification codes or passwords.`,
  };
}

function badge(value, type) {
  const normalized = String(value || '').toLowerCase();
  const palettes = {
    status: { open: ['#e0f2fe', '#075985'], in_progress: ['#ede9fe', '#5b21b6'], pending: ['#fef3c7', '#92400e'], resolved: ['#dcfce7', '#166534'], closed: ['#e2e8f0', '#334155'] },
    priority: { low: ['#dcfce7', '#166534'], medium: ['#dbeafe', '#1e40af'], high: ['#ffedd5', '#9a3412'], urgent: ['#fee2e2', '#991b1b'] },
  };
  const [background, foreground] = palettes[type]?.[normalized] || ['#edf2f7', colors.text];
  const label = normalized.replaceAll('_', ' ') || '—';
  return `<span style="display:inline-block;padding:4px 9px;background:${background};border-radius:999px;color:${foreground};font-size:12px;font-weight:700;text-transform:capitalize">${escapeHtml(label)}</span>`;
}

function ticketDetails({ ticketNumber, subject, description, priority, status, categoryName, agentName }) {
  const details = [
    ['Ticket number', ticketNumber, 'text'], ['Subject', subject, 'text'],
    ['Description', description, 'text'], ['Priority', priority, 'priority'],
    ['Status', status, 'status'], ['Category', categoryName || 'Uncategorized', 'text'],
    ['Assigned agent', agentName || 'Not assigned', 'text'],
  ];
  const rows = details.map(([label, value, type], index) => {
    const renderedValue = type === 'text' ? paragraph(value || '—') : badge(value, type);
    const background = index % 2 === 0 ? '#ffffff' : '#f8fafc';
    return `<tr><td valign="top" style="padding:12px 14px;background:${background};border-bottom:1px solid #e7edf4;color:${colors.muted};font-size:12px;font-weight:700;line-height:19px;width:135px;text-transform:uppercase;letter-spacing:.3px">${escapeHtml(label)}</td><td valign="top" style="padding:12px 14px;background:${background};border-bottom:1px solid #e7edf4;color:${colors.heading};font-size:14px;line-height:21px">${renderedValue}</td></tr>`;
  }).join('');
  const html = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;border:1px solid ${colors.border};border-radius:10px;border-collapse:separate;border-spacing:0;overflow:hidden"><tr><td colspan="2" style="padding:13px 14px;background:#e6fffa;color:${colors.brandDark};font-size:13px;font-weight:700;letter-spacing:.4px;text-transform:uppercase">Ticket details</td></tr>${rows}</table>`;
  const text = details.map(([label, value]) => `${label}: ${value || '—'}`).join('\n');
  return { html, text };
}

function validateHttpsUrl(value, fieldName) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${fieldName} must be a valid HTTPS URL`); }
  if (url.protocol !== 'https:') throw new Error(`${fieldName} must be a valid HTTPS URL`);
  return url.toString();
}

export function renderOtpVerificationEmail({ name, otp, expiresInMinutes = 10 }) {
  const title = 'Verify your email address';
  return { subject: title, ...layout(title,
    `${greeting(name)}<p style="margin:0;color:${colors.text};font-size:15px;line-height:24px">Enter this one-time verification code to continue:</p>${callout(`<div style="text-align:center"><p style="margin:0 0 8px;color:${colors.muted};font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Verification code</p><p style="margin:0;color:${colors.brandDark};font-family:Courier New,monospace;font-size:32px;font-weight:700;letter-spacing:8px">${escapeHtml(otp)}</p></div>`)}<p style="margin:0;color:${colors.muted};font-size:13px;line-height:21px">This code expires in <strong>${Number(expiresInMinutes)} minutes</strong>. If you did not request it, you can safely ignore this email.</p>`,
    `Hello ${name || 'there'},\n\nYour verification code is: ${otp}\nThis code expires in ${Number(expiresInMinutes)} minutes.`) };
}

export function renderWelcomeEmail({ name }) {
  const title = 'Welcome to Support Center';
  return { subject: 'Welcome to Support', ...layout(title,
    `${greeting(name)}${callout(`<p style="margin:0;color:${colors.brandDark};font-size:16px;font-weight:700">Your account is ready.</p><p style="margin:7px 0 0;color:${colors.text};font-size:14px;line-height:22px">You can now create requests, follow their progress, and reply to your support team from one place.</p>`)}<p style="margin:0;color:${colors.text};font-size:15px;line-height:24px">Whenever you need help, simply open a ticket and our team will take it from there.</p>`,
    `Hello ${name || 'there'},\n\nYour support account is ready. Reply to this email if you need help.`) };
}

export function renderTicketCreatedEmail({ name, ticketNumber, subject }) {
  const title = 'We received your request';
  return { subject: `Ticket ${ticketNumber} created: ${subject}`, ...layout(title,
    `${greeting(name)}<p style="margin:0;color:${colors.text};font-size:15px;line-height:24px">Your request has been received and added to our support queue.</p>${callout(`<p style="margin:0 0 6px;color:${colors.muted};font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase">Ticket ${escapeHtml(ticketNumber)}</p><p style="margin:0;color:${colors.heading};font-size:17px;font-weight:700;line-height:25px">${paragraph(subject)}</p>`)}<p style="margin:0;color:${colors.muted};font-size:13px;line-height:21px">Keep the ticket number handy. We’ll email you when there is an update.</p>`,
    `Hello ${name || 'there'},\n\nTicket ${ticketNumber} has been created.\n${subject}`) };
}

export function renderTicketReplyEmail({ name, ticketNumber, message }) {
  if (!message || message.type === 'internal' || message.visibility === 'internal') throw new Error('Internal ticket messages cannot be rendered for customer email');
  const title = `A reply was added to ticket ${ticketNumber}`;
  const body = message.body || '';
  return { subject: `New reply on ticket ${ticketNumber}`, ...layout(title,
    `${greeting(name)}<p style="margin:0;color:${colors.text};font-size:15px;line-height:24px">Your support conversation has a new reply:</p>${callout(`<p style="margin:0;color:${colors.heading};font-size:15px;line-height:25px">${paragraph(body)}</p>`, { background: '#f8fafc', border: colors.border })}<p style="margin:0;color:${colors.muted};font-size:13px;line-height:21px">Open your ticket to view the complete conversation.</p>`,
    `Hello ${name || 'there'},\n\n${body}`) };
}

export function renderTicketAssignedEmail({ name, ticketNumber, subject, description, priority, status, categoryName, agentName }) {
  const title = `Ticket ${ticketNumber} assigned`;
  const assignedAgent = agentName || 'our support team';
  const details = ticketDetails({ ticketNumber, subject, description, priority, status, categoryName, agentName: assignedAgent });
  return { subject: title, ...layout(title,
    `${greeting(name)}<p style="margin:0;color:${colors.text};font-size:15px;line-height:24px">Good news—your ticket has been assigned to <strong style="color:${colors.heading}">${escapeHtml(assignedAgent)}</strong>, who will help you from here.</p>${details.html}`,
    `Hello ${name || 'there'},\n\nYour ticket has been assigned to ${assignedAgent}.\n\n${details.text}`) };
}

export function renderTicketStatusUpdateEmail({ name, ticketNumber, subject, description, priority, status, categoryName, agentName }) {
  const title = `Ticket ${ticketNumber} status updated`;
  const details = ticketDetails({ ticketNumber, subject, description, priority, status, categoryName, agentName });
  return { subject: title, ...layout(title,
    `${greeting(name)}<p style="margin:0;color:${colors.text};font-size:15px;line-height:24px">The status of your ticket is now ${badge(status, 'status')}.</p>${details.html}`,
    `Hello ${name || 'there'},\n\nThe status of ticket ${ticketNumber} is now ${status}.\n\n${details.text}`) };
}

export function renderTicketInformationRequestEmail({ name, question, ticketNumber, subject, description, priority, status, categoryName, agentName }) {
  const title = `More information needed for ticket ${ticketNumber}`;
  const details = ticketDetails({ ticketNumber, subject, description, priority, status, categoryName, agentName });
  return { subject: `[${ticketNumber}] More information needed`, ...layout(title,
    `${greeting(name)}<p style="margin:0;color:${colors.text};font-size:15px;line-height:24px"><strong style="color:${colors.heading}">${escapeHtml(agentName || 'Our support team')}</strong> needs a little more information to continue:</p>${callout(`<p style="margin:0;color:${colors.heading};font-size:15px;line-height:25px">${paragraph(question)}</p>`, { background: '#fff7ed', border: '#fed7aa' })}<p style="margin:0 0 8px;color:${colors.brandDark};font-size:14px;font-weight:700;line-height:22px">Reply directly to this email with text only.</p><p style="margin:0;color:${colors.muted};font-size:13px;line-height:21px">Your reply will be added securely to the ticket conversation.</p>${details.html}`,
    `Hello ${name || 'there'},\n\n${agentName || 'Our support team'} needs the following information:\n\n${question}\n\nReply directly to this email with text only.\n\n${details.text}`) };
}

export function renderPasswordResetEmail({ name, resetUrl }) {
  const title = 'Reset your password';
  const validatedUrl = validateHttpsUrl(resetUrl, 'resetUrl');
  return { subject: title, ...layout(title,
    `${greeting(name)}<p style="margin:0;color:${colors.text};font-size:15px;line-height:24px">We received a request to reset your Support Center password.</p>${actionButton('Reset password', validatedUrl)}<p style="margin:0 0 10px;color:${colors.muted};font-size:13px;line-height:21px">If the button does not work, copy and paste this secure link into your browser:</p><p style="margin:0;padding:12px;background:#f8fafc;border:1px solid ${colors.border};border-radius:8px;color:${colors.brandDark};font-size:12px;line-height:19px;word-break:break-all">${escapeHtml(validatedUrl)}</p><p style="margin:20px 0 0;color:${colors.muted};font-size:13px;line-height:21px">If you did not request a password reset, no action is needed.</p>`,
    `Hello ${name || 'there'},\n\nReset your password using this link: ${validatedUrl}\n\nIf you did not request this, you can ignore this email.`) };
}
