// bot/worker/worker.js: the "Ask my AI" chat box's one server door (12 Oct 2026).
//
// WHY it exists: howisjason.com is a static page on GitHub Pages, so it cannot hold an
// API key. The page sends the visitor's conversation here; this worker checks the caps,
// adds the private-to-the-server instructions (prompt.md + facts.md), asks Claude, and
// sends back one short reply. J's choices (12 Oct 2026): a good model (Opus 5.5, never a
// cheap one), his voice, work facts only, and a cap on how much one visitor can send.
//
//   POST /chat  {messages: [{role: "user"|"assistant", content: "..."}, ...]}
//               -> 200 {reply}   or   4xx/5xx {error} (a friendly sentence, safe to show)
//   GET  /      -> "ok" (a health check for testing)
//
// Nothing secret lives in this file or the two .md files beside it: this folder becomes
// public if J puts it on the live page. The one secret is the Anthropic API key, held as
// the Wrangler secret ANTHROPIC_API_KEY (`npx wrangler secret put ANTHROPIC_API_KEY`).
//
// No cron on purpose: J's Cloudflare account caps cron triggers at 5 for the whole
// account, and this worker has nothing to do on a clock.

import PROMPT from './prompt.md';
import FACTS from './facts.md';
import { LIMITS, checkMessages, replyFrom } from './check.js';

// The system prompt is built once from its two files, so the review copy J reads
// (facts.md is the truth; the Brain Dump note is his annotated copy) and what the model
// sees can never drift apart inside the worker.
const SYSTEM = PROMPT.trimEnd() + '\n\n' + FACTS;

const MODEL = 'claude-opus-5-5';

// Who may call this from a browser. CORS only stops OTHER WEBSITES from using the bot
// in their visitors' browsers; a script can still call it directly, which is why the
// daily caps below are the real guard on cost, not this list.
const ORIGINS = ['https://howisjason.com', 'https://www.howisjason.com'];
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/; // J's own Mac, for testing

const SORRY = "Sorry, my AI couldn't answer just now. You can reach me directly at jason@howisjason.com.";

const cors = (req) => {
  const o = req.headers.get('origin') || '';
  const ok = ORIGINS.includes(o) || LOCAL.test(o);
  return ok ? { 'access-control-allow-origin': o, 'access-control-allow-headers': 'content-type', vary: 'origin' } : {};
};
const json = (req, body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors(req) } });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: { ...cors(req), 'access-control-allow-methods': 'POST' } });
    if (req.method === 'GET' && url.pathname === '/') return new Response('ok');
    if (req.method !== 'POST' || url.pathname !== '/chat') return json(req, { error: 'Not found.' }, 404);

    // A browser on another website is turned away here (no Origin = a script or curl,
    // which the caps still bound).
    const origin = req.headers.get('origin');
    if (origin && !cors(req)['access-control-allow-origin']) return json(req, { error: 'Not allowed.' }, 403);

    let body;
    try { body = await req.json(); } catch { return json(req, { error: 'That did not go through.' }, 400); }
    const msgs = checkMessages(body && body.messages);
    if (typeof msgs === 'string') return json(req, { error: msgs }, 400);

    // Count the message against the caps BEFORE spending anything on the model.
    const ip = req.headers.get('cf-connecting-ip') || 'unknown';
    const ledger = env.LEDGER.get(env.LEDGER.idFromName('ledger'));
    const take = await (await ledger.fetch('https://ledger/take', {
      method: 'POST',
      // A missing or broken cap reads as 0, so it refuses everything rather than
      // letting everything through (NaN would compare false and switch the cap off).
      body: JSON.stringify({ ip, perVisitor: Number(env.PER_VISITOR_DAILY) || 0, total: Number(env.TOTAL_DAILY) || 0 }),
    })).json();
    if (!take.ok) {
      const error = take.reason === 'visitor'
        ? "That's all the questions my AI can take from you today. For more, email me at jason@howisjason.com."
        : "My AI has answered all it can for today. Email me at jason@howisjason.com and I'll answer myself.";
      return json(req, { error }, 429);
    }

    if (!env.ANTHROPIC_API_KEY) return json(req, { error: SORRY }, 503);

    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: LIMITS.maxTokens,
          // The instructions and fact sheet are the same for every visitor, so they are
          // cached: a repeat within 5 minutes reads them at $0.20 per million tokens
          // instead of $4.
          system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
          // Thinking cannot be switched off on Opus 5.5; low effort keeps it brief, which
          // suits short chat answers and keeps each reply cheap.
          output_config: { effort: 'low' },
          messages: msgs,
        }),
      });
    } catch (e) {
      console.log('anthropic fetch failed', String(e));
      return json(req, { error: SORRY }, 502);
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      console.log('anthropic error', res.status, JSON.stringify(data && data.error));
      return json(req, { error: SORRY }, 502);
    }
    const reply = replyFrom(data);
    if (!reply) {
      console.log('no reply', data && data.stop_reason);
      return json(req, { error: "I can't help with that one. Ask me about my work, or email me at jason@howisjason.com." }, 200);
    }
    console.log('usage', JSON.stringify(data.usage));
    return json(req, { reply });
  },
};

// The ledger: one Durable Object counting today's messages, per visitor and in total.
// A Durable Object, not KV, because its count is exact (KV is eventually consistent, so
// a quick burst could slip past a cap) and KV's free tier allows only 1,000 writes a day.
// Cloudflare's rate-limit binding was not used: it only counts over 10 or 60 seconds,
// never a whole day. Same pattern as chronicle/door, which runs on this account.
//
// Visitors are kept as a short hash of their IP address, never the address itself, and
// the whole ledger is wiped when the day (UTC) changes, so nothing builds up.
export class Ledger {
  constructor(state) {
    this.storage = state.storage;
  }

  async fetch(req) {
    const { ip, perVisitor, total } = await req.json();
    const day = new Date().toISOString().slice(0, 10);
    if ((await this.storage.get('day')) !== day) {
      await this.storage.deleteAll();
      await this.storage.put('day', day);
    }
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(day + '|' + ip));
    const v = 'v:' + [...new Uint8Array(hash)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
    const mine = (await this.storage.get(v)) || 0;
    const all = (await this.storage.get('total')) || 0;
    if (all >= total) return Response.json({ ok: false, reason: 'total' });
    if (mine >= perVisitor) return Response.json({ ok: false, reason: 'visitor' });
    await this.storage.put({ [v]: mine + 1, total: all + 1 });
    return Response.json({ ok: true, mine: mine + 1, all: all + 1 });
  }
}
