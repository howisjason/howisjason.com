// bot/worker/check.js: the worker's two pure helpers, kept apart from worker.js so
// check.test.mjs can run them with plain node, with no network and no Cloudflare.

// The sizes that bound the cost of one message (see the price note in J's review copy):
export const LIMITS = {
  userChars: 600,      // one visitor message: a question, not a document
  assistantChars: 1500, // earlier replies sent back by the page (the bot's own are far shorter)
  turns: 10,           // visitor messages in one conversation; then "start a new chat"
  maxTokens: 1500,     // the reply's ceiling, thinking included (answers aim for ~80 words)
};

// The conversation arrives from the page, so it is checked like any outside input:
// roles alternate, it starts and ends with the visitor, and every size is bounded.
// Returns the clean message list, or a string saying what is wrong.
export function checkMessages(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return 'Write a question first.';
  const msgs = [];
  for (let i = 0; i < raw.length; i++) {
    const m = raw[i] || {};
    const role = i % 2 === 0 ? 'user' : 'assistant';
    if (m.role !== role) return 'That conversation looks broken. Try starting a new chat.';
    const text = typeof m.content === 'string' ? m.content.trim() : '';
    if (!text) return 'Write a question first.';
    const cap = role === 'user' ? LIMITS.userChars : LIMITS.assistantChars;
    if (text.length > cap) return role === 'user' ? `Please keep it under ${cap} characters.` : 'That conversation looks broken. Try starting a new chat.';
    msgs.push({ role, content: text });
  }
  if (msgs[msgs.length - 1].role !== 'user') return 'Write a question first.';
  if (Math.ceil(msgs.length / 2) > LIMITS.turns) return "That's the end of this chat. Start a new one, or email me at jason@howisjason.com.";
  return msgs;
}

// The reply is the text blocks only. A refusal (Anthropic's safety system declining)
// gets the plain apology rather than a retry on another model: on a portfolio bot a
// refusal almost always means someone was trying to misuse it, and a server-side
// fallback would only hand that attempt to a second model.
export function replyFrom(data) {
  if (!data || data.stop_reason === 'refusal') return null;
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  // Cut to the size checkMessages accepts back as an earlier turn, or one long answer
  // would make the visitor's next question fail as "broken" (the grader's catch).
  return text ? text.slice(0, LIMITS.assistantChars) : null;
}

