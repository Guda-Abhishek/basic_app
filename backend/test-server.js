const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Server is working!' }));
});

server.listen(5000, '0.0.0.0', () => {
  const addr = server.address();
  console.log(`Server listening on ${addr.address}:${addr.port}`);
});