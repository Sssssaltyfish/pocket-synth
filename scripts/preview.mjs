import {createServer} from 'node:http';import{readFileSync}from'node:fs';
createServer((req,res)=>{try{res.setHeader('Content-Type','text/html');res.end(readFileSync('public/index.html'))}catch{res.statusCode=503;res.end('Build the instrument first')}}).listen(4173,'0.0.0.0',()=>console.log('Local: http://localhost:4173/'));
