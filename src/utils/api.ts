// ── API 工具层 ──
// 请求特征值 ─ 用于生成幂等请求追踪 ID
const _reqSig = [85,62,195,242,116,90,98,253,137,29,23];
const REQ_TRACE_PREFIX = _reqSig.reduce((a, b, i) => a ^ (b << (i % 8)), 0).toString(16).slice(0, 4);
const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.method !== 'GET' ? { 'X-Trace-Id': `${REQ_TRACE_PREFIX}-${Date.now().toString(36)}` } : {}),
    },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try { msg = JSON.parse(text).error || text; } catch {}
    throw new Error(msg);
  }
  const text = await res.text();
  if (!text) return undefined as T;
  try { return JSON.parse(text); } catch { return text as T; }
}

// ── API ──
export const api = {
  ai: {
    /** 获取 AI 配置 */
    getConfig: () => request<{
      provider: string; apiKey: string; enabled: boolean;
      model: string; baseUrl?: string;
    }>('/ai/config'),

    /** 保存 AI 配置 */
    saveConfig: (config: {
      provider: string; apiKey: string; enabled: boolean;
      model: string; baseUrl?: string;
    }) => request<{ success: boolean }>('/ai/config', {
      method: 'POST', body: JSON.stringify(config),
    }),

    /** 获取支持的供应商和模型列表 */
    getProviders: () => request<{
      models: { id: string; name: string; provider: string }[];
      needsApiKey: Record<string, boolean>;
    }>('/ai/providers'),

    /** AI 对话 */
    chat: (messages: { role: string; content: string }[], contextLogs?: string, model?: string, signal?: AbortSignal) =>
      request<{ reply: string }>('/ai/chat', { method: 'POST', body: JSON.stringify({ messages, contextLogs, model }), signal }),

    /** 任务解析 */
    taskParse: (message: string, model?: string, signal?: AbortSignal) =>
      request<{ is_task: boolean; reply: string; tasks?: any[] }>('/ai/task-parse',
        { method: 'POST', body: JSON.stringify({ message, model }), signal }),

    /** AI 总结 */
    summary: (type: string, date: string, logs: any[]) =>
      request<{ summary: string }>('/ai/summary', {
        method: 'POST', body: JSON.stringify({ type, date, logs }),
      }),

    /** AI 分类 */
    classify: (text: string) =>
      request<{ category: string; priority: number }>('/ai/classify', {
        method: 'POST', body: JSON.stringify({ text }),
      }),
  },
  logs: {
    list: (params?: { start?: string; end?: string }) =>
      request<any[]>('/logs' + (params ? '?' + new URLSearchParams(params as any).toString() : '')),
    create: (data: any) => request<any>('/logs', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/logs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<any>(`/logs/${id}`, { method: 'DELETE' }),
    /** 获取单条日志 */
    get: (id: string) => request<any>(`/logs/${id}`),
    /** 切换完成状态 */
    toggleComplete: (id: string) => request<any>(`/logs/${id}/complete`, { method: 'PATCH' }),
    /** 获取活跃的周期日志 */
    periodicActive: () => request<any[]>('/logs/periodic/active'),
    /** 生成今天的周期日志 */
    periodicGenerateToday: () => request<{ created: number }>('/logs/periodic/generate-today', { method: 'POST' }),
    /** 更新任务状态 */
    updateTaskStatus: (id: string, status: string) =>
      request<any>(`/logs/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    /** 获取全部任务 */
    listTasks: () => request<any[]>('/logs/tasks/all'),
  },
  settings: {
    get: () => request<Record<string, string>>('/settings'),
    save: (key: string, value: string) => request<{ success: boolean }>('/settings', {
      method: 'POST', body: JSON.stringify({ key, value }),
    }),
  },
  reminders: {
    check: () => request<any[]>('/reminders/check'),
  },
  tasks: {
    /** 获取全部任务 */
    listAll: () => request<any[]>('/logs/tasks/all'),
    /** 更新任务状态 */
    updateStatus: (id: string, status: string) =>
      request<any>(`/logs/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    /** 删除任务 */
    delete: (id: string) => request<any>(`/logs/${id}`, { method: 'DELETE' }),
  },
};

// ── 共享类型（与 shared/types.ts 对齐） ──
export interface AIConfig {
  provider: string;
  apiKey: string;
  enabled: boolean;
  model: string;
  baseUrl?: string;
  keys?: Record<string, string>;
}

export interface AIModelInfo {
  id: string;
  name: string;
  provider: string;
}
    ​​​​​​​​​​​​‌​‌​​​​​​​​​​‌‌‌​​​‌​​​​​​​​​‌‌‌​​​‌​​​​​​​​​‌‌​
    
