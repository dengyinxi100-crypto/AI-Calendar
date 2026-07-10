import React, { useState } from 'react';
import { Log, getCategoryColor } from '../utils/types';

interface CalendarCellProps {
  day: number;
  dateStr: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  logs: Log[];
  onClick: (dateStr: string) => void;
  onLogClick: (log: Log, e: React.MouseEvent) => void;
  onDeleteLog: (id: string, e: React.MouseEvent) => void;
  onToggleComplete: (id: string, e: React.MouseEvent) => void;
}

const STATUS_DOT: Record<string, string> = {
  pending: '#DC2626',
  in_progress: '#D97706',
  completed: '#16A34A',
};

const MAX_DOTS = 4;

export default function CalendarCell({ day, dateStr, isCurrentMonth, isToday, logs, onClick, onLogClick, onDeleteLog, onToggleComplete }: CalendarCellProps) {
  const visibleLogs = logs.slice(0, MAX_DOTS);
  const hiddenCount = logs.length - MAX_DOTS;
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const cellClass = [
    'calendar-cell',
    !isCurrentMonth && 'other-month',
    isToday && 'today',
    logs.length > 0 && 'has-logs',
  ].filter(Boolean).join(' ');

  return (
    <button className={cellClass} onClick={() => onClick(dateStr)} aria-label={`查看 ${dateStr} 的日程`}>
      {/* 日期数字 - AI-main 风格居中圆形 */}
      <span className="date-number">
        {day}
      </span>

      {/* 任务小圆点 - AI-main 风格 */}
      {logs.length > 0 && (
        <div className="log-dots">
          {visibleLogs.map((log, i) => {
            const isOverdue = dateStr < todayStr && !log.completed;
            const dotColor = log.completed
              ? STATUS_DOT.completed
              : isOverdue
                ? STATUS_DOT.pending
                : (log.status === 'in_progress'
                    ? STATUS_DOT.in_progress
                    : (log.is_task === 1 ? STATUS_DOT.pending : getCategoryColor(log.category)));

            return (
              <button
                key={log.id}
                className="log-dot"
                style={{ background: dotColor }}
                onClick={(e) => { e.stopPropagation(); onLogClick(log, e); }}
                title={`${log.start_time ? log.start_time + ' ' : ''}${log.title}${log.completed ? ' (已完成)' : ''}`}
                aria-label={`查看 ${log.title}`}
              />
            );
          })}
          {hiddenCount > 0 && (
            <button className="log-dot-more" onClick={(e) => { e.stopPropagation(); onClick(dateStr); }} aria-label={`查看剩余 ${hiddenCount} 项`}>
              +{hiddenCount}
            </button>
          )}
        </div>
      )}
    </button>
  );
}
