import React, { useMemo, useState } from 'react';
import { Log, CATEGORY_LABELS, PRIORITY_LABELS, getCategoryColor, STATUS_COLORS, STATUS_LABELS, STATUS_NEXT, TaskStatus } from '../utils/types';
import { formatDate } from '../utils/calendar';
import { IconChevronLeft, IconChevronRight, IconChevronUp, IconChevronDown, IconCheck } from './Icons';

interface TimelineViewProps {
  logs: Log[];
  onLogClick: (log: Log) => void;
  onStatusChange: (id: string, newStatus: TaskStatus) => void;
}

/** 收拢状态下各列的固定颜色 */
const COLUMN_FIXED_COLORS: Record<ColumnKey, string> = {
  overdue: '#ef4444',
  today: '#f59e0b',
  tomorrow: '#3b82f6',
  week: '#06b6d4',
  later: '#64748b',
};

/** 计算一列日志的主导状态色 */
function columnStatusColor(logs: Log[]): string {
  const tasks = logs.filter(l => l.is_task === 1);
  if (tasks.length === 0) return '#94a3b8';
  const statuses = tasks.map(t => (t.status || 'pending') as TaskStatus);
  if (statuses.some(s => s === 'pending')) return STATUS_COLORS.pending;
  if (statuses.some(s => s === 'in_progress')) return STATUS_COLORS.in_progress;
  return STATUS_COLORS.completed;
}

type ColumnKey = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later';

interface Column {
  key: ColumnKey;
  label: string;
  icon: string;
  logs: Log[];
}

const today = formatDate(new Date());
const tomorrow = formatDate(new Date(Date.now() + 86400000));
const weekEnd = formatDate(new Date(Date.now() + 7 * 86400000));

const getColumnKey = (date: string): ColumnKey => {
  if (date < today) return 'overdue';
  if (date === today) return 'today';
  if (date === tomorrow) return 'tomorrow';
  if (date <= weekEnd) return 'week';
  return 'later';
};

const COLUMN_ORDER: ColumnKey[] = ['overdue', 'today', 'tomorrow', 'week', 'later'];

