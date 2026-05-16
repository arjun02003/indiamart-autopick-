const axios = require('axios');

/**
 * Send a message to a Telegram chat via Bot API.
 * Silently fails if token/chatId are not configured.
 */
async function sendTelegramNotification(token, chatId, message) {
  if (!token || !chatId || !token.trim() || !chatId.trim()) return;
  try {
    await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`,
      { chat_id: chatId, text: message, parse_mode: 'HTML' },
      { timeout: 10000 }
    );
  } catch (err) {
    console.warn('[Telegram] Notification failed:', err.message);
  }
}

module.exports = { sendTelegramNotification };
