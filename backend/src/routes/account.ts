import { Router, Request, Response } from 'express';
import { accountService, type Tier } from '../services/accountService.js';

const router = Router();

// The "What's New" changelog surfaced in the top bar.
const CHANGELOG = [
  {
    version: '2.0.0',
    date: '2026-07-02',
    title: 'StudyFinder launch',
    items: [
      'New Discover Studies feed with For You, All Studies, and Bookmarks tabs',
      'Scouts: saved indication-based search agents with weekly reports',
      'Rich study detail panel with 9 tabs (Overview, Eligibility, Design, and more)',
      'Contact discovery & enrichment with LinkedIn lookup and Add to Sequence',
      'Push any study straight into your TrialTrack pipeline',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-05-10',
    title: 'Outreach & Alerts',
    items: ['Email sequences and templates', 'Research alerts via email and SMS'],
  },
];

// GET /api/account
router.get('/', (_req: Request, res: Response) => {
  res.json(accountService.get());
});

// POST /api/account/tier — switch subscription tier (demo of feature gating).
router.post('/tier', (req: Request, res: Response) => {
  const { tier } = req.body as { tier: Tier };
  if (!['starter', 'growth', 'enterprise'].includes(tier)) {
    res.status(400).json({ error: 'Invalid tier' });
    return;
  }
  res.json(accountService.setTier(tier));
});

// GET /api/account/changelog
router.get('/changelog', (_req: Request, res: Response) => {
  res.json({ changelog: CHANGELOG });
});

export default router;
