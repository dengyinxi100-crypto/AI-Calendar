// ── 前后端共享类型定义 ──

// ── 日志/任务核心类型 ──
export type LogCategory = 'meeting' | 'task' | 'chore' | 'personal' | 'work' | 'study' | 'health' | 'other';
export type TaskPriority = 0 | 1 | 2;
export type TaskStatus = 'pending' | 'in_progress' | 'completed';
export type PeriodicType = 'none' | 'daily' | 'workday' | 'weekend' | 'weekly' | 'monthly';
export type SummaryType = 'daily' | 'weekly' | 'monthly';

export interface Log {
  id: string;
  title: string;
  content: string;
  category: string;
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
  status: string;
  ai_summary: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface CreateLogInput {
  title: string;
  content?: string;
  category?: string;
  date: string;
  start_time?: string;
  end_time?: string;
  is_periodic?: number;
  periodic_type?: string;
  periodic_value?: string;
  reminder_enabled?: number;
  reminder_time?: string;
  advance_minutes?: number;
  completed?: number;
  ai_summary?: string;
  color?: string;
  is_task?: number;
  priority?: number;
  status?: string;
}

export interface UpdateLogInput {
  title?: string;
  content?: string;
  category?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  is_periodic?: number;
  periodic_type?: string;
  periodic_value?: string;
  reminder_enabled?: number;
  reminder_time?: string;
  advance_minutes?: number;
  completed?: number;
  ai_summary?: string;
  color?: string;
  is_task?: number;
  priority?: number;
  status?: string;
}

// ── AI 相关类型 ──

/** AI 模型供应商 */
export type AIProvider =
  | 'deepseek'
  | 'openai'
  | 'anthropic'
  | 'glm'
  | 'qwen'
  | 'ollama';

/** AI 配置 */
export interface AIConfig {
  provider: AIProvider;
  apiKey: string;               // 当前 provider 的 key（后端 resolve）
  enabled: boolean;
  model: string;
  baseUrl?: string;             // 自定义 API 端点（兼容代理/中转，仅 Ollama 使用）
  keys?: Record<string, string>; // 所有 provider 的 Key 映射（前端维护，后端持久化）
}

/** 聊天消息 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** AI 任务解析结果 */
export interface TaskParseItem {
  title: string;
  content: string;
  date: string;
  start_time: string;
  end_time: string;
  category: string;
  priority: number;
  reminder_enabled: boolean;
  reminder_time: string;
  advance_minutes: number;
  is_periodic: number;
  periodic_type: string;
  periodic_value: string;
}

export interface TaskParseResult {
  is_task: boolean;
  reply: string;
  tasks?: TaskParseItem[];
}

/** AI 提供商模型列表 */
export interface AIModelInfo {
  id: string;
  name: string;
  provider: AIProvider;
}

// ── 统一适配器接口 ──
export interface AIAdapterOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface AIAdapter {
  provider: AIProvider;
  chat(model: string, messages: ChatMessage[], options?: AIAdapterOptions): Promise<string>;
  classify(model: string, title: string, content: string): Promise<string>;
  summary(model: string, type: string, date: string, logs: Log[]): Promise<string>;
  taskParse(model: string, message: string, today: string): Promise<TaskParseResult>;
}

// ── 主题类型 ──
export type ThemeMode = 'light' | 'dark';
export type ThemeColor = 'mist-blue' | 'lavender' | 'mint' | 'milky-apricot' | 'coral-pink';

export interface ThemeConfig {
  mode: ThemeMode;
  color: ThemeColor;
}

// ── 常量映射 ──
export const CATEGORY_LABELS: Record<string, string> = {
  meeting: '会议', task: '任务', chore: '杂务', personal: '个人',
  work: '工作', study: '学习', health: '健康', other: '其他',
};

export const STATUS_LABELS: Record<string, string> = {
  pending: '待处理', in_progress: '处理中', completed: '已完成',
};

export const PRIORITY_LABELS: Record<number, string> = {
  0: '非紧急', 1: '次要', 2: '紧急',
};

export const PERIODIC_LABELS: Record<string, string> = {
  none: '不重复', daily: '每天', workday: '工作日',
  weekend: '休息日', weekly: '每周', monthly: '每月',
};

/** 可用的在线模型列表 */
export const AVAILABLE_MODELS: AIModelInfo[] = [
  // DeepSeek
  { id: 'deepseek-chat', name: 'DeepSeek V3 (快速)', provider: 'deepseek' },
  { id: 'deepseek-reasoner', name: 'DeepSeek R1 (深度推理)', provider: 'deepseek' },
  // OpenAI
  { id: 'gpt-4o', name: 'GPT-4o (全能)', provider: 'openai' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini (经济)', provider: 'openai' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai' },
  // Anthropic
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (快速)', provider: 'anthropic' },
  // GLM (智谱)
  { id: 'glm-4-plus', name: 'GLM-4 Plus', provider: 'glm' },
  { id: 'glm-4-flash', name: 'GLM-4 Flash (免费)', provider: 'glm' },
  // Qwen (通义千问)
  { id: 'qwen-plus', name: 'Qwen Plus', provider: 'qwen' },
  { id: 'qwen-max', name: 'Qwen Max', provider: 'qwen' },
  { id: 'qwen-turbo', name: 'Qwen Turbo (快速)', provider: 'qwen' },
];

/** AI 供应商 API 端点 */
export const PROVIDER_ENDPOINTS: Record<AIProvider, string> = {
  deepseek: 'https://api.deepseek.com/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  glm: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  ollama: 'http://localhost:11434/v1/chat/completions',
};

/** 是否需要 API Key 才能使用 */
export const PROVIDER_NEEDS_API_KEY: Record<string, boolean> = {
  deepseek: true,
  openai: true,
  anthropic: true,
  glm: true,
  qwen: true,
  ollama: false,
};
