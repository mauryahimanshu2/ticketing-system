function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return entities[character];
  });
}

function paragraph(value) {
  return escapeHtml(value).replace(/\r?\n/g, '<br>');
}

function layout(title, bodyHtml, bodyText) {
  return {
    html: `<!doctype html><html><body style="margin:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#202124"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border-radius:8px"><tr><td style="padding:28px"><p style="font-size:13px;font-weight:bold;color:#315efb">SUPPORT</p><h1 style="font-size:22px">${escapeHtml(title)}</h1>${bodyHtml}<p style="margin-top:32px;color:#5f6368;font-size:13px">This is an automated support email.</p></td></tr></table></td></tr></table></body></html>`,
    text: `${title}\n\n${bodyText}\n\nThis is an automated support email.`,
  };
}

function validateHttpsUrl(value, fieldName) {
  let url;
  try {
    url = new URL(value);
  } catch (error) {
    throw new Error(`${fieldName} must be a valid HTTPS URL`);
  }
  if (url.protocol !== 'https:') {
    throw new Error(`${fieldName} must be a valid HTTPS URL`);
  }
  return url.toString();
}

export function renderOtpVerificationEmail({ name, otp, expiresInMinutes = 10 }) {
  const safeName = escapeHtml(name || 'there');
  const safeOtp = escapeHtml(otp);
  const title = 'Verify your email address';
  return {
    subject: title,
    ...layout(
      title,
      `<p>Hello ${safeName},</p><p>Your verification code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${safeOtp}</p><p>This code expires in ${Number(expiresInMinutes)} minutes.</p>`,
      `Hello ${name || 'there'},\n\nYour verification code is: ${otp}\nThis code expires in ${Number(expiresInMinutes)} minutes.`,
    ),
  };
}

export function renderWelcomeEmail({ name }) {
  const title = 'Welcome';
  return {
    subject: 'Welcome to Support',
    ...layout(title, `<p>Hello ${escapeHtml(name || 'there')},</p><p>Your support account is ready. Reply to this email if you need help.</p>`, `Hello ${name || 'there'},\n\nYour support account is ready. Reply to this email if you need help.`),
  };
}

export function renderTicketCreatedEmail({ name, ticketNumber, subject }) {
  const title = 'We received your request';
  return {
    subject: `Ticket ${ticketNumber} created: ${subject}`,
    ...layout(title, `<p>Hello ${escapeHtml(name || 'there')},</p><p>Ticket <strong>${escapeHtml(ticketNumber)}</strong> has been created.</p><p>${paragraph(subject)}</p>`, `Hello ${name || 'there'},\n\nTicket ${ticketNumber} has been created.\n${subject}`),
  };
}

export function renderTicketReplyEmail({ name, ticketNumber, message }) {
  if (!message || message.type === 'internal' || message.visibility === 'internal') {
    throw new Error('Internal ticket messages cannot be rendered for customer email');
  }

  const title = `A reply was added to ticket ${ticketNumber}`;
  const body = message.body || '';
  return {
    subject: `New reply on ticket ${ticketNumber}`,
    ...layout(title, `<p>Hello ${escapeHtml(name || 'there')},</p><p>${paragraph(body)}</p>`, `Hello ${name || 'there'},\n\n${body}`),
  };
}

export function renderTicketAssignedEmail({ name, ticketNumber, agentName }) {
  const title = `Ticket ${ticketNumber} assigned`;
  const assignedAgent = agentName || 'our support team';
  return {
    subject: title,
    ...layout(title, `<p>Hello ${escapeHtml(name || 'there')},</p><p>Your ticket has been assigned to ${escapeHtml(assignedAgent)}.</p>`, `Hello ${name || 'there'},\n\nYour ticket has been assigned to ${assignedAgent}.`),
  };
}

export function renderTicketStatusUpdateEmail({ name, ticketNumber, status }) {
  const title = `Ticket ${ticketNumber} status updated`;
  return {
    subject: title,
    ...layout(title, `<p>Hello ${escapeHtml(name || 'there')},</p><p>The status of ticket <strong>${escapeHtml(ticketNumber)}</strong> is now <strong>${escapeHtml(status)}</strong>.</p>`, `Hello ${name || 'there'},\n\nThe status of ticket ${ticketNumber} is now ${status}.`),
  };
}

export function renderPasswordResetEmail({ name, resetUrl }) {
  const title = 'Reset your password';
  const validatedUrl = validateHttpsUrl(resetUrl, 'resetUrl');
  const safeUrl = escapeHtml(validatedUrl);
  return {
    subject: title,
    ...layout(title, `<p>Hello ${escapeHtml(name || 'there')},</p><p>Use the link below to reset your password:</p><p><a href="${safeUrl}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`, `Hello ${name || 'there'},\n\nReset your password using this link: ${validatedUrl}\n\nIf you did not request this, you can ignore this email.`),
  };
}
