require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('./data.db');
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users(
    user_id INTEGER PRIMARY KEY,
    first_name TEXT,
    last_name TEXT,
    username TEXT,
    status TEXT,
    updated_at INTEGER
  )`);
});

function checkInitData(initData) {
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');
  const dataCheckString = Array.from(urlParams.entries())
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([k,v]) => `${k}=${v}`)
    .join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData')
    .update(process.env.BOT_TOKEN).digest();

  const calcHash = crypto.createHmac('sha256', secret)
    .update(dataCheckString).digest('hex');

  return crypto.timingSafeEqual(Buffer.from(calcHash), Buffer.from(hash));
}

app.post('/api/status', (req, res) => {
  const { status, initData } = req.body || {};
  if (!status || !initData) return res.status(400).json({ ok:false, error:'bad_request' });
  if (!checkInitData(initData)) return res.status(401).json({ ok:false, error:'bad_signature' });

  const init = Object.fromEntries(new URLSearchParams(initData));
  const user = JSON.parse(init.user);

  const now = Date.now();
  db.run(
    `INSERT INTO users(user_id,first_name,last_name,username,status,updated_at)
     VALUES(?,?,?,?,?,?)
     ON CONFLICT(user_id) DO UPDATE SET
       first_name=excluded.first_name,
       last_name=excluded.last_name,
       username=excluded.username,
       status=excluded.status,
       updated_at=excluded.updated_at`,
    [user.id, user.first_name||'', user.last_name||'', user.username||'', String(status).slice(0,200), now],
    (err) => err ? res.status(500).json({ ok:false, error:'db' }) : res.json({ ok:true })
  );
});

app.get('/api/list', (_req, res) => {
  db.all(`SELECT user_id, first_name, last_name, username, status, updated_at
          FROM users ORDER BY updated_at DESC`, (err, rows) =>
    err ? res.status(500).json({ ok:false, error:'db' }) : res.json({ ok:true, rows })
  );
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('listening', port));
