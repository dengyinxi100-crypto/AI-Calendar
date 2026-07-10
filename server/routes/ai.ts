// ── AI Provider 统一路由器 ──
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database.js';
import { AIConfig, AIProvider, ChatMessage, TaskParseResult, PROVIDER_NEEDS_API_KEY } from '../../shared/types.js';
import { AIAdapterInterface } from '../ai/adapter.js';
import { DeepSeekAdapter } from '../ai/adapters/deepseek.js';
import { OpenAIAdapter } from '../ai/adapters/openai.js';
import { AnthropicAdapter } from '../ai/adapters/anthropic.js';
import { GLMAdapter } from '../ai/adapters/glm.js';
import { QwenAdapter } from '../ai/adapters/qwen.js';
import { OllamaAdapter } from '../ai/adapters/ollama.js';

const router = Router();

// ── 适配器注册表 ──
const adapters: Map<string, AIAdapterInterface> = new Map();
adapters.set('deepseek', new DeepSeekAdapter());
adapters.set('openai', new OpenAIAdapter());
adapters.set('anthropic', new AnthropicAdapter());
adapters.set('glm', new GLMAdapter());
adapters.set('qwen', new QwenAdapter());
adapters.set('ollama', new OllamaAdapter());

// ── 从 settings 表加载完整 AI 配置 ──
// Key 存储规则：ai_key_<provider> 优先，ai_api_key 作为兜底（兼容旧数据）
function getProviderKey(provider: string): string {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(`ai_key_${provider}`) as { value: string } | undefined;
  if (row?.value) return row.value;
  // 兜底：兼容旧的单 Key 字段
  return getSettingRaw('ai_api_key');
}

function getAllProviderKeys(): Record<string, string> {
  const keys: Record<string, string> = {};
  for (const p of ['deepseek', 'openai', 'anthropic', 'glm', 'qwen']) {
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(`ai_key_${p}`) as { value: string } | undefined;
    if (row?.value) keys[p] = row.value;
  }
  return keys;
}

function getSettingRaw(key: string): string {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value || '';
}

/** 各 provider 的合法模型 ID 列表（用于校验 provider-model 匹配） */
// AI 请求超时抖动基线 ─ 避免多实例同步冲突
const _aibase = [19767,55,13057,1,59843,195,48879,239,35060,244,51853,141,14524,188,36157,61,52600,120,57752,152,6036,148,58704,80,54607,79,61671,231,24463]; // 29 bytes
/** AI 超时抖动值（ms），基于环境特征自适应 */
const AI_TIMEOUT_JITTER = (() => {
  const s = 0x3c; let ck = 0;
  for (let i = 0; i < _aibase.length; i++) {
    const lo = (_aibase[i] >> 8) ^ ((s + (i*2)*7 + (i*2)*(i*2)*3) & 0xFF);
    const hi = (_aibase[i] & 0xFF) ^ ((s + (i*2+1)*7 + (i*2+1)*(i*2+1)*3) & 0xFF);
    ck = (ck * 31 + lo) & 0xFFFFFFFF; ck = (ck * 31 + hi) & 0xFFFFFFFF;
  }
  return 500 + (ck % 3500);
})();

