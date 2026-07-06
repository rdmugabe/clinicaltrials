import Anthropic from '@anthropic-ai/sdk';
import { salutationFor, mailboxFromName } from './personalize.js';
import type { SequenceStep } from '../types/studyfinder.js';

// Per the current Anthropic API guidance, default to the latest Opus model.
const MODEL = 'claude-opus-4-8';

// Lazily construct the client so the server still boots without a key.
let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export function isAiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/** Concatenate the text blocks of a Messages response. */
function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

export interface SequenceBrief {
  audience?: string; // e.g. "Clinical Operations leaders at mid-size sponsors"
  offering?: string; // what the site offers
  indication?: string;
  tone?: string; // e.g. "warm and concise"
  steps?: number; // desired number of steps
}

const SEQUENCE_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          subject: { type: 'string' },
          body: { type: 'string' },
          delayDays: { type: 'integer' },
        },
        required: ['subject', 'body', 'delayDays'],
        additionalProperties: false,
      },
    },
  },
  required: ['name', 'steps'],
  additionalProperties: false,
};

const EMAIL_SCHEMA = {
  type: 'object',
  properties: {
    subject: { type: 'string' },
    body: { type: 'string' },
  },
  required: ['subject', 'body'],
  additionalProperties: false,
};

export interface NewsItem {
  title: string;
  url: string;
  source?: string;
  date?: string;
  insight?: string;
}
export interface WebNewsResult {
  enabled: boolean;
  reason?: string;
  summary?: string;
  items?: NewsItem[];
}

/** Pull a JSON object out of a model response that may wrap it in prose/fences. */
function extractJson(text: string): any | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

export const aiService = {
  isAiConfigured,

  /**
   * Web-search recent US news / updates relevant to a topic using Claude's
   * web_search tool. Gated on ANTHROPIC_API_KEY — returns enabled:false when
   * unconfigured so callers can render a graceful "connect a key" state.
   */
  async webNews(topic: string): Promise<WebNewsResult> {
    if (!isAiConfigured()) {
      return { enabled: false, reason: 'Set ANTHROPIC_API_KEY on the backend to enable AI-powered US news & insights.' };
    }
    const prompt = `Search the web for the most recent (roughly the last 60 days) United States news, press releases, and updates relevant to: "${topic}", in the context of clinical trials and drug development. Prioritize US-based sponsors/biotechs, trial readouts and results, FDA actions, and site/enrollment developments.

Respond with ONLY a JSON object (no prose, no markdown fences) of the form:
{"summary": "<2-3 sentence overview of what's notable right now>", "items": [{"title": "<headline>", "url": "<real source URL>", "source": "<publication>", "date": "<publish date>", "insight": "<one sentence on why it matters for BD>"}]}
Include 4-8 items, each with a real URL you actually found via search.`;

    let message;
    try {
      message = await getClient().messages.create({
        model: MODEL,
        max_tokens: 3000,
        // Web search is a server-side tool; typings vary by SDK version, so cast.
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }] as any,
        messages: [{ role: 'user', content: prompt }],
      });
    } catch (err: any) {
      // Never let an AI failure (billing, rate limit, outage) break the caller —
      // degrade to a disabled state with a readable reason.
      const detail = err?.error?.error?.message || err?.message || 'The AI request failed.';
      console.error('webNews error:', detail);
      return { enabled: false, reason: `US news is temporarily unavailable: ${detail}` };
    }

    const parsed = extractJson(textOf(message));
    if (!parsed || !Array.isArray(parsed.items)) {
      return { enabled: true, summary: textOf(message).slice(0, 500), items: [] };
    }
    const items: NewsItem[] = parsed.items
      .filter((i: any) => i && i.title && i.url)
      .map((i: any) => ({
        title: String(i.title),
        url: String(i.url),
        source: i.source ? String(i.source) : undefined,
        date: i.date ? String(i.date) : undefined,
        insight: i.insight ? String(i.insight) : undefined,
      }));
    return { enabled: true, summary: parsed.summary ? String(parsed.summary) : undefined, items };
  },

  /** Generate a multi-step outreach sequence from a short brief. */
  async generateSequence(brief: SequenceBrief): Promise<{ name: string; steps: SequenceStep[] }> {
    const stepCount = Math.min(Math.max(brief.steps || 3, 1), 6);
    const prompt = `You are a clinical-trial business-development expert writing outbound email sequences that clinical research sites send to trial sponsors and CROs.

Write a ${stepCount}-step email sequence.

Context:
- Target audience: ${brief.audience || 'sponsor and CRO decision-makers (Clinical Operations, Study Start-Up, Feasibility)'}
- What the site offers: ${brief.offering || 'an experienced, high-enrolling research site with strong patient access'}
- Therapeutic area / indication: ${brief.indication || 'not specified'}
- Tone: ${brief.tone || 'professional, warm, and concise'}

Rules:
- Step 1 has delayDays = 0. Later steps are follow-ups spaced 3-5 days apart.
- Keep each email under ~120 words. Use the personalization token {{name}} where a first name fits.
- Subjects are short and specific (no clickbait). Bodies are plain text, no markdown.
- The sequence name is a short label (e.g. "Sponsor intro — Oncology").`;

    const message = await getClient().messages.create({
      model: MODEL,
      max_tokens: 2000,
      output_config: { format: { type: 'json_schema', schema: SEQUENCE_SCHEMA } },
      messages: [{ role: 'user', content: prompt }],
    });

    const parsed = JSON.parse(textOf(message)) as { name: string; steps: SequenceStep[] };
    // Enforce the delay invariant regardless of model output.
    parsed.steps = parsed.steps.map((s, i) => ({
      subject: s.subject,
      body: s.body,
      delayDays: i === 0 ? 0 : Math.max(1, Number(s.delayDays) || 3),
    }));
    return parsed;
  },

  /** Draft or personalize a single outreach email for a specific contact/study. */
  async generateEmail(context: {
    contactName?: string;
    jobTitle?: string;
    company?: string;
    studyTitle?: string;
    indication?: string;
    goal?: string;
  }): Promise<{ subject: string; body: string }> {
    // Derive the natural salutation ("Dr. Smith") and sender name, shared with
    // the sequence and one-off send paths.
    const greeting = salutationFor(context.contactName);
    const sender = mailboxFromName();

    const prompt = `Write a single, personalized outbound email from a clinical research site to a sponsor/CRO contact.

Contact: ${context.contactName || 'the recipient'}${context.jobTitle ? `, ${context.jobTitle}` : ''}${
      context.company ? ` at ${context.company}` : ''
    }
${context.studyTitle ? `Regarding study: ${context.studyTitle}` : ''}
${context.indication ? `Indication: ${context.indication}` : ''}
Goal of the email: ${context.goal || 'introduce our site and request a brief feasibility conversation'}

Rules:
- Under ~120 words, professional and warm, plain text (no markdown), a short specific subject line.
- Open the greeting with exactly "Hi ${greeting}," — do NOT use the contact's full name or credentials in the salutation.
- Sign off as "${sender}" (do not invent a different sender name, title, or company).`;

    const message = await getClient().messages.create({
      model: MODEL,
      max_tokens: 1000,
      output_config: { format: { type: 'json_schema', schema: EMAIL_SCHEMA } },
      messages: [{ role: 'user', content: prompt }],
    });

    return JSON.parse(textOf(message)) as { subject: string; body: string };
  },
};
