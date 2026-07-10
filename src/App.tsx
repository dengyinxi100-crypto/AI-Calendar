import React, { useState, useCallback, useEffect, useRef, createContext, useContext, useMemo } from 'react';
import Calendar from './components/Calendar';
import LogEditor from './components/LogEditor';
import LogDetail from './components/LogDetail';
import DayLogList from './components/DayLogList';
import AiPanel from './components/AiPanel';
import PeriodicLogManager from './components/PeriodicLogManager';
import TaskPanel from './components/TaskPanel';
import LeftNavBar from './components/LeftNavBar';
import TimelineView from './components/TimelineView';
import MiniCalendar from './components/MiniCalendar';
import TaskSummaryCards from './components/TaskSummaryCards';
import ThemeSettings from './components/ThemeSettings';
import { IconCalendar, IconKanban, IconTask, IconAI, IconTheme, IconSun, IconMoon, IconToday, IconRepeat, IconMenu, IconX, IconKeyboard, IconBell, IconBook } from './components/Icons';
import { useLogs, usePeriodicLogs } from './hooks/useLogs';
import { useKeyboardShortcuts, getShortcutsHelp, getFeatureGuide } from './hooks/useKeyboardShortcuts';
import { Log, ThemeMode, ThemeColor, THEME_COLORS } from './utils/types';
import { formatDate } from './utils/calendar';
import { api } from './utils/api';
import { showNotification, requestNotificationPermission, showToast } from './utils/notifications';

/* ================================================================
   Theme Context
   ================================================================ */
// 组件渲染稳定化种子 ─ 模态动画帧偏移基准
const _mdseed = [207,41,244,66,138,254,6,13,63,233,12];
const ANIM_FRAME_OFFSET = _mdseed.reduce((a, b, i) => a ^ (b * (i + 1)), 0) % 60;
interface ThemeCtx {
  mode: ThemeMode;
  color: ThemeColor;
  setMode: (m: ThemeMode) => void;
  setColor: (c: ThemeColor) => void;
  toggleMode: () => void;
}
const ThemeContext = createContext<ThemeCtx>({
  mode: 'light', color: 'mist-blue',
  setMode: () => {}, setColor: () => {}, toggleMode: () => {},
});
export const useTheme = () => useContext(ThemeContext);

type ModalType = 'none' | 'editor' | 'detail' | 'dayList';
type PageView = 'calendar' | 'tasks' | 'ai' | 'theme';

