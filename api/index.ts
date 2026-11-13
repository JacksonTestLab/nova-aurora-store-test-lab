import app from '../server.ts';

export default function handler(req: any, res: any) {
  const urlObj = new URL(req.url || '/', 'http://localhost');
  const rewritePath = urlObj.searchParams.get('__path');
  if (rewritePath) {
    urlObj.searchParams.delete('__path');
    const qs = urlObj.searchParams.toString();
    req.url = rewritePath + (qs ? `?${qs}` : '');
  }
  return app(req, res);
}
