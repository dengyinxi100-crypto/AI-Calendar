import React from 'react';
import { THEME_COLORS } from '../utils/types';
import { IconKanban, IconTask, IconAI, IconTheme, IconCalendar, IconSun, IconMoon, IconPlus } from './Icons';

interface LeftNavBarProps {
  currentView: 'timeline' | 'tasks' | 'ai' | 'theme';
  onViewChange: (v: 'timeline' | 'tasks' | 'ai' | 'theme') => void;
  onAddLog: () => void;
  taskCount: number;
  aiEnabled: boolean;
  mode: 'light' | 'dark';
  color: string;
  onToggleMode: () => void;
}

const LeftNavBar: React.FC<LeftNavBarProps> = ({
  currentView, onViewChange, onAddLog, taskCount, aiEnabled, mode, color, onToggleMode,
}) => {
  const currentTheme = THEME_COLORS.find(t => t.key === color)!;

  const navItems = [
    { key: 'timeline' as const, icon: <IconKanban size={18} />, label: '看板' },
    { key: 'tasks' as const, icon: <IconTask size={18} />, label: '任务', badge: taskCount > 0 ? String(taskCount) : '' },
    { key: 'ai' as const, icon: <IconAI size={18} />, label: 'AI 助手', badge: aiEnabled ? 'ON' : 'OFF' },
    { key: 'theme' as const, icon: <IconTheme size={18} />, label: '主题' },
  ];

  return (
    <aside className="left-navbar">
      {/* Logo */}
      <div className="left-nav-logo" style={{
        background: currentTheme.gradient,
      }}>
        <IconCalendar size={20} className="left-nav-logo-icon" />
        <span className="left-nav-logo-text">AI 日历</span>
      </div>

      {/* Navigation */}
      <nav className="left-nav-menu">
        {navItems.map(item => (
          <button
            key={item.key}
            className={`left-nav-item ${currentView === item.key ? 'active' : ''}`}
            onClick={() => onViewChange(item.key)}
            title={item.label}
          >
            <span className="left-nav-item-icon">{item.icon}</span>
            <span className="left-nav-item-label">{item.label}</span>
            {item.badge && <span className={`left-nav-badge ${item.badge === 'OFF' ? 'off' : ''}`}>{item.badge}</span>}
          </button>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="left-nav-footer">
        <button className="left-nav-add-btn" onClick={onAddLog} title="新建日程" aria-label="新建日程">
          <IconPlus size={22} />
        </button>
        <button className="left-nav-toggle-btn" onClick={onToggleMode} title={mode === 'light' ? '深色模式' : '浅色模式'} aria-label="切换深浅色模式">
          {mode === 'light' ? <IconMoon size={18} /> : <IconSun size={18} />}
        </button>
      </div>
    </aside>
  );
};

export default LeftNavBar;
