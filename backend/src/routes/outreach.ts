import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { emailService } from '../services/emailService.js';
import type {
  TrialContact,
  OutreachRecord,
  EmailTemplate,
  ContactList,
  BulkEmailRequest,
  OutreachStatus,
  OrganizationSettings,
} from '../types/outreach.js';

const router = Router();

// In-memory storage (replace with database in production)
const contacts: Map<string, TrialContact> = new Map();
const outreachRecords: Map<string, OutreachRecord> = new Map();
const emailTemplates: Map<string, EmailTemplate> = new Map();
const contactLists: Map<string, ContactList> = new Map();
let organizationSettings: OrganizationSettings = {
  name: 'My Organization',
  email: 'contact@example.com',
};

// Initialize default templates
emailService.generateDefaultTemplates().forEach((template) => {
  emailTemplates.set(template.id, template);
});

// ============ CONTACTS ============

// Get all contacts
router.get('/contacts', (_req: Request, res: Response) => {
  const allContacts = Array.from(contacts.values()).sort(
    (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
  );
  res.json({ contacts: allContacts, total: allContacts.length });
});

// Add a contact
router.post('/contacts', (req: Request, res: Response) => {
  const contactData = req.body as Omit<TrialContact, 'id' | 'addedAt'>;

  if (!contactData.nctId || !contactData.trialTitle) {
    res.status(400).json({ error: 'nctId and trialTitle are required' });
    return;
  }

  // Check for duplicate
  const existing = Array.from(contacts.values()).find(
    (c) => c.nctId === contactData.nctId && c.contactEmail === contactData.contactEmail
  );
  if (existing) {
    res.status(409).json({ error: 'Contact already exists', contact: existing });
    return;
  }

  const contact: TrialContact = {
    ...contactData,
    id: uuidv4(),
    addedAt: new Date().toISOString(),
  };

  contacts.set(contact.id, contact);
  res.status(201).json(contact);
});

// Add multiple contacts (bulk)
router.post('/contacts/bulk', (req: Request, res: Response) => {
  const { contactsData } = req.body as { contactsData: Omit<TrialContact, 'id' | 'addedAt'>[] };

  if (!Array.isArray(contactsData)) {
    res.status(400).json({ error: 'contactsData must be an array' });
    return;
  }

  const added: TrialContact[] = [];
  const skipped: Array<{ data: any; reason: string }> = [];

  for (const data of contactsData) {
    if (!data.nctId || !data.trialTitle) {
      skipped.push({ data, reason: 'Missing nctId or trialTitle' });
      continue;
    }

    const existing = Array.from(contacts.values()).find(
      (c) => c.nctId === data.nctId && c.contactEmail === data.contactEmail
    );
    if (existing) {
      skipped.push({ data, reason: 'Already exists' });
      continue;
    }

    const contact: TrialContact = {
      ...data,
      id: uuidv4(),
      addedAt: new Date().toISOString(),
    };
    contacts.set(contact.id, contact);
    added.push(contact);
  }

  res.status(201).json({ added, skipped, addedCount: added.length, skippedCount: skipped.length });
});

// Delete a contact
router.delete('/contacts/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  if (!contacts.has(id)) {
    res.status(404).json({ error: 'Contact not found' });
    return;
  }

  contacts.delete(id);
  res.status(204).send();
});

// ============ TEMPLATES ============

// Get all templates
router.get('/templates', (_req: Request, res: Response) => {
  const allTemplates = Array.from(emailTemplates.values());
  res.json({ templates: allTemplates });
});

// Create a template
router.post('/templates', (req: Request, res: Response) => {
  const { name, subject, body } = req.body;

  if (!name || !subject || !body) {
    res.status(400).json({ error: 'name, subject, and body are required' });
    return;
  }

  const now = new Date().toISOString();
  const template: EmailTemplate = {
    id: `template_${uuidv4()}`,
    name,
    subject,
    body,
    variables: emailService.parseTemplateVariables(subject + body),
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };

  emailTemplates.set(template.id, template);
  res.status(201).json(template);
});

// Update a template
router.put('/templates/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, subject, body } = req.body;

  const existing = emailTemplates.get(id);
  if (!existing) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  const updated: EmailTemplate = {
    ...existing,
    name: name || existing.name,
    subject: subject || existing.subject,
    body: body || existing.body,
    variables: emailService.parseTemplateVariables((subject || existing.subject) + (body || existing.body)),
    updatedAt: new Date().toISOString(),
  };

  emailTemplates.set(id, updated);
  res.json(updated);
});

// Delete a template
router.delete('/templates/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const template = emailTemplates.get(id);

  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  if (template.isDefault) {
    res.status(400).json({ error: 'Cannot delete default templates' });
    return;
  }

  emailTemplates.delete(id);
  res.status(204).send();
});