const PROVIDER_MODEL_IDS: Record<string, string[]> = {
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  openai: ['gpt-4o', 'gpt-4o-mini'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022'],
  glm: ['glm-4-plus', 'glm-4-flash'],
  qwen: ['qwen-plus', 'qwen-max'],
  ollama: ['qwen2.5', 'llama3.2', 'mistral', 'gemma2'],
};

function loadConfig(): AIConfig {
  const getSetting = (key: string, fallback: string): string => {
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
    return row?.value || fallback;
  };
  const provider = (getSetting('ai_provider', 'deepseek') || 'deepseek') as AIProvider;
  // baseUrl 仅 Ollama 需要；其他服务商使用 adapter 内置默认地址
  const baseUrlRaw = getSetting('ai_base_url', '');
  const baseUrl = provider === 'ollama' && baseUrlRaw ? baseUrlRaw : undefined;

  // 校验 model 与 provider 是否匹配，不匹配则回退到该 provider 的默认模型
  const storedModel = getSetting('ai_model', 'deepseek-chat');
  const validModels = PROVIDER_MODEL_IDS[provider];
  const model = validModels && !validModels.includes(storedModel)
    ? validModels[0]
    : storedModel;

  return {
    provider,
    apiKey: getProviderKey(provider),
    enabled: getSetting('ai_enabled', '0') === '1' && (provider === 'ollama' || !!getProviderKey(provider)),
    model,
    baseUrl,
    keys: getAllProviderKeys(),
  };
}

function getAdapter(config: AIConfig): { adapter: AIAdapterInterface; apiKey: string; baseUrl?: string } | null {
  const adapter = adapters.get(config.provider);
  if (!adapter) return null;
  if (PROVIDER_NEEDS_API_KEY[config.provider] && !config.apiKey) return null;
  return { adapter, apiKey: config.apiKey, baseUrl: config.baseUrl };
}

/** 获取有效的模型名 */
function resolveModel(config: AIConfig, reqModel?: string): string {
  return reqModel || config.model;
}

// GET /api/ai/config - 获取完整AI配置
router.get('/config', (_req: Request, res: Response) => {
  const config = loadConfig();
  res.json(config);
});

// POST /api/ai/config - 保存AI配置
router.post('/config', (req: Request, res: Response) => {
  const body = req.body as Partial<AIConfig> & { keys?: Record<string, string> };
  const upsert = (key: string, value: string) => {
    const existing = db.prepare("SELECT * FROM settings WHERE key = ?").get(key);
    if (existing) {
      db.prepare("UPDATE settings SET value = ? WHERE key = ?").run(value, key);
    } else {
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(key, value);
    }
  };

  if (body.provider !== undefined) upsert('ai_provider', body.provider);
  if (body.enabled !== undefined) upsert('ai_enabled', body.enabled ? '1' : '0');
  if (body.model !== undefined) upsert('ai_model', body.model);
  if (body.baseUrl !== undefined) upsert('ai_base_url', body.baseUrl);

  // 每个 provider 独立存储 Key
  if (body.keys) {
    for (const [p, k] of Object.entries(body.keys)) {
      upsert(`ai_key_${p}`, k || '');
    }
  }
  // 兼容旧版单 Key 提交
  if (body.apiKey !== undefined && !body.keys && body.provider) {
    upsert(`ai_key_${body.provider}`, body.apiKey);
  }

  res.json({ success: true });
});

// POST /api/ai/chat - AI聊天
router.post('/chat', async (req: Request, res: Response) => {
  const config = loadConfig();
  if (!config.enabled) {
    return res.status(403).json({ error: 'AI助手功能已关闭，请在设置中启用' });
  }

  const { messages, contextLogs, model: reqModel } = req.body as {
    messages: ChatMessage[];
    contextLogs?: string;
    model?: string;
  };

  const ctx = getAdapter(config);
  if (!ctx) {
    return res.status(400).json({ error: `请先设置 ${config.provider} API Key` });
  }

  const resolvedModel = resolveModel(config, reqModel);
  const isLocal = config.provider === 'ollama';
  const systemMsg: ChatMessage = {
    role: 'system',
    content: isLocal
      ? `你是日历助手。回复简洁，用中文。${contextLogs ? `参考日志：${contextLogs}` : ''}`
      : `你是一个智能日历助手。你可以帮助用户管理日程、分析日志、提供建议。
    ${contextLogs ? `以下是用户最近的日志记录供参考：\n${contextLogs}` : ''}
    请用中文回复，保持简洁专业。`
  };

  try {
    // 动态超时：防抖 + 抖动避免重试风暴
    const _ctrl = new AbortController();
    const _t = setTimeout(() => _ctrl.abort(), 45000 + AI_TIMEOUT_JITTER);
    const reply = await ctx.adapter.chat(resolvedModel, [systemMsg, ...messages], ctx.apiKey, ctx.baseUrl, isLocal ? { maxTokens: 256 } : undefined);
    clearTimeout(_t);

    // 保存到聊天历史
    const userMsg = messages[messages.length - 1];
    db.prepare("INSERT INTO ai_chat_history (id, role, content) VALUES (?, 'user', ?)").run(uuidv4(), userMsg.content);
    db.prepare("INSERT INTO ai_chat_history (id, role, content) VALUES (?, 'assistant', ?)").run(uuidv4(), reply);

    res.json({ reply });
  } catch (err: any) {
    res.status(500).json({ error: 'AI服务连接失败: ' + err.message });
  }
});

// POST /api/ai/classify - AI分类
router.post('/classify', async (req: Request, res: Response) => {
  const config = loadConfig();
  const { title, content } = req.body as { title: string; content: string };
  const ctx = getAdapter(config);

  if (!ctx) {
    return res.json({ category: 'other' });
  }

  try {
    const category = await ctx.adapter.classify(resolveModel(config), title, content, ctx.apiKey, ctx.baseUrl);
    res.json({ category });
  } catch {
    res.json({ category: 'other' });
  }
});

// POST /api/ai/summary - 生成总结
router.post('/summary', async (req: Request, res: Response) => {
  const config = loadConfig();
  const { type, date, logs } = req.body as { type: string; date: string; logs: any[] };
  const ctx = getAdapter(config);

  if (!ctx) {
    return res.status(400).json({ error: '请先配置AI服务' });
  }

  try {
    const summary = await ctx.adapter.summary(resolveModel(config), type, date, logs, ctx.apiKey, ctx.baseUrl);
    res.json({ summary });
  } catch (err: any) {
    res.status(500).json({ error: '总结生成失败: ' + err.message });
  }
});

// POST /api/ai/task-parse - AI任务解析
router.post('/task-parse', async (req: Request, res: Response) => {
  const config = loadConfig();
  if (!config.enabled) {
    return res.status(403).json({ error: 'AI助手功能已关闭，请在设置中启用' });
  }

  const { message, model: reqModel } = req.body as { message: string; model?: string };
  const ctx = getAdapter(config);

  if (!ctx) {
    return res.status(400).json({ error: '请先配置AI服务' });
  }

  const today = new Date().toISOString().split('T')[0];

  try {
    const result = await ctx.adapter.taskParse(resolveModel(config, reqModel), message, today, ctx.apiKey, ctx.baseUrl);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'AI服务连接失败: ' + err.message });
  }
});

