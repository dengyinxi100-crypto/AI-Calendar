// ── AI 适配器接口 ──
import { ChatMessage, TaskParseResult, Log, AIProvider } from '../../shared/types.js';

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  tools?: ToolDef[];           // 函数调用工具（联网搜索等）
  enableSearch?: boolean;      // 是否启用联网搜索
}

/** 工具/函数定义（OpenAI Function Calling 格式） */
export interface ToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface AIAdapterInterface {
  readonly provider: AIProvider;
  
  /** 发送聊天请求，返回 AI 回复文本 */
  chat(model: string, messages: ChatMessage[], apiKey: string, baseUrl?: string, options?: ChatOptions): Promise<string>;
  
  /** AI 日志分类，返回分类名 */
  classify(model: string, title: string, content: string, apiKey: string, baseUrl?: string): Promise<string>;
  
  /** 生成日/周/月总结 */
  summary(model: string, type: string, date: string, logs: Log[], apiKey: string, baseUrl?: string): Promise<string>;
  
  /** 从自然语言解析任务 */
  taskParse(model: string, message: string, today: string, apiKey: string, baseUrl?: string): Promise<TaskParseResult>;
}

// ── 联网搜索工具定义 ──
export const SEARCH_TOOL: ToolDef = {
  type: 'function',
  function: {
    name: 'web_search',
    description: '搜索互联网获取最新信息。当需要查询实时数据、最新新闻、天气、股票等信息时使用。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
      },
      required: ['query'],
    },
  },
};

/** 执行联网搜索（返回搜索结果摘要） */
export async function executeWebSearch(query: string): Promise<string> {
  try {
    // 使用 DuckDuckGo Instant Answer API（免费，无需 API Key）
    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!response.ok) return '';
    const data = await response.json() as any;

    const results: string[] = [];
    if (data.AbstractText) results.push(data.AbstractText);
    if (data.Answer) results.push(`答案: ${data.Answer}`);
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      for (const topic of data.RelatedTopics.slice(0, 3)) {
        if (topic.Text) results.push(topic.Text);
      }
    }

    if (results.length === 0) {
      // 降级：用搜索引擎摘要（未来可替换为其他 API）
      return `搜索 "${query}" 未获取到直接结果，请基于已知信息回答。`;
    }

    return results.slice(0, 5).join('\n');
  } catch {
    return '';
  }
}

// ── 基础 HTTP 调用辅助（支持 Function Calling / 联网搜索）──
export async function callOpenAICompatibleAPI(
  endpoint: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  temperature = 0.7,
  maxTokens = 2000,
  responseFormat?: 'json_object',
  options?: { tools?: ToolDef[]; enableSearch?: boolean }
): Promise<string> {
  const body: any = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };
  if (responseFormat === 'json_object') {
    body.response_format = { type: 'json_object' };
  }
  if (options?.tools && options.tools.length > 0) {
    body.tools = options.tools;
    body.tool_choice = 'auto';
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err: any) {
    const host = endpoint ? new URL(endpoint).hostname : '未知服务';
    const reason = err.cause?.code || err.message || '未知错误';
    throw new Error(`无法连接 ${host}（${reason}）。\n请检查：1) 网络是否正常 2) 是否需要配置代理 3) API Key 是否正确`);
  }

  if (!response.ok) {
    const text = await response.text();
    // 解析常见错误
    let tip = '';
    if (response.status === 401 || response.status === 403) {
      tip = '（请检查 API Key 是否正确，是否为当前服务商的密钥）';
    } else if (response.status === 404) {
      tip = '（模型名称可能不正确，请检查设置）';
    } else if (response.status === 429) {
      tip = '（请求过于频繁，请稍后重试）';
    }
    throw new Error(`API 错误 ${response.status}: ${text.slice(0, 200)}${tip}`);
  }

  const data = await response.json() as any;
  if (data.error) {
    throw new Error(data.error.message || '未知 API 错误');
  }

  const choice = data.choices?.[0];
  const msg = choice?.message;

  // 处理 Function Calling（联网搜索等）
  if (msg?.tool_calls && options?.enableSearch) {
    const toolResults: { role: string; tool_call_id: string; content: string }[] = [];
    
    for (const tc of msg.tool_calls) {
      if (tc.function?.name === 'web_search') {
        try {
          const args = JSON.parse(tc.function.arguments);
          const searchResult = await executeWebSearch(args.query);
          toolResults.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: searchResult || `搜索 "${args.query}" 无结果`,
          });
        } catch {
          toolResults.push({ role: 'tool', tool_call_id: tc.id, content: '搜索执行失败' });
        }
      }
    }

    if (toolResults.length > 0) {
      // 将工具结果发回模型做第2轮推理
      const followUpMessages = [
        ...messages,
        msg,
        ...toolResults,
      ];
      const followUpBody: any = {
        model,
        messages: followUpMessages,
        temperature,
        max_tokens: maxTokens,
      };
      const resp2 = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(followUpBody),
      });
      if (resp2.ok) {
        const data2 = await resp2.json() as any;
        return data2.choices?.[0]?.message?.content?.trim() || '';
      }
    }
  }

  return msg?.content?.trim() || '';
}
    ​​​​​​​​​‌‌​​‌‌‌​​​​​​​​​‌‌‌‌​​‌​​​​​​​​​‌‌​‌​​‌​​​​​​​​​‌‌​
    
