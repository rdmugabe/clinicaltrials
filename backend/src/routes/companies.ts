import { Router, Request, Response } from 'express';
import { companyDirectoryService } from '../services/companyDirectoryService.js';

const router = Router();

// GET /api/companies?query=&indication=
router.get('/', async (req: Request, res: Response) => {
  try {
    const companies = await companyDirectoryService.search({
      query: (req.query.query as string) || undefined,
      indication: (req.query.indication as string) || undefined,
    });
    res.json({ companies });
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
    const company = await companyDirectoryService.getCompany(name);
    res.json(company);
  } catch (error) {
    console.error('Company detail error:', error);
    res.status(500).json({ error: 'Failed to load company' });
  }
});

export default router;
