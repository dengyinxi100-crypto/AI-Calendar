// ── GLM (智谱清言) 适配器 ──
import { ChatMessage, TaskParseResult, Log } from '../../../shared/types.js';
import { AIAdapterInterface, ChatOptions, callOpenAICompatibleAPI } from '../adapter.js';
import { performTaskParse } from './task-parser.js';

const DEFAULT_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

export class GLMAdapter implements AIAdapterInterface {
  readonly provider = 'glm' as const;

  async chat(model: string, messages: ChatMessage[], apiKey: string, baseUrl?: string, options?: ChatOptions): Promise<string> {
    return callOpenAICompatibleAPI(
      baseUrl || DEFAULT_ENDPOINT, apiKey, model, messages,
      options?.temperature ?? 0.7, options?.maxTokens ?? 2000
    );
  }

  async classify(model: string, title: string, content: string, apiKey: string, baseUrl?: string): Promise<string> {
    const result = await callOpenAICompatibleAPI(
      baseUrl || DEFAULT_ENDPOINT, apiKey, model,
      [
        { role: 'system', content: '你是一个日志分类助手。请根据标题和内容将日志分类为：meeting(会议)、task(任务)、chore(杂务)、personal(个人)、work(工作)、study(学习)、health(健康)、other(其他)。只回复类别英文名。' },
        { role: 'user', content: `标题：${title}\n内容：${content || '(无)'}` }
      ], 0.3, 20
    );
    const category = result.toLowerCase();
    const valid = ['meeting', 'task', 'chore', 'personal', 'work', 'study', 'health', 'other'];
    return valid.includes(category) ? category : 'other';
  }

  async summary(model: string, type: string, date: string, logs: Log[], apiKey: string, baseUrl?: string): Promise<string> {
    const typeLabels: Record<string, string> = { daily: '每日', weekly: '每周', monthly: '每月' };
    const label = typeLabels[type] || type;
    return callOpenAICompatibleAPI(
      baseUrl || DEFAULT_ENDPOINT, apiKey, model,
      [
        { role: 'system', content: `你是一个日志总结助手。请根据提供的日志数据生成${label}总结。要求：1.概括主要事项 2.分析完成情况 3.给出改进建议 4.统计各分类占比。请用中文输出。` },
        { role: 'user', content: `日期：${date}\n日志数据：\n${JSON.stringify(logs, null, 2)}` }
      ], 0.7, 1500
    );
  }

  async taskParse(model: string, message: string, today: string, apiKey: string, baseUrl?: string): Promise<TaskParseResult> {
    return performTaskParse(baseUrl || DEFAULT_ENDPOINT, apiKey, model, message, today);
  }
}
    ​​‌‌​​​​​​​​​​​​​​‌‌​​​​​​​​​​​​​​‌​‌‌​‌​​​​​​​​​‌‌​​​‌‌​​​​
    
