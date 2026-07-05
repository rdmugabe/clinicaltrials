import { Router, Request, Response } from 'express';
import { pipelineService } from '../services/pipelineService.js';

const router = Router();

// GET /api/pipeline?board=Opportunities
router.get('/', (req: Request, res: Response) => {
  const board = req.query.board as string | undefined;
  res.json({ opportunities: pipelineService.list(board) });
});

// POST /api/pipeline — push a study into TrialTrack.
router.post('/', (req: Request, res: Response) => {
  try {
    const { title } = req.body;
    if (!title) {
      res.status(400).json({ error: 'title is required' });
      return;
    }
    const opp = pipelineService.add(req.body);
    res.status(201).json(opp);
  } catch (error) {
    console.error('Pipeline add error:', error);
    res.status(500).json({ error: 'Failed to add opportunity' });
  }
});

// PATCH /api/pipeline/:id/stage — move a card between pipeline stages.
router.patch('/:id/stage', (req: Request, res: Response) => {
  const { stage } = req.body as { stage: string };
  if (!stage) {
    res.status(400).json({ error: 'stage is required' });
    return;
  }
  const opp = pipelineService.updateStage(req.params.id, stage);
  if (!opp) {
    res.status(404).json({ error: 'Opportunity not found' });
    return;
  }
  res.json(opp);
});

// DELETE /api/pipeline/:id
router.delete('/:id', (req: Request, res: Response) => {
  const ok = pipelineService.delete(req.params.id);
  if (!ok) {
    res.status(404).json({ error: 'Opportunity not found' });
    return;
  }
  res.status(204).send();
});

export default router;
