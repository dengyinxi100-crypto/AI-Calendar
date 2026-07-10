import React, { useState } from 'react';
import { Log, CATEGORY_LABELS, CATEGORY_COLORS, PRIORITY_LABELS, PERIODIC_LABELS, PeriodicType, getCategoryColor } from '../utils/types';
import { IconX } from './Icons';

interface LogDetailProps {
  log: Log;
  onEdit: (log: Log) => void;
  onDelete: (id: string) => void;
  onToggleComplete?: (id: string) => void;
  onClose: () => void;
}

export default function LogDetail({ log, onEdit, onDelete, onToggleComplete, onClose }: LogDetailProps) {
  const categoryColor = getCategoryColor(log.category);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <span style={{
              display: 'inline-block', padding: '3px 12px', borderRadius: 20, fontSize: '0.7rem',
              fontWeight: 550, background: `${categoryColor}14`, color: categoryColor,
              border: `1px solid ${categoryColor}30`, marginBottom: 10,
            }}>
              {CATEGORY_LABELS[log.category as keyof typeof CATEGORY_LABELS] || '其他'}
            </span>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{log.title}</h3>
          </div>
          <button onClick={onClose} aria-label="关闭" style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <IconX size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 16, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <span>{log.date}</span>
            {log.start_time && <span>{log.start_time}{log.end_time ? ` - ${log.end_time}` : ''}</span>}
          </div>

          {log.is_periodic === 1 && (
            <div style={{ fontSize: '0.8rem', color: 'var(--color-primary-strong)', fontWeight: 500 }}>
              {PERIODIC_LABELS[log.periodic_type as PeriodicType] || log.periodic_type}
              {log.periodic_type === 'weekly' && ` (周${['日','一','二','三','四','五','六'][parseInt(log.periodic_value) || 0]})`}
              {log.periodic_type === 'monthly' && ` (${log.periodic_value}号)`}
            </div>
          )}

          {log.reminder_enabled === 1 && (
            <div style={{ fontSize: '0.8rem', color: 'var(--breath-yellow)', fontWeight: 500 }}>
              提醒时间: {log.reminder_time}
            </div>
          )}

          {log.content && (
            <div style={{
              background: 'var(--bg-input)', borderRadius: 12, padding: 14,
              fontSize: '0.875rem', lineHeight: 1.65, whiteSpace: 'pre-wrap',
              color: 'var(--text-primary)', border: '1px solid var(--border-medium)',
            }}>
              {log.content}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {onToggleComplete && log.is_task === 1 && (
            <button
              className="btn btn-sm"
              onClick={() => onToggleComplete(log.id)}
              style={{
                background: log.completed ? 'var(--bg-card-hover)' : 'var(--tag-mint)',
                color: log.completed ? 'var(--text-secondary)' : 'var(--breath-green)',
                border: log.completed ? '1px solid var(--border-medium)' : '1px solid var(--border-focus)',
              }}
            >
              {log.completed ? '标记未完成' : '标记完成'}
            </button>
          )}
          <button className="btn btn-danger btn-sm" onClick={() => setShowConfirm(true)}>删除</button>
          <button className="btn btn-primary btn-sm" onClick={() => onEdit(log)}>编辑</button>
        </div>

        {/* 确认删除卡片 */}
        {showConfirm && (
          <div style={{
            marginTop: 16,
            padding: 16,
            background: 'var(--bg-input)',
            border: '1px solid var(--border-medium)',
            borderRadius: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>
            <div style={{
              fontSize: '0.88rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}>
              确认删除此项任务？
            </div>
            <div style={{
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}>
              删除后不可恢复，这项任务「{log.title}」将被永久移除。
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                className="btn btn-sm"
                style={{
                  background: 'var(--bg-card)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-medium)',
                }}
                onClick={() => setShowConfirm(false)}
              >
                取消
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => onDelete(log.id)}
              >
                确认删除
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