// ============ OUTREACH ============

// Get outreach history
router.get('/history', (req: Request, res: Response) => {
  const { contactId, status } = req.query;

  let records = Array.from(outreachRecords.values());

  if (contactId) {
    records = records.filter((r) => r.contactId === contactId);
  }
  if (status) {
    records = records.filter((r) => r.status === status);
  }

  records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({ records, total: records.length });
});

// Get outreach stats
router.get('/stats', (_req: Request, res: Response) => {
  const records = Array.from(outreachRecords.values());

  const stats = {
    total: records.length,
    pending: records.filter((r) => r.status === 'pending').length,
    sent: records.filter((r) => r.status === 'sent').length,
    delivered: records.filter((r) => r.status === 'delivered').length,
    opened: records.filter((r) => r.status === 'opened').length,
    replied: records.filter((r) => r.status === 'replied').length,
    failed: records.filter((r) => r.status === 'failed').length,
    bounced: records.filter((r) => r.status === 'bounced').length,
  };

  res.json(stats);
});

// Send single email
router.post('/send', async (req: Request, res: Response) => {
  const { contactId, templateId, subject, body, variables } = req.body;

  const contact = contacts.get(contactId);
  if (!contact) {
    res.status(404).json({ error: 'Contact not found' });
    return;
  }

  if (!contact.contactEmail) {
    res.status(400).json({ error: 'Contact has no email address' });
    return;
  }

  let finalSubject = subject;
  let finalBody = body;

  // Apply template if specified
  if (templateId) {
    const template = emailTemplates.get(templateId);
    if (template) {
      finalSubject = template.subject;
      finalBody = template.body;
    }
  }

  // Replace variables
  const allVariables: Record<string, string> = {
    contactName: contact.contactName || 'Team',
    trialTitle: contact.trialTitle,
    nctId: contact.nctId,
    sponsorName: contact.sponsorName || '',
    organizationName: organizationSettings.name,
    senderName: organizationSettings.name,
    senderEmail: organizationSettings.email,
    senderPhone: organizationSettings.phone || '',
    organizationWebsite: organizationSettings.website || '',
    organizationDescription: organizationSettings.description || '',
    ...variables,
  };

  finalSubject = emailService.replaceVariables(finalSubject, allVariables);
  finalBody = emailService.replaceVariables(finalBody, allVariables);

  const now = new Date().toISOString();
  const outreach: OutreachRecord = {
    id: uuidv4(),
    contactId,
    templateId,
    subject: finalSubject,
    body: finalBody,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  // Send the email
  const result = await emailService.sendEmail(contact.contactEmail, finalSubject, finalBody);

  if (result.success) {
    outreach.status = 'sent';
    outreach.sentAt = new Date().toISOString();
  } else {
    outreach.status = 'failed';
    outreach.errorMessage = result.error;
  }

  outreach.updatedAt = new Date().toISOString();
  outreachRecords.set(outreach.id, outreach);

  res.json(outreach);
});

// Send bulk emails
router.post('/send-bulk', async (req: Request, res: Response) => {
  const { contactIds, templateId, subject, body, variables } = req.body as BulkEmailRequest & { variables?: Record<string, string> };

  if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
    res.status(400).json({ error: 'contactIds array is required' });
    return;
  }

  const template = templateId ? emailTemplates.get(templateId) : null;
  const baseSubject = subject || template?.subject || '';
  const baseBody = body || template?.body || '';

  if (!baseSubject || !baseBody) {
    res.status(400).json({ error: 'Subject and body are required (or provide a valid templateId)' });
    return;
  }

  const emailsToSend: Array<{ to: string; subject: string; body: string; contactId: string }> = [];
  const skipped: Array<{ contactId: string; reason: string }> = [];

  for (const contactId of contactIds) {
    const contact = contacts.get(contactId);
    if (!contact) {
      skipped.push({ contactId, reason: 'Contact not found' });
      continue;
    }
    if (!contact.contactEmail) {
      skipped.push({ contactId, reason: 'No email address' });
      continue;
    }

    const allVariables: Record<string, string> = {
      contactName: contact.contactName || 'Team',
      trialTitle: contact.trialTitle,
      nctId: contact.nctId,
      sponsorName: contact.sponsorName || '',
      organizationName: organizationSettings.name,
      senderName: organizationSettings.name,
      senderEmail: organizationSettings.email,
      senderPhone: organizationSettings.phone || '',
      organizationWebsite: organizationSettings.website || '',
      organizationDescription: organizationSettings.description || '',
      ...variables,
    };

    emailsToSend.push({
      to: contact.contactEmail,
      subject: emailService.replaceVariables(baseSubject, allVariables),
      body: emailService.replaceVariables(baseBody, allVariables),
      contactId,
    });
  }

  if (emailsToSend.length === 0) {
    res.status(400).json({ error: 'No valid contacts to send to', skipped });
    return;
  }

  // Create pending outreach records
  const outreachMap = new Map<string, OutreachRecord>();
  const now = new Date().toISOString();

  for (const email of emailsToSend) {
    const outreach: OutreachRecord = {
      id: uuidv4(),
      contactId: email.contactId,
      templateId,
      subject: email.subject,
      body: email.body,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    outreachRecords.set(outreach.id, outreach);
    outreachMap.set(email.contactId, outreach);
  }

  // Send emails
  const results = await emailService.sendBulkEmails(emailsToSend);

  // Update outreach records with results
  for (const success of results.successful) {
    const outreach = outreachMap.get(success.contactId);
    if (outreach) {
      outreach.status = 'sent';
      outreach.sentAt = new Date().toISOString();
      outreach.updatedAt = new Date().toISOString();
    }
  }

  for (const failure of results.failed) {
    const outreach = outreachMap.get(failure.contactId);
    if (outreach) {
      outreach.status = 'failed';
      outreach.errorMessage = failure.error;
      outreach.updatedAt = new Date().toISOString();
    }
  }

  res.json({
    sent: results.successful.length,
    failed: results.failed.length,
    skipped: skipped.length,
    details: {
      successful: results.successful,
      failed: results.failed,
      skipped,
    },
  });
});

// Preview email (without sending)
router.post('/preview', (req: Request, res: Response) => {
  const { contactId, templateId, subject, body, variables } = req.body;

  const contact = contactId ? contacts.get(contactId) : null;

  const template = templateId ? emailTemplates.get(templateId) : null;
  let finalSubject = subject || template?.subject || '';
  let finalBody = body || template?.body || '';

  const allVariables: Record<string, string> = {
    contactName: contact?.contactName || '[Contact Name]',
    trialTitle: contact?.trialTitle || '[Trial Title]',
    nctId: contact?.nctId || '[NCT ID]',
    sponsorName: contact?.sponsorName || '[Sponsor Name]',
    organizationName: organizationSettings.name,
    senderName: organizationSettings.name,
    senderEmail: organizationSettings.email,
    senderPhone: organizationSettings.phone || '[Phone]',
    organizationWebsite: organizationSettings.website || '[Website]',
    organizationDescription: organizationSettings.description || '[Description]',
    customMessage: '',
    ...variables,
  };

  finalSubject = emailService.replaceVariables(finalSubject, allVariables);
  finalBody = emailService.replaceVariables(finalBody, allVariables);

  res.json({
    subject: finalSubject,
    body: finalBody,
    to: contact?.contactEmail || '[No email]',
  });
});

// ============ CONTACT LISTS ============

// Get all contact lists
router.get('/lists', (_req: Request, res: Response) => {
  const lists = Array.from(contactLists.values());
  res.json({ lists });
});

// Create a contact list
router.post('/lists', (req: Request, res: Response) => {
  const { name, description, contactIds } = req.body;

  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const now = new Date().toISOString();
  const list: ContactList = {
    id: uuidv4(),
    name,
    description,
    contactIds: contactIds || [],
    createdAt: now,
    updatedAt: now,
  };

  contactLists.set(list.id, list);
  res.status(201).json(list);
});

// Update a contact list
router.put('/lists/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, contactIds } = req.body;

  const existing = contactLists.get(id);
  if (!existing) {
    res.status(404).json({ error: 'List not found' });
    return;
  }

  const updated: ContactList = {
    ...existing,
    name: name || existing.name,
    description: description !== undefined ? description : existing.description,
    contactIds: contactIds || existing.contactIds,
    updatedAt: new Date().toISOString(),
  };

  contactLists.set(id, updated);
  res.json(updated);
});

// Delete a contact list
router.delete('/lists/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  if (!contactLists.has(id)) {
    res.status(404).json({ error: 'List not found' });
    return;
  }

  contactLists.delete(id);
  res.status(204).send();
});

// ============ ORGANIZATION SETTINGS ============

router.get('/settings', (_req: Request, res: Response) => {
  res.json(organizationSettings);
});

router.put('/settings', (req: Request, res: Response) => {
  const { name, email, phone, website, description } = req.body;

  if (!name || !email) {
    res.status(400).json({ error: 'name and email are required' });
    return;
  }

  organizationSettings = {
    name,
    email,
    phone,
    website,
    description,
  };

  res.json(organizationSettings);
});

// Check email service status
router.get('/email-status', (_req: Request, res: Response) => {
  res.json({
    configured: emailService.isConfigured(),
    fromEmail: process.env.FROM_EMAIL || 'Not configured',
  });
});

export default router;
