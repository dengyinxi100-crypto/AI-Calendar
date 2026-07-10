import React, { useState, useRef, useEffect } from 'react';
import { api } from '../utils/api';
import { formatDate } from '../utils/calendar';

interface AiChatProps {
  onSaveToLog?: (content: string) => void;
  onTaskCreated?: () => void;
  disabled?: boolean;
  provider?: string;
}

const PROVIDER_NAMES: Record<string, string> = {
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
  anthropic: 'Claude',
  glm: 'GLM',
  qwen: 'Qwen',
  ollama: 'Ollama',
};

export default function AiChat({ onSaveToLog, onTaskCreated, disabled, provider }: AiChatProps) {
  const providerLabel = PROVIDER_NAMES[provider || 'deepseek'] || 'AI';
  // 全局共享对话历史，切换供应商不重置
  const storageKey = 'ai_chat_shared';
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  // 首次加载时显示欢迎语
  const [initialized, setInitialized] = useState(() => {
    try { return !!localStorage.getItem(storageKey); } catch { return false; }
  });
  useEffect(() => {
    if (!initialized && messages.length === 0) {
      setMessages([{ role: 'assistant', content: `你好！我是你的日历助手。我可以帮你管理日志、分析日程、提供建议。\n\n你可以点击 "引入日志" 将本地日志作为对话上下文。` }]);
      setInitialized(true);
    }
  }, [initialized, messages.length, providerLabel]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [contextLogs, setContextLogs] = useState('');
  const [loadingContext, setLoadingContext] = useState(false);
  const [processSteps, setProcessSteps] = useState<string[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    chatEndRef.current?.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth' });
  }, [messages, processSteps]);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(messages)); } catch {}
  }, [messages, storageKey]);

  const loadContextLogs = async () => {
    setLoadingContext(true);
    setProcessSteps(['读取本地日志数据...']);
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const end = formatDate(now);
      const logs = await api.logs.list({ start, end });
      if (logs.length === 0) {
        setMessages(prev => [...prev, { role: 'assistant', content: '当前月份暂无日志记录。' }]);
        setContextLogs('');
        setProcessSteps(['当月无日志记录']);
      } else {
        const summary = logs.map(l => `[${l.date}] ${l.title}${l.content ? ' - ' + l.content : ''}`).join('\n');
        setContextLogs(summary);
        setMessages(prev => [...prev, { role: 'assistant', content: `已加载 ${logs.length} 条本月日志作为对话上下文。现在你可以问我关于这些日志的任何问题！` }]);
        setProcessSteps([`已加载 ${logs.length} 条日志作为上下文`]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '加载日志失败，请稍后重试。' }]);
      setProcessSteps(['日志加载失败']);
    } finally {
      setLoadingContext(false);
      setTimeout(() => setProcessSteps([]), 2500);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading || disabled) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);
    setProcessSteps([`连接 ${providerLabel} AI...`, '分析上下文...', '生成回复...']);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const taskResult = await api.ai.taskParse(userMsg, undefined, controller.signal);
      if (taskResult.is_task && taskResult.tasks && taskResult.tasks.length > 0) {
        let createdCount = 0;
        for (const t of taskResult.tasks) {
          if (controller.signal.aborted) break;
          try {
            await api.logs.create({
              title: t.title, content: t.content || '',
              category: t.category || 'task', date: t.date || formatDate(new Date()),
              start_time: t.start_time || '', end_time: t.end_time || '',
              is_periodic: t.is_periodic || 0, periodic_type: t.periodic_type || '', periodic_value: t.periodic_value || '',
              reminder_enabled: t.reminder_enabled ? 1 : 0, reminder_time: t.reminder_time || '',
              advance_minutes: t.advance_minutes || 0, completed: 0, color: '',
              is_task: 1, priority: t.priority || 1, status: 'pending',
            });
            createdCount++;
          } catch {}
        }
        if (!controller.signal.aborted) {
          setMessages(prev => [...prev, { role: 'assistant', content: taskResult.reply || `已为你创建 ${createdCount} 个任务` }]);
          setProcessSteps(['已连接', `${createdCount} 个任务已创建`, '已完成']);
        }
        onTaskCreated?.();
      } else {
        const chatMessages = [...messages, { role: 'user', content: userMsg }]
          .filter(m => m.role !== 'system')
          .map(m => ({ role: m.role, content: m.content }));
        const result = await api.ai.chat(chatMessages, contextLogs || undefined, undefined, controller.signal);
        if (!controller.signal.aborted) {
          setMessages(prev => [...prev, { role: 'assistant', content: result.reply }]);
          setProcessSteps(['已连接', '上下文分析完成', '回复已生成']);
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: '已停止生成' }]);
        setProcessSteps(['已取消']);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，AI 服务暂时不可用：' + err.message }]);
        setProcessSteps(['处理失败: ' + err.message]);
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
      setTimeout(() => setProcessSteps([]), 2500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  /* ── Helpers: step status ── */
  const stepClass = (s: string) => {
    if (s.startsWith('✓')) return 'done';
    if (s.startsWith('✗')) return 'error';
    return 'active';
  };

  const ctxLoaded = contextLogs && contextLogs.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 工具栏 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{
          fontSize: '0.6rem', padding: '2px 8px', borderRadius: 'var(--radius-full)',
          background: 'var(--color-primary-light)', color: 'var(--color-primary-strong)',
          border: '1px solid var(--color-primary-border, var(--border-light))',
          fontWeight: 600,
        }}>
          {providerLabel}
        </span>
        <button
          onClick={loadContextLogs}
          disabled={loadingContext}
          style={{
            fontSize: '0.65rem', padding: '4px 10px', borderRadius: 'var(--radius-full)',
            background: ctxLoaded ? 'var(--tag-mint)' : 'var(--bg-input)',
            color: ctxLoaded ? 'var(--breath-green)' : 'var(--text-secondary)',
            border: ctxLoaded ? '1px solid var(--border-focus)' : '1px solid var(--border-medium)',
            cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
          }}
        >
          {loadingContext ? '加载中...' : ctxLoaded ? `已引入 ${contextLogs.split('\n').length} 条日志` : '引入日志'}
        </button>
        {messages.length > 1 && (
          <button
            onClick={() => {
              setMessages([{ role: 'assistant', content: `你好！我是你的日历助手。我可以帮你管理日志、分析日程、提供建议。\n\n你可以点击 "引入日志" 将本地日志作为对话上下文。` }]);
              setContextLogs('');
              localStorage.removeItem(storageKey);
            }}
            style={{
              fontSize: '0.65rem', padding: '4px 10px', borderRadius: 'var(--radius-full)',
              background: 'var(--bg-input)', color: 'var(--text-secondary)',
              border: '1px solid var(--border-medium)', cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: 500,
            }}
          >
            清空对话
          </button>
        )}
      </div>

      {/* 处理流程指示器 */}
      {processSteps.length > 0 && (
        <div className="process-steps" style={{ marginBottom: 8, borderRadius: 10 }}>
          <div style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--color-primary-text)', marginBottom: 4 }}>处理流程</div>
          {processSteps.map((step, i) => (
            <div key={i} className={`process-step ${stepClass(step)}`}>
              <span className="step-dot" />
              {step}
            </div>
          ))}
        </div>
      )}

      {/* 消息列表 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: 10, display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div className={`chat-bubble ${msg.role}`}>
              {msg.content}
              {msg.role === 'assistant' && onSaveToLog && i > 0 && (
                <div style={{ marginTop: 8 }}>
                  <button className="btn btn-success btn-sm" onClick={() => onSaveToLog(msg.content)} style={{ fontSize: '0.65rem' }}>
                    保存到当天日志
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
              fontSize: '0.75rem', color: 'var(--color-primary-text)',
            }}>
              <span>AI 正在思考</span>
              <span className="typing-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-primary-strong)', display: 'inline-block' }} />
              <span className="typing-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-primary-strong)', display: 'inline-block' }} />
              <span className="typing-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-primary-strong)', display: 'inline-block' }} />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* 输入框 */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 0 0' }}>
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
          placeholder={disabled ? 'AI 助手已关闭，请在设置中启用' : "输入消息，Shift+Enter 换行，Enter 发送…"} style={{ flex: 1, resize: 'none', minHeight: 44 }} rows={2} disabled={loading || disabled} />
        {loading ? (
          <button className="btn btn-danger btn-sm" onClick={() => { abortRef.current?.abort(); }}
            style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
            停止
          </button>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={handleSend} disabled={!input.trim() || disabled}>发送</button>
        )}
      </div>
    </div>
  );
}
