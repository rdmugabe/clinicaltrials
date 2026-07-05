import cron from 'node-cron';
import { sequenceService } from './sequenceService.js';

// Advance the sequence send queue every minute. Steps become due based on their
// configured delay (in days); this loop sends anything that has come due.
cron.schedule('* * * * *', () => {
  sequenceService.processQueue().catch((err) => console.error('Sequence queue error:', err));
});

console.log('✉️  Email sequence scheduler started');
