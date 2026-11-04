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
