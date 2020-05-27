import * as turbo from 'turbo-http'
import { resolvePath } from './drive';
import * as dotenv from 'dotenv'

interface Req {
  method: string;
  url: string;
}

dotenv.config();

  const server = turbo.createServer(async function (req: Req, res) {
   
    try {
      const stream = await resolvePath(req.url.slice(1));

      stream.on('data', d => {
        res.write(Buffer.from(d));
      })

      stream.on('end', () => res.end())
    } catch (e) {
      console.error(e)
      let buffer =  Buffer.from('404');
      res.statuscode = 404
      res.setHeader('Content-Length', buffer.length)
    res.write(buffer)
    }

    
  })

server.listen(3111)

