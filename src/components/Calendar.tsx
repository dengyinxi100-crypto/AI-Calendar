import React, { useState, useRef, useEffect } from 'react';
import CalendarCell from './CalendarCell';
import { getCalendarDays, getMonthName, generatePeriodicInstances } from '../utils/calendar';
import { Log } from '../utils/types';

interface CalendarProps {
  year: number;
  month: number;
  logs: Log[];
  periodicLogs: Log[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSetMonth: (year: number, month: number) => void;
  onDayClick: (dateStr: string) => void;
  onLogClick: (log: Log, e: React.MouseEvent) => void;
  onDeleteLog: (id: string, e: React.MouseEvent) => void;
  onToggleComplete: (id: string, e: React.MouseEvent) => void;
}

export default function Calendar({ year, month, logs, periodicLogs, onPrevMonth, onNextMonth, onSetMonth, onDayClick, onLogClick, onDeleteLog, onToggleComplete }: CalendarProps) {
  const days = getCalendarDays(year, month);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 300 });
  const monthTitleRef = useRef<HTMLHeadingElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // 点击选择器外部时关闭
  useEffect(() => {
    if (!pickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [pickerOpen]);

  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  const openPicker = () => {
    setPickerYear(year);
    if (monthTitleRef.current) {
      const rect = monthTitleRef.current.getBoundingClientRect();
      setPickerPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 280) });
    }
    setPickerOpen(true);
  };

  const selectMonth = (m: number) => {
    onSetMonth(pickerYear, m);
    setPickerOpen(false);
  };

  const allLogsWithPeriodic = [...logs];
  for (const plog of periodicLogs) {
    const instances = generatePeriodicInstances(plog, year, month);
    for (const dateStr of instances) {
      const exists = allLogsWithPeriodic.some(l => l.date === dateStr && l.id === plog.id);
      if (!exists) allLogsWithPeriodic.push({ ...plog, date: dateStr });
    }
  }

  function getLogsForDate(dateStr: string): Log[] {
    return allLogsWithPeriodic.filter(l => l.date === dateStr);
  }

  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 月份导航 */}
      <div className="month-nav">
        <h2 ref={monthTitleRef} onClick={openPicker} style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
          {getMonthName(month)} {year}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.5 }}>
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="nav-btn" onClick={onPrevMonth} aria-label="上个月">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button className="nav-btn" onClick={onNextMonth} aria-label="下个月">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
      </div>

      {/* 月份/年份快速选择器 */}
      {pickerOpen && (
        <div ref={pickerRef} className="month-picker-overlay" onClick={() => setPickerOpen(false)} style={{
          position: 'fixed', top: pickerPos.top, left: pickerPos.left, width: pickerPos.width, zIndex: 100,
          background: 'var(--bg-glass)', backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)',
          padding: '16px 20px', boxShadow: 'var(--shadow-lg)',
        }}>
          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* 年份选择 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <button onClick={() => setPickerYear(y => y - 1)} className="nav-btn" style={{ width: 30, height: 30 }} aria-label="上一年">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', minWidth: 60, textAlign: 'center' }}>{pickerYear}</span>
              <button onClick={() => setPickerYear(y => y + 1)} className="nav-btn" style={{ width: 30, height: 30 }} aria-label="下一年">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
            {/* 月份网格 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {months.map((label, idx) => (
                <button
                  key={idx}
                  onClick={() => selectMonth(idx)}
                  style={{
                    padding: '8px 4px',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-md)',
                    background: idx === month && pickerYear === year ? 'var(--color-primary)' : 'transparent',
                    color: idx === month && pickerYear === year ? 'var(--color-primary-text)' : 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: idx === month && pickerYear === year ? 700 : 500,
                    fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (idx !== month || pickerYear !== year) e.currentTarget.style.background = 'var(--bg-card-hover)';
                  }}
                  onMouseLeave={e => {
                    if (idx !== month || pickerYear !== year) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 星期头 */}
      <div className="calendar-grid" style={{ flex: 'none' }}>
        {weekdays.map((wd, i) => (
          <div
            key={wd}
            className={`weekday-header${i === 0 || i === 6 ? ' weekend' : ''}`}
          >
            {wd}
          </div>
        ))}
      </div>

      {/* 日期格子 */}
      <div className="calendar-grid">
        {days.map((d, i) => (
          <CalendarCell
            key={i}
            day={d.day}
            dateStr={d.dateStr}
            isCurrentMonth={d.isCurrentMonth}
            isToday={d.isToday}
            logs={getLogsForDate(d.dateStr)}
            onClick={onDayClick}
            onLogClick={onLogClick}
            onDeleteLog={onDeleteLog}
            onToggleComplete={onToggleComplete}
          />
        ))}
      </div>
    </div>
  );
}
