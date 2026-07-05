import { Router, Request, Response } from 'express';
import { boardService } from '../services/boardService.js';
import { taskService, type TaskStatus } from '../services/taskService.js';
import { companyService } from '../services/companyService.js';
import { reportService } from '../services/reportService.js';

const router = Router();

// ---------- Boards ----------
router.get('/boards', (_req: Request, res: Response) => {
  res.json({ boards: boardService.list() });
});

router.post('/boards', (req: Request, res: Response) => {
  const { name, stages } = req.body as { name: string; stages?: string[] };
  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  res.status(201).json(boardService.create(name, stages));
});

router.put('/boards/:id', (req: Request, res: Response) => {
  const board = boardService.update(req.params.id, req.body);
  if (!board) {
    res.status(404).json({ error: 'Board not found' });
    return;
  }
  res.json(board);
});

router.delete('/boards/:id', (req: Request, res: Response) => {
  if (!boardService.delete(req.params.id)) {
    res.status(404).json({ error: 'Board not found' });
    return;
  }
  res.status(204).send();
});

// ---------- Tasks ----------
router.get('/tasks', (req: Request, res: Response) => {
  res.json({
    tasks: taskService.list({
      opportunityId: req.query.opportunityId as string | undefined,
      category: req.query.category as string | undefined,
      assignee: req.query.assignee as string | undefined,
    }),
  });
});

router.post('/tasks', (req: Request, res: Response) => {
  if (!req.body?.title?.trim()) {
    res.status(400).json({ error: 'title is required' });
    return;
  }
  res.status(201).json(taskService.create(req.body));
});

router.patch('/tasks/:id', (req: Request, res: Response) => {
  const task = taskService.update(req.params.id, req.body as { status?: TaskStatus });
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  res.json(task);
});

router.delete('/tasks/:id', (req: Request, res: Response) => {
  if (!taskService.delete(req.params.id)) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  res.status(204).send();
});

// ---------- CRM Companies ----------
router.get('/companies', (_req: Request, res: Response) => {
  res.json({ companies: companyService.list() });
});

router.post('/companies', (req: Request, res: Response) => {
  if (!req.body?.name?.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  res.status(201).json(companyService.create(req.body));
});

router.post('/companies/import', (_req: Request, res: Response) => {
  const added = companyService.importFromPipeline();
  res.json({ added });
});

router.delete('/companies/:id', (req: Request, res: Response) => {
  if (!companyService.delete(req.params.id)) {
    res.status(404).json({ error: 'Company not found' });
    return;
  }
  res.status(204).send();
});

// ---------- Reports ----------
router.get('/reports/summary', (req: Request, res: Response) => {
  res.json(
    reportService.summary({
      board: req.query.board as string | undefined,
      stage: req.query.stage as string | undefined,
      assignee: req.query.assignee as string | undefined,
      source: req.query.source as string | undefined,
      pi: req.query.pi as string | undefined,
      indication: req.query.indication as string | undefined,
    })
  );
});

router.get('/reports/filters', (_req: Request, res: Response) => {
  res.json(reportService.filterOptions());
});

export default router;
