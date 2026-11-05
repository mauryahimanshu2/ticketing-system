function jsonResponse(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return jsonResponse({ success: true, service: 'ticketing-email' });
}

function doPost(event) {
  try {
    var request = JSON.parse(event.postData.contents);
    var expectedSecret = PropertiesService.getScriptProperties().getProperty('APPS_SCRIPT_SECRET');

    if (!expectedSecret || !request.secret || request.secret !== expectedSecret) {
      return jsonResponse({ success: false, code: 'unauthorized' });
    }

    var recipient = String(request.recipient || '').trim();
    var subject = String(request.subject || '').trim();
    var text = String(request.text || '');
    var html = String(request.html || '');
    var replyTo = String(request.replyTo || '').trim();
    var idempotencyKey = String(request.idempotencyKey || '').trim();
    var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(recipient) || !subject || (!text.trim() && !html.trim()) || !idempotencyKey) {
      return jsonResponse({ success: false, code: 'invalid_email_payload' });
    }
    if (replyTo && !emailPattern.test(replyTo)) {
      return jsonResponse({ success: false, code: 'invalid_reply_to' });
    }

    var digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      idempotencyKey,
      Utilities.Charset.UTF_8
    );
    var cacheKey = 'sent_' + Utilities.base64EncodeWebSafe(digest);
    var cache = CacheService.getScriptCache();
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {
      if (cache.get(cacheKey)) {
        return jsonResponse({ success: true, duplicate: true });
      }

      var options = {};
      if (html) options.htmlBody = html;
      if (replyTo) options.replyTo = replyTo;

      GmailApp.sendEmail(recipient, subject, text || 'Please view this message in an HTML-capable email client.', options);
      cache.put(cacheKey, 'sent', 21600);
      return jsonResponse({ success: true, duplicate: false });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    console.error('Email delivery request failed');
    return jsonResponse({ success: false, code: 'delivery_failed' });
  }
}

function processInboundReplies() {
  var properties = PropertiesService.getScriptProperties();
  var inboundUrl = String(properties.getProperty('INBOUND_EMAIL_URL') || '').trim();
  var inboundSecret = String(properties.getProperty('INBOUND_EMAIL_SECRET') || '').trim();
  var supportEmail = String(properties.getProperty('SUPPORT_EMAIL') || '').trim().toLowerCase();

  if (!inboundUrl || !inboundSecret || !supportEmail) {
    throw new Error('INBOUND_EMAIL_URL, INBOUND_EMAIL_SECRET, and SUPPORT_EMAIL are required');
  }

  var supportParts = supportEmail.split('@');
  if (supportParts.length !== 2) throw new Error('SUPPORT_EMAIL is invalid');
  var replyPrefix = supportParts[0].split('+')[0] + '+ticket-';
  var replyDomain = '@' + supportParts[1];
  var threads = GmailApp.search('is:unread newer_than:14d', 0, 50);

  threads.forEach(function (thread) {
    thread.getMessages().forEach(function (message) {
      if (!message.isUnread()) return;

      var recipient = extractEmailAddress(message.getTo());
      var sender = extractEmailAddress(message.getFrom());
      var isTicketReply = recipient.indexOf(replyPrefix) === 0 && recipient.endsWith(replyDomain);
      if (!isTicketReply || !sender || sender === supportEmail) return;

      try {
        var response = UrlFetchApp.fetch(inboundUrl, {
          method: 'post',
          contentType: 'application/json',
          headers: { 'x-inbound-email-secret': inboundSecret },
          payload: JSON.stringify({
            recipient: recipient,
            sender: sender,
            messageId: message.getId(),
            inReplyTo: String(message.getHeader('In-Reply-To') || ''),
            body: extractLatestReply(message.getPlainBody())
          }),
          muteHttpExceptions: true
        });

        var statusCode = response.getResponseCode();
        if (statusCode < 500) {
          message.markRead();
        } else {
          console.error('Inbound reply backend returned ' + statusCode);
        }
      } catch (error) {
        console.error('Inbound reply delivery failed');
      }
    });
  });
}

function extractEmailAddress(value) {
  var text = String(value || '').trim().toLowerCase();
  var bracketMatch = text.match(/<([^<>]+)>/);
  return String(bracketMatch ? bracketMatch[1] : text).trim();
}

function extractLatestReply(value) {
  var lines = String(value || '').replace(/\r\n/g, '\n').split('\n');
  var reply = [];

  for (var index = 0; index < lines.length; index += 1) {
    var trimmed = lines[index].trim();
    if (/^On .+wrote:$/i.test(trimmed)) break;
    if (/^-{2,}\s*Original Message\s*-{2,}$/i.test(trimmed)) break;
    if (trimmed === '--') break;
    if (trimmed.indexOf('>') !== 0) reply.push(lines[index]);
  }
  return reply.join('\n').trim();
}
