// ── Anthropic/Claude 适配器 ──
import { ChatMessage, TaskParseResult, Log } from '../../../shared/types.js';
import { AIAdapterInterface, ChatOptions } from '../adapter.js';

const DEFAULT_ENDPOINT = 'https://api.anthropic.com/v1/messages';

export class AnthropicAdapter implements AIAdapterInterface {
  readonly provider = 'anthropic' as const;

  private async callClaude(
    endpoint: string, apiKey: string, model: string,
    systemPrompt: string, userMessage: string, maxTokens = 2000
  ): Promise<string> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Claude API 错误 ${response.status}: ${text.slice(0, 200)}`);
    }

    const data = await response.json() as any;
    if (data.error) {
      throw new Error(data.error.message || '未知 Claude API 错误');
    }

    // Claude returns content as array of blocks
    const content = data.content;
    if (Array.isArray(content)) {
      return content.map((b: any) => b.text || '').join('').trim();
    }
    return content?.toString() || '';
  }

  async chat(model: string, messages: ChatMessage[], apiKey: string, baseUrl?: string, options?: ChatOptions): Promise<string> {
    // Extract system message if any, combine rest as conversation
    const systemMsg = messages.find(m => m.role === 'system');
    const conversation = messages.filter(m => m.role !== 'system')
      .map(m => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`).join('\n\n');

    return this.callClaude(
      baseUrl || DEFAULT_ENDPOINT, apiKey, model,
      systemMsg?.content || options?.systemPrompt || '你是一个智能日历助手，请用中文回复。',
      conversation,
      options?.maxTokens ?? 2000
    );
  }

  async classify(model: string, title: string, content: string, apiKey: string, baseUrl?: string): Promise<string> {
    const result = await this.callClaude(
      baseUrl || DEFAULT_ENDPOINT, apiKey, model,
      '你是一个日志分类助手。根据标题和内容将日志分类为：meeting(会议)、task(任务)、chore(杂务)、personal(个人)、work(工作)、study(学习)、health(健康)、other(其他)。只回复类别英文名。',
      `标题：${title}\n内容：${content || '(无)'}`,
      20
    );
    const category = result.toLowerCase();
    const valid = ['meeting', 'task', 'chore', 'personal', 'work', 'study', 'health', 'other'];
    return valid.includes(category) ? category : 'other';
  }

  async summary(model: string, type: string, date: string, logs: Log[], apiKey: string, baseUrl?: string): Promise<string> {
    const typeLabels: Record<string, string> = { daily: '每日', weekly: '每周', monthly: '每月' };
    const label = typeLabels[type] || type;
    return this.callClaude(
      baseUrl || DEFAULT_ENDPOINT, apiKey, model,
      `你是一个日志总结助手。请根据提供的日志数据生成${label}总结。要求：1.概括主要事项 2.分析完成情况 3.给出改进建议 4.统计各分类占比。请用中文输出。`,
      `日期：${date}\n日志数据：\n${JSON.stringify(logs, null, 2)}`,
      1500
    );
  }

  async taskParse(model: string, message: string, today: string, apiKey: string, baseUrl?: string): Promise<TaskParseResult> {
    const result = await this.callClaude(
      baseUrl || DEFAULT_ENDPOINT, apiKey, model,
      `你是一个智能日程解析助手。请分析用户消息，判断是否包含创建日程/任务的意图。

## 输出 JSON 格式（只返回 JSON，不要其他内容）
{
  "is_task": true,
  "reply": "已为你创建任务的确认回复（一句中文）",
  "tasks": [{ "title": "任务标题", "content": "详细描述", "category": "meeting/task/chore/personal/work/study/health/other", "date": "YYYY-MM-DD", "start_time": "HH:MM或空", "end_time": "HH:MM或空", "priority": 1, "reminder_enabled": false, "reminder_time": "HH:MM或空", "advance_minutes": 0, "is_periodic": 0, "periodic_type": "daily/weekly/monthly/yearly或空", "periodic_value": "周期值或空" }]
}

规则：priority 1=普通 2=重要 3=紧急；日期默认今天；不是任务则返回 {"is_task": false, "reply": "回复内容"}。`,
      `当前日期：${today}\n用户消息：${message}`,
      4096
    );

    // 解析 JSON
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (!parsed.tasks) parsed.tasks = [];
        if (!Array.isArray(parsed.tasks)) parsed.tasks = [parsed.tasks];
        return parsed;
      } catch {}
    }
    return { is_task: false, reply: result.slice(0, 200) };
  }
}
    ​​​​​​​​​‌‌​‌‌‌‌​​​​​​​​​​​​‌​‌​​​​​​​​​​‌‌​​‌​‌​​​​​​​​​‌‌​
    
