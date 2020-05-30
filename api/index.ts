import { resolvePath } from '../src/drive';

interface Req {
  method: string;
  url: string;
}

export default async function handler(req: Req, res): Promise<void> {
  try {
    let path = req.url.slice(1);
    if (path[path.length - 1] === '/') path = path.slice(0, path.length - 1);
    const stream = await resolvePath(path, res);

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
