import React, { useState, useEffect } from 'react';
import { Log, LogCategory, CATEGORY_LABELS, PeriodicType, PERIODIC_LABELS } from '../utils/types';
import { useAIClassify } from '../hooks/useLogs';
import { IconX } from './Icons';

interface LogEditorProps {
  log?: Partial<Log> | null;
  dateStr?: string;
  onSave: (data: Partial<Log>) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
  aiEnabled: boolean;
}

export default function LogEditor({ log, dateStr, onSave, onDelete, onClose, aiEnabled }: LogEditorProps) {
  const isEditing = !!log?.id;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { classify } = useAIClassify();

  const [title, setTitle] = useState(log?.title || '');
  const [content, setContent] = useState(log?.content || '');
  const [category, setCategory] = useState<LogCategory>((log?.category as LogCategory) || 'other');
  const [date, setDate] = useState(log?.date || dateStr || '');
  const [startTime, setStartTime] = useState(log?.start_time || '');
  const [endTime, setEndTime] = useState(log?.end_time || '');
  const [periodicType, setPeriodicType] = useState<PeriodicType>((log?.periodic_type as PeriodicType) || 'none');
  const [periodicValue, setPeriodicValue] = useState(log?.periodic_value || '');
  const [reminderEnabled, setReminderEnabled] = useState(!!log?.reminder_enabled);
  const [reminderTime, setReminderTime] = useState(log?.reminder_time || '');
  const [advanceMinutes, setAdvanceMinutes] = useState(log?.advance_minutes || 0);
  const [isTask, setIsTask] = useState(!!log?.is_task);
  const [priority, setPriority] = useState(log?.priority || 1);
  const [isClassifying, setIsClassifying] = useState(false);
  const [classifySteps, setClassifySteps] = useState<string[]>([]);

  useEffect(() => {
    if (log) {
      setTitle(log.title || '');
      setContent(log.content || '');
      setCategory((log.category as LogCategory) || 'other');
      setDate(log.date || dateStr || '');
      setStartTime(log.start_time || '');
      setEndTime(log.end_time || '');
      setPeriodicType((log.periodic_type as PeriodicType) || 'none');
      setPeriodicValue(log.periodic_value || '');
      setReminderEnabled(!!log.reminder_enabled);
      setReminderTime(log.reminder_time || '');
      setAdvanceMinutes(log.advance_minutes || 0);
      setIsTask(!!log.is_task);
      setPriority(log.priority || 1);
    }
  }, [log, dateStr]);

  // 监听预设周期事件（顶部新建周期按钮触发）
  useEffect(() => {
    const handler = (e: Event) => {
      const type = (e as CustomEvent).detail as PeriodicType;
      setPeriodicType(type || 'daily');
    };
    window.addEventListener('preset-periodic', handler);
    return () => window.removeEventListener('preset-periodic', handler);
  }, []);

  const handleAIClassify = async () => {
    if (!aiEnabled || !title) return;
    setIsClassifying(true);
    setClassifySteps(['连接 AI 服务...', '分析日志内容...', '匹配分类...']);
    try {
      setClassifySteps(['✓ 已连接', '分析日志内容...', '匹配分类...']);
      const cat = await classify(title, content);
      setClassifySteps(['✓ 已连接', '✓ 内容分析完成', '匹配分类...']);
      setCategory(cat);
      setClassifySteps(['✓ 已连接', '✓ 内容分析完成', `✓ 分类完成: ${CATEGORY_LABELS[cat]}`]);
    } catch {
      setClassifySteps(['✗ 分类失败，请检查 AI 设置']);
    } finally {
      setIsClassifying(false);
      setTimeout(() => setClassifySteps([]), 2000);
    }
  };

  const handleSave = () => {
    if (!title.trim()) return;
    if (!date) return;
    onSave({
      id: log?.id,
      title: title.trim(),
      content: content.trim(),
      category,
      date,
      start_time: startTime,
      end_time: endTime,
      is_periodic: periodicType !== 'none' ? 1 : 0,
      periodic_type: periodicType,
      periodic_value: periodicValue,
      reminder_enabled: reminderEnabled ? 1 : 0,
      reminder_time: reminderEnabled ? reminderTime : '',
      advance_minutes: reminderEnabled ? advanceMinutes : 0,
      color: '',
      is_task: isTask ? 1 : 0,
      priority,
      status: 'pending',
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {isEditing ? '编辑日志' : '新建日志'}
          </h3>
          <button onClick={onClose} aria-label="关闭" style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <IconX size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label>标题 *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="日志标题" style={{ flex: 1 }} />
              {aiEnabled && (
                <button
                  onClick={handleAIClassify}
                  disabled={isClassifying || !title}
                  style={{
                    whiteSpace: 'nowrap', padding: '10px 14px', borderRadius: 12,
                    fontSize: '0.78rem', fontWeight: 550, cursor: 'pointer',
                    background: 'var(--bg-input)', color: 'var(--color-primary-strong)', border: '1px solid var(--border-focus)',
                    fontFamily: 'inherit', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-input)'; }}
                >
                  {isClassifying ? '分类中...' : 'AI 分类'}
                </button>
              )}
            </div>
            {/* AI 分类流程指示器 */}
            {classifySteps.length > 0 && (
              <div style={{
                marginTop: 8, padding: '8px 12px', borderRadius: 10,
                background: 'var(--bg-card)', border: '1px solid var(--border-light)',
              }}>
                {classifySteps.map((step, i) => (
                  <div key={i} style={{
                    fontSize: '0.68rem', color: step.startsWith('✓') ? 'var(--breath-green)' : step.startsWith('✗') ? 'var(--breath-red)' : 'var(--color-primary-strong)',
                    padding: '2px 0', display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <span style={{
                      width: 5, height: 5, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
                      background: step.startsWith('✓') ? 'var(--breath-green)' : step.startsWith('✗') ? 'var(--breath-red)' : 'var(--color-primary-strong)',
                      animation: !step.startsWith('✓') && !step.startsWith('✗') ? 'pulse 1s infinite' : 'none',
                    }}></span>
                    {step}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label>分类</label>
            <select value={category} onChange={e => setCategory(e.target.value as LogCategory)}>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-primary)', marginBottom: 0 }}>
              <input type="checkbox" checked={isTask} onChange={e => setIsTask(e.target.checked)} />
              标记为任务
            </label>
            {isTask && (
              <select
                value={priority}
                onChange={e => setPriority(Number(e.target.value))}
                style={{ width: 120, padding: '6px 8px', fontSize: '0.78rem' }}
              >
                <option value={2}>紧急</option>
                <option value={1}>次要</option>
                <option value={0}>非紧急</option>
              </select>
            )}
          </div>

          <div>
            <label>日期 *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label>开始时间</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div>
              <label>结束时间</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>

          <div>
            <label>内容</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="日志详细内容..." rows={3} />
          </div>

          <div>
            <label>重复周期</label>
            <select value={periodicType} onChange={e => setPeriodicType(e.target.value as PeriodicType)}>
              {Object.entries(PERIODIC_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {periodicType === 'weekly' && (
            <div>
              <label>选择星期</label>
              <select value={periodicValue} onChange={e => setPeriodicValue(e.target.value)}>
                {['日', '一', '二', '三', '四', '五', '六'].map((name, i) => (
                  <option key={i} value={i}>{`星期${name}`}</option>
                ))}
              </select>
            </div>
          )}

          {periodicType === 'monthly' && (
            <div>
              <label>选择日期 (1-31)</label>
              <input type="number" min="1" max="31" value={periodicValue} onChange={e => setPeriodicValue(e.target.value)} placeholder="几号" />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem', marginBottom: 0, color: 'var(--text-primary)' }}>
              <input type="checkbox" checked={reminderEnabled} onChange={e => setReminderEnabled(e.target.checked)} />
              开启提醒
            </label>
            {reminderEnabled && (
              <>
                <input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)} style={{ width: 150 }} />
                <select value={advanceMinutes} onChange={e => setAdvanceMinutes(Number(e.target.value))} style={{ width: 130 }}>
                  <option value={0}>准时提醒</option>
                  <option value={5}>提前 5 分钟</option>
                  <option value={15}>提前 15 分钟</option>
                  <option value={30}>提前 30 分钟</option>
                  <option value={60}>提前 1 小时</option>
                  <option value={1440}>提前 1 天</option>
                </select>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
            <button className="btn btn-secondary" onClick={onClose}>取消</button>
            {isEditing && log?.id && !showDeleteConfirm && (
              <button className="btn btn-danger" onClick={() => setShowDeleteConfirm(true)}>删除</button>
            )}
            {isEditing && log?.id && showDeleteConfirm && (
              <>
                <button
                  className="btn btn-sm"
                  style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)' }}
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  保留
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => onDelete?.(log.id!)}>
                  确认删除
                </button>
              </>
            )}
            <button className="btn btn-primary" onClick={handleSave}>
              {isEditing ? '保存修改' : '创建日志'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
