export interface CalendarDay {
  year: number;
  month: number;
  day: number;
  dateStr: string;
  isCurrentMonth: boolean;
  isToday: boolean;
}

export function getCalendarDays(year: number, month: number): CalendarDay[] {
  const days: CalendarDay[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // 当月第一天是星期几（0=周日）
  const startDayOfWeek = firstDay.getDay();

  // 填充上个月末的日期
  const prevLastDay = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = prevLastDay - i;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({
      year: month === 0 ? year - 1 : year,
      month: month === 0 ? 11 : month - 1,
      day: d,
      dateStr: dateStr.startsWith('-') ? dateStr : `${month === 0 ? year - 1 : year}-${String(month === 0 ? 12 : month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
    });
  }

  // 填充当前月日期
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({
      year,
      month,
      day: d,
      dateStr,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
    });
  }

  // 填充下个月初日期，填满6行
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    const nextMonth = month + 2 > 12 ? 1 : month + 2;
    const nextYear = month + 2 > 12 ? year + 1 : year;
    const dateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({
      year: nextYear,
      month: nextMonth - 1,
      day: d,
      dateStr,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
    });
  }

  return days;
}

export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getMonthName(month: number): string {
  const names = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  return names[month];
}

export function getWeekdayName(day: number): string {
  const names = ['日', '一', '二', '三', '四', '五', '六'];
  return names[day];
}

// 检查某个日期是否符合周期规则
export function matchesPeriodicRule(
  periodicType: string,
  periodicValue: string,
  originalDate: string,
  checkDate: string
): boolean {
  const check = new Date(checkDate + 'T00:00:00');
  const orig = new Date(originalDate + 'T00:00:00');

  if (check < orig) return false;
  if (checkDate === originalDate) return false; // 原日期不需要重复

  switch (periodicType) {
    case 'daily':
      return true;
    case 'workday':
      return check.getDay() >= 1 && check.getDay() <= 5;
    case 'weekend':
      return check.getDay() === 0 || check.getDay() === 6;
    case 'weekly': {
      // periodic_value 存储星期几 (0-6)
      const targetDay = parseInt(periodicValue);
      return check.getDay() === targetDay;
    }
    case 'monthly': {
      // periodic_value 存储几号 (1-31)
      const targetDate = parseInt(periodicValue);
      return check.getDate() === targetDate;
    }
    default:
      return false;
  }
}

// 生成周期日志的虚拟实例
export function generatePeriodicInstances(
  periodicLog: { date: string; periodic_type: string; periodic_value: string },
  year: number,
  month: number
): string[] {
  const instances: string[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let d = 1; d <= daysInMonth; d++) {
    const checkDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (matchesPeriodicRule(periodicLog.periodic_type, periodicLog.periodic_value, periodicLog.date, checkDate)) {
      instances.push(checkDate);
    }
  }

  return instances;
}
    ​‌‌​‌‌​​‌‌‌‌‌‌‌‌​​​‌‌​‌​​​​​​​​​​‌‌​​‌​​​​​​​​​​​‌‌‌‌​​‌​​​​
    
