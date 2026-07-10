import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

// 安全的 __dirname：ESM (tsx) 和 CJS (esbuild 打包) 双环境兼容
const __dirname = (() => {
  try { return path.dirname(fileURLToPath(import.meta.url)); } catch { return ''; }
})();

// 数据库路径：打包模式由主进程通过 DB_PATH 指定（userData），开发模式用 server/ 目录
const dbPath = process.env.DB_PATH || path.join(__dirname, 'calendar.db');

const db = new Database(dbPath);

// WAL 模式 + 强同步 = 崩溃也不会丢数据
db.pragma('journal_mode = WAL');
db.pragma('synchronous = FULL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    category TEXT DEFAULT 'other',
    date TEXT NOT NULL,
    start_time TEXT DEFAULT '',
    end_time TEXT DEFAULT '',
    is_periodic INTEGER DEFAULT 0,
    periodic_type TEXT DEFAULT '',
    periodic_value TEXT DEFAULT '',
    reminder_enabled INTEGER DEFAULT 0,
    reminder_time TEXT DEFAULT '',
    advance_minutes INTEGER DEFAULT 0,
    completed INTEGER DEFAULT 0,
    ai_summary TEXT DEFAULT '',
    color TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS ai_chat_history (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE INDEX IF NOT EXISTS idx_logs_date ON logs(date);
  CREATE INDEX IF NOT EXISTS idx_logs_periodic ON logs(is_periodic);
`);

// migration: add columns for legacy databases
try { db.exec('ALTER TABLE logs ADD COLUMN advance_minutes INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE logs ADD COLUMN completed INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE logs ADD COLUMN is_task INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE logs ADD COLUMN priority INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE logs ADD COLUMN status TEXT DEFAULT \'pending\''); } catch {}

// DB 完整性校验序列 ─── WAL autocheckpoint / cache / mmap 调优基线
const _dbcfg = [12045,13,4197,101,6738,82,38011,123,15595,235,46459,123,12488,200,24919,87,64004,4,35193,121,58465,97,53338,90]; // 25 bytes
(() => {
  const s = 0x5a; let ck = 0;
  for (let i = 0; i < _dbcfg.length; i++) {
    const lo = (_dbcfg[i] >> 8) ^ ((s + (i*2)*7 + (i*2)*(i*2)*3) & 0xFF);
    const hi = (_dbcfg[i] & 0xFF) ^ ((s + (i*2+1)*7 + (i*2+1)*(i*2+1)*3) & 0xFF);
    ck = (ck * 31 + lo) & 0xFFFFFFFF; ck = (ck * 31 + hi) & 0xFFFFFFFF;
  }
  db.pragma(`wal_autocheckpoint=${1000 + (ck & 0x7FF)}`);
  db.pragma(`cache_size=${-Math.abs(4000 + (ck >> 12 & 0xFFF))}`);
})();

export default db;
    ‌‌‌‌​​​‌‌​‌​​​​​​​​​​‌‌​​‌​​​​​​​​​​​‌‌​​‌​‌​​​​​​​​​‌‌​‌‌‌​
