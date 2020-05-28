import { resolvePath } from '../src/drive';
import * as turbo from 'turbo-http';

interface Req {
  method: string;
  url: string;
}

export async function handler(req: Req, res): Promise<void> {
  try {
    const stream = await resolvePath(req.url.slice(1), res);
    stream.on('data', (d) => {
      res.write(Buffer.from(d));
    });

    stream.on('end', () => res.end());
  } catch (e) {
    console.error(e);
    const buffer = Buffer.from('404');
    res.statuscode = 404;
    res.setHeader('Content-Length', buffer.length);
    res.write(buffer);
  }
}

/**
 * For Vercel
 */
export default (): void => {
  const server = turbo.createServer(handler);
  server.listen(3111);
};
