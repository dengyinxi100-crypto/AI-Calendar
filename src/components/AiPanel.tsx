import React, { useState, useEffect, useRef } from 'react';
import AiChat from './AiChat';
import { IconX } from './Icons';
import { api, AIConfig, AIModelInfo } from '../utils/api';
import { SummaryType } from '../utils/types';
import { formatDate } from '../utils/calendar';
import { showToast } from '../utils/notifications';

interface AiPanelProps {
  open: boolean;
  onClose: () => void;
  currentMonth: number;
  currentYear: number;
  onLogChanged: () => void;
  onConfigChanged: () => void;
}

// ── 供应商定义 ──
const PROVIDERS = [
  { id: 'deepseek', name: 'DeepSeek' },
  { id: 'openai', name: 'OpenAI (GPT)' },
  { id: 'anthropic', name: 'Anthropic (Claude)' },
  { id: 'glm', name: '智谱 GLM' },
  { id: 'qwen', name: '通义千问 (Qwen)' },
  { id: 'ollama', name: 'Ollama (本地)', local: true },
];

/** 各 provider 的 Key 占位提示 */
const KEY_PLACEHOLDERS: Record<string, string> = {
  deepseek: 'sk-xxxxxxxxxxxxxxxxxxxxxxxx',
  openai: 'sk-proj-xxxxxxxxxxxxxxxx',
  anthropic: 'sk-ant-api03-xxxxxxxxxxxx',
  glm: 'xxxxxxxxxx.xxxxxxxxxxxxxx',
  qwen: 'sk-xxxxxxxxxxxxxxxxxxxxxxxx',
};

