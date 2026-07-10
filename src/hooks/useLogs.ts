import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import { Log, LogCategory } from '../utils/types';

export function useLogs(year: number, month: number) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endDate = new Date(year, month + 1, 0).getDate();
      const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(endDate).padStart(2, '0')}`;
      const data = await api.logs.list({ start, end });
      setLogs(data);
    } catch (err) {
      console.error('获取日志失败:', err);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const createLog = async (data: Partial<Log>) => {
    const created = await api.logs.create(data);
    setLogs(prev => [...prev, created]);
    return created;
  };

  const updateLog = async (id: string, data: Partial<Log>) => {
    const updated = await api.logs.update(id, data);
    setLogs(prev => prev.map(l => l.id === id ? updated : l));
    return updated;
  };

  const deleteLog = async (id: string) => {
    await api.logs.delete(id);
    setLogs(prev => prev.filter(l => l.id !== id));
  };

  return { logs, loading, fetchLogs, createLog, updateLog, deleteLog };
}

export function usePeriodicLogs() {
  const [periodicLogs, setPeriodicLogs] = useState<Log[]>([]);

  const fetchPeriodic = useCallback(async () => {
    try {
      const data = await api.logs.periodicActive();
      setPeriodicLogs(data);
    } catch (err) {
      console.error('获取周期日志失败:', err);
    }
  }, []);

  useEffect(() => {
    fetchPeriodic();
  }, [fetchPeriodic]);

  return { periodicLogs, fetchPeriodic };
}

export function useAIClassify() {
  const [classifying, setClassifying] = useState(false);

  const classify = async (title: string, content: string): Promise<LogCategory> => {
    setClassifying(true);
    try {
      const result = await api.ai.classify(title, content);
      return result.category as LogCategory;
    } catch {
      return 'other';
    } finally {
      setClassifying(false);
    }
  };

  return { classify, classifying };
}
    ​​​​​​​​​‌‌​​​​‌​​​​​​​​​‌‌​‌‌‌​​​​​​​​​​‌‌​​‌‌‌​​​​​​​​​‌‌​
    
