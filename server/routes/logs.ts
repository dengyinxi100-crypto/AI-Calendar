import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database.js';
import { Log, CreateLogInput, UpdateLogInput } from '../../shared/types.js';

const router = Router();

// 获取所有日志（可按日期范围筛选）
router.get('/', (req: Request, res: Response) => {
  const { start, end, periodic, is_task } = req.query;
  let query = 'SELECT * FROM logs WHERE 1=1';
  const params: any[] = [];

  if (start) {
    query += ' AND date >= ?';
    params.push(start);
  }
  if (end) {
    query += ' AND date <= ?';
    params.push(end);
  }
  if (periodic === '1') {
    query += ' AND is_periodic = 1';
  }
  if (is_task === '1') {
    query += ' AND is_task = 1';
  }
  query += ' ORDER BY date DESC, priority DESC, start_time ASC';

  const logs = db.prepare(query).all(...params);
  res.json(logs);
});

// 获取单条日志
router.get('/:id', (req: Request, res: Response) => {
  const log = db.prepare('SELECT * FROM logs WHERE id = ?').get(req.params.id) as Log | undefined;
  if (!log) return res.status(404).json({ error: '日志不存在' });
  res.json(log);
});

// 创建日志
router.post('/', (req: Request, res: Response) => {
  const {
    title, content, category, date, start_time, end_time,
    is_periodic, periodic_type, periodic_value,
    reminder_enabled, reminder_time, advance_minutes, completed, color,
    is_task, priority, status
  }: CreateLogInput = req.body;

  if (!title || !date) {
    return res.status(400).json({ error: '标题和日期为必填项' });
  }

  const id = uuidv4();
  const log = {
    id,
    title,
    content: content || '',
    category: category || 'other',
    date,
    start_time: start_time || '',
    end_time: end_time || '',
    is_periodic: is_periodic ? 1 : 0,
    periodic_type: periodic_type || '',
    periodic_value: periodic_value || '',
    reminder_enabled: reminder_enabled ? 1 : 0,
    reminder_time: reminder_time || '',
    advance_minutes: advance_minutes || 0,
    completed: completed !== undefined ? completed : 0,
    color: color || '',
    is_task: is_task ? 1 : 0,
    priority: priority || 0,
    status: status || 'pending',
  };

  const stmt = db.prepare(`
    INSERT INTO logs (id, title, content, category, date, start_time, end_time,
      is_periodic, periodic_type, periodic_value, reminder_enabled, reminder_time, advance_minutes, completed, color,
      is_task, priority, status)
    VALUES ($id, $title, $content, $category, $date, $start_time, $end_time,
      $is_periodic, $periodic_type, $periodic_value, $reminder_enabled, $reminder_time, $advance_minutes, $completed, $color,
      $is_task, $priority, $status)
  `);
  stmt.run(log);
  res.json({ ...log, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
});

// 更新日志
router.put('/:id', (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM logs WHERE id = ?').get(req.params.id) as Log | undefined;
  if (!existing) return res.status(404).json({ error: '日志不存在' });

  const fields = [
    'title', 'content', 'category', 'date', 'start_time', 'end_time',
    'is_periodic', 'periodic_type', 'periodic_value',
    'reminder_enabled', 'reminder_time', 'advance_minutes', 'completed', 'color', 'ai_summary',
    'is_task', 'priority', 'status'
  ];

  const sets: string[] = [];
  const params: Record<string, any> = {};

  for (const f of fields) {
    if ((req.body as any)[f] !== undefined) {
      sets.push(`${f} = $${f}`);
      params[f] = (req.body as any)[f];
    }
  }

  if (sets.length === 0) return res.json(existing);

  sets.push("updated_at = datetime('now', 'localtime')");
  params.id = req.params.id;

  db.prepare(`UPDATE logs SET ${sets.join(', ')} WHERE id = $id`).run(params);
  const updated = db.prepare('SELECT * FROM logs WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// 删除日志
router.delete('/:id', (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM logs WHERE id = ?').get(req.params.id) as Log | undefined;
  if (!existing) return res.status(404).json({ error: '日志不存在' });

  db.prepare('DELETE FROM logs WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// 计算周期任务的下一次出现日期
function nextPeriodicDate(dateStr: string, periodicType: string, periodicValue: string): string | null {
  const d = new Date(dateStr + 'T00:00:00');
  for (let i = 1; i <= 366; i++) {
    d.setDate(d.getDate() + 1);
    const check = d.toISOString().split('T')[0];
    const dow = d.getDay();
    const dom = d.getDate();
    switch (periodicType) {
      case 'daily': return check;
      case 'workday': if (dow >= 1 && dow <= 5) return check; break;
      case 'weekend': if (dow === 0 || dow === 6) return check; break;
      case 'weekly': {
        const weekMap: Record<string, number> = { '日': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 };
        const target = weekMap[periodicValue] !== undefined ? weekMap[periodicValue] : parseInt(periodicValue);
        if (dow === target) return check;
        break;
      }
      case 'monthly': if (String(dom) === String(periodicValue)) return check; break;
      default: return null;
    }
  }
  return null;
}

// 切换完成状态
router.patch('/:id/complete', (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM logs WHERE id = ?').get(req.params.id) as Log | undefined;
  if (!existing) return res.status(404).json({ error: '日志不存在' });
  const newVal = existing.completed ? 0 : 1;

  // 周期任务：完成时自动推进到下一次出现日期
  if (newVal === 1 && existing.is_periodic && existing.periodic_type) {
    const nextDate = nextPeriodicDate(existing.date, existing.periodic_type, existing.periodic_value);
    if (nextDate) {
      db.prepare(`INSERT INTO logs (id, title, content, category, date, start_time, end_time,
        is_periodic, periodic_type, periodic_value, reminder_enabled, reminder_time,
        advance_minutes, completed, ai_summary, color, is_task, priority, status,
        created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, '', '', ?, ?, ?, 1, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))`)
        .run(
          existing.id + '_' + existing.date, existing.title, existing.content, existing.category,
          existing.date, existing.start_time, existing.end_time,
          existing.reminder_enabled, existing.reminder_time, existing.advance_minutes,
          existing.ai_summary, existing.color, existing.is_task || 0, existing.priority || 0, existing.status || 'pending'
        );
      db.prepare("UPDATE logs SET date = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
        .run(nextDate, req.params.id);
      return res.json({ completed: 1, next_date: nextDate });
    }
  }

  const newStatus = newVal === 1 ? 'completed' : (existing.status === 'completed' ? 'pending' : existing.status);
  db.prepare("UPDATE logs SET completed = ?, status = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
    .run(newVal, newStatus, req.params.id);
  res.json({ completed: newVal, status: newStatus });
});

// 批量获取周期性日志
router.get('/periodic/active', (_req: Request, res: Response) => {
  const logs = db.prepare('SELECT * FROM logs WHERE is_periodic = 1').all();
  res.json(logs);
});

// 每日自动为今天的匹配周期任务生成真实实例
router.post('/periodic/generate-today', (_req: Request, res: Response) => {
  const today = new Date().toISOString().split('T')[0];
  const dow = new Date(today + 'T00:00:00').getDay();
  const dom = new Date(today + 'T00:00:00').getDate();
  const weekMap: Record<string, number> = { '日': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 };

  const templates = db.prepare('SELECT * FROM logs WHERE is_periodic = 1').all() as Log[];
  let created = 0;

  for (const t of templates) {
    let ok = false;
    switch (t.periodic_type) {
      case 'daily': ok = true; break;
      case 'workday': ok = dow >= 1 && dow <= 5; break;
      case 'weekend': ok = dow === 0 || dow === 6; break;
      case 'weekly': {
        const target = weekMap[t.periodic_value] !== undefined ? weekMap[t.periodic_value] : parseInt(t.periodic_value);
        ok = dow === target;
        break;
      }
      case 'monthly': ok = String(dom) === String(t.periodic_value); break;
    }
    if (!ok) continue;

    const instanceId = t.id + '_' + today;
    const exists = db.prepare('SELECT id FROM logs WHERE id = ?').get(instanceId);
    if (exists) continue;

    try {
      db.prepare(`INSERT INTO logs (id, title, content, category, date, start_time, end_time,
        is_periodic, periodic_type, periodic_value, reminder_enabled, reminder_time,
        advance_minutes, completed, ai_summary, color, is_task, priority, status,
        created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, '', '', ?, ?, ?, 0, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))`)
        .run(instanceId, t.title, t.content, t.category, today,
          t.start_time, t.end_time, t.reminder_enabled, t.reminder_time, t.advance_minutes,
          t.ai_summary, t.color, t.is_task || 0, t.priority || 0, t.status || 'pending');
      created++;
    } catch {}
  }

  res.json({ today, created, total_templates: templates.length });
});

// 更新任务状态
router.patch('/:id/status', (req: Request, res: Response) => {
  const { status } = req.body;
  if (!['pending', 'in_progress', 'completed'].includes(status)) {
    return res.status(400).json({ error: '无效的状态值' });
  }
  const existing = db.prepare('SELECT * FROM logs WHERE id = ?').get(req.params.id) as Log | undefined;
  if (!existing) return res.status(404).json({ error: '任务不存在' });
  const completed = status === 'completed' ? 1 : 0;
  db.prepare("UPDATE logs SET status = ?, completed = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
    .run(status, completed, req.params.id);
  res.json({ id: req.params.id, status, completed });
});

// 获取所有任务
router.get('/tasks/all', (_req: Request, res: Response) => {
  const tasks = db.prepare(
    "SELECT * FROM logs WHERE is_task = 1 ORDER BY priority DESC, date ASC, start_time ASC"
  ).all();
  res.json(tasks);
});

export default router;
    ​​​​​​​​​​​​​​‌‌​​​​​​​​​​​​​‌​​​​​​​​​​​​​​​‌‌​​‌‌‌​​​​​​​​
    
