export interface Log {
  id: string;
  title: string;
  content: string;
  category: LogCategory;
  date: string;
  start_time: string;
  end_time: string;
  is_periodic: number;
  periodic_type: string;
  periodic_value: string;
  reminder_enabled: number;
  reminder_time: string;
  advance_minutes: number;
  completed: number;
  is_task: number;
  priority: number;
  status: TaskStatus;
  ai_summary: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export type TaskPriority = 0 | 1 | 2; // 0=非紧急, 1=次要, 2=紧急
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: '#ef4444',
  in_progress: '#f59e0b',
  completed: '#10b981',
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: '待处理',
  in_progress: '处理中',
  completed: '已完成',
};

/** 状态流转: pending → in_progress → completed → pending */
export const STATUS_NEXT: Record<TaskStatus, TaskStatus> = {
  pending: 'in_progress',
  in_progress: 'completed',
  completed: 'pending',
};

export const PRIORITY_LABELS: Record<number, string> = {
  0: '非紧急',
  1: '次要',
  2: '紧急',
};

export const PRIORITY_COLORS: Record<number, string> = {
  0: '#10b981', // 绿色 -> 非紧急
  1: '#f59e0b', // 黄色 -> 次要
  2: '#ef4444', // 红色 -> 紧急
};

export type LogCategory = 'meeting' | 'task' | 'chore' | 'personal' | 'work' | 'study' | 'health' | 'other';

export const CATEGORY_LABELS: Record<LogCategory, string> = {
  meeting: '会议',
  task: '任务',
  chore: '杂务',
  personal: '个人',
  work: '工作',
  study: '学习',
  health: '健康',
  other: '其他',
};

export const CATEGORY_COLORS: Record<LogCategory, string> = {
  meeting: '#3b82f6',
  task: '#f59e0b',
  chore: '#8b5cf6',
  personal: '#ec4899',
  work: '#10b981',
  study: '#06b6d4',
  health: '#ef4444',
  other: '#64748b',
};

/** 后备颜色池 — 确定性 fallback */
const CATEGORY_FALLBACK = [
  '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899',
  '#10b981', '#06b6d4', '#ef4444', '#64748b',
];

/** 安全获取分类颜色，兼容数据库中非标准 category 值 */
export function getCategoryColor(cat: string | undefined | null): string {
  if (!cat) return '#64748b';
  // 直接匹配
  if (cat in CATEGORY_COLORS) return CATEGORY_COLORS[cat as LogCategory];
  // 中文标签反向查找
  for (const [key, label] of Object.entries(CATEGORY_LABELS)) {
    if (label === cat) return CATEGORY_COLORS[key as LogCategory];
  }
  // 确定性 hash fallback
  let hash = 0;
  for (let i = 0; i < cat.length; i++) hash = ((hash << 5) - hash) + cat.charCodeAt(i);
  return CATEGORY_FALLBACK[Math.abs(hash) % CATEGORY_FALLBACK.length];
}

export type PeriodicType = 'none' | 'daily' | 'workday' | 'weekend' | 'weekly' | 'monthly';
export const PERIODIC_LABELS: Record<PeriodicType, string> = {
  none: '不重复',
  daily: '每天',
  workday: '工作日',
  weekend: '休息日',
  weekly: '每周',
  monthly: '每月',
};

export type SummaryType = 'daily' | 'weekly' | 'monthly';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIConfig {
  apiKey: string;
  enabled: boolean;
}

export interface ReminderToast {
  id: string;
  log: Log;
}

// ── 主题系统 ──
export type ThemeMode = 'light' | 'dark';
export type ThemeColor = 'mist-blue' | 'lavender' | 'mint' | 'milky-apricot' | 'coral-pink';

export interface ThemeConfig {
  mode: ThemeMode;
  color: ThemeColor;
}

export const THEME_COLORS: { key: ThemeColor; label: string; light: string; dark: string; gradient: string }[] = [
  { key: 'mist-blue', label: '雾霾蓝', light: '#D6E4F7', dark: '#89A8D0', gradient: 'linear-gradient(135deg, #B8CEE8, #A0BFE0)' },
  { key: 'lavender', label: '薰衣草紫', light: '#E2D9F3', dark: '#A48FC9', gradient: 'linear-gradient(135deg, #CBB8E8, #B8A0D8)' },
  { key: 'mint', label: '薄荷青', light: '#D4F0EB', dark: '#73BFB2', gradient: 'linear-gradient(135deg, #B0E0D4, #90D0C0)' },
  { key: 'milky-apricot', label: '奶茶杏', light: '#F6E8D9', dark: '#C9A887', gradient: 'linear-gradient(135deg, #E8D0B8, #D8C0A0)' },
  { key: 'coral-pink', label: '珊瑚粉', light: '#F9D8DD', dark: '#D48A98', gradient: 'linear-gradient(135deg, #F0C0C8, #E8A8B4)' },
];

// 任务标签色（适配各主题）
export const TAG_COLORS: Record<ThemeColor, { pink: string; mint: string; beige: string; pinkDark: string; mintDark: string; beigeDark: string }> = {
  'mist-blue': { pink: '#F9E4EB', mint: '#E3F4E9', beige: '#FFF7DD', pinkDark: '#7A5664', mintDark: '#4F705A', beigeDark: '#867858' },
  'lavender': { pink: '#F2E4F0', mint: '#E0F0EB', beige: '#FFF5E8', pinkDark: '#6B5270', mintDark: '#4A6B60', beigeDark: '#82705A' },
  'mint': { pink: '#FAE8EC', mint: '#DFF2EA', beige: '#FFF8E0', pinkDark: '#7A5866', mintDark: '#4D6E58', beigeDark: '#867A5A' },
  'milky-apricot': { pink: '#FAEAEE', mint: '#E5F4EC', beige: '#FEF5E0', pinkDark: '#7C5868', mintDark: '#50705C', beigeDark: '#857858' },
  'coral-pink': { pink: '#FCE8EC', mint: '#E6F5EE', beige: '#FFF7E0', pinkDark: '#7E5A6A', mintDark: '#527260', beigeDark: '#887A5C' },
};
    ​‌​‌​​​​​​​​​‌‌​‌‌​‌​​​​​​​​​‌‌​​​​‌​​​​​​​​​‌‌​‌​​‌​​​​​​​​
    
