// ── 共享任务解析逻辑（适用于 OpenAI 兼容 API：DeepSeek / GLM / Qwen / OpenAI）──
import { TaskParseResult } from '../../../shared/types.js';
import { callOpenAICompatibleAPI } from '../adapter.js';

const TASK_PARSE_SYSTEM = `你是一个智能日程解析助手。请分析用户消息，判断是否包含创建日程/任务的意图。

## 输出 JSON 格式
{
  "is_task": true,
  "reply": "已为你创建任务的确认回复（一句中文）",
  "tasks": [
    {
      "title": "任务标题",
      "content": "任务详细内容",
      "category": "meeting|task|chore|personal|work|study|health|other",
      "date": "YYYY-MM-DD",
      "start_time": "HH:MM",
      "end_time": "HH:MM",
      "priority": 1,
      "reminder_enabled": false,
      "reminder_time": "HH:MM",
      "advance_minutes": 0,
      "is_periodic": 0,
      "periodic_type": "",
      "periodic_value": ""
    }
  ]
}

## 字段说明
- is_task: 是否包含创建任务的意图 (true/false)
- reply: 回复给用户的确认消息，简短自然
- tasks: 任务数组，可包含多个任务
  - title: 任务名称（必填，简洁准确）
  - content: 详细描述（可为空字符串）
  - category: 分类，从 meeting/task/chore/personal/work/study/health/other 中选择
  - date: 日期 YYYY-MM-DD，默认今天
  - start_time/end_time: 时间 HH:MM，无时间则为空字符串
  - priority: 1=普通 2=重要 3=紧急（默认1）
  - reminder_enabled: 是否提醒 (true/false)
  - reminder_time: 提醒时间 HH:MM
  - advance_minutes: 提前分钟数（默认0）
  - is_periodic: 是否周期任务 0=否 1=是
  - periodic_type: 周期类型 daily/weekly/monthly/yearly
  - periodic_value: 周期值（如每周一填"1"，每月5号填"5"）

## 重要规则
1. 如果消息不是创建日程/任务，返回 {"is_task": false, "reply": "简要回复"}
2. tasks 数组中只包含任务，不要放非任务信息
3. 日期默认使用当前日期，除非用户明确指定
4. priority: 用户说"重要""紧急"时设为2或3，默认为1
5. 只返回 JSON，不要输出 markdown 代码块或额外文字`;

export async function performTaskParse(
  endpoint: string, apiKey: string, model: string,
  message: string, today: string
): Promise<TaskParseResult> {
  const result = await callOpenAICompatibleAPI(endpoint, apiKey, model, [
    { role: 'system', content: TASK_PARSE_SYSTEM },
    { role: 'user', content: `当前日期：${today}\n\n用户消息：${message}` }
  ], 0.3, 4096);

  // 提取 JSON（兼容 markdown 代码块包裹的情况）
  let jsonStr = result.trim();
  const codeBlock = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) jsonStr = codeBlock[1].trim();
  // 如果前面有非 JSON 文字，截取第一个 { 到最后 }
  const braceStart = jsonStr.indexOf('{');
  if (braceStart > 0) jsonStr = jsonStr.slice(braceStart);

  try {
    const parsed = JSON.parse(jsonStr);
    // 规范化：tasks 可能为空
    if (!parsed.tasks) parsed.tasks = [];
    if (!Array.isArray(parsed.tasks)) parsed.tasks = [parsed.tasks];
    return parsed;
  } catch {
    // 如果模型仍不遵循格式，回退：不创建任务
    return { is_task: false, reply: result.slice(0, 200) };
  }
}
    ​​​​​‌‌​​‌‌‌​​​​​​​​​‌‌‌‌​​‌​​​​​​​​​‌‌​‌​​‌​​​​​​​​​‌‌​‌‌‌​
    
