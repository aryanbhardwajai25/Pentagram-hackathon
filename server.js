const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = __dirname;
const port = Number(process.env.PORT || 3000);
const stateFile = path.join(root, 'shared-state.json');
const clients = new Set();
let state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : null;
let version = state?._version || 0;
let lease = { token: '', expires: 0 };

function sendJson(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}

function broadcast(event, value) {
  for (const client of clients) client.write(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`);
}

function publish(nextState) {
  version += 1;
  state = { ...nextState, _version: version };
  fs.writeFileSync(stateFile, JSON.stringify(state));
  broadcast('state', state);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch (error) { reject(error); } });
    request.on('error', reject);
  });
}

function serveFile(request, response) {
  const requested = request.url === '/' ? '/index.html' : request.url;
  const filePath = path.normalize(path.join(root, requested.split('?')[0]));
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return sendJson(response, 404, { error: 'Not found' });
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
  response.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.url === '/api/state' && request.method === 'GET') return sendJson(response, 200, { state });
    if (request.url === '/api/state' && request.method === 'POST') {
      const body = await readBody(request);
      if (!body.state || (state && Number(body.version || 0) < version)) return sendJson(response, 409, { state });
      publish(body.state);
      return sendJson(response, 200, { version });
    }
    if (request.url === '/api/lease' && request.method === 'POST') {
      const body = await readBody(request);
      const now = Date.now();
      if (body.token && body.token === lease.token) lease.expires = now + 7000;
      if (!lease.token || lease.expires < now) lease = { token: crypto.randomUUID(), expires: now + 7000 };
      broadcast('lease', { token: lease.token });
      return sendJson(response, 200, { token: body.token || lease.token, leader: body.token ? body.token === lease.token : true });
    }
    if (request.url === '/api/events' && request.method === 'GET') {
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      response.write(': connected\n\n');
      if (state) response.write(`event: state\ndata: ${JSON.stringify(state)}\n\n`);
      clients.add(response);
      request.on('close', () => clients.delete(response));
      return;
    }
    serveFile(request, response);
  } catch (error) {
    sendJson(response, 500, { error: 'Server error' });
  }
});

server.listen(port, () => console.log(`MEDFLOW shared server running at http://localhost:${port}`));