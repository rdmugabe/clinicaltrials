import { Router, Request, Response } from 'express';
import { alertMonitorService } from '../services/alertMonitorService.js';
import { notificationService } from '../services/notificationService.js';
import type { ResearchAlert, AlertFrequency, NotificationChannel } from '../types/alerts.js';
import type { SearchParams } from '../types/clinicalTrials.js';

const router = Router();

// Get all alerts
router.get('/', (_req: Request, res: Response) => {
  const alerts = alertMonitorService.getAlerts();
  res.json({ alerts });
});

// Get alert stats
router.get('/stats', (_req: Request, res: Response) => {
  const stats = alertMonitorService.getStats();
  const serviceStatus = notificationService.getServiceStatus();
  res.json({ stats, serviceStatus });
});

// Get notification history
router.get('/notifications', (req: Request, res: Response) => {
  const { alertId } = req.query;
  const notifications = alertMonitorService.getNotifications(alertId as string);
  res.json({ notifications });
});

// Get a specific alert
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const alert = alertMonitorService.getAlert(id);

  if (!alert) {
    res.status(404).json({ error: 'Alert not found' });
    return;
  }

  res.json(alert);
});

// Create a new alert
router.post('/', (req: Request, res: Response) => {
  try {
    const {
      name,
      searchParams,
      notificationChannels,
      email,
      phone,
      frequency,
    } = req.body as {
      name: string;
      searchParams: SearchParams;
      notificationChannels: NotificationChannel;
      email?: string;
      phone?: string;
      frequency: AlertFrequency;
    };

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Alert name is required' });
      return;
    }

    if (!searchParams || typeof searchParams !== 'object') {
      res.status(400).json({ error: 'Search parameters are required' });
      return;
    }

    if (!notificationChannels) {
      res.status(400).json({ error: 'Notification channel is required' });
      return;
    }

    if ((notificationChannels === 'email' || notificationChannels === 'both') && !email) {
      res.status(400).json({ error: 'Email is required for email notifications' });
      return;
    }

    if ((notificationChannels === 'sms' || notificationChannels === 'both') && !phone) {
      res.status(400).json({ error: 'Phone number is required for SMS notifications' });
      return;
    }

    const alert = alertMonitorService.createAlert({
      name: name.trim(),
      searchParams,
      notificationChannels,
      email,
      phone,
      frequency: frequency || 'hourly',
      isActive: true,
    });

    res.status(201).json(alert);
  } catch (error) {
    console.error('Create alert error:', error);
    res.status(500).json({
      error: 'Failed to create alert',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Update an alert
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      searchParams,
      notificationChannels,
      email,
      phone,
      frequency,
      isActive,
    } = req.body;

    const updates: Partial<ResearchAlert> = {};

    if (name !== undefined) updates.name = name.trim();
    if (searchParams !== undefined) updates.searchParams = searchParams;
    if (notificationChannels !== undefined) updates.notificationChannels = notificationChannels;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (frequency !== undefined) updates.frequency = frequency;
    if (isActive !== undefined) updates.isActive = isActive;

    const alert = alertMonitorService.updateAlert(id, updates);

    if (!alert) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    res.json(alert);
  } catch (error) {
    console.error('Update alert error:', error);
    res.status(500).json({
      error: 'Failed to update alert',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Toggle alert active status
router.post('/:id/toggle', (req: Request, res: Response) => {
  const { id } = req.params;
  const alert = alertMonitorService.toggleAlert(id);

  if (!alert) {
    res.status(404).json({ error: 'Alert not found' });
    return;
  }

  res.json(alert);
});

// Manually trigger a check
router.post('/:id/check', async (req: Request, res: Response) => {
  const { id } = req.params;

  const result = await alertMonitorService.triggerCheck(id);

  if (!result) {
    res.status(404).json({ error: 'Alert not found' });
    return;
  }

  res.json({
    newTrialsCount: result.newTrials.length,
    newTrials: result.newTrials,
    notificationSent: result.notificationSent,
  });
});

// Delete an alert
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const deleted = alertMonitorService.deleteAlert(id);

  if (!deleted) {
    res.status(404).json({ error: 'Alert not found' });
    return;
  }

  res.status(204).send();
});

// Test notification
router.post('/test-notification', async (req: Request, res: Response) => {
  const { channels, email, phone } = req.body as {
    channels: NotificationChannel;
    email?: string;
    phone?: string;
  };

  const testTrial = {
    nctId: 'NCT00000000',
    title: 'Test Clinical Trial - This is a test notification',
    status: 'RECRUITING',
    conditions: ['Test Condition'],
    sponsor: 'Test Organization',
    url: 'https://clinicaltrials.gov/study/NCT00000000',
  };

  const result = await notificationService.sendAlertNotification({
    alertName: 'Test Alert',
    channels,
    email,
    phone,
    trials: [testTrial],
  });

  res.json({
    success: result.emailSent || result.smsSent,
    emailSent: result.emailSent,
    smsSent: result.smsSent,
    errors: result.errors,
  });
});

export default router;
