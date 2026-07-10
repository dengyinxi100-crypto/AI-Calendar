// ── 全局键盘快捷键 ──
import { useEffect } from 'react';

export interface ShortcutHandlers {
  /** Alt+1: 切换日历视图 */
  onCalendarView: () => void;
  /** Alt+2: 切换任务视图 */
  onTaskView: () => void;
  /** Alt+N: 新建日志 */
  onNewLog: () => void;
  /** Ctrl+Shift+A: 打开/关闭 AI 助手 */
  onToggleAi: () => void;
  /** Alt+T: 切换暗色/亮色 */
  onToggleTheme: () => void;
  /** T: 跳转今天 */
  onToday: () => void;
  /** PageUp / PageDown: 月份/日期切换 */
  onPrev: () => void;
  onNext: () => void;
  /** Esc: 关闭弹窗 */
  onClose: () => void;
}

/** 快捷键帮助文本（展示在 UI 中） */
export function getShortcutsHelp(): { category: string; shortcuts: { key: string; desc: string }[] }[] {
  return [
    {
      category: '视图切换',
      shortcuts: [
        { key: 'Alt+1', desc: '日历视图' },
        { key: 'Alt+2', desc: '任务/看板视图' },
      ],
    },
    {
      category: '日志/任务',
      shortcuts: [
        { key: 'Alt+N', desc: '新建日志' },
        { key: 'Ctrl+Enter', desc: '保存（编辑器中）' },
      ],
    },
    {
      category: 'AI',
      shortcuts: [
        { key: 'Ctrl+Shift+A', desc: '打开/关闭 AI 助手' },
      ],
    },
    {
      category: '通用',
      shortcuts: [
        { key: 'Alt+T', desc: '切换暗色/亮色主题' },
        { key: 'T', desc: '跳转今天' },
        { key: 'PgUp / PgDn', desc: '切换月份' },
        { key: 'Esc', desc: '关闭弹窗' },
      ],
    },
  ];
}

/** 功能介绍与使用教程 */
export function getFeatureGuide(): { icon: string; title: string; desc: string; tips: string[] }[] {
  return [
    {
      icon: 'Calendar',
      title: '日历视图',
      desc: '以月历形式展示所有日程和任务，每天标注日志数量。点击日期查看详情，按 ← → 或左右箭头切换月份。',
      tips: [
        '点击日期格子查看当天所有日志',
        '顶部切换按钮可在日历与看板布局间切换',
        '按 T 键快速回到今天',
      ],
    },
    {
      icon: 'Kanban',
      title: '看板 / 时间轴',
      desc: '时间线按日期分组展示任务，拖拽排序、状态流转（待办 → 进行中 → 已完成），右侧配有迷你日历和任务统计卡片。',
      tips: [
        '顶部切换按钮可进入看板布局',
        '右侧面板显示迷你日历和任务完成率',
        '看板中可直接拖拽或点击修改任务状态',
      ],
    },
    {
      icon: 'AI',
      title: 'AI 智能助手',
      desc: '支持 DeepSeek、OpenAI、Claude、GLM、Qwen、Ollama 六大 AI 服务商，可自由对话、智能解析任务、生成日志摘要。',
      tips: [
        '💡 建议试用用户选择 GLM-4-Flash（永久免费，注册即用）',
        '推荐使用 DeepSeek API（本项目开发测试均基于 DS）',
        'DeepSeek → platform.deepseek.com/api_keys',
        'OpenAI → platform.openai.com/api-keys',
        'Claude → console.anthropic.com',
        'GLM（智谱）→ open.bigmodel.cn',
        'Qwen（通义千问）→ dashscope.aliyun.com',
        'Ollama → 本地部署（ollama.com），无需 API Key',
        '可点击"停止"按钮随时中断 AI 生成',
      ],
    },
    {
      icon: 'Task',
      title: '任务管理',
      desc: '日志可标记为任务类型，支持四象限优先级与提醒时间。任务看板按状态分列，拖拽即可流转。',
      tips: [
        '新建日志时勾选"任务"复选框即可转为任务',
        '四象限优先级：紧急重要 / 重要不紧急 / 紧急不重要 / 不紧急不重要',
        '完成后勾选复选框即自动归档',
      ],
    },
    {
      icon: 'Repeat',
      title: '周期日志',
      desc: '支持每日 / 每周 / 每月自动生成重复日志，设置一次后系统按时自动创建，无需手动重复输入。',
      tips: [
        '顶部"周期"按钮统一管理所有周期规则',
        '新建日志时可勾选"周期"并选择重复频率',
        '系统启动时自动检测并补生成遗漏的周期日志',
      ],
    },
    {
      icon: 'Theme',
      title: '主题定制',
      desc: '亮色 / 暗色双模式，搭配 10+ 种主题色（雾蓝、翡翠、紫罗兰、琥珀等），全局 UI 即时生效。',
      tips: [
        '按 Alt+T 快速切换亮/暗模式',
        '侧边栏"主题"入口可浏览并预览所有配色',
        '主题偏好自动保存，下次启动无需重设',
      ],
    },
    {
      icon: 'Bell',
      title: '提醒通知',
      desc: '设置提醒时间的日志到期时弹出浏览器通知和桌面 Toast。未完成任务每天自动汇总提醒。',
      tips: [
        '新建日志时设置"提醒时间"即可',
        '首次使用需在浏览器中授权通知权限',
        '系统每 30 秒自动检查待提醒事项',
      ],
    },
  ];
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略输入框中的按键（除非是 Esc / Ctrl+Enter）
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      const ctrl = e.ctrlKey || e.metaKey;
      const alt = e.altKey;

      // Esc: 始终触发
      if (e.key === 'Escape') {
        e.preventDefault();
        handlers.onClose?.();
        return;
      }

      // 输入框中只放行 Ctrl+Enter
      if (isInput) {
        if (ctrl && e.key === 'Enter') {
          // Ctrl+Enter 交给编辑器自己处理，不拦截
        }
        return;
      }

      // Alt+1: 日历视图
      if (alt && e.key === '1') { e.preventDefault(); handlers.onCalendarView(); return; }
      // Alt+2: 任务视图
      if (alt && e.key === '2') { e.preventDefault(); handlers.onTaskView(); return; }
      // Alt+N: 新建日志
      if (alt && (e.key === 'n' || e.key === 'N')) { e.preventDefault(); handlers.onNewLog(); return; }
      // Ctrl+Shift+A: 切换 AI 面板
      if (ctrl && e.shiftKey && (e.key === 'a' || e.key === 'A')) { e.preventDefault(); handlers.onToggleAi(); return; }
      // Alt+T: 切换主题
      if (alt && (e.key === 't' || e.key === 'T')) { e.preventDefault(); handlers.onToggleTheme(); return; }
      // T (无修饰键): 跳转今天
      if (!ctrl && !alt && !e.shiftKey && (e.key === 't' || e.key === 'T')) { e.preventDefault(); handlers.onToday(); return; }
      // PageUp: 上个月
      if (e.key === 'PageUp') { e.preventDefault(); handlers.onPrev(); return; }
      // PageDown: 下个月
      if (e.key === 'PageDown') { e.preventDefault(); handlers.onNext(); return; }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}
    ​‌​​​​​​​​​​​‌‌​‌‌‌‌​​​​​​​​​‌‌​‌‌‌​​​​​​​​​​‌‌​​‌‌‌​​​​​​​​
    
