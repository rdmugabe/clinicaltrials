import { Router, Request, Response } from 'express';
import { scoutService } from '../services/scoutService.js';
import { feedService } from '../services/feedService.js';
import type { SortOption } from '../types/clinicalTrials.js';

const router = Router();

// GET /api/scouts
router.get('/', (_req: Request, res: Response) => {
  res.json({ scouts: scoutService.list() });
});

// GET /api/scouts/:id/studies — live, paginated browse of ALL studies matching
// the scout's criteria (not just the tracked set). Caches the true match total.
router.get('/:id/studies', async (req: Request, res: Response) => {
  const scout = scoutService.get(req.params.id);
  if (!scout) {
    res.status(404).json({ error: 'Scout not found' });
    return;
  }
  try {
    const pageToken = (req.query.pageToken as string) || undefined;
    const sort = (req.query.sort as SortOption) || undefined;
    const sortOrder: 'asc' | 'desc' = req.query.sortOrder === 'asc' ? 'asc' : 'desc';
    const result = await feedService.searchCards({
      ...scout.params,
      ...(sort ? { sort, sortOrder } : {}),
      pageToken,
    });
    if (!pageToken) scoutService.setMatchTotal(scout.id, result.totalCount);
    res.json(result);
  } catch (error) {
    console.error('Scout studies error:', error);
    res.status(500).json({ error: 'Failed to load studies' });
  }
});

// GET /api/scouts/reports — all weekly reports (optionally by scout).
router.get('/reports', (req: Request, res: Response) => {
  const scoutId = req.query.scoutId as string | undefined;
  res.json({ reports: scoutService.listReports(scoutId) });
});

// GET /api/scouts/:id
router.get('/:id', (req: Request, res: Response) => {
  const scout = scoutService.get(req.params.id);
  if (!scout) {
    res.status(404).json({ error: 'Scout not found' });
    return;
  }
  res.json(scout);
});

// POST /api/scouts
router.post('/', (req: Request, res: Response) => {
  try {
    const { name, params, criteria, indication, color, weeklyReport } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }
    const scout = scoutService.create({ name, params: params || {}, criteria, indication, color, weeklyReport });
    res.status(201).json(scout);
  } catch (error) {
    console.error('Create scout error:', error);
    res.status(500).json({ error: 'Failed to create scout' });
  }
});

// PUT /api/scouts/:id
router.put('/:id', (req: Request, res: Response) => {
  const scout = scoutService.update(req.params.id, req.body);
  if (!scout) {
    res.status(404).json({ error: 'Scout not found' });
    return;
  }
  res.json(scout);
});

// DELETE /api/scouts/:id
router.delete('/:id', (req: Request, res: Response) => {
  const ok = scoutService.delete(req.params.id);
  if (!ok) {
    res.status(404).json({ error: 'Scout not found' });
    return;
  }
  res.status(204).send();
});

// POST /api/scouts/:id/report — generate a fresh weekly report now.
router.post('/:id/report', async (req: Request, res: Response) => {
  try {
    const report = await scoutService.generateWeeklyReport(req.params.id);
    if (!report) {
      res.status(404).json({ error: 'Scout not found' });
      return;
    }
    res.status(201).json(report);
  } catch (error) {
    console.error('Generate report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

export default router;
