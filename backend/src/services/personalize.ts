import { db } from '../db/database.js';

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * Turn a messy registry name into a natural email salutation:
 *   "John Smith, PhD"         -> "Dr. Smith"
 *   "Ivo Iavicoli, Professor" -> "Prof. Iavicoli"
 *   "Sarah Singh"             -> "Sarah"
 *   "Medical Director"        -> "there"
 */
export function salutationFor(raw: string | null | undefined): string {
  const name = (raw || '').trim();
  if (!name) return 'there';
  const [namePart, ...credParts] = name.split(',');
  const creds = credParts.join(' ').trim();
  const hay = `${namePart} ${creds}`;

  const isProf = /\bprof(essor)?\b/i.test(hay);
  const isDoctor = /\b(MD|DO|Ph\.?D|DVM|DDS|DMD|PharmD|MBBS|MBChB|DrPH|ScD|EdD|DNP|MBBCh)\b/i.test(hay);
  const title = isProf ? 'Prof.' : isDoctor ? 'Dr.' : null;

  // Drop single-letter middle initials (e.g. the "A" in "David A Berntsen").
  const tokens = namePart.trim().split(/\s+/).filter((t) => t && !/^[A-Z]\.?$/.test(t));
  if (title && tokens.length >= 1) return `${title} ${capitalize(tokens[tokens.length - 1])}`;

  // Role/org "contacts" (not people) — greet generically.
  const nonName =
    /\b(director|manager|coordinator|contact|information|office|team|department|dept|study|trials?|recruit\w*|enroll\w*|sponsor|inc|llc|ltd|gmbh|pharmaceuticals?|biosciences?|therapeutics?|university|hospital|institute|clinic|centers?|centres?)\b/i;
  if (nonName.test(namePart)) return 'there';

  if (creds || tokens.length <= 2) return tokens.length ? capitalize(tokens[0]) : 'there';
  return 'there';
}

/** Sender name for {{senderName}} — the connected mailbox, else env, else a default. */
export function mailboxFromName(): string {
  const r = db.prepare('SELECT from_name FROM mailbox WHERE id = 1').get() as { from_name?: string } | undefined;
  return r?.from_name || process.env.FROM_NAME || 'Our team';
}

/** The merge-token values for a contact, shared by sequence sends and one-off emails. */
export function contactVars(name: string | null | undefined, email: string): Record<string, string> {
  const contactName = (name || '').trim() || email.split('@')[0];
  const first = contactName.split(' ')[0];
  return {
    name: contactName,
    firstName: first,
    first_name: first,
    greeting: salutationFor(contactName),
    email,
    senderName: mailboxFromName(),
  };
}
