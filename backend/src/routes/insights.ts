import { Router, Request, Response } from 'express';
import { insightsService } from '../services/insightsService.js';

const router = Router();

// GET /api/insights — global roll-up across all scouts (studies + AI US news).
router.get('/', async (_req: Request, res: Response) => {
  try {
    res.json(await insightsService.global());
  } catch (error) {
    console.error('Insights (global) error:', error);
    res.status(500).json({ error: 'Failed to load insights' });
  }
});

// GET /api/insights/scout/:id — insights scoped to a single scout.
router.get('/scout/:id', async (req: Request, res: Response) => {
  try {
    const result = await insightsService.forScout(req.params.id);
    if (!result) {
      res.status(404).json({ error: 'Scout not found' });
      return;
    }
    res.json(result);
  } catch (error) {
    console.error('Insights (scout) error:', error);
    res.status(500).json({ error: 'Failed to load insights' });
  }
});

// GET /api/insights/query?q=... — insights for an ad-hoc condition/topic.
router.get('/query', async (req: Request, res: Response) => {
  const q = (req.query.q as string) || '';
  if (!q.trim()) {
    res.status(400).json({ error: 'q is required' });
    return;
  }
  try {
    res.json(await insightsService.forQuery(q));
  } catch (error) {
    console.error('Insights (query) error:', error);
    res.status(500).json({ error: 'Failed to load insights' });
  }
});

export default router;
