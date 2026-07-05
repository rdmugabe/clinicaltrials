import { clinicalTrialsService } from './clinicalTrialsService.js';
import { scoutService } from './scoutService.js';
import { toStudyCard } from './studyMapper.js';
import { aiService, type WebNewsResult } from './aiService.js';
import type { SearchParams } from '../types/clinicalTrials.js';
import type { Scout, StudyCard } from '../types/studyfinder.js';

export interface Insights {
  topic: string;
  aiConfigured: boolean;
  /** Newest studies to hit the registry (by first-post date) — fresh opportunities. */
  newStudies: StudyCard[];
  /** Most recently updated studies (by last-update date) — status/protocol changes. */
  updatedStudies: StudyCard[];
  /** AI web-search US news & insights (gated on ANTHROPIC_API_KEY). */
  news: WebNewsResult;
}

export interface ScoutInsightRow {
  scoutId: string;
  scoutName: string;
  color?: string;
  indication?: string;
  newStudies: StudyCard[];
  updatedStudies: StudyCard[];
}

export interface GlobalInsights {
  aiConfigured: boolean;
  scouts: ScoutInsightRow[];
  news: WebNewsResult;
}

/** A concise news/search topic derived from a scout's criteria. */
function topicForScout(scout: Scout): string {
  if (scout.indication) return scout.indication;
  const conds = scout.criteria?.conditions?.map((c) => c.label) ?? [];
  if (conds.length) return conds.slice(0, 3).join(', ');
  if (scout.criteria?.keywords?.length) return scout.criteria.keywords.slice(0, 3).join(', ');
  return scout.name;
}

/** Fetch the newest-posted and most-recently-updated studies for a query. */
async function studySignals(params: SearchParams, size: number): Promise<{ newStudies: StudyCard[]; updatedStudies: StudyCard[] }> {
  const [fresh, updated] = await Promise.all([
    clinicalTrialsService.searchStudies({ ...params, sort: 'StudyFirstPostDate', sortOrder: 'desc', pageSize: size }),
    clinicalTrialsService.searchStudies({ ...params, sort: 'LastUpdatePostDate', sortOrder: 'desc', pageSize: size }),
  ]);
  return {
    newStudies: fresh.studies.map((s) => toStudyCard(s)),
    updatedStudies: updated.studies.map((s) => toStudyCard(s)),
  };
}

export const insightsService = {
  /** Full insights for a single scout: CT.gov signals + AI US news. */
  async forScout(scoutId: string): Promise<Insights | undefined> {
    const scout = scoutService.get(scoutId);
    if (!scout) return undefined;
    const topic = topicForScout(scout);
    const signals = await studySignals(scout.params, 8);
    const news = await aiService.webNews(topic);
    return { topic, aiConfigured: aiService.isAiConfigured(), ...signals, news };
  },

  /** Full insights for an ad-hoc query (condition text). */
  async forQuery(q: string): Promise<Insights> {
    const topic = q.trim();
    const signals = await studySignals({ condition: topic }, 8);
    const news = await aiService.webNews(topic);
    return { topic, aiConfigured: aiService.isAiConfigured(), ...signals, news };
  },

  /** A roll-up across all scouts for the global Insights page. */
  async global(): Promise<GlobalInsights> {
    const scouts = scoutService.list().slice(0, 6);
    const rows = await Promise.all(
      scouts.map(async (s): Promise<ScoutInsightRow> => {
        const signals = await studySignals(s.params, 4);
        return {
          scoutId: s.id,
          scoutName: s.name,
          color: s.color,
          indication: s.indication,
          ...signals,
        };
      })
    );
    const topics = Array.from(new Set(scouts.map((s) => s.indication || s.name))).slice(0, 5);
    const news = await aiService.webNews(topics.join(', ') || 'clinical trials');
    return { aiConfigured: aiService.isAiConfigured(), scouts: rows, news };
  },
};
