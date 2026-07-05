import type { Region } from './types.js';

/** ClinicalTrials.gov Essie expression matching studies with a US location. */
export const US_COUNTRY_EXPR = 'AREA[LocationCountry]United States';

/**
 * Translate a region into a ClinicalTrials.gov advanced (Essie) geo filter:
 * 'us' → US studies, 'world' → everything except the US, undefined → no filter.
 */
export function regionAdvanced(region?: Region): string | undefined {
  if (region === 'us') return US_COUNTRY_EXPR;
  if (region === 'world') return `NOT ${US_COUNTRY_EXPR}`;
  return undefined;
}
