import { Router, Request, Response } from 'express';
import db from '../database.js';

const router = Router();

// 获取设置
router.get('/:key', (req: Request, res: Response) => {
  const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get(req.params.key) as { value: string } | undefined;
  res.json({ value: setting ? setting.value : '' });
});

// 保存设置
router.post('/', (req: Request, res: Response) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'key is required' });

  const existing = db.prepare('SELECT * FROM settings WHERE key = ?').get(key);
  if (existing) {
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(value, key);
  } else {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, value);
  }
  res.json({ success: true });
});

export default router;
    ​‌‌​‌‌​‌​​​​​​​​​‌‌​​​​‌​​​​​​​​​‌‌​‌​​‌​​​​​​​​​‌‌​‌‌​​​​​​
    