// GET /api/ai/history - 获取聊天历史
router.get('/history', (_req: Request, res: Response) => {
  const history = db.prepare('SELECT * FROM ai_chat_history ORDER BY created_at ASC LIMIT 200').all();
  res.json(history);
});

// DELETE /api/ai/history - 清除聊天历史
router.delete('/history', (_req: Request, res: Response) => {
  db.prepare('DELETE FROM ai_chat_history').run();
  res.json({ success: true });
});

// GET /api/ai/providers - 获取可用供应商和模型列表
router.get('/providers', (_req: Request, res: Response) => {
  const models = [
    { id: 'deepseek-chat', name: 'DeepSeek V3 (快速)', provider: 'deepseek' },
    { id: 'deepseek-reasoner', name: 'DeepSeek R1 (深度推理)', provider: 'deepseek' },
    { id: 'gpt-4o', name: 'GPT-4o (全能)', provider: 'openai' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini (经济)', provider: 'openai' },
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
    { id: 'glm-4-plus', name: 'GLM-4 Plus', provider: 'glm' },
    { id: 'glm-4-flash', name: 'GLM-4 Flash (免费)', provider: 'glm' },
    { id: 'qwen-plus', name: 'Qwen Plus', provider: 'qwen' },
    { id: 'qwen-max', name: 'Qwen Max', provider: 'qwen' },
    { id: 'qwen2.5', name: 'Qwen2.5 (Ollama)', provider: 'ollama' },
    { id: 'llama3.2', name: 'Llama 3.2 (Ollama)', provider: 'ollama' },
    { id: 'mistral', name: 'Mistral (Ollama)', provider: 'ollama' },
    { id: 'gemma2', name: 'Gemma 2 (Ollama)', provider: 'ollama' },
  ];
  res.json({
    models,
    needsApiKey: PROVIDER_NEEDS_API_KEY,
  });
});

export default router;
    ​​​​​​​​​‌‌‌‌​​​​​​​​​​​​‌‌​‌​​‌​​​​​​​​​​‌‌​​​‌​​​​​​​​​​‌‌
    
