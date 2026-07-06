import { Router, Request, Response } from 'express';
import { companyDirectoryService } from '../services/companyDirectoryService.js';
import { sponsorIndexService } from '../services/sponsorIndexService.js';

const router = Router();

// GET /api/companies/all?query=&page=&pageSize= — full cached sponsor index.
router.get('/all', (req: Request, res: Response) => {
  const result = sponsorIndexService.list({
    query: (req.query.query as string) || undefined,
    page: req.query.page ? Number(req.query.page) : undefined,
    pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
  });
  res.json({ ...result, sync: sponsorIndexService.status() });
});

// POST /api/companies/sync — (re)build the full sponsor index in the background.
router.post('/sync', (_req: Request, res: Response) => {
  res.json(sponsorIndexService.startSync());
});

// GET /api/companies/sync/status — sweep progress.
router.get('/sync/status', (_req: Request, res: Response) => {
  res.json(sponsorIndexService.status());
});

// GET /api/companies?query=&indication=&scoutId=
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await companyDirectoryService.search({
      query: (req.query.query as string) || undefined,
      indication: (req.query.indication as string) || undefined,
      scoutId: (req.query.scoutId as string) || undefined,
    });
    res.json(result);
  } catch (error) {
    console.error('Company directory error:', error);
    res.status(500).json({ error: 'Failed to load companies' });
  }
});

// GET /api/companies/detail?name=... — query param avoids issues with slashes
// in company names (e.g. "Novo Nordisk A/S").
router.get('/detail', async (req: Request, res: Response) => {
  const name = req.query.name as string | undefined;
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  try {
    const company = await companyDirectoryService.getCompany(name, (req.query.pageToken as string) || undefined);
    res.json(company);
  } catch (error) {
    console.error('Company detail error:', error);
    res.status(500).json({ error: 'Failed to load company' });
  }
});

export default router;
