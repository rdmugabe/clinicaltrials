/**
 * Contact enrichment layer.
 *
 * Real integration: if HUNTER_API_KEY is set we call Hunter.io's Email Finder
 * (https://hunter.io/api-documentation/v2#email-finder) to resolve a verified
 * work email from a full name + company domain.
 *
 * Graceful fallback: with no key (or no resolvable domain) we return a best-guess
 * email pattern and a LinkedIn people-search URL, both clearly flagged as
 * "guessed" so the UI never presents unverified data as fact.
 */

export interface EnrichmentResult {
  email?: string;
  linkedin?: string;
  confidence: 'verified' | 'guessed';
}

const HUNTER_KEY = process.env.HUNTER_API_KEY;

export function isEnrichmentConfigured(): boolean {
  return !!HUNTER_KEY;
}

function slugifyDomain(company?: string): string | undefined {
  if (!company) return undefined;
  const slug = company
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|corporation|co|company|pharmaceuticals?|therapeutics|biosciences?|labs?|group|plc|gmbh|sa|ag)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
  return slug ? `${slug}.com` : undefined;
}

function linkedInSearchUrl(name: string, company?: string): string {
  const q = encodeURIComponent([name, company].filter(Boolean).join(' '));
  return `https://www.linkedin.com/search/results/people/?keywords=${q}`;
}

function guessEmail(name: string, domain?: string): string | undefined {
  if (!domain) return undefined;
  const parts = name.trim().toLowerCase().split(/\s+/);
  if (parts.length < 2) return undefined;
  const first = parts[0].replace(/[^a-z]/g, '');
  const last = parts[parts.length - 1].replace(/[^a-z]/g, '');
  if (!first || !last) return undefined;
  return `${first}.${last}@${domain}`;
}

async function hunterFindEmail(name: string, domain: string): Promise<string | undefined> {
  const parts = name.trim().split(/\s+/);
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ') || parts[0];
  const url = new URL('https://api.hunter.io/v2/email-finder');
  url.searchParams.set('domain', domain);
  url.searchParams.set('first_name', firstName);
  url.searchParams.set('last_name', lastName);
  url.searchParams.set('api_key', HUNTER_KEY as string);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Hunter.io error: ${res.status}`);
  }
  const data = (await res.json()) as { data?: { email?: string } };
  return data.data?.email || undefined;
}

export const enrichmentService = {
  isEnrichmentConfigured,

  async enrich(name: string, company?: string): Promise<EnrichmentResult> {
    const linkedin = linkedInSearchUrl(name, company);
    const domain = slugifyDomain(company);

    if (HUNTER_KEY && domain) {
      try {
        const email = await hunterFindEmail(name, domain);
        if (email) {
          return { email, linkedin, confidence: 'verified' };
        }
      } catch (err) {
        console.error('Enrichment (Hunter.io) failed, falling back to guess:', err);
      }
    }

    return {
      email: guessEmail(name, domain),
      linkedin,
      confidence: 'guessed',
    };
  },
};
