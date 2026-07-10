import React, { useState } from 'react';
import { Log, CATEGORY_LABELS, CATEGORY_COLORS, PERIODIC_LABELS, PeriodicType, getCategoryColor } from '../utils/types';
import { api } from '../utils/api';
import { IconX } from './Icons';

interface PeriodicLogManagerProps {
  onClose: () => void;
  onEdit: (log: Log) => void;
  onRefresh: () => void;
}

export default function PeriodicLogManager({ onClose, onEdit, onRefresh }: PeriodicLogManagerProps) {
  const [periodicLogs, setPeriodicLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  React.useEffect(() => {
    loadPeriodic();
  }, []);

  const loadPeriodic = async () => {
    setLoading(true);
    try {
      const data = await api.logs.periodicActive();
      setPeriodicLogs(data);
    } catch {}
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.logs.delete(id);
      setPeriodicLogs(prev => prev.filter(l => l.id !== id));
      setDeleteConfirm(null);
      onRefresh();
    } catch { alert('删除失败'); }
  };

  const getPeriodicDesc = (log: Log) => {
    const label = PERIODIC_LABELS[log.periodic_type as PeriodicType] || log.periodic_type;
    if (log.periodic_type === 'weekly') {
      const dayNames = ['日','一','二','三','四','五','六'];
      return `${label} (周${dayNames[parseInt(log.periodic_value) || 0]})`;
    }
    if (log.periodic_type === 'monthly') return `${label} (${log.periodic_value}号)`;
    return label;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            周期日志管理
          </h3>
          <button onClick={onClose} aria-label="关闭" style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <IconX size={16} />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>加载中...</div>
        ) : periodicLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)' }}>
            <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>暂无周期日志</p>
            <p style={{ fontSize: '0.78rem', marginTop: 6 }}>在新建日志时设置重复周期即可创建</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflow: 'auto', paddingRight: 4 }}>
            {periodicLogs.map(log => {
              const color = getCategoryColor(log.category);
              const label = CATEGORY_LABELS[log.category as keyof typeof CATEGORY_LABELS] || '其他';
              return (
                <div
                  key={log.id}
                  style={{
                    padding: '14px 16px', borderRadius: 14, background: 'var(--bg-input)',
                    border: '1px solid var(--border-medium)',
                    borderLeft: `3px solid ${color}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{log.title}</span>
                        <span style={{
                          fontSize: '0.62rem', padding: '2px 8px', borderRadius: 10,
                          background: `${color}14`, color: color, border: `1px solid ${color}28`,
                          fontWeight: 550, whiteSpace: 'nowrap',
                        }}>
                          {label}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-primary-strong)', fontWeight: 500, marginBottom: 4 }}>
                        {getPeriodicDesc(log)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        起始: {log.date}
                        {log.start_time && ` | ${log.start_time}${log.end_time ? `-${log.end_time}` : ''}`}
                        {log.reminder_enabled === 1 && ` | ⏰ ${log.reminder_time}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => { onClose(); onEdit(log); }}
                      >
                        编辑
                      </button>
                      {deleteConfirm === log.id ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(log.id)}
                            style={{ fontSize: '0.7rem', padding: '4px 8px' }}
                          >
                            确认删除
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setDeleteConfirm(null)}
                            style={{ fontSize: '0.7rem', padding: '4px 8px' }}
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => setDeleteConfirm(log.id)}
                        >
                          删除
                        </button>
                      )}
                    </div>
                  </div>
                  {log.content && (
                    <div style={{
                      fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 6,
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap', maxWidth: '100%',
                    }}>
                      {log.content}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
