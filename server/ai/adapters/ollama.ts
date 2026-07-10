// ── Ollama 适配器（连接本地 Ollama 服务）──
// Ollama 默认运行在 http://localhost:11434
// 支持 OpenAI 兼容的 /v1/chat/completions 端点

import type { ChatMessage, TaskParseResult, Log } from '../../../shared/types.js';
import type { AIAdapterInterface, ChatOptions } from '../adapter.js';

export class OllamaAdapter implements AIAdapterInterface {
  readonly provider = 'ollama' as const;

  private async request(
    baseUrl: string, model: string, messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<string> {
    const url = `${baseUrl || 'http://localhost:11434'}/v1/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2000,
        stream: false,
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama 错误 ${response.status}: ${text.slice(0, 200)}`);
    }

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content?.trim() || '';
  }

  async chat(
    model: string, messages: ChatMessage[], _apiKey: string, baseUrl?: string, options?: ChatOptions
  ): Promise<string> {
    return this.request(baseUrl || '', model, messages, options);
  }

  async classify(model: string, title: string, content: string, _apiKey: string, baseUrl?: string): Promise<string> {
    const result = await this.request(baseUrl || '', model, [
      { role: 'system', content: '你是一个日志分类助手。根据标题和内容将日志分类为：meeting(会议)、task(任务)、chore(杂务)、personal(个人)、work(工作)、study(学习)、health(健康)、other(其他)。只回复一个英文类别名。' },
      { role: 'user', content: `标题：${title}\n内容：${content || '(无)'}` }
    ], { temperature: 0.3, maxTokens: 20 });

    const category = result.toLowerCase().trim();
    const valid = ['meeting', 'task', 'chore', 'personal', 'work', 'study', 'health', 'other'];
    return valid.includes(category) ? category : 'other';
  }

  async summary(model: string, type: string, date: string, logs: Log[], _apiKey: string, baseUrl?: string): Promise<string> {
    const typeLabels: Record<string, string> = { daily: '每日', weekly: '每周', monthly: '每月' };
    const label = typeLabels[type] || type;
    return this.request(baseUrl || '', model, [
      { role: 'system', content: `你是一个日志总结助手。请根据提供的日志数据生成${label}总结。要求：1.概括主要事项 2.分析完成情况 3.给出改进建议 4.统计各分类占比。300字以内，中文。` },
      { role: 'user', content: `日期：${date}\n日志数据：\n${JSON.stringify(logs, null, 2)}` }
    ], { temperature: 0.5, maxTokens: 1000 });
  }

  async taskParse(model: string, message: string, today: string, _apiKey: string, baseUrl?: string): Promise<TaskParseResult> {
    const result = await this.request(baseUrl || '', model, [
      { role: 'system', content: `你是一个智能日程解析助手。请分析用户消息是否为日程/任务创建请求。

返回 JSON（只输出 JSON，不要其他内容）：
{"is_task":true,"reply":"确认回复","tasks":[{"title":"任务名","content":"详细","date":"YYYY-MM-DD","start_time":"HH:MM","end_time":"HH:MM","category":"task","priority":1,"reminder_enabled":false,"reminder_time":"","advance_minutes":0,"is_periodic":0,"periodic_type":"","periodic_value":""}]}

不是任务返回：{"is_task":false,"reply":"回复"}
priority: 1普通 2重要 3紧急。日期默认今天：${today}` },
      { role: 'user', content: message }
    ], { temperature: 0.3, maxTokens: 2000 });

    // 提取 JSON
    let jsonStr = result.trim();
    const cbMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (cbMatch) jsonStr = cbMatch[1].trim();
    const braceStart = jsonStr.indexOf('{');
    if (braceStart > 0) jsonStr = jsonStr.slice(braceStart);

    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed.tasks) parsed.tasks = [];
      if (!Array.isArray(parsed.tasks)) parsed.tasks = [parsed.tasks];
      return parsed;
    } catch {}
    return { is_task: false, reply: result.slice(0, 200) };
  }
}
    ​​‌‌‌​‌​​​​​​​​​​‌‌​​‌​​​​​​​​​​​‌‌​​‌​‌​​​​​​​​​‌‌​‌‌‌​​​​​
    
