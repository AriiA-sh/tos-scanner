// ToS Scanner — background service worker
// Supports multiple AI providers — user picks which one and supplies their own key.

const PROMPT_INSTRUCTIONS = `You are analyzing a Terms of Service or Privacy Policy page. Respond with ONLY valid JSON, no markdown fences, no extra text, in this exact shape:
{"risk": "high" or "safe", "summary": "<one plain-English sentence, max 25 words>", "clauses": [{"quote": "<exact verbatim passage from the page, max 200 chars, cut at a sentence boundary>", "why": "<one short plain-English phrase: what the user is giving up>"}]}

Rules:
- risk="high" ONLY if the text contains genuinely user-unfriendly clauses, such as: mandatory arbitration, class-action waiver, unlimited or irrevocable license to the user's content (including AI training), selling or broadly sharing personal data, one-sided termination without notice, waiving the right to sue, waiving moral rights / attribution, or indemnifying the company against the user.
- If risk="high": list ALL such clauses you can find (up to 5), most harmful first. Each quote MUST be copy-pasted EXACTLY and verbatim from the page text — do NOT paraphrase or describe it. Keep quotes short (one sentence, under 200 chars).
- Do NOT flag normal clauses like "follow the community guidelines", "we may moderate content", "no illegal use", or the platform owning its own content.
- If nothing genuinely unfair exists, respond exactly: {"risk": "safe", "summary": "Nothing seriously unfair found - this looks reasonably safe.", "clauses": []}
Begin your reply directly with the opening curly brace and end with the closing brace. Nothing else, ever.`;

function parseJsonReply(raw) {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last > first) {
    const json = cleaned.slice(first, last + 1);
    try {
      return JSON.parse(json);
    } catch (e) {
      /* fall through to try whole string */
    }
  }
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Couldn't parse AI response as JSON. Raw reply: ${cleaned.slice(0, 150)}`);
  }
}

let groqModelCache = null;

