import { Router, Request, Response } from 'express';
import { discoveryService } from '../services/discoveryService.js';
import { enrichmentService } from '../services/enrichmentService.js';
import { accountService } from '../services/accountService.js';
import { emailService } from '../services/emailService.js';
import { contactVars } from '../services/personalize.js';

const router = Router();

// A helper list of decision-maker titles for the "Relevant Job Title" filter helper.
const RELEVANT_JOB_TITLES = [
  'Business Development',
  'Clinical Operations',
  'Study Start-Up',
  'Feasibility',
  'Site Engagement',
  'Clinical Trial Manager',
  'Clinical Research Associate',
  'Principal Investigator',
  'Medical Director',
  'VP Clinical Development',
  'Head of Clinical Operations',
  'Outsourcing / Procurement',
];

// GET /api/discovery/relevant-titles
router.get('/relevant-titles', (_req: Request, res: Response) => {
  res.json({ titles: RELEVANT_JOB_TITLES });
});

// GET /api/discovery/status — whether real enrichment is configured.
router.get('/status', (_req: Request, res: Response) => {
  res.json({ enrichmentConfigured: enrichmentService.isEnrichmentConfigured() });
});

// GET /api/discovery/contacts?nctId=...
router.get('/contacts', (req: Request, res: Response) => {
  const nctId = req.query.nctId as string | undefined;
  res.json({ contacts: discoveryService.listContacts(nctId) });
});

// POST /api/discovery/discover/:nctId — extract people from the study record.
router.post('/discover/:nctId', async (req: Request, res: Response) => {
  try {
    const contacts = await discoveryService.discoverForStudy(req.params.nctId);
    res.json({ contacts });
  } catch (error) {
    console.error('Discovery error:', error);
    res.status(500).json({
      error: 'Failed to discover contacts',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/discovery/contacts/:id/enrich — resolve email + LinkedIn.
router.post('/contacts/:id/enrich', async (req: Request, res: Response) => {
  try {
    // Enrichment is a metered action — 1 credit per contact.
    if (!accountService.spend(1)) {
      res.status(402).json({ error: 'Out of credits', message: 'Upgrade your plan to enrich more contacts.' });
      return;
    }
    const contact = await discoveryService.enrichContact(req.params.id);
    res.json(contact);
  } catch (error) {
    console.error('Enrich error:', error);
    res.status(error instanceof Error && error.message === 'Contact not found' ? 404 : 500).json({
      error: 'Failed to enrich contact',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/discovery/contacts/:id/email — send a one-off email to a contact.
router.post('/contacts/:id/email', async (req: Request, res: Response) => {
  const { subject, body } = req.body as { subject?: string; body?: string };
  if (!subject?.trim() || !body?.trim()) {
    res.status(400).json({ error: 'subject and body are required' });
    return;
  }
  const contact = discoveryService.get(req.params.id);
  if (!contact) {
    res.status(404).json({ error: 'Contact not found' });
    return;
  }
  if (!contact.email) {
    res.status(400).json({ error: 'Contact has no email — enrich them first' });
    return;
  }
  // Personalize any merge tokens ({{greeting}}, {{name}}, {{senderName}}, …).
  const vars = contactVars(contact.name, contact.email);
  const finalSubject = emailService.replaceVariables(subject, vars);
  const finalBody = emailService.replaceVariables(body, vars);
  const result = await emailService.sendEmail(contact.email, finalSubject, finalBody);
  if (result.success) discoveryService.setStatus([contact.id], 'Contacted');
  res.status(result.success ? 200 : 502).json(result);
});

// POST /api/discovery/contacts/status — bulk status update (e.g. "In Sequence").
router.post('/contacts/status', (req: Request, res: Response) => {
  const { ids, status } = req.body as { ids: string[]; status: string };
  if (!Array.isArray(ids) || !status) {
    res.status(400).json({ error: 'ids[] and status are required' });
    return;
  }
  discoveryService.setStatus(ids, status);
  res.json({ ok: true, updated: ids.length });
});

export default router;
