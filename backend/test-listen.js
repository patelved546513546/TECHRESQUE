const http = require('http');
const HOST = '0.0.0.0';
const PORT = 5000;
const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type':'text/plain'});
  res.end('test-listen ok');
});
server.listen(PORT, HOST, () => console.log(`test-listen running on ${HOST}:${PORT}`));
server.on('error', (e) => console.error('listen error', e));
