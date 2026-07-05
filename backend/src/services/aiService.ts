import Anthropic from '@anthropic-ai/sdk';
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

export const aiService = {
  isAiConfigured,

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
    const prompt = `Write a single, personalized outbound email from a clinical research site to a sponsor/CRO contact.

Contact: ${context.contactName || 'the recipient'}${context.jobTitle ? `, ${context.jobTitle}` : ''}${
      context.company ? ` at ${context.company}` : ''
    }
${context.studyTitle ? `Regarding study: ${context.studyTitle}` : ''}
${context.indication ? `Indication: ${context.indication}` : ''}
Goal of the email: ${context.goal || 'introduce our site and request a brief feasibility conversation'}

Rules: under ~120 words, professional and warm, plain text (no markdown), a short specific subject line. Use {{name}} only if the contact name is unknown.`;

    const message = await getClient().messages.create({
      model: MODEL,
      max_tokens: 1000,
      output_config: { format: { type: 'json_schema', schema: EMAIL_SCHEMA } },
      messages: [{ role: 'user', content: prompt }],
    });

    return JSON.parse(textOf(message)) as { subject: string; body: string };
  },
};
