/**
 * AI Provider Service
 *
 * Pluggable AI provider abstraction for CRS Assistant.
 * Supports OpenAI-compatible REST endpoints (via native fetch / axios)
 * with robust timeout handling, parameter sanitization, and fallback flags.
 */

const getProviderConfig = () => {
  const isEnabled = process.env.CHATBOT_AI_ENABLED === "true";
  const apiKey = process.env.CHATBOT_AI_API_KEY || process.env.OPENAI_API_KEY || null;
  const model = process.env.CHATBOT_AI_MODEL || "gpt-4o-mini";
  const apiUrl = process.env.CHATBOT_AI_URL || "https://api.openai.com/v1/chat/completions";
  const timeoutMs = parseInt(process.env.CHATBOT_AI_TIMEOUT_MS, 10) || 5000;

  return {
    isEnabled: Boolean(isEnabled && apiKey),
    apiKey,
    model,
    apiUrl,
    timeoutMs,
  };
};

/**
 * Generate a response from the configured AI provider.
 * @param {Array<{role: string, content: string}>} messages
 * @param {Object} [customOptions]
 * @returns {Promise<{success: boolean, text: string, source: string, error?: string}>}
 */
const generateChatCompletion = async (messages, customOptions = {}) => {
  const config = getProviderConfig();

  if (!config.isEnabled || !config.apiKey) {
    return {
      success: false,
      text: null,
      source: "unavailable",
      error: "AI provider is not configured or disabled",
    };
  }

  const timeoutMs = customOptions.timeoutMs || config.timeoutMs;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const payload = {
      model: customOptions.model || config.model,
      temperature: 0.3,
      max_tokens: 300,
      messages,
    };

    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      return {
        success: false,
        text: null,
        source: "provider_error",
        error: `Provider HTTP ${response.status}: ${errText.slice(0, 150)}`,
      };
    }

    const data = await response.json();
    const replyText = data?.choices?.[0]?.message?.content?.trim();

    if (!replyText) {
      return {
        success: false,
        text: null,
        source: "malformed_output",
        error: "Provider returned empty or invalid response structure",
      };
    }

    return {
      success: true,
      text: replyText,
      source: "ai",
    };
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = err.name === "AbortError";
    return {
      success: false,
      text: null,
      source: isTimeout ? "timeout" : "provider_error",
      error: isTimeout ? "Provider request timed out" : err.message,
    };
  }
};

module.exports = {
  getProviderConfig,
  generateChatCompletion,
};
