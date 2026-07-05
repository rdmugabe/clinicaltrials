import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import trialsRouter from './routes/trials.js';
import savedSearchesRouter from './routes/savedSearches.js';
import outreachRouter from './routes/outreach.js';
import alertsRouter from './routes/alerts.js';
import feedRouter from './routes/feed.js';
import scoutsRouter from './routes/scouts.js';
import discoveryRouter from './routes/discovery.js';
import pipelineRouter from './routes/pipeline.js';
import trialtrackRouter from './routes/trialtrack.js';
import companiesRouter from './routes/companies.js';
import sequencesRouter from './routes/sequences.js';
import aiRouter from './routes/ai.js';
import insightsRouter from './routes/insights.js';
import notesRouter from './routes/notes.js';
import accountRouter from './routes/account.js';

// Initialize the SQLite persistence layer (creates tables + seeds account).
import './db/database.js';
// Import to start the alert monitor scheduler
import './services/alertMonitorService.js';
// Import to start the email sequence queue scheduler
import './services/sequenceScheduler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3002',
  credentials: true,
}));

app.use(express.json());

// Rate limiting to respect ClinicalTrials.gov API limits (~50 req/min)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  // Most endpoints now hit local SQLite; only some proxy to ClinicalTrials.gov.
  // Keep a generous ceiling for the richer UI while still bounding abuse.
  max: 200,
  message: {
    error: 'Too many requests',
    message: 'Please wait before making more requests',
  },
});

app.use('/api', apiLimiter);

// Routes
app.use('/api/trials', trialsRouter);
app.use('/api/saved-searches', savedSearchesRouter);
app.use('/api/outreach', outreachRouter);
app.use('/api/alerts', alertsRouter);
// StudyFinder
app.use('/api/feed', feedRouter);
app.use('/api/scouts', scoutsRouter);
app.use('/api/discovery', discoveryRouter);
app.use('/api/pipeline', pipelineRouter);
app.use('/api/trialtrack', trialtrackRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/sequences', sequencesRouter);
app.use('/api/ai', aiRouter);
app.use('/api/insights', insightsRouter);
app.use('/api/notes', notesRouter);
app.use('/api/account', accountRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'clinical-trials-research-api',
  });
});

// Error handling
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🏥 Clinical Trials Research API running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
  console.log(`   Search trials: http://localhost:${PORT}/api/trials/search`);
});

export default app;