async function fetchWithTimeout(url, options, ms = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function getGroqModels(apiKey) {
  if (groqModelCache) return groqModelCache;
  try {
    const res = await fetchWithTimeout("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    if (res.ok) {
      const data = await res.json();
      groqModelCache = (data.data || []).map((m) => m.id);
    }
  } catch (e) { /* ignore */ }
  return groqModelCache || [];
}

const GROQ_PREFERRED = ["openai/gpt-oss-20b", "openai/gpt-oss-120b"];

const RISK_KEYWORDS = [
  "arbitration", "class action", "sue", "waive", "indemnif", "binding",
  "dispute", "terminate", "without notice", "personal data", "third parties",
  "unilateral", "assign", "license", "submit", "your content"
];

function smartSample(text, maxChars = 8000) {
  const head = text.slice(0, 3000);
  const lower = text.toLowerCase();
  const parts = [];
  const seen = new Set();
  for (const kw of RISK_KEYWORDS) {
    let idx = lower.indexOf(kw);
    let count = 0;
    while (idx !== -1 && count < 3) {
      if (!(seen.has(idx))) {
        seen.add(idx);
        parts.push(text.slice(Math.max(0, idx - 300), Math.min(text.length, idx + 600)));
      }
      idx = lower.indexOf(kw, idx + kw.length);
      count++;
    }
  }
  return (head + "\n" + parts.join("\n")).slice(0, maxChars);
}

function groqCandidateModels(userModel, available) {
  const has = (id) => !available.length || available.includes(id);
  const list = [];
  if (has(userModel)) list.push(userModel);
  for (const id of GROQ_PREFERRED) {
    if (!list.includes(id) && has(id)) list.push(id);
  }
  for (const id of available) {
    if (!list.includes(id)) list.push(id);
  }
  return list.slice(0, 5);
}

const PROVIDERS = {
  gemini: {
    label: "Google Gemini",
    defaultModel: "gemini-3.6-flash",
    async analyze(text, apiKey, model) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const body = {
        contents: [{ parts: [{ text: `${PROMPT_INSTRUCTIONS}\n\nPAGE TEXT:\n${text}` }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 300 }
      };
      let res, lastErr;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetchWithTimeout(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        if (res.ok) break;
        if (res.status === 503 && attempt < 2) {
          lastErr = await res.text();
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        const errText = await res.text();
        throw new Error(`Gemini API error (${res.status}): ${errText.slice(0, 200)}`);
      }
      if (!res.ok) {
        throw new Error(`Gemini API error (503): still overloaded after retries. ${lastErr?.slice(0, 150) || ""}`);
      }
      const data = await res.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return parseJsonReply(raw);
    }
  },

  openai: {
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    async analyze(text, apiKey, model) {
      const url = `https://api.openai.com/v1/chat/completions`;
      const body = {
        model,
        messages: [
          { role: "system", content: PROMPT_INSTRUCTIONS },
          { role: "user", content: `PAGE TEXT:\n${text}` }
        ],
        temperature: 0.2,
        max_tokens: 300
      };
      let res, lastErr;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetchWithTimeout(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        if (res.ok) break;
        if (res.status === 503 && attempt < 2) {
          lastErr = await res.text();
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        const errText = await res.text();
        throw new Error(`OpenAI API error (${res.status}): ${errText.slice(0, 200)}`);
      }
      if (!res.ok) {
        throw new Error(`OpenAI API error (503): still overloaded after retries. ${lastErr?.slice(0, 150) || ""}`);
      }
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content || "";
      return parseJsonReply(raw);
    }
  },

  groq: {
    label: "Groq (free)",
    defaultModel: "openai/gpt-oss-20b",
    async analyze(text, apiKey, model) {
      const url = `https://api.groq.com/openai/v1/chat/completions`;
      const trimmed = smartSample(text);
      const available = await getGroqModels(apiKey);
      const candidates = groqCandidateModels(model, available).slice(0, 3);
      let lastErr;
      for (const tryModel of candidates) {
        const body = {
          model: tryModel,
          messages: [
            { role: "system", content: PROMPT_INSTRUCTIONS },
            { role: "user", content: `PAGE TEXT:\n${trimmed}` }
          ],
          temperature: 0.2,
          max_tokens: 2000
        };
        let res;
        try {
          res = await fetchWithTimeout(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(body)
          });
        } catch (e) {
          lastErr = e.message;
          continue;
        }
        if (res.status === 429 || res.status === 503) {
          lastErr = (await res.text()).slice(0, 150);
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        if (!res.ok) {
          const errText = await res.text();
          if (res.status === 404 && errText.includes("model_not_found")) {
            lastErr = `model ${tryModel} not available`;
            continue;
          }
          throw new Error(`Groq API error (${res.status}): ${errText.slice(0, 200)}`);
        }
        const data = await res.json();
        const msg = data.choices?.[0]?.message || null;
        const raw = (msg && (msg.content || msg.reasoning_content)) || "";
        if (!raw) {
          lastErr = `empty reply from ${tryModel}. FULL RESPONSE: ${JSON.stringify(data).slice(0, 400)}`;
          continue;
        }
        try {
          return parseJsonReply(raw);
        } catch (parseErr) {
          lastErr = `odd reply from ${tryModel}: ${raw.slice(0, 150)}`;
        }
      }
      throw new Error(`Groq API error: no usable reply. ${lastErr || ""}`);
    }
  },

  anthropic: {
    label: "Claude (Anthropic)",
    defaultModel: "claude-haiku-4-5-20251001",
    async analyze(text, apiKey, model) {
      const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model,
          max_tokens: 300,
          system: PROMPT_INSTRUCTIONS,
          messages: [{ role: "user", content: `PAGE TEXT:\n${text}` }]
        })
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Claude API error (${res.status}): ${errText.slice(0, 200)}`);
      }
      const data = await res.json();
      const raw = data.content?.[0]?.text || "";
      return parseJsonReply(raw);
    }
  }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "SCAN_TOS") return false;

  chrome.storage.local.get(
    ["provider", "apiKeys", "models"],
    async ({ provider, apiKeys, models }) => {
      const providerId = provider || "gemini";
      const config = PROVIDERS[providerId];
      const apiKey = apiKeys?.[providerId];
      const model = models?.[providerId] || config.defaultModel;

      if (!apiKey) {
        sendResponse({
          error: `No API key set for ${config.label}. Click the extension icon and add one.`
        });
        return;
      }
      try {
        const result = await config.analyze(smartSample(message.text), apiKey, model);
        const clauses = Array.isArray(result.clauses)
          ? result.clauses.slice(0, 5)
          : result.worst_clause
            ? [{ quote: result.worst_clause, why: result.summary || "" }]
            : [];
        sendResponse({
          risk: result.risk === "safe" || !clauses.length ? "safe" : "high",
          summary: result.summary || "",
          clauses
        });
      } catch (err) {
        sendResponse({ error: err.message });
      }
    }
  );

  return true; // keep the message channel open for the async response
});
