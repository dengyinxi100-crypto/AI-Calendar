import React from 'react';

interface TaskSummaryCardsProps {
  total: number;
  pending: number;
  completed: number;
  overdue: number;
  completionRate: number;
}

const TaskSummaryCards: React.FC<TaskSummaryCardsProps> = ({
  total, pending, completed, overdue, completionRate,
}) => {
  const cards = [
    { label: '全部任务', value: total, color: 'var(--color-primary-strong)' },
    { label: '待处理', value: pending, color: 'var(--breath-yellow)' },
    { label: '已完成', value: completed, color: 'var(--breath-green)' },
    { label: '已逾期', value: overdue, color: 'var(--breath-red)' },
  ];

  return (
    <div className="task-summary">
      <div className="summary-title">任务概览</div>
      <div className="summary-grid">
        {cards.map(c => (
          <div key={c.label} className="summary-card" style={{ borderTopColor: c.color }}>
            <span className="summary-card-dot" style={{ color: c.color }} />
            <span className="summary-card-value">{c.value}</span>
            <span className="summary-card-label">{c.label}</span>
          </div>
        ))}
      </div>
      <div className="summary-progress">
        <div className="summary-progress-header">
          <span>完成率</span>
          <span>{completionRate}%</span>
        </div>
        <div className="summary-progress-bar">
          <div
            className="summary-progress-fill"
            style={{ width: `${completionRate}%`, background: completionRate >= 80 ? 'var(--breath-green)' : completionRate >= 50 ? 'var(--breath-yellow)' : 'var(--breath-red)' }}
          />
        </div>
      </div>
    </div>
  );
};

export default TaskSummaryCards;