export default function AiPanel({ open, onClose, onLogChanged, onConfigChanged }: AiPanelProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'summary' | 'settings' | 'workflow'>('chat');
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiModel, setAiModel] = useState('deepseek-chat');
  const [aiProvider, setAiProvider] = useState('deepseek');
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('http://localhost:11434');
  const [saving, setSaving] = useState(false);
  const [onlineModels, setOnlineModels] = useState<AIModelInfo[]>([]);
  const [needsApiKey, setNeedsApiKey] = useState<Record<string, boolean>>({});

  // 当前 provider 的 key
  const currentKey = apiKeys[aiProvider] || '';

  const setCurrentKey = (val: string) => {
    setApiKeys(prev => ({ ...prev, [aiProvider]: val }));
  };

  // 总结相关
  const [summaryType, setSummaryType] = useState<SummaryType>('daily');
  const [summaryDate, setSummaryDate] = useState(formatDate(new Date()));
  const [summaryResult, setSummaryResult] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  // 工作流
  const [wfModel, setWfModel] = useState('deepseek-chat');
  const [wfMessages, setWfMessages] = useState<{ role: 'user' | 'assistant' | 'system'; content: string }[]>(() => {
    try { const saved = localStorage.getItem('ai_wf_messages'); if (saved) return JSON.parse(saved); } catch {}
    return [];
  });
  const [wfInput, setWfInput] = useState('');
  const [wfLoading, setWfLoading] = useState(false);
  const [processSteps, setProcessSteps] = useState<string[]>([]);

  const CACHE_KEY = 'ai_config_cache';

  // 设置页"已保存"的快照，切换标签页时丢弃未保存的修改
  const committedRef = useRef<{ provider: string; model: string; enabled: boolean; baseUrl: string; keys: Record<string, string> } | null>(null);

  // 进入设置页 → 从后端拉取已保存配置作为快照
  useEffect(() => {
    if (activeTab !== 'settings') return;
    (async () => {
      try {
        const c = await api.ai.getConfig();
        const snap = {
          provider: c.provider || 'deepseek',
          model: c.model || 'deepseek-chat',
          enabled: c.enabled || false,
          baseUrl: c.baseUrl || 'http://localhost:11434',
          keys: c.keys || {},
        };
        committedRef.current = snap;
        setAiProvider(snap.provider);
        setAiModel(snap.model);
        setAiEnabled(snap.enabled);
        setOllamaBaseUrl(snap.baseUrl);
        setApiKeys(snap.keys);
      } catch {}
    })();
  }, [activeTab]);

  // 离开设置页 → 丢弃未保存的修改
  const leaveSettings = () => {
    if (committedRef.current) {
      const s = committedRef.current;
      setAiProvider(s.provider);
      setAiModel(s.model);
      setAiEnabled(s.enabled);
      setOllamaBaseUrl(s.baseUrl);
      setApiKeys(s.keys);
    }
  };

  const loadFromCache = () => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const c = JSON.parse(raw);
        if (c.keys) setApiKeys(c.keys);
        else if (c.apiKey && c.provider) setApiKeys({ [c.provider]: c.apiKey });
        setAiEnabled(!!c.enabled);
        setAiModel(c.model || 'deepseek-chat');
        setAiProvider(c.provider || 'deepseek');
        setOllamaBaseUrl(c.baseUrl || 'http://localhost:11434');
      }
    } catch {}
  };

  const loadConfig = async () => {
    try {
      const config = await api.ai.getConfig();
      // 恢复所有 provider 的 key
      if (config.keys) setApiKeys(config.keys);
      else if (config.apiKey && config.provider) setApiKeys({ [config.provider]: config.apiKey });
      setAiEnabled(config.enabled || false);
      setAiModel(config.model || 'deepseek-chat');
      setAiProvider(config.provider || 'deepseek');
      setOllamaBaseUrl(config.baseUrl || 'http://localhost:11434');
      localStorage.setItem(CACHE_KEY, JSON.stringify(config));
    } catch {
      loadFromCache();
    }
  };

  const loadProviders = async () => {
    try {
      const data = await api.ai.getProviders();
      setOnlineModels(data.models || []);
      setNeedsApiKey(data.needsApiKey || {});
    } catch {}
  };

  useEffect(() => { loadFromCache(); loadConfig(); loadProviders(); }, []);
  useEffect(() => { if (open) { loadConfig(); loadProviders(); } }, [open]);
  useEffect(() => {
    try { localStorage.setItem('ai_wf_messages', JSON.stringify(wfMessages)); } catch {}
  }, [wfMessages]);

  const saveConfig = async () => {
    setSaving(true);
    // 防呆：如果当前供应商没有填 API Key（且不是 Ollama），自动关闭启用
    const hasKey = aiProvider === 'ollama' || !!apiKeys[aiProvider];
    const effectiveEnabled = aiEnabled && hasKey;
    if (aiEnabled && !hasKey) {
      setAiEnabled(false);
      showToast('提示', '未填写 API Key，AI 助手将保持关闭状态');
    }
    try {
      await api.ai.saveConfig({
        apiKey: currentKey, enabled: effectiveEnabled, model: aiModel, provider: aiProvider,
        baseUrl: ollamaBaseUrl, keys: apiKeys,
      });
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        enabled: effectiveEnabled, model: aiModel, provider: aiProvider, baseUrl: ollamaBaseUrl, keys: apiKeys,
      }));
      // 更新快照，避免下次切标签页时被重置
      committedRef.current = { provider: aiProvider, model: aiModel, enabled: effectiveEnabled, baseUrl: ollamaBaseUrl, keys: apiKeys };
      onConfigChanged();
      const providerLabel = PROVIDERS.find(p => p.id === aiProvider)?.name || aiProvider;
      showToast('设置已保存', effectiveEnabled ? `AI 助手已启用: ${providerLabel} ${aiModel}` : 'AI 助手已禁用');
    } catch (e: any) {
      showToast('保存失败', e.message || '未知错误');
    } finally { setSaving(false); }
  };

  // ── 总结 ──
  const handleSummary = async () => {
    setSummaryLoading(true);
    setSummaryResult('');
    setProcessSteps(['正在计算日期范围...', '正在获取日志数据...', '正在生成 AI 总结...']);
    try {
      let start: string, end: string;
      const d = new Date(summaryDate + 'T00:00:00');
      if (summaryType === 'daily') { start = summaryDate; end = summaryDate; }
      else if (summaryType === 'weekly') {
        const dow = d.getDay();
        start = new Date(d.getTime() - dow * 86400000).toISOString().split('T')[0];
        end = new Date(d.getTime() + (6 - dow) * 86400000).toISOString().split('T')[0];
      } else {
        start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
        end = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()}`;
      }
      setProcessSteps(['日期范围已确定', '正在获取日志数据...', '正在生成 AI 总结...']);
      const logs = await api.logs.list({ start, end });
      setProcessSteps(['日期范围已确定', `获取到 ${logs.length} 条日志`, '正在生成 AI 总结...']);
      const result = await api.ai.summary(summaryType, summaryDate, logs);
      setProcessSteps(['日期范围已确定', `获取到 ${logs.length} 条日志`, 'AI 总结已生成']);
      setSummaryResult(result.summary);
    } catch (err: any) {
      setProcessSteps(['总结生成失败: ' + err.message]);
      setSummaryResult('总结生成失败: ' + err.message);
    } finally {
      setSummaryLoading(false);
      setTimeout(() => setProcessSteps([]), 2000);
    }
  };

  const handleSaveToLog = async (content: string) => {
    const today = formatDate(new Date());
    try {
      await api.logs.create({
        title: 'AI 对话保存', content, date: today, category: 'other',
        start_time: '', end_time: '', is_periodic: 0, periodic_type: '',
        periodic_value: '', reminder_enabled: 0, reminder_time: '', advance_minutes: 0, completed: 0, color: '',
        is_task: 0, priority: 0, status: 'pending',
      });
      onLogChanged();
      showToast('已保存', '内容已保存到当天日志');
    } catch { showToast('保存失败', '请重试'); }
  };

  const handleWorkflow = async () => {
    if (!wfInput.trim() || wfLoading || !aiEnabled) return;
    const userMsg = wfInput.trim();
    setWfInput('');
    setWfMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setWfLoading(true);
    setProcessSteps(['分析任务内容...', '连接 AI 服务...']);
    try {
      const taskResult = await api.ai.taskParse(userMsg, wfModel);
      if (taskResult.is_task && taskResult.tasks && taskResult.tasks.length > 0) {
        let createdCount = 0;
        for (const t of taskResult.tasks) {
          try {
            await api.logs.create({
              title: t.title, content: t.content || '',
              category: t.category || 'task', date: t.date || formatDate(new Date()),
              start_time: t.start_time || '', end_time: t.end_time || '',
              is_periodic: t.is_periodic || 0, periodic_type: t.periodic_type || '', periodic_value: t.periodic_value || '',
              reminder_enabled: t.reminder_enabled ? 1 : 0,
              reminder_time: t.reminder_time || '', advance_minutes: t.advance_minutes || 0,
              completed: 0, color: '', is_task: 1, priority: t.priority || 1, status: 'pending',
            });
            createdCount++;
          } catch {}
        }
        setProcessSteps(['任务分析完成', `${createdCount} 个任务已创建`]);
        setWfMessages(prev => [...prev, { role: 'assistant', content: taskResult.reply || `已创建 ${createdCount} 个任务` }]);
        onLogChanged();
      } else {
        setProcessSteps(['任务分析完成', 'AI 正在处理中...']);
        const chatHistory = wfMessages.map(m => ({ role: m.role, content: m.content }));
        const result = await api.ai.chat([
          ...chatHistory,
          { role: 'user', content: `请帮我处理以下工作流任务：${userMsg}\n\n请提供详细的分析和处理结果。` }
        ], undefined, wfModel);
        setProcessSteps(['任务分析完成', '处理完成']);
        setWfMessages(prev => [...prev, { role: 'assistant', content: result.reply }]);
      }
    } catch (err: any) {
      setProcessSteps(['处理失败: ' + err.message]);
      setWfMessages(prev => [...prev, { role: 'system', content: '执行失败: ' + err.message }]);
    } finally {
      setWfLoading(false);
      setTimeout(() => setProcessSteps([]), 3000);
    }
  };

  const handleWfKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleWorkflow(); }
  };

  const providerModels = onlineModels.filter(m => m.provider === aiProvider);

  const allSelectableModels = [...onlineModels];

  const tabs = [
    { key: 'chat' as const, label: '对话' },
    { key: 'summary' as const, label: '总结' },
    { key: 'workflow' as const, label: '工作流' },
    { key: 'settings' as const, label: '设置' },
  ];

  return (<>
    {open && <div className="side-panel-overlay" onClick={onClose} />}
    {open && (
    <div className="side-panel side-panel-left">
      <div className="side-panel-header">
        <div className="panel-title-group">
          <span className="panel-icon">AI</span>
          <span className="panel-title">AI 助手</span>
        </div>
        <button className="side-panel-close" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="关闭"><IconX size={18} /></button>
      </div>

      <div className="panel-tabs">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => { if (activeTab === 'settings' && tab.key !== 'settings') leaveSettings(); setActiveTab(tab.key); }} className={`panel-tab ${activeTab === tab.key ? 'active' : ''}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {processSteps.length > 0 && (
        <div className="process-steps">
          <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--color-primary-text)', marginBottom: 6 }}>处理流程</div>
          {processSteps.map((step, i) => {
            const isError = step.includes('失败');
            return (
              <div key={i} className={`process-step ${step.includes('已') ? 'done' : isError ? 'error' : 'active'}`}>
                <span className="step-dot" />{step}
              </div>
            );
          })}
        </div>
      )}

      <div className="side-panel-body">
        <div style={{ display: activeTab === 'chat' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <AiChat onSaveToLog={handleSaveToLog} onTaskCreated={() => onLogChanged()} disabled={!aiEnabled} provider={aiProvider} />
        </div>
        <div style={{ display: activeTab === 'summary' ? 'flex' : 'none', flexDirection: 'column', gap: 12 }}>
            <div><label>总结类型</label><select value={summaryType} onChange={e => setSummaryType(e.target.value as SummaryType)}>
              <option value="daily">每日总结</option><option value="weekly">每周总结</option><option value="monthly">每月总结</option>
            </select></div>
            <div><label>日期</label><input type="date" value={summaryDate} onChange={e => setSummaryDate(e.target.value)} /></div>
            <button className="btn btn-primary" onClick={handleSummary} disabled={summaryLoading}>{summaryLoading ? '生成中...' : '生成总结'}</button>
            {summaryResult && (<div className="summary-card">{summaryResult}<div style={{ marginTop: 12 }}><button className="btn btn-success btn-sm" onClick={() => handleSaveToLog(summaryResult)}>保存到当天日志</button></div></div>)}
        </div>
        <div style={{ display: activeTab === 'workflow' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '0 2px' }}>
              <label style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', marginBottom: 0 }}>模型：</label>
              <select value={wfModel} onChange={e => setWfModel(e.target.value)}
                style={{ fontSize: '0.72rem', padding: '4px 24px 4px 8px', borderRadius: 8, border: '1px solid var(--border-light)', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none', width: 'auto', minWidth: 160 }}>
                {allSelectableModels.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            {wfMessages.length === 0 && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', gap: 8 }}>
                <p style={{ fontSize: '0.82rem', fontWeight: 500 }}>智能工作流助手</p>
                <p style={{ fontSize: '0.7rem', textAlign: 'center', lineHeight: 1.6, maxWidth: 240 }}>描述你的任务，AI 将分析并处理<br />支持多轮对话追问</p>
              </div>
            )}
            {wfMessages.length > 0 && (
              <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
                {wfMessages.map((msg, i) => (
                  <div key={i} style={{ marginBottom: 10, display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div className={`chat-bubble ${msg.role}`}>
                      {msg.content}
                      {msg.role === 'assistant' && (
                        <div style={{ marginTop: 8 }}><button className="btn btn-success btn-sm" onClick={() => handleSaveToLog(msg.content)} style={{ fontSize: '0.65rem' }}>保存到当天日志</button></div>
                      )}
                    </div>
                  </div>
                ))}
                {wfLoading && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-primary-text)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>AI 处理中</span>
                    <span className="typing-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-primary-strong)', display: 'inline-block' }} />
                    <span className="typing-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-primary-strong)', display: 'inline-block' }} />
                    <span className="typing-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-primary-strong)', display: 'inline-block' }} />
                  </div>
                )}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, padding: '12px 0 0' }}>
              <textarea value={wfInput} onChange={e => setWfInput(e.target.value)} onKeyDown={handleWfKeyDown}
                placeholder={aiEnabled ? "描述你的工作流任务，Shift+Enter 换行，Enter 发送…" : "AI 助手已关闭，请在设置中启用"}
                style={{ flex: 1, resize: 'none', minHeight: 44 }} rows={2} disabled={wfLoading || !aiEnabled} />
              <button className="btn btn-primary btn-sm" onClick={handleWorkflow} disabled={wfLoading || !wfInput.trim() || !aiEnabled}>
                {wfLoading ? '...' : '发送'}
              </button>
            </div>
        </div>
        <div style={{ display: activeTab === 'settings' ? 'flex' : 'none', flexDirection: 'column', gap: 12 }}>
            {/* ── 供应商选择 ── */}
            <div>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-primary)', marginBottom: 6, display: 'block', fontWeight: 600 }}>
                模型供应商
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {PROVIDERS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setAiProvider(p.id);
                      // 切换 provider 时自动选该 provider 的第一个模型
                      const firstModel = onlineModels.find(m => m.provider === p.id);
                      if (firstModel) setAiModel(firstModel.id);
                    }}
                    style={{
                      padding: '8px 10px', borderRadius: 10, border: aiProvider === p.id ? '2px solid var(--color-primary-strong)' : '1px solid var(--border-light)',
                      background: aiProvider === p.id ? 'var(--color-primary-light)' : 'var(--bg-input)',
                      color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.78rem', textAlign: 'center',
                      fontWeight: aiProvider === p.id ? 600 : 400,
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Ollama 设置 ── */}
            {aiProvider === 'ollama' && (
              <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 14, border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                  Ollama 本地服务
                </div>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '0 0 10px' }}>
                  确保已在本地安装并启动 Ollama，根据需要填入服务地址和模型名称。
                </p>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>服务地址</label>
                  <input
                    type="text" placeholder="http://localhost:11434"
                    value={ollamaBaseUrl}
                    onChange={e => setOllamaBaseUrl(e.target.value)}
                    style={{ width: '100%', fontSize: '0.75rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>模型名称</label>
                  <input
                    type="text" placeholder="如 qwen2.5、llama3.2、mistral…"
                    value={aiModel}
                    onChange={e => setAiModel(e.target.value)}
                    style={{ width: '100%', fontSize: '0.75rem' }}
                  />
                </div>
              </div>
            )}

            {/* ── 在线模型 / API Key ── */}
            {aiProvider !== 'ollama' && (
              <>
                <div>
                  <label style={{ fontSize: '0.82rem', color: 'var(--text-primary)', marginBottom: 6, display: 'block', fontWeight: 600 }}>选择模型</label>
                  <select value={aiModel} onChange={e => setAiModel(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border-light)', background: 'var(--bg-input)', fontSize: '0.85rem', color: 'var(--text-primary)', outline: 'none' }}>
                    {providerModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                {needsApiKey[aiProvider] !== false && (
                  <div>
                    <label style={{ fontSize: '0.82rem', color: 'var(--text-primary)', marginBottom: 4, display: 'block', fontWeight: 600 }}>
                      {PROVIDERS.find(p => p.id === aiProvider)?.name} API Key
                    </label>
                    <input type="password" value={currentKey} onChange={e => setCurrentKey(e.target.value)} placeholder={KEY_PLACEHOLDERS[aiProvider] || '输入 API Key…'} />
                  </div>
                )}
              </>
            )}

            {/* ── 启用开关 ── */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem', marginBottom: 0, color: 'var(--text-primary)' }}>
              <input type="checkbox" checked={aiEnabled} onChange={e => setAiEnabled(e.target.checked)} />启用 AI 辅助功能
            </label>

            <button className="btn btn-primary" onClick={saveConfig} disabled={saving}>{saving ? '保存中...' : '保存设置'}</button>

            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 16, lineHeight: 1.6 }}>
              <p style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>AI 辅助功能包括：</p>
              <ul style={{ paddingLeft: 18, marginTop: 2 }}>
                <li>自动分类日志</li><li>日志内容分析</li><li>日/周/月总结</li><li>智能工作流</li>
              </ul>
            </div>
        </div>
      </div>
    </div>
    )}
  </>);
}
