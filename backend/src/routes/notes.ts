import { Router, Request, Response } from 'express';
import { notesService, type NoteEntityType } from '../services/notesService.js';

const router = Router();

function parseType(v: unknown): NoteEntityType | null {
  return v === 'study' || v === 'contact' ? v : null;
}

// GET /api/notes?entityType=study&entityId=NCT... — notes for one entity.
router.get('/', (req: Request, res: Response) => {
  const entityType = parseType(req.query.entityType);
  const entityId = (req.query.entityId as string) || '';
  if (!entityType || !entityId) {
    res.status(400).json({ error: 'entityType (study|contact) and entityId are required' });
    return;
  }
  res.json({ notes: notesService.list(entityType, entityId) });
});

// GET /api/notes/counts?entityType=contact&ids=a,b,c — note counts for badges.
router.get('/counts', (req: Request, res: Response) => {
  const entityType = parseType(req.query.entityType);
  const ids = ((req.query.ids as string) || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!entityType) {
    res.status(400).json({ error: 'entityType (study|contact) is required' });
    return;
  }
  res.json({ counts: notesService.counts(entityType, ids) });
});

// POST /api/notes — add a note { entityType, entityId, body }.
router.post('/', (req: Request, res: Response) => {
  const { entityType, entityId, body } = req.body as {
    entityType?: string;
    entityId?: string;
    body?: string;
  };
  const type = parseType(entityType);
  if (!type || !entityId || !body || !body.trim()) {
    res.status(400).json({ error: 'entityType, entityId, and a non-empty body are required' });
    return;
  }
  // Attribute the note to the signed-in user (server-authoritative, not client input).
  const author = req.user?.name || req.user?.email || 'Team member';
  res.status(201).json({ note: notesService.add({ entityType: type, entityId, body, author }) });
});

// DELETE /api/notes/:id
router.delete('/:id', (req: Request, res: Response) => {
  const ok = notesService.remove(req.params.id);
  res.status(ok ? 204 : 404).send();
});

export default router;
