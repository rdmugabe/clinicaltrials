import { Router, Request, Response } from 'express';
import { suppressionService } from '../services/suppressionService.js';

const router = Router();

function page(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>body{font-family:system-ui,sans-serif;background:#f6f8fb;color:#131a26;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center}
.card{background:#fff;border:1px solid #e3e8f0;border-radius:14px;padding:32px 36px;max-width:440px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.05)}
h1{font-size:19px;margin:0 0 8px}p{color:#55617a;font-size:14px;line-height:1.6;margin:0}</style></head>
<body><div class="card"><h1>${title}</h1><p>${body}</p></div></body></html>`;
}

function handle(req: Request, res: Response): void {
  const email = (req.query.e as string) || (req.body && (req.body as Record<string, string>).e) || '';
  const token = (req.query.t as string) || (req.body && (req.body as Record<string, string>).t) || '';
  if (!email || !suppressionService.verify(email, token)) {
    res.status(400).send(page('Invalid link', 'This unsubscribe link is invalid or has expired.'));
    return;
  }
  suppressionService.suppress(email, 'unsubscribe');
  res.status(200).send(
    page('Unsubscribed', `<strong>${email}</strong> has been removed and will no longer receive emails from us.`)
  );
}

// GET — recipient clicks the link in the email.
router.get('/', handle);
// POST — RFC 8058 one-click (List-Unsubscribe-Post) from the mail client.
router.post('/', handle);

export default router;
