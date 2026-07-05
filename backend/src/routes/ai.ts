import { Router, Request, Response } from 'express';
import { aiService } from '../services/aiService.js';
import { accountService } from '../services/accountService.js';

const router = Router();

const SEQUENCE_COST = 5;
const EMAIL_COST = 2;

// GET /api/ai/status — whether the Claude API is configured + which model.
router.get('/status', (_req: Request, res: Response) => {
  res.json({ configured: aiService.isAiConfigured(), model: 'claude-opus-4-8' });
});

function guardConfigured(res: Response): boolean {
  if (!aiService.isAiConfigured()) {
    res.status(503).json({
      error: 'AI not configured',
      message: 'Set ANTHROPIC_API_KEY in the backend environment to enable AI generation.',
    });
    return false;
  }
  return true;
}

// POST /api/ai/sequence — generate a multi-step outreach sequence.
router.post('/sequence', async (req: Request, res: Response) => {
  if (!guardConfigured(res)) return;
  if (!accountService.spend(SEQUENCE_COST)) {
    res.status(402).json({ error: 'Out of credits', message: 'Upgrade your plan to generate more with AI.' });
    return;
  }
  try {
    const result = await aiService.generateSequence(req.body || {});
    res.json(result);
  } catch (error) {
    console.error('AI sequence generation failed:', error);
    res.status(502).json({
      error: 'AI generation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/ai/email — draft a single personalized outreach email.
router.post('/email', async (req: Request, res: Response) => {
  if (!guardConfigured(res)) return;
  if (!accountService.spend(EMAIL_COST)) {
    res.status(402).json({ error: 'Out of credits', message: 'Upgrade your plan to generate more with AI.' });
    return;
  }
  try {
    const result = await aiService.generateEmail(req.body || {});
    res.json(result);
  } catch (error) {
    console.error('AI email generation failed:', error);
    res.status(502).json({
      error: 'AI generation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
