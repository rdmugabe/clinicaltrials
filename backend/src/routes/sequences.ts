import { Router, Request, Response } from 'express';
import { sequenceService } from '../services/sequenceService.js';

const router = Router();

// ---------- Metrics ----------
router.get('/metrics', (_req: Request, res: Response) => {
  res.json(sequenceService.metrics());
});

// ---------- Sequences ----------
router.get('/', (_req: Request, res: Response) => {
  res.json({ sequences: sequenceService.list() });
});

router.get('/:id', (req: Request, res: Response) => {
  const seq = sequenceService.get(req.params.id);
  if (!seq) {
    res.status(404).json({ error: 'Sequence not found' });
    return;
  }
  res.json(seq);
});

router.get('/:id/enrollments', (req: Request, res: Response) => {
  res.json({ enrollments: sequenceService.listEnrollments(req.params.id) });
});

router.post('/', (req: Request, res: Response) => {
  if (!req.body?.name?.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  res.status(201).json(sequenceService.create(req.body));
});

router.put('/:id', (req: Request, res: Response) => {
  const seq = sequenceService.update(req.params.id, req.body);
  if (!seq) {
    res.status(404).json({ error: 'Sequence not found' });
    return;
  }
  res.json(seq);
});

router.post('/:id/status', async (req: Request, res: Response) => {
  const { status } = req.body as { status: 'active' | 'paused' };
  if (status !== 'active' && status !== 'paused') {
    res.status(400).json({ error: 'status must be active or paused' });
    return;
  }
  const seq = await sequenceService.setStatus(req.params.id, status);
  if (!seq) {
    res.status(404).json({ error: 'Sequence not found' });
    return;
  }
  res.json(seq);
});

router.post('/:id/enroll', (req: Request, res: Response) => {
  const { contacts } = req.body as { contacts: { contactId?: string; name?: string; email: string }[] };
  if (!Array.isArray(contacts) || contacts.length === 0) {
    res.status(400).json({ error: 'contacts[] is required' });
    return;
  }
  try {
    res.status(201).json(sequenceService.enroll(req.params.id, contacts));
  } catch {
    res.status(404).json({ error: 'Sequence not found' });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  if (!sequenceService.delete(req.params.id)) {
    res.status(404).json({ error: 'Sequence not found' });
    return;
  }
  res.status(204).send();
});

// Manually advance the queue (also runs on a schedule).
router.post('/process/queue', async (_req: Request, res: Response) => {
  res.json(await sequenceService.processQueue());
});

// ---------- Signatures ----------
router.get('/signatures/all', (_req: Request, res: Response) => {
  res.json({ signatures: sequenceService.listSignatures() });
});

router.post('/signatures', (req: Request, res: Response) => {
  const { name, body } = req.body as { name: string; body: string };
  if (!name?.trim() || !body?.trim()) {
    res.status(400).json({ error: 'name and body are required' });
    return;
  }
  res.status(201).json(sequenceService.createSignature(name, body));
});

router.delete('/signatures/:id', (req: Request, res: Response) => {
  if (!sequenceService.deleteSignature(req.params.id)) {
    res.status(404).json({ error: 'Signature not found' });
    return;
  }
  res.status(204).send();
});

// ---------- Mailbox ----------
router.get('/mailbox/status', (_req: Request, res: Response) => {
  res.json(sequenceService.getMailbox());
});

router.post('/mailbox/connect', (req: Request, res: Response) => {
  const { fromEmail } = req.body as { fromEmail: string };
  if (!fromEmail?.trim()) {
    res.status(400).json({ error: 'fromEmail is required' });
    return;
  }
  res.json(sequenceService.connectMailbox(req.body));
});

router.post('/mailbox/disconnect', (_req: Request, res: Response) => {
  res.json(sequenceService.disconnectMailbox());
});

export default router;