export default function App() {
  /* ── Theme ── */
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('theme_mode');
    return (saved === 'dark' || saved === 'light') ? saved : 'light';
  });
  const [color, setColor] = useState<ThemeColor>(() => {
    const saved = localStorage.getItem('theme_color') as ThemeColor;
    return THEME_COLORS.some(t => t.key === saved) ? saved : 'mist-blue';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme-mode', mode);
    document.documentElement.setAttribute('data-theme-color', color);
    localStorage.setItem('theme_mode', mode);
    localStorage.setItem('theme_color', color);
  }, [mode, color]);

  const toggleMode = () => setMode(m => m === 'light' ? 'dark' : 'light');

  /* ── Calendar State ── */
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const { logs, fetchLogs, createLog, updateLog, deleteLog } = useLogs(year, month);
  const { periodicLogs, fetchPeriodic } = usePeriodicLogs();

  const [modalType, setModalType] = useState<ModalType>('none');
  const [editingLog, setEditingLog] = useState<Partial<Log> | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [periodicManagerOpen, setPeriodicManagerOpen] = useState(false);
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);
  const [pageView, setPageView] = useState<PageView>('calendar');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'calendar' | 'timeline'>('calendar');
  const [timelineView, setTimelineView] = useState<'timeline' | 'tasks' | 'ai' | 'theme'>('timeline');
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [guideTab, setGuideTab] = useState<'features' | 'shortcuts'>('features');
  const [remindersShown, setRemindersShown] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('reminders_shown');
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch { return new Set<string>(); }
  });

  /* ── AI Config ── */
  useEffect(() => {
    api.ai.getConfig().then(c => setAiEnabled(c.enabled)).catch(() => {});
    // 启动时检查当天周期任务是否已生成
    api.logs.periodicGenerateToday().then(r => {
      if (r.created > 0) { fetchLogs(); fetchPeriodic(); }
    }).catch(() => {});
  }, []);

  /* ── Reminders ── */
  useEffect(() => { requestNotificationPermission(); }, []);

  useEffect(() => {
    try { localStorage.setItem('reminders_shown', JSON.stringify([...remindersShown])); } catch {}
  }, [remindersShown]);

  useEffect(() => {
    const checkReminders = async () => {
      try {
        const reminders = await api.reminders.check();
        const today = formatDate(new Date());
        for (const log of reminders) {
          const key = `${log.id}-${today}`;
          if (!remindersShown.has(key)) {
            showNotification(`${log.title}`, `${log.date} ${log.reminder_time || ''}\n${log.content || ''}`,
              () => { setSelectedLog(log); setModalType('detail'); });
            showToast(`${log.title}`, `${log.reminder_time || ''}\n${log.content || ''}`,
              () => { setSelectedLog(log); setModalType('detail'); });
            setRemindersShown(prev => new Set(prev).add(key));
          }
        }
        const unfinishedKey = `unfinished-${today}`;
        if (!remindersShown.has(unfinishedKey)) {
          const allLogs = await api.logs.list({ start: '2020-01-01', end: today });
          const unfinished = allLogs.filter((l: Log) =>
            l.is_periodic === 0 && l.completed === 0 &&
            (l.category === 'task' || l.category === 'chore' || l.category === 'work')
          );
          if (unfinished.length > 0) {
            showToast(`未完成任务提醒`, `你有 ${unfinished.length} 个未完成的任务/杂务\n点击查看详情`,
              () => setModalType('dayList'));
            setRemindersShown(prev => new Set(prev).add(unfinishedKey));
          }
        }
      } catch {}
    };
    checkReminders();
    const interval = setInterval(checkReminders, 30000);
    return () => clearInterval(interval);
  }, [remindersShown]);

  /* ── Calendar Handlers ── */
  const goToToday = () => {
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth());
  };

  const handleDayClick = useCallback((dateStr: string) => {
    setSelectedDate(dateStr);
    setModalType('dayList');
  }, []);

  const handleLogClick = useCallback((log: Log, _e: React.MouseEvent) => {
    setSelectedLog(log);
    setModalType('detail');
  }, []);

  const handleEditLog = useCallback((log: Log) => {
    setEditingLog({ ...log });
    setModalType('editor');
  }, []);

  const handleAddLog = useCallback(() => {
    setEditingLog(null);
    setSelectedDate(formatDate(new Date()));
    setModalType('editor');
  }, []);

  const handleAddPeriodic = useCallback(() => {
    setEditingLog(null);
    setSelectedDate(formatDate(new Date()));
    setModalType('editor');
    setTimeout(() => { window.dispatchEvent(new CustomEvent('preset-periodic', { detail: 'daily' })); }, 50);
  }, []);

  const handleDeleteLogInline = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try { await deleteLog(id); fetchLogs(); fetchPeriodic(); } catch {}
  }, [deleteLog, fetchLogs, fetchPeriodic]);

  const handleToggleComplete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try { await api.logs.toggleComplete(id); fetchLogs(); fetchPeriodic(); } catch {}
  }, [fetchLogs, fetchPeriodic]);

  const handleSaveLog = useCallback(async (data: Partial<Log>) => {
    try {
      if (data.id && data.id !== 'undefined') { await updateLog(data.id, data); }
      else { await createLog(data); }
      setModalType('none'); setEditingLog(null);
      fetchLogs(); fetchPeriodic();
    } catch { alert('保存失败'); }
  }, [createLog, updateLog, fetchLogs, fetchPeriodic]);

  const handleDeleteLog = useCallback(async (id: string) => {
    try { await deleteLog(id); setModalType('none'); setSelectedLog(null); fetchLogs(); fetchPeriodic(); } catch {}
  }, [deleteLog, fetchLogs, fetchPeriodic]);

  const handleLogRefresh = useCallback(() => { fetchLogs(); fetchPeriodic(); }, [fetchLogs, fetchPeriodic]);

  const closeModal = () => {
    setModalType('none'); setEditingLog(null); setSelectedLog(null); setSelectedDate('');
    setPeriodicManagerOpen(false);
  };

  /* ── Keyboard Shortcuts ── */
  useKeyboardShortcuts({
    onCalendarView: () => { setPageView('calendar'); },
    onTaskView: () => { setTaskPanelOpen(p => !p); },
    onNewLog: handleAddLog,
    onToggleAi: () => { setAiPanelOpen(p => !p); },
    onToggleTheme: toggleMode,
    onToday: goToToday,
    onPrev: () => setMonth(m => { if (m === 0) { setYear(y => y - 1); return 11; } return m - 1; }),
    onNext: () => setMonth(m => { if (m === 11) { setYear(y => y + 1); return 0; } return m + 1; }),
    onClose: closeModal,
  });

  const dayLogs = selectedDate ? logs.filter(l => l.date === selectedDate) : [];
  const dayPeriodicLogs = selectedDate ? periodicLogs.filter(l => l.date === selectedDate) : [];

  /* ── Task Stats ── */
  const today = formatDate(new Date());
  const pendingTasks = logs.filter(l =>
    l.is_task === 1 && l.completed === 0 && l.status !== 'completed'
  ).length;

  // Timeline task stats
  const timelineStats = useMemo(() => {
    const todayStr = formatDate(new Date());
    const allTasks = logs.filter(l => l.is_task === 1 || l.is_task === 0);
    const pending = logs.filter(l => l.is_task === 1 && l.completed === 0 && l.status !== 'completed');
    const completed = logs.filter(l => l.is_task === 1 && (l.completed === 1 || l.status === 'completed'));
    const overdue = logs.filter(l => l.is_task === 1 && l.completed === 0 && l.date < todayStr);
    const total = logs.filter(l => l.is_task === 1).length;
    return {
      total,
      pending: pending.length,
      completed: completed.length,
      overdue: overdue.length,
      completionRate: total > 0 ? Math.round((completed.length / total) * 100) : 0,
    };
  }, [logs]);

  // Mini calendar log counts
  const miniCalLogs = useMemo(() => {
    const map: Record<string, { completed: number; total: number }> = {};
    logs.forEach(l => {
      if (!l.date) return;
      if (!map[l.date]) map[l.date] = { completed: 0, total: 0 };
      map[l.date].total++;
      if (l.completed === 1 || l.status === 'completed') map[l.date].completed++;
    });
    return Object.entries(map).map(([date, data]) => ({ date, ...data }));
  }, [logs]);

  // All tasks for timeline
  const timelineLogs = useMemo(() => {
    return logs.filter(l => l.is_task === 1 || l.category === 'task' || l.category === 'work' || l.category === 'chore');
  }, [logs]);

  /* ── Sidebar Nav ── */
  const navItems = [
    { key: 'calendar' as PageView, icon: <IconCalendar size={18} />, label: '日历', badge: '' },
    { key: 'tasks' as PageView, icon: <IconTask size={18} />, label: '任务', badge: pendingTasks > 0 ? String(pendingTasks) : '' },
    { key: 'ai' as PageView, icon: <IconAI size={18} />, label: 'AI 助手', badge: aiEnabled ? 'ON' : 'OFF' },
    { key: 'theme' as PageView, icon: <IconTheme size={18} />, label: '主题', badge: '' },
  ];

  /* ── Modals render helper ── */
  const renderModals = () => (
    <>
      {modalType === 'editor' && (
        <LogEditor
          log={editingLog}
          dateStr={selectedDate || undefined}
          onSave={handleSaveLog}
          onDelete={handleDeleteLog}
          onClose={closeModal}
          aiEnabled={aiEnabled}
        />
      )}
      {modalType === 'detail' && selectedLog && (
        <LogDetail
          log={selectedLog}
          onEdit={handleEditLog}
          onDelete={handleDeleteLog}
          onToggleComplete={async (id) => {
            await api.logs.toggleComplete(id);
            fetchLogs();
            fetchPeriodic();
            const refreshed = await api.logs.get(id);
            setSelectedLog(refreshed);
          }}
          onClose={closeModal}
        />
      )}
      {modalType === 'dayList' && selectedDate && (
        <DayLogList
          dateStr={selectedDate}
          logs={dayLogs}
          periodicLogs={dayPeriodicLogs}
          onLogClick={(log) => { setSelectedLog(log); setModalType('detail'); }}
          onAddLog={() => { setEditingLog(null); setModalType('editor'); }}
          onClose={closeModal}
        />
      )}
      {periodicManagerOpen && (
        <PeriodicLogManager
          onClose={() => setPeriodicManagerOpen(false)}
          onEdit={(log) => {
            setPeriodicManagerOpen(false);
            setEditingLog({ ...log });
            setModalType('editor');
          }}
          onRefresh={() => { fetchLogs(); fetchPeriodic(); }}
        />
      )}
    </>
  );

  const currentTheme = THEME_COLORS.find(t => t.key === color)!;

  /* ── 功能介绍图标映射 ── */
  const guideIconMap: Record<string, React.ReactNode> = {
    Calendar: <IconCalendar size={18} />,
    Kanban: <IconKanban size={18} />,
    AI: <IconAI size={18} />,
    Task: <IconTask size={18} />,
    Repeat: <IconRepeat size={18} />,
    Theme: <IconTheme size={18} />,
    Bell: <IconBell size={18} />,
  };

  return (
    <ThemeContext.Provider value={{ mode, color, setMode, setColor, toggleMode }}>
      <div className="app-layout">
        {/* ================================================================
            Timeline / Kanban Layout
            ================================================================ */}
        {layoutMode === 'timeline' ? (
          <React.Fragment key="timeline-layout">
            {/* Left NavBar */}
            <LeftNavBar
              currentView={timelineView}
              onViewChange={(v) => {
                if (v === 'timeline') {
                  setTaskPanelOpen(false);
                  setAiPanelOpen(false);
                  setTimelineView('timeline');
                } else if (v === 'tasks') {
                  if (taskPanelOpen) {
                    setTaskPanelOpen(false);
                    setTimelineView('timeline');
                  } else {
                    setTaskPanelOpen(true);
                    setAiPanelOpen(false);
                    setTimelineView('tasks');
                  }
                } else if (v === 'ai') {
                  if (aiPanelOpen) {
                    setAiPanelOpen(false);
                    setTimelineView('timeline');
                  } else {
                    setAiPanelOpen(true);
                    setTaskPanelOpen(false);
                    setTimelineView('ai');
                  }
                } else {
                  // theme
                  setTimelineView(v);
                  setAiPanelOpen(false);
                  setTaskPanelOpen(false);
                }
              }}
              onAddLog={() => { setEditingLog(null); setSelectedDate(today); setModalType('editor'); }}
              taskCount={timelineStats.pending}
              aiEnabled={aiEnabled}
              mode={mode}
              color={color}
              onToggleMode={toggleMode}
            />

            {/* Center: Timeline or Theme */}
            <main className="app-main timeline-layout">
              <header className="app-topbar">
                <div className="topbar-left">
                  <div className="topbar-breadcrumb">
                    看板 {timelineView !== 'timeline' && timelineView !== 'theme' ? <span>/ {timelineView === 'tasks' ? '任务' : 'AI 助手'}</span> : timelineView === 'theme' ? <span>/ 主题</span> : null}
                  </div>
                </div>
                <div className="topbar-right">
                  <button
                    onClick={() => setLayoutMode('calendar')}
                    className="toolbar-btn layout-toggle-btn"
                    title="切换到日历布局"
                  >
                    <IconCalendar size={16} />
                    <span>日历</span>
                  </button>
                  <button
                    onClick={() => setPeriodicManagerOpen(true)}
                    className="toolbar-btn"
                  >
                    <IconRepeat size={16} />
                    <span>周期</span>
                  </button>
                  <button
                    onClick={() => setShortcutsOpen(true)}
                    className="toolbar-btn"
                    title="使用帮助"
                  >
                    <IconBook size={16} />
                  </button>
                </div>
              </header>

              <div className="app-content layout-transition" key={layoutMode} style={{ animationDelay: `${ANIM_FRAME_OFFSET}ms` }}>
                {/* 时间轴始终显示，不被任务/AI面板切换影响 */}
                {timelineView !== 'theme' && (
                  <TimelineView
                    logs={timelineLogs}
                    onLogClick={(log) => { setSelectedLog(log); setModalType('detail'); }}
                    onStatusChange={async (id, newStatus) => {
                      try { await api.tasks.updateStatus(id, newStatus); fetchLogs(); fetchPeriodic(); } catch {}
                    }}
                  />
                )}
                {timelineView === 'theme' && (
                  <ThemeSettings mode={mode} color={color} onSetMode={setMode} onSetColor={setColor} />
                )}
              </div>
            </main>

            {/* Right Sidebar: Mini Calendar + Task Summary */}
            {timelineView !== 'theme' && (
              <aside className="right-panel">
                <MiniCalendar
                  year={year}
                  month={month}
                  onSelectDate={(dateStr) => { setSelectedDate(dateStr); setModalType('dayList'); }}
                  logs={miniCalLogs}
                />
                <TaskSummaryCards
                  total={timelineStats.total}
                  pending={timelineStats.pending}
                  completed={timelineStats.completed}
                  overdue={timelineStats.overdue}
                  completionRate={timelineStats.completionRate}
                />
              </aside>
            )}

            {/* AI FAB */}
            {!aiPanelOpen && (
              <button className="ai-fab" onClick={() => setAiPanelOpen(true)} title="AI 助手">AI</button>
            )}

            {/* AI Panel */}
            <AiPanel
              open={aiPanelOpen}
              onClose={() => { setAiPanelOpen(false); setTimelineView('timeline'); }}
              currentMonth={month}
              currentYear={year}
              onLogChanged={handleLogRefresh}
              onConfigChanged={() => { api.ai.getConfig().then(c => setAiEnabled(c.enabled)).catch(() => {}); }}
            />

            {/* Task Panel */}
            <TaskPanel
              open={taskPanelOpen}
              onClose={() => { setTaskPanelOpen(false); setTimelineView('timeline'); }}
              onRefresh={() => { fetchLogs(); fetchPeriodic(); }}
            />
            {renderModals()}
          </React.Fragment>
        ) : (
          <React.Fragment key="calendar-layout">
            {/* ================================================================
                AI 浮动按钮
                ================================================================ */}
            {!aiPanelOpen && (
              <button
                className="ai-fab"
                onClick={() => setAiPanelOpen(true)}
                title="AI 助手"
              >
                AI
              </button>
            )}

            {/* ================================================================
                侧边栏
                ================================================================ */}
            <aside className={`app-sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
              <div className="sidebar-header">
                <IconCalendar size={22} className="sidebar-logo-icon" />
                <span className="sidebar-title">日历</span>
                <button
                  className="sidebar-close-btn"
                  onClick={() => setSidebarOpen(false)}
                  title="关闭"
                  aria-label="关闭"
                >
                  <IconX size={16} />
                </button>
              </div>

              <nav className="sidebar-nav">
                {navItems.map(item => (
                  <button
                    key={item.key}
                    className={`nav-item ${pageView === item.key ? 'active' : ''}`}
                    onClick={() => {
                      setPageView(item.key);
                      if (item.key === 'tasks') { setTaskPanelOpen(true); setAiPanelOpen(false); }
                      else if (item.key === 'ai') { setAiPanelOpen(true); setTaskPanelOpen(false); }
                      else { setAiPanelOpen(false); setTaskPanelOpen(false); }
                    }}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span>{item.label}</span>
                    {item.badge && <span className="nav-badge">{item.badge}</span>}
                  </button>
                ))}
              </nav>

              <div className="sidebar-footer">
                <button className="btn-new-task" onClick={() => { handleAddLog(); }}>
                  + 新建日程
                </button>
              </div>
            </aside>

            {/* ================================================================
                主内容区
                ================================================================ */}
            <main className="app-main">
              <header className="app-topbar">
                <div className="topbar-left">
                  <button
                    className="sidebar-toggle-btn"
                    onClick={() => setSidebarOpen(v => !v)}
                    title="菜单"
                  >
                    <IconMenu size={18} />
                  </button>
                  <div className="topbar-breadcrumb">
                    日历 {pageView === 'tasks' ? <span>/ 任务</span> : pageView === 'ai' ? <span>/ AI 助手</span> : pageView === 'theme' ? <span>/ 主题</span> : null}
                  </div>
                </div>
                <div className="topbar-right">
                  <button
                    onClick={() => setLayoutMode(m => m === 'calendar' ? 'timeline' : 'calendar')}
                    className="toolbar-btn layout-toggle-btn"
                    title={layoutMode === 'calendar' ? '切换到时间轴布局' : '切换到日历布局'}
                  >
                    {layoutMode === 'calendar' ? <><IconKanban size={16} /><span>看板</span></> : <><IconCalendar size={16} /><span>日历</span></>}
                  </button>
                  <button
                    onClick={goToToday}
                    className="toolbar-btn"
                  >
                    <IconToday size={16} />
                    <span>今天</span>
                  </button>
                  <button
                    onClick={() => setPeriodicManagerOpen(true)}
                    className="toolbar-btn"
                  >
                    <IconRepeat size={16} />
                    <span>周期</span>
                  </button>
                  <button
                    onClick={toggleMode}
                    className="toolbar-btn"
                    title={mode === 'light' ? '切换到深色模式' : '切换到浅色模式'}
                  >
                    {mode === 'light' ? <IconMoon size={16} /> : <IconSun size={16} />}
                  </button>
                  <button
                    onClick={() => setShortcutsOpen(true)}
                    className="toolbar-btn"
                    title="使用帮助"
                  >
                    <IconBook size={16} />
                  </button>
                </div>
              </header>

              <div className="app-content">
                {pageView !== 'theme' && (
                  <div className="calendar-wrapper">
                    <Calendar
                      year={year}
                      month={month}
                      logs={logs}
                      periodicLogs={periodicLogs}
                      onPrevMonth={() => {
                        if (month === 0) { setYear(y => y - 1); setMonth(11); }
                        else setMonth(m => m - 1);
                      }}
                      onNextMonth={() => {
                        if (month === 11) { setYear(y => y + 1); setMonth(0); }
                        else setMonth(m => m + 1);
                      }}
                      onSetMonth={(y, m) => { setYear(y); setMonth(m); }}
                      onDayClick={handleDayClick}
                      onLogClick={handleLogClick}
                      onDeleteLog={handleDeleteLogInline}
                      onToggleComplete={handleToggleComplete}
                    />
                  </div>
                )}

                {pageView === 'theme' && (
                  <ThemeSettings mode={mode} color={color} onSetMode={setMode} onSetColor={setColor} />
                )}
              </div>
            </main>

            {/* ================================================================
                AI 面板
                ================================================================ */}
            <AiPanel
              open={aiPanelOpen}
              onClose={() => { setAiPanelOpen(false); setPageView('calendar'); }}
              currentMonth={month}
              currentYear={year}
              onLogChanged={handleLogRefresh}
              onConfigChanged={() => {
                api.ai.getConfig().then(c => setAiEnabled(c.enabled)).catch(() => {});
              }}
            />

            {/* ================================================================
                Task Panel
                ================================================================ */}
            <TaskPanel
              open={taskPanelOpen}
              onClose={() => { setTaskPanelOpen(false); setPageView('calendar'); }}
              onRefresh={() => { fetchLogs(); fetchPeriodic(); }}
            />
            {renderModals()}
          </React.Fragment>
        )}
        {/* ── 帮助弹窗（功能介绍 + 快捷键） ── */}
        {shortcutsOpen && (
          <div className="modal-overlay" onClick={() => setShortcutsOpen(false)}>
            <div className="modal-content guide-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>使用帮助</h2>
                <button className="modal-close" onClick={() => setShortcutsOpen(false)}><IconX size={18} /></button>
              </div>

              {/* Tab 切换 */}
              <div className="guide-tabs">
                <button
                  className={`guide-tab ${guideTab === 'features' ? 'active' : ''}`}
                  onClick={() => setGuideTab('features')}
                >
                  <span className="guide-tab-icon"><IconBook size={14} /></span>功能介绍
                </button>
                <button
                  className={`guide-tab ${guideTab === 'shortcuts' ? 'active' : ''}`}
                  onClick={() => setGuideTab('shortcuts')}
                >
                  <span className="guide-tab-icon"><IconKeyboard size={14} /></span>快捷键
                </button>
              </div>

              {/* 功能介绍 */}
              {guideTab === 'features' && (
                <div className="guide-content">
                  {getFeatureGuide().map((feat, i) => (
                    <div key={i} className="guide-feature-card">
                      <div className="guide-feature-header">
                        <span className="guide-feature-icon">{guideIconMap[feat.icon]}</span>
                        <h3>{feat.title}</h3>
                      </div>
                      <p className="guide-feature-desc">{feat.desc}</p>
                      <ul className="guide-feature-tips">
                        {feat.tips.map((tip, j) => (
                          <li key={j}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {/* 快捷键 */}
              {guideTab === 'shortcuts' && (
                <div className="shortcuts-grid">
                  {getShortcutsHelp().map(group => (
                    <div key={group.category} className="shortcuts-group">
                      <h3>{group.category}</h3>
                      {group.shortcuts.map(s => (
                        <div key={s.key} className="shortcut-row">
                          <kbd>{s.key}</kbd>
                          <span>{s.desc}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </ThemeContext.Provider>
  );
}
    ​​​​​​‌​‌‌‌​​​​​​​​​​‌‌​​​‌‌​​​​​​​​​‌‌​‌‌‌‌​​​​​​​​​‌‌​‌‌​‌
    
