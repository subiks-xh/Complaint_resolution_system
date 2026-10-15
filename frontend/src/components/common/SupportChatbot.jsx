import { useState } from "react";
import { Bot, MessageCircle, Send, X } from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../hooks/useAuth";

const starter = {
  role: "bot",
  text: "Hi, I am CRS Assistant. Ask about payments, complaint status, onboarding, or password reset.",
};

const SupportChatbot = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([starter]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setLoading(true);

    try {
      // Pass recent messages for context
      const historyPayload = messages.slice(-4).map((m) => ({
        role: m.role,
        text: m.text,
      }));
      const { data } = await api.post("/chatbot/message", { message: text, history: historyPayload });
      const reply = data?.data?.reply || "I could not process that just now.";
      const providerNotice = data?.data?.providerNotice;
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: reply,
          notice: providerNotice,
        },
      ]);
    } catch (error) {
      const errMsg =
        error.response?.data?.message ||
        "Chatbot is currently unavailable. Please try again in a moment.";
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: errMsg,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open ? (
        <div className="w-[340px] max-w-[90vw] rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl overflow-hidden">
          <div className="px-4 py-3 bg-primary text-white flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <Bot className="w-4 h-4" />
              CRS Assistant
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-white/90 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="h-72 overflow-y-auto p-3 space-y-2 bg-gray-50 dark:bg-gray-900/30">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`text-sm px-3 py-2 rounded-xl max-w-[85%] ${
                  message.role === "user"
                    ? "ml-auto bg-primary text-white"
                    : "mr-auto bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-100"
                }`}
              >
                {message.text}
                {message.notice && (
                  <div className="mt-1 text-[11px] opacity-75 italic">
                    {message.notice}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Assistant is typing...
              </div>
            )}
          </div>

          <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask your question..."
              className="flex-1 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={loading}
              className="rounded-xl bg-primary text-white p-2.5 disabled:opacity-60"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-14 h-14 rounded-full shadow-lg bg-primary text-white flex items-center justify-center hover:bg-blue-600 transition-colors"
          aria-label="Open chatbot"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};

export default SupportChatbot;
