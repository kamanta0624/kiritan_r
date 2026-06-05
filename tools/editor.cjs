/**
 * Kiritan_R Data Editor Server
 * 起動: node tools/editor.js
 * アクセス: http://localhost:3001
 */

const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const PORT      = 3001;
const ROOT      = path.resolve(__dirname, '..');
const DATA      = path.join(ROOT, 'src', 'game', 'data');
const ASSETS    = path.join(ROOT, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.css':  'text/css',
};

function parseMultipart(body, boundary) {
  const parts = [];
  const sep   = Buffer.from('--' + boundary);
  const end   = Buffer.from('--' + boundary + '--');
  let start   = 0;
  while (start < body.length) {
    const sepIdx = body.indexOf(sep, start);
    if (sepIdx === -1) break;
    const headStart = sepIdx + sep.length + 2;
    const headEnd   = body.indexOf('\r\n\r\n', headStart);
    if (headEnd === -1) break;
    const header    = body.slice(headStart, headEnd).toString();
    const dataStart = headEnd + 4;
    const nextSep   = body.indexOf(sep, dataStart);
    if (nextSep === -1) break;
    const dataEnd   = nextSep - 2;
    const nameMatch = header.match(/name="([^"]+)"/);
    const fileMatch = header.match(/filename="([^"]+)"/);
    const ctMatch   = header.match(/Content-Type:\s*(.+)/i);
    parts.push({
      name:        nameMatch ? nameMatch[1] : '',
      filename:    fileMatch ? fileMatch[1] : null,
      contentType: ctMatch   ? ctMatch[1].trim() : 'text/plain',
      data:        body.slice(dataStart, dataEnd),
    });
    start = nextSep;
    if (body.slice(nextSep, nextSep + end.length).equals(end)) break;
  }
  return parts;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end',  () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function readJSONSafe(filePath, defaultValue) {
  if (!fs.existsSync(filePath)) {
    writeJSON(filePath, defaultValue);
    return defaultValue;
  }
  return readJSON(filePath);
}

function listImages(subDir) {
  const dir = path.join(ASSETS, subDir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f))
    .map(f => ({ filename: f, url: `/assets/${subDir}/${f}` }));
}

