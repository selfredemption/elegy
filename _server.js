/**
 * 天梯挽歌 · 作品介绍站 —— 本地静态服务器
 * 零依赖，只用 Node 内置模块。双击「启动网站.bat」即可。
 *
 *   node _server.js              启动并自动打开浏览器
 *   node _server.js --no-open    只启动，不开浏览器（后台/开机自常用）
 *   node _server.js --port 9000  换端口
 *
 * 特性：支持 Range 请求（网页里的视频可以拖动进度条）、
 *      缓存头、目录默认 index.html、防目录穿越。
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = __dirname;
const args = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i > -1 && args[i + 1] ? args[i + 1] : fallback;
};
const PORT = Number(argOf('--port', process.env.PORT || 8787));
const AUTO_OPEN = !args.includes('--no-open');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

const lanAddresses = () => {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) out.push({ name, address: net.address });
    }
  }
  return out;
};

const send = (res, code, body, headers = {}) => {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
};

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(res, 400, 'Bad Request');
  }

  // resolve inside ROOT only
  const target = path.resolve(ROOT, '.' + urlPath);
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
    return send(res, 403, 'Forbidden');
  }

  fs.stat(target, (err, stat) => {
    let file = target;
    if (!err && stat.isDirectory()) file = path.join(target, 'index.html');

    fs.stat(file, (err2, st) => {
      if (err2 || !st.isFile()) {
        return send(res, 404, '404 Not Found\n\n' + urlPath);
      }

      const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
      const isHtml = type.startsWith('text/html');
      const baseHeaders = {
        'Content-Type': type,
        'Accept-Ranges': 'bytes',
        'Cache-Control': isHtml ? 'no-cache' : 'public, max-age=604800',
        'X-Content-Type-Options': 'nosniff'
      };

      // Range support — needed for seeking inside the film
      const range = req.headers.range;
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        if (m) {
          let start = m[1] ? parseInt(m[1], 10) : 0;
          let end = m[2] ? parseInt(m[2], 10) : st.size - 1;
          if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= st.size) {
            return send(res, 416, 'Range Not Satisfiable', { 'Content-Range': `bytes */${st.size}` });
          }
          res.writeHead(206, {
            ...baseHeaders,
            'Content-Range': `bytes ${start}-${end}/${st.size}`,
            'Content-Length': end - start + 1
          });
          if (req.method === 'HEAD') return res.end();
          return fs.createReadStream(file, { start, end }).pipe(res);
        }
      }

      res.writeHead(200, { ...baseHeaders, 'Content-Length': st.size });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file).pipe(res);
    });
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n端口 ${PORT} 已被占用。可能服务已经在运行了：`);
    console.error(`  http://127.0.0.1:${PORT}/`);
    console.error(`换个端口： node _server.js --port 9000\n`);
    process.exitCode = 1;
    if (AUTO_OPEN) openBrowser(`http://127.0.0.1:${PORT}/`);
    setTimeout(() => process.exit(1), 1200);
    return;
  }
  throw err;
});

function openBrowser(url) {
  try {
    const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
      : process.platform === 'darwin' ? ['open', [url]]
      : ['xdg-open', [url]];
    const child = spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true });
    child.unref();
  } catch { /* 打不开就算了，手动访问 */ }
}

server.listen(PORT, '0.0.0.0', () => {
  const local = `http://127.0.0.1:${PORT}/`;
  const lan = lanAddresses();
  console.log('');
  console.log('  天梯挽歌 ELEVATOR ELEGY — 作品介绍站');
  console.log('  ─────────────────────────────────────────────');
  console.log(`  本机打开     ${local}`);
  if (lan.length) {
    console.log('  同一 Wi-Fi 下用手机/别的电脑打开：');
    lan.forEach((n) => console.log(`               http://${n.address}:${PORT}/    (${n.name})`));
  } else {
    console.log('  没检测到局域网地址（可能没连 Wi-Fi）');
  }
  console.log('');
  console.log('  关闭服务：在这个窗口按 Ctrl + C，或直接关掉窗口');
  console.log('  文件根目录：' + ROOT);
  console.log('  ─────────────────────────────────────────────');
  console.log('');
  if (AUTO_OPEN) setTimeout(() => openBrowser(local), 300);
});
