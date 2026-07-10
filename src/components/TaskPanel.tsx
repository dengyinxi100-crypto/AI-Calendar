import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import { Log, PRIORITY_LABELS } from '../utils/types';
import { formatDate } from '../utils/calendar';
import { IconTask, IconX } from './Icons';

interface TaskPanelProps {
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

// 呼吸灯颜色逻辑 — 使用 CSS 变量适配明暗主题
function getBreathingColor(task: Log): string {
  const today = formatDate(new Date());
  if (task.status === 'completed' || task.completed === 1) return 'var(--text-tertiary)';
  if (task.status === 'in_progress') return 'var(--breath-blue)';
  if (task.date < today) return 'var(--breath-red)';
  if (task.priority === 2) return 'var(--breath-red)';
  if (task.priority === 1) return 'var(--breath-yellow)';
  return 'var(--breath-green)';
}

function getStatusLabel(task: Log): string {
  const today = formatDate(new Date());
  if (task.status === 'completed' || task.completed === 1) return '已完成';
  if (task.status === 'in_progress') return '处理中';
  if (task.date < today) return '已逾期';
  return '待处理';
}

function getStatusColor(task: Log): string {
  if (task.status === 'completed' || task.completed === 1) return 'var(--text-tertiary)';
  if (task.status === 'in_progress') return 'var(--breath-blue)';
  if (task.date < new Date().toISOString().split('T')[0]) return 'var(--breath-red)';
  return 'var(--color-primary-strong)';
}

function getTagClass(priority: number): string {
  if (priority === 2) return 'pink';
  if (priority === 1) return 'beige';
  return 'mint';
}

export default function TaskPanel({ open, onClose, onRefresh }: TaskPanelProps) {
  const [tasks, setTasks] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.tasks.listAll();
      data.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.start_time || '').localeCompare(b.start_time || '');
      });
      setTasks(data);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) { fetchTasks(); setSelectedIds(new Set()); }
  }, [open, fetchTasks]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === tasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tasks.map(t => t.id)));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    setBatchConfirmOpen(true); // 状态驱动确认，确保不会跳过
  };

  const execBatchDelete = async () => {
    setBatchConfirmOpen(false);
    setLoading(true);
    const ids = [...selectedIds];
    let deleted = 0;
    for (const id of ids) {
      try { await api.logs.delete(id); deleted++; } catch {}
    }
    setSelectedIds(new Set());
    setLoading(false);
    onRefresh();
    fetchTasks();
  };

  const cancelBatchDelete = () => {
    setBatchConfirmOpen(false);
  };

  const handleProcess = async (id: string) => {
    try {
      await api.tasks.updateStatus(id, 'in_progress');
      onRefresh();
      fetchTasks();
    } catch {}
  };

  const handleComplete = async (id: string) => {
    try {
      await api.tasks.updateStatus(id, 'completed');
      await api.logs.update(id, { completed: 1, status: 'completed' });
      onRefresh();
      fetchTasks();
    } catch {}
  };

  if (!open) return null;

  return (<>
    {/* 批量删除确认弹窗 */}
    {batchConfirmOpen && (
      <div className="modal-overlay" onClick={cancelBatchDelete} style={{ zIndex: 10000 }}>
        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 380, padding: 24 }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>确认删除</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
            确定要删除选中的 <strong style={{ color: 'var(--breath-red)' }}>{selectedIds.size}</strong> 个任务？此操作不可撤销。
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={cancelBatchDelete} className="btn btn-secondary" style={{ padding: '6px 20px' }}>取消</button>
            <button onClick={execBatchDelete} style={{ background: 'var(--breath-red)', color: 'var(--text-inverse)', border: 'none', padding: '6px 20px', borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>确认删除</button>
          </div>
        </div>
      </div>
    )}
    <div className="side-panel-overlay" onClick={onClose} />
    <div className="side-panel side-panel-right">
      {/* Header */}
      <div className="side-panel-header">
        <div className="panel-title-group">
          <IconTask size={18} className="panel-icon" />
          <span className="panel-title">任务栏</span>
          <span className="panel-badge">{tasks.length} 任务</span>
        </div>
        <button className="side-panel-close" onClick={onClose} aria-label="关闭"><IconX size={16} /></button>
      </div>

      {/* Task List */}
      <div className="side-panel-body">
        {/* 批量操作栏 */}
        {tasks.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 2px 10px', borderBottom: '1px solid var(--border-light)', marginBottom: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 0, userSelect: 'none' }}>
              <input type="checkbox" checked={selectedIds.size === tasks.length && tasks.length > 0} onChange={toggleSelectAll} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              全选
            </label>
            {selectedIds.size > 0 && (
              <button
                onClick={handleBatchDelete}
                disabled={loading}
                style={{
                  marginLeft: 'auto',
                  padding: '4px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--breath-red)',
                  background: 'rgba(239,68,68,0.1)',
                  color: 'var(--breath-red)',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                删除选中 ({selectedIds.size})
              </button>
            )}
          </div>
        )}
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
            加载中...
          </div>
        )}
        {!loading && tasks.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
            <p style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>暂无任务</p>
            <p style={{ fontSize: '0.72rem', marginTop: 4, color: 'var(--text-secondary)' }}>通过 AI 对话创建任务，或在日志编辑中将日志标记为任务</p>
          </div>
        )}
        {!loading && tasks.length > 0 && (
          <div className="task-timeline">
            {tasks.map((task) => {
              const breathColor = getBreathingColor(task);
              const statusLabel = getStatusLabel(task);
              const statusColor = getStatusColor(task);
              const isDone = task.status === 'completed' || task.completed === 1;

              return (
                <div key={task.id} className={`task-card${isDone ? ' done' : ''}`}>
                  {/* 复选框 + 呼吸灯 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(task.id)}
                      onChange={() => toggleSelect(task.id)}
                      style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
                      onClick={e => e.stopPropagation()}
                    />
                    <div
                      className="task-breath-dot"
                      style={{
                        background: breathColor,
                        color: breathColor,
                        animation: breathColor !== 'var(--text-tertiary)' ? 'breathingLight 2s ease-in-out infinite' : 'none',
                      }}
                    />
                    {/* 标题行 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                      <span style={{
                        fontSize: '0.85rem', fontWeight: 600,
                        color: isDone ? 'var(--text-tertiary)' : 'var(--text-primary)',
                        textDecoration: isDone ? 'line-through' : 'none',
                        flex: 1,
                      }}>
                        {task.title}
                      </span>
                      <span className={`task-tag ${getTagClass(task.priority)}`}>
                        {PRIORITY_LABELS[task.priority]}
                      </span>
                    </div>
                  </div>

                  {/* 详情 */}
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                    {task.date} {task.start_time && `⏰ ${task.start_time}`}
                    {task.end_time && ` - ${task.end_time}`}
                  </div>
                  {task.content && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: 8, lineHeight: 1.4 }}>
                      {task.content.length > 80 ? task.content.slice(0, 80) + '…' : task.content}
                    </div>
                  )}

                  {/* 状态标签 + 操作按钮 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: '0.65rem', padding: '2px 10px', borderRadius: 'var(--radius-full)',
                      background: `${statusColor}14`, color: statusColor, fontWeight: 600,
                    }}>
                      {statusLabel}
                    </span>
                    <div style={{ flex: 1 }} />
                    {!isDone && task.status !== 'in_progress' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleProcess(task.id); }}
                        className="btn btn-sm btn-primary"
                      >
                        处理
                      </button>
                    )}
                    {task.status === 'in_progress' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleComplete(task.id); }}
                        className="btn btn-sm btn-success"
                      >
                        完成
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  </>);
}