const TimelineView: React.FC<TimelineViewProps> = ({ logs, onLogClick, onStatusChange }) => {
  /** 某列是否有未完成的任务 */
  const hasActiveTasks = (logs: Log[]) => logs.some(l => l.is_task === 1 && l.status !== 'completed' && !l.completed);

  // 智能默认展开：今日优先，有逾期同步展开，否则依次后推（仅展开有未完成任务或非任务日志的列，纯已完成列不展开）
  const [expandedColumns, setExpandedColumns] = useState<Set<ColumnKey>>(() => {
    const grouped: Record<ColumnKey, Log[]> = { overdue: [], today: [], tomorrow: [], week: [], later: [] };
    logs.forEach(l => { const k = getColumnKey(l.date); if (k) grouped[k].push(l); });
    const set = new Set<ColumnKey>();
    const seq: ColumnKey[] = ['today','overdue','tomorrow','week','later'];
    // today 有未完成任务或非任务日志才展开
    if (grouped.today.some(l => l.is_task !== 1 || (l.status !== 'completed' && !l.completed))) {
      set.add('today');
    }
    // 逾期有未完成任务才展开
    if (hasActiveTasks(grouped.overdue)) set.add('overdue');
    // 如果 today 和 overdue 都未展开，则找到第一个有未完成任务或非任务日志的列展开
    if (!set.has('today') && !set.has('overdue')) {
      for (const k of seq) {
        if (grouped[k].some(l => l.is_task !== 1 || (l.status !== 'completed' && !l.completed))) {
          set.add(k); break;
        }
      }
    }
    return set;
  });
  // Card stack expansion per column (collapsed = stacked by default)
  const [expandedStacks, setExpandedStacks] = useState<Set<ColumnKey>>(new Set());

  const toggleColumn = (key: ColumnKey) => {
    setExpandedColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleStack = (key: ColumnKey) => {
    setExpandedStacks(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const columns = useMemo((): Column[] => {
    const grouped: Record<ColumnKey, Log[]> = {
      overdue: [], today: [], tomorrow: [], week: [], later: [],
    };

    logs.forEach(log => {
      if (!log.date) return;
      const key = getColumnKey(log.date);
      grouped[key].push(log);
    });

    const sortFn = (a: Log, b: Log) => {
      if (a.is_task !== b.is_task) return (b.is_task || 0) - (a.is_task || 0);
      if (a.priority !== b.priority) return (b.priority || 0) - (a.priority || 0);
      return (a.start_time || '').localeCompare(b.start_time || '');
    };

    Object.keys(grouped).forEach(k => grouped[k as ColumnKey].sort(sortFn));

    const overdueHasDanger = grouped.overdue.some(l => l.is_task === 1 && (l.status === 'pending' || l.status === 'in_progress'));

    return [
      { key: 'overdue', label: '逾期', dotColor: overdueHasDanger ? '#ef4444' : columnStatusColor(grouped.overdue), hasTasks: grouped.overdue.some(l => l.is_task === 1), danger: overdueHasDanger, logs: grouped.overdue },
      { key: 'today', label: '今天', dotColor: columnStatusColor(grouped.today), hasTasks: grouped.today.some(l => l.is_task === 1), logs: grouped.today },
      { key: 'tomorrow', label: '明天', dotColor: columnStatusColor(grouped.tomorrow), hasTasks: grouped.tomorrow.some(l => l.is_task === 1), logs: grouped.tomorrow },
      { key: 'week', label: '本周', dotColor: columnStatusColor(grouped.week), hasTasks: grouped.week.some(l => l.is_task === 1), logs: grouped.week },
      { key: 'later', label: '稍后', dotColor: columnStatusColor(grouped.later), hasTasks: grouped.later.some(l => l.is_task === 1), logs: grouped.later },
    ];
  }, [logs]);

  const renderCard = (log: Log) => {
    const st: TaskStatus = log.completed ? 'completed' : (log.status || 'pending') as TaskStatus;
    const stColor = STATUS_COLORS[st];
    return (
    <div
      key={log.id}
      className={`timeline-card ${log.completed ? 'completed' : ''} ${log.is_task ? 'is-task' : ''}`}
      style={log.is_task ? { borderLeftColor: stColor, ['--breath' as any]: stColor, animation: st !== 'completed' ? 'cardBreath 2.5s ease-in-out infinite' : 'none', animationDelay: st !== 'completed' ? `${Math.random() * 1.5}s` : '0s' } : undefined}
      onClick={() => onLogClick(log)}
    >
      <div className="timeline-card-top">
        <span className="timeline-card-title">{log.title}</span>
      </div>
      {log.is_task === 1 && (
        <div className="timeline-card-meta">
          {log.priority !== undefined && (
            <span className={`timeline-priority p${log.priority}`}>
              {PRIORITY_LABELS[log.priority]}
            </span>
          )}
          <span className={`timeline-status s-${st}`} style={{ color: stColor }}>
            {STATUS_LABELS[st]}
          </span>
        </div>
      )}
      {log.start_time && (
        <div className="timeline-card-time">
          {log.start_time}{log.end_time ? ` - ${log.end_time}` : ''}
        </div>
      )}
      {log.is_task === 1 && st !== 'completed' && (
        <button
          className="timeline-status-btn"
          style={{ borderColor: stColor, color: stColor }}
          onClick={(e) => { e.stopPropagation(); onStatusChange(log.id!, STATUS_NEXT[st]); }}
          title={`当前: ${STATUS_LABELS[st]} → 点击切换`}
        >
          {'处理'}
        </button>
      )}
    </div>
  );};

  return (
    <div className="timeline-board">
      {COLUMN_ORDER.map(key => {
        const col = columns.find(c => c.key === key)!;
        const isExpanded = expandedColumns.has(key);
        const count = col.logs.length;

        return (
          <div
            key={key}
            className={`timeline-col-wrapper col-${key} ${isExpanded ? 'expanded' : 'collapsed'}`}
          >
            {/* Left toggle bar */}
            <button
              className="timeline-col-toggle"
              onClick={() => toggleColumn(key)}
              title={isExpanded ? `收拢 ${col.label}` : `展开 ${col.label}`}
            >
              {isExpanded ? (
                <span className="col-toggle-arrow"><IconChevronLeft size={14} /></span>
              ) : (
                <>
                  <span className="col-toggle-dot" style={{ background: count === 0 ? '#94a3b8' : col.dotColor, ...(col.hasTasks ? { ['--breath' as any]: col.dotColor, animation: 'toggleDotBreath 2.5s ease-in-out infinite' } : {}) }} />
                  <span className="col-toggle-label">{col.label}</span>
                  <span className={`col-toggle-count${col.danger ? ' danger' : ''}`}>{count}</span>
                  <span className="col-toggle-arrow"><IconChevronRight size={14} /></span>
                </>
              )}
            </button>

            {/* Column content */}
            <div className={`timeline-column col-${col.key}`}>
              <div className="timeline-col-header">
                <span className="col-header-dot" style={{ background: count === 0 ? '#94a3b8' : col.dotColor, ...(col.hasTasks ? { ['--breath' as any]: col.dotColor, animation: 'toggleDotBreath 2.5s ease-in-out infinite' } : {}) }} />
                <span className="timeline-col-title">{col.label}</span>
                <span className="timeline-col-count">{count}</span>
              </div>
              <div className="timeline-col-body">
                {count === 0 && (
                  <div className="timeline-empty">暂无任务</div>
                )}
                {count === 1 && renderCard(col.logs[0])}
                {count > 1 && (() => {
                  const stackExpanded = expandedStacks.has(key);
                  return (
                    <>
                      {/* 堆叠状态：显示切换栏 + 数字；展开状态：只显示收拢按钮 */}
                      {stackExpanded ? (
                        <button
                          className="timeline-stack-toggle expanded"
                          onClick={() => toggleStack(key)}
                          title="收拢卡片"
                        >
                          <span className="stack-toggle-arrow"><IconChevronUp size={14} /></span>
                        </button>
                      ) : (
                        <button
                          className="timeline-stack-toggle collapsed"
                          onClick={() => toggleStack(key)}
                          title="展开卡片"
                        >
                          <span className="stack-toggle-count">{count} 张卡片</span>
                          <span className="stack-toggle-arrow"><IconChevronDown size={14} /></span>
                        </button>
                      )}
                      <div className={`timeline-stack ${stackExpanded ? 'expanded' : 'collapsed'}`}>
                        <div className="timeline-stack-cards">
                          {col.logs.map((log, i) => (
                            <div
                              key={log.id}
                              className="timeline-stack-card-wrapper"
                              style={{
                                '--stack-index': i,
                                '--stack-total': count,
                              } as React.CSSProperties}
                            >
                              {renderCard(log)}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TimelineView;