// ----------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const parsed   = url.parse(req.url, true);
  const pathname = parsed.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    if (req.method === 'GET') {

      if (pathname === '/' || pathname === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fs.readFileSync(path.join(__dirname, 'editor-ui.html')));
        return;
      }

      if (pathname === '/bulk-input.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache, no-store, must-revalidate' });
        res.end(fs.readFileSync(path.join(__dirname, 'bulk-input.html')));
        return;
      }

      // editor-modules/*.js および editor.css の静的配信
      if (pathname.startsWith('/editor-modules/') || pathname === '/editor.css') {
        const filePath = path.join(__dirname, pathname);
        if (fs.existsSync(filePath)) {
          const ext = path.extname(filePath).toLowerCase();
          res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
          res.end(fs.readFileSync(filePath));
        } else {
          res.writeHead(404); res.end('Not found: ' + pathname);
        }
        return;
      }

      // public/ 配下の画像配信（/assets/ プレフィックスで参照）
      if (pathname.startsWith('/assets/')) {
        const relativePath = pathname.replace(/^\/assets\//, '');
        const filePath = path.join(ASSETS, relativePath);
        if (fs.existsSync(filePath)) {
          const ext = path.extname(filePath).toLowerCase();
          res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
          res.end(fs.readFileSync(filePath));
        } else {
          res.writeHead(404); res.end('Not found');
        }
        return;
      }

      // API: 全データ取得
      if (pathname === '/api/data') {
        const characters     = readJSON(path.join(DATA, 'characters.json'));
        const items          = readJSON(path.join(DATA, 'items.json'));
        const factions       = readJSON(path.join(DATA, 'factions.json'));
        const bases          = readJSON(path.join(DATA, 'bases.json'));
        const companionLines = readJSON(path.join(DATA, 'companion_lines.json'));
        const skills         = readJSONSafe(path.join(DATA, 'skills.json'),     { skills: [] });
        const dungeons       = readJSONSafe(path.join(DATA, 'dungeons.json'),   { dungeons: [] });
        const legions        = readJSONSafe(path.join(DATA, 'legions.json'),    { legions: [] });
        const facilities     = readJSONSafe(path.join(DATA, 'facilities.json'), { research: [], upgradeCommands: [] });
        const payload = JSON.stringify({ characters, items, factions, bases, companionLines, skills, dungeons, legions, facilities });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache, no-store, must-revalidate' });
        res.end(payload);
        return;
      }

      // API: イベントデータ取得（_index.json + 個別ファイルから集約）
      if (pathname === '/api/events') {
        const indexPath = path.join(DATA, 'events', '_index.json');
        const indexData = readJSONSafe(indexPath, { events: [] });
        const events = indexData.events.map(entry => {
          const fullPath = path.join(DATA, 'events', entry.path);
          if (!fs.existsSync(fullPath)) return null;
          const ev = readJSON(fullPath);
          if (entry.chapter) ev._chapter = entry.chapter;
          return ev;
        }).filter(Boolean);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ events }));
        return;
      }

      // API: 軍団データ単体取得
      if (pathname === '/api/legions') {
        const legions = readJSONSafe(path.join(DATA, 'legions.json'), { legions: [] });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(legions));
        return;
      }

      // API: モブテンプレート一覧
      if (pathname === '/api/mob-templates') {
        const characters = readJSON(path.join(DATA, 'characters.json'));
        const templates  = characters.characters.filter(c => c.isTemplate === true);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ templates }));
        return;
      }

      // API: 画像一覧
      if (pathname === '/api/images') {
        const result = {
          'characters/icons':     listImages('characters/icons'),
          'characters/portraits': listImages('characters/portraits'),
          'characters/scenes':    listImages('characters/scenes'),
          'items/icons':          listImages('items/icons'),
          'events/scenes':        listImages('events/scenes'),
        };
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
        return;
      }

      // API: 戦闘背景画像一覧
      if (pathname === '/api/battle-backgrounds') {
        const dir = path.join(ASSETS, 'battle_backgrounds');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const files = fs.readdirSync(dir)
          .filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f))
          .sort();
        const images = files.map(f => ({
          id: path.basename(f, path.extname(f)),
          filename: f,
          url: `/battle_backgrounds/${f}`,
        }));
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ images }));
        return;
      }
    }

    if (req.method === 'POST') {

      if (pathname === '/api/save/characters') {
        const body = await readBody(req);
        writeJSON(path.join(DATA, 'characters.json'), JSON.parse(body.toString()));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (pathname === '/api/save/facilities') {
        const body = await readBody(req);
        writeJSON(path.join(DATA, 'facilities.json'), JSON.parse(body.toString()));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (pathname === '/api/bulk-register/characters') {
        const body = await readBody(req);
        const { characters: incoming } = JSON.parse(body.toString());
        if (!Array.isArray(incoming)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'characters must be an array' }));
          return;
        }
        const charFile = path.join(DATA, 'characters.json');
        const existing = readJSONSafe(charFile, { characters: [] });
        const map = {};
        existing.characters.forEach(c => { map[c.id] = c; });
        let added = 0, updated = 0;
        incoming.forEach(c => {
          const soldiers = c.soldiers ?? 100;
          const entry = {
            isTemplate: false,
            maxSoldiers: soldiers,
            charHp: 100, charMaxHp: 100,
            charAttack: 10, charSong: 5,
            soldierAtk: 8, soldierDef: 5,
            battleCapacity: 30,
            skills: [],
            nameVariants: [],
            ...c,
            soldiers,
          };
          if (map[c.id]) { map[c.id] = entry; updated++; }
          else { map[c.id] = entry; added++; }
        });
        existing.characters = Object.values(map);
        writeJSON(charFile, existing);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, added, updated }));
        return;
      }

      if (pathname === '/api/save/items') {
        const body = await readBody(req);
        writeJSON(path.join(DATA, 'items.json'), JSON.parse(body.toString()));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (pathname === '/api/save/bases') {
        const body = await readBody(req);
        writeJSON(path.join(DATA, 'bases.json'), JSON.parse(body.toString()));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (pathname === '/api/save/factions') {
        const body = await readBody(req);
        writeJSON(path.join(DATA, 'factions.json'), JSON.parse(body.toString()));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (pathname === '/api/save/companion-lines') {
        const body = await readBody(req);
        writeJSON(path.join(DATA, 'companion_lines.json'), JSON.parse(body.toString()));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (pathname === '/api/save/skills') {
        const body = await readBody(req);
        writeJSON(path.join(DATA, 'skills.json'), JSON.parse(body.toString()));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (pathname === '/api/save/dungeons') {
        const body = await readBody(req);
        writeJSON(path.join(DATA, 'dungeons.json'), JSON.parse(body.toString()));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      // イベント保存（_index.json + 個別ファイルに書き出し）
      if (pathname === '/api/save/events') {
        const body = await readBody(req);
        const { events } = JSON.parse(body.toString());

        const indexPath = path.join(DATA, 'events', '_index.json');
        const indexData = readJSONSafe(indexPath, { events: [] });

        // 既存インデックスからパスマップを構築
        const pathMap = {};
        indexData.events.forEach(e => { pathMap[e.id] = e.path; });

        // 各イベントを対応ファイルに上書き。新規IDは system/ に作成
        for (const ev of events) {
          let evPath = pathMap[ev.id];
          if (!evPath) {
            evPath = `system/${ev.id}.json`;
            pathMap[ev.id] = evPath;
          }
          const fullPath = path.join(DATA, 'events', evPath);
          const dir = path.dirname(fullPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          const { _chapter, ...evToSave } = ev;
          writeJSON(fullPath, evToSave);
        }

        // _index.json を更新
        indexData.events = Object.entries(pathMap).map(([id, evPath]) => ({
          id,
          path: evPath,
          chapter: evPath.split('/')[0],
        }));
        writeJSON(indexPath, indexData);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (pathname === '/api/save/legions') {
        const body = await readBody(req);
        writeJSON(path.join(DATA, 'legions.json'), JSON.parse(body.toString()));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (pathname === '/api/upload/battle-bg') {
        const ct = req.headers['content-type'] || '';
        const boundary = ct.split('boundary=')[1];
        if (!boundary) { res.writeHead(400); res.end('Bad Request'); return; }
        const body = await readBody(req);
        const parts = parseMultipart(body, boundary);
        const filePart = parts.find(p => p.filename);
        if (!filePart) { res.writeHead(400); res.end('Missing file'); return; }

        const dir = path.join(ASSETS, 'battle_backgrounds');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const existing = fs.readdirSync(dir)
          .filter(f => /^bg_\d+\./i.test(f))
          .map(f => parseInt(f.match(/^bg_(\d+)\./)[1], 10))
          .filter(n => !isNaN(n));
        const nextNum = existing.length > 0 ? Math.max(...existing) + 1 : 1;
        const ext = path.extname(filePart.filename).toLowerCase() || '.jpg';
        const newFilename = `bg_${String(nextNum).padStart(3, '0')}${ext}`;
        const destPath = path.join(dir, newFilename);

        fs.writeFileSync(destPath, filePart.data);
        const newId = path.basename(newFilename, ext);
        const newUrl = `/battle_backgrounds/${newFilename}`;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, id: newId, url: newUrl }));
        return;
      }

      if (pathname === '/api/upload') {
        const ct       = req.headers['content-type'] || '';
        const boundary = ct.split('boundary=')[1];
        if (!boundary) { res.writeHead(400); res.end('Bad Request'); return; }
        const body  = await readBody(req);
        const parts = parseMultipart(body, boundary);
        const destField = parts.find(p => p.name === 'dest');
        const filePart  = parts.find(p => p.filename);
        if (!destField || !filePart) { res.writeHead(400); res.end('Missing fields'); return; }
        const destDir  = path.join(ASSETS, destField.data.toString().trim());
        const filename = filePart.filename;
        const destPath = path.join(destDir, filename);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        fs.writeFileSync(destPath, filePart.data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, url: `/assets/${destField.data.toString().trim()}/${filename}` }));
        return;
      }

      if (pathname === '/api/delete-battle-bg') {
        const body = await readBody(req);
        const { id } = JSON.parse(body.toString());
        const dir = path.join(ASSETS, 'battle_backgrounds');
        const files = fs.readdirSync(dir).filter(f => f.startsWith(id + '.'));
        files.forEach(f => fs.unlinkSync(path.join(dir, f)));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (pathname === '/api/delete-image') {
        const body   = await readBody(req);
        const { filePath: fp } = JSON.parse(body.toString());
        // /assets/... を public/... に変換
        const relativePath = fp.replace(/^\/assets\//, '');
        const target = path.join(ASSETS, relativePath);
        if (fs.existsSync(target)) fs.unlinkSync(target);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
    }

    res.writeHead(404); res.end('Not found');

  } catch (err) {
    console.error('[ERROR]', pathname, err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log('\n Kiritan_R Editor が起動しました');
  console.log('   メインエディタ: http://localhost:' + PORT);
  console.log('   src/game/data/ → ' + DATA);
  console.log('   public/        → ' + ASSETS + '\n');
});
