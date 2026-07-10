import React, { useMemo, useState, useEffect, useRef } from 'react';
import { getCalendarDays, getMonthName } from '../utils/calendar';

interface MiniCalendarProps {
  year: number;
  month: number;
  onSelectDate?: (dateStr: string) => void;
  logs: { date: string; completed: number; total: number }[];
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

const MiniCalendar: React.FC<MiniCalendarProps> = ({ year, month, onSelectDate, logs }) => {
  const [miniYear, setMiniYear] = useState(year);
  const [miniMonth, setMiniMonth] = useState(month);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);
  const pickerRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

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

  // 点击日历外部时取消日期选中
  useEffect(() => {
    if (!selectedDate) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setSelectedDate(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedDate]);

  const days = useMemo(() => getCalendarDays(miniYear, miniMonth), [miniYear, miniMonth]);
  const today = new Date().toISOString().split('T')[0];

  const logMap = useMemo(() => {
    const map: Record<string, { completed: number; total: number }> = {};
    logs.forEach(l => {
      if (!map[l.date]) map[l.date] = { completed: 0, total: 0 };
      map[l.date].completed += l.completed;
      map[l.date].total += l.total;
    });
    return map;
  }, [logs]);

  const openPicker = () => {
    setPickerYear(miniYear);
    setPickerOpen(true);
  };

  const selectMonth = (m: number) => {
    setMiniYear(pickerYear);
    setMiniMonth(m);
    setPickerOpen(false);
  };

  const goToToday = () => {
    const now = new Date();
    setMiniYear(now.getFullYear());
    setMiniMonth(now.getMonth());
    setSelectedDate(today);
    if (onSelectDate) onSelectDate(today);
  };

  return (
    <div className="mini-calendar" ref={calendarRef}>
      <div className="mini-cal-header">
        <button aria-label="上个月" onClick={() => {
          if (miniMonth === 0) { setMiniYear(y => y - 1); setMiniMonth(11); }
          else setMiniMonth(m => m - 1);
        }}>‹</button>
        <span onClick={openPicker}>
          {getMonthName(miniMonth)} {miniYear}
        </span>
        <button aria-label="下个月" onClick={() => {
          if (miniMonth === 11) { setMiniYear(y => y + 1); setMiniMonth(0); }
          else setMiniMonth(m => m + 1);
        }}>›</button>
      </div>

      {/* 月份/年份快速选择器 */}
      {pickerOpen && (
        <div
          ref={pickerRef}
          className="mini-month-picker"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          {/* 年份选择 */}
          <div className="picker-year-row">
            <button aria-label="上一年" onClick={() => setPickerYear(y => y - 1)}>‹</button>
            <span>{pickerYear}</span>
            <button aria-label="下一年" onClick={() => setPickerYear(y => y + 1)}>›</button>
          </div>
          {/* 月份网格 */}
          <div className="picker-month-grid">
            {MONTHS.map((label, idx) => (
              <button
                key={idx}
                className={`picker-month-btn ${idx === miniMonth && pickerYear === miniYear ? 'current' : ''}`}
                onClick={() => selectMonth(idx)}
              >
                {label}
              </button>
            ))}
          </div>
          {/* 回到今天 */}
          <button className="picker-today-btn" onClick={() => { selectMonth(new Date().getMonth()); setPickerYear(new Date().getFullYear()); }}>
            回到今天
          </button>
        </div>
      )}

      <div className="mini-cal-weekdays">
        {WEEKDAYS.map(d => <span key={d}>{d}</span>)}
      </div>

      <div className="mini-cal-grid">
        {days.map((day, i) => {
          const dateStr = `${day.year}-${String(day.month + 1).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`;
          const isToday = dateStr === today;
          const isCurMonth = day.month === miniMonth;
          const isSelected = dateStr === selectedDate;
          const dayLogs = logMap[dateStr];
          const hasLogs = dayLogs && dayLogs.total > 0;
          const allDone = hasLogs && dayLogs.completed === dayLogs.total;
          const partial = hasLogs && dayLogs.completed > 0 && dayLogs.completed < dayLogs.total;

          return (
            <button
              key={i}
              className={`mini-cal-day ${isToday ? 'today' : ''} ${!isCurMonth ? 'other-month' : ''} ${isSelected ? 'selected' : ''} ${allDone ? 'all-done' : ''} ${partial ? 'partial' : ''}`}
              onClick={() => {
                if (isCurMonth) { setSelectedDate(dateStr); if (onSelectDate) onSelectDate(dateStr); }
              }}
              aria-label={dateStr}
            >
              <span className="mini-day-num">{day.day}</span>
              {hasLogs && <span className="mini-day-dot" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MiniCalendar;
