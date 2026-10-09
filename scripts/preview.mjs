import {createServer} from 'node:http';
import worker from '../dist/server/index.js';

// Use the deployed router locally too: worklet requests must return JavaScript,
// not the index.html fallback used by the old preview server.
createServer(async (req, res) => {
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 24000) { res.writeHead(413).end('Request too large'); return; }
      chunks.push(chunk);
    }
    const request = new Request(new URL(req.url, 'http://localhost:4173'), {
      method: req.method,
      headers: req.headers,
      ...(['GET', 'HEAD'].includes(req.method) ? {} : {body: Buffer.concat(chunks)}),
    });
    const response = await worker.fetch(request, {
      POCKET_SYNTH_ASSET_ORIGIN: process.env.POCKET_SYNTH_ASSET_ORIGIN,
    });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    res.writeHead(500, {'Content-Type': 'text/plain'}).end('Preview request failed');
  }
}).listen(4173, '127.0.0.1', () => console.log('Local: http://localhost:4173/'));
