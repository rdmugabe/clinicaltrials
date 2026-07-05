import { Router, Request, Response } from 'express';
import { feedService, type FeedQuery } from '../services/feedService.js';
import { sourceCatalog } from '../services/sources/index.js';
import type { StudyCard } from '../types/studyfinder.js';
import type { StudyPhase, StudyStatus, SortOption } from '../types/clinicalTrials.js';

const router = Router();

// GET /api/feed/sources — the study sources the feed can pull from.
router.get('/sources', (_req: Request, res: Response) => {
  res.json({ sources: sourceCatalog() });
});

// GET /api/feed — the Discover Studies feed (For You / All / Bookmarks).
router.get('/', async (req: Request, res: Response) => {
  try {
    const q = req.query;
    const tabParam = (q.tab as string) || 'all';
    const tab: FeedQuery['tab'] =
      tabParam === 'foryou' || tabParam === 'bookmarks' ? tabParam : 'all';

    const overallStatus = (q.overallStatus as string) || '';
    const statuses = overallStatus
      ? (overallStatus.split(',').filter(Boolean) as StudyStatus[])
      : undefined;

    const phasesParam = (q.phases as string) || '';
    const phases = phasesParam
      ? (phasesParam.split(',').filter(Boolean) as StudyPhase[])
      : undefined;

    const query: FeedQuery = {
      tab,
      source: (q.source as string) || undefined,
      region: q.region === 'us' || q.region === 'world' ? q.region : undefined,
      scoutId: (q.scoutId as string) || undefined,
      status: q.status as FeedQuery['status'],
      statuses,
      sponsor: (q.sponsor as string) || undefined,
      phase: (q.phase as StudyPhase) || undefined,
      phases,
      country: (q.country as string) || undefined,
      condition: (q.condition as string) || undefined,
      enrollmentMin: q.enrollmentMin ? Number(q.enrollmentMin) : undefined,
      enrollmentMax: q.enrollmentMax ? Number(q.enrollmentMax) : undefined,
      showHidden: q.showHidden === 'true',
      sort: (q.sort as SortOption) || undefined,
      sortOrder: q.sortOrder === 'asc' ? 'asc' : q.sortOrder === 'desc' ? 'desc' : undefined,
      pageToken: (q.pageToken as string) || undefined,
      pageSize: q.pageSize ? Number(q.pageSize) : undefined,
    };

    const result = await feedService.getFeed(query);
    res.json(result);
  } catch (error) {
    console.error('Feed error:', error);
    res.status(500).json({
      error: 'Failed to load feed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/feed/by-ids — fetch a specific set of studies by NCT ID (scout drill-down).
router.post('/by-ids', async (req: Request, res: Response) => {
  const { nctIds } = req.body as { nctIds: string[] };
  if (!Array.isArray(nctIds)) {
    res.status(400).json({ error: 'nctIds[] is required' });
    return;
  }
  try {
    res.json({ studies: await feedService.studiesByIds(nctIds) });
  } catch (error) {
    console.error('Feed by-ids error:', error);
    res.status(500).json({ error: 'Failed to load studies' });
  }
});

// POST /api/feed/sync — pull the latest studies from the registry into the ledger.
router.post('/sync', async (_req: Request, res: Response) => {
  try {
    const result = await feedService.sync();
    res.json(result);
  } catch (error) {
    console.error('Feed sync error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// POST /api/feed/bookmark — bookmark a study (expects the full card).
router.post('/bookmark', (req: Request, res: Response) => {
  const card = req.body as StudyCard;
  if (!card?.nctId) {
    res.status(400).json({ error: 'nctId is required' });
    return;
  }
  feedService.bookmark(card);
  res.status(201).json({ ok: true });
});

router.delete('/bookmark/:nctId', (req: Request, res: Response) => {
  feedService.removeBookmark(req.params.nctId);
  res.status(204).send();
});

// POST /api/feed/hide — hide a study from the feed.
router.post('/hide/:nctId', (req: Request, res: Response) => {
  feedService.hide(req.params.nctId);
  res.status(201).json({ ok: true });
});

router.delete('/hide/:nctId', (req: Request, res: Response) => {
  feedService.unhide(req.params.nctId);
  res.status(204).send();
});

export default router;
