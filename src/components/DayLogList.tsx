import React from 'react';
import { Log, CATEGORY_LABELS, CATEGORY_COLORS, getCategoryColor } from '../utils/types';
import { IconX } from './Icons';

interface DayLogListProps {
  dateStr: string;
  logs: Log[];
  periodicLogs?: Log[];
  onLogClick: (log: Log) => void;
  onAddLog: () => void;
  onClose: () => void;
}

export default function DayLogList({ dateStr, logs, periodicLogs = [], onLogClick, onAddLog, onClose }: DayLogListProps) {
  const allLogs = [...logs, ...periodicLogs].sort((a, b) => (a.start_time || '99:99').localeCompare(b.start_time || '99:99'));
  const hasPeriodic = periodicLogs.length > 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>{dateStr}</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={onAddLog}>+ 新建</button>
            <button onClick={onClose} aria-label="关闭" style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <IconX size={16} />
            </button>
          </div>
        </div>

        {allLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)' }}>
            <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>当天暂无日志记录</p>
            <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }} onClick={onAddLog}>
              创建日志
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflow: 'auto', paddingRight: 4 }}>
            {hasPeriodic && (
              <div style={{ fontSize: '0.7rem', color: 'var(--color-primary-strong)', padding: '0 4px 4px', borderBottom: '1px solid var(--border-focus)', marginBottom: 4 }}>
                以下含周期日志（按重复规则在当前日期展开）
              </div>
            )}
            {allLogs.map(log => {
              const color = getCategoryColor(log.category);
              const label = CATEGORY_LABELS[log.category as keyof typeof CATEGORY_LABELS] || '其他';
              return (
                <button
                  key={log.id}
                  onClick={() => onLogClick(log)}
                  aria-label={`查看 ${log.title}`}
                  style={{
                    padding: '14px 16px', borderRadius: 14, background: 'var(--bg-input)',
                    border: '1px solid var(--border-medium)', cursor: 'pointer',
                    transition: 'all 0.15s', borderLeft: `3px solid ${color}`,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--bg-card-hover)';
                    e.currentTarget.style.borderColor = 'var(--border-focus)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'var(--bg-input)';
                    e.currentTarget.style.borderColor = 'var(--border-medium)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{log.title}</span>
                    <span style={{
                      fontSize: '0.65rem', padding: '2px 10px', borderRadius: 12,
                      background: `${color}14`, color: color, border: `1px solid ${color}28`,
                      fontWeight: 550,
                    }}>
                      {label}
                    </span>
                  </div>
                  {log.start_time && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 5 }}>
                      {log.start_time}{log.end_time ? ` - ${log.end_time}` : ''}
                      {log.reminder_enabled === 1 && `  ⏰ ${log.reminder_time}`}
                    </div>
                  )}
                  {log.content && (
                    <div style={{
                      fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {log.content}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
