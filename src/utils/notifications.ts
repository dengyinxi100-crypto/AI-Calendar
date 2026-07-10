export function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    return Promise.resolve(false);
  }
  if (Notification.permission === 'granted') {
    return Promise.resolve(true);
  }
  return Notification.requestPermission().then(p => p === 'granted');
}

export function hasBrowserNotification(): boolean {
  return 'Notification' in window && Notification.permission === 'granted';
}

export function showNotification(title: string, body: string, onClick?: () => void): void {
  const hasNotification = 'Notification' in window && Notification.permission === 'granted';

  // Electron 环境：使用 IPC 原生通知（后台也可见）
  const electronAPI = (window as any).electronAPI;
  if (electronAPI?.showNotification) {
    electronAPI.showNotification(title, body);
    if (onClick && electronAPI.onNotificationClick) {
      electronAPI.onNotificationClick(onClick);
    }
  }

  if (hasNotification) {
    const notification = new Notification(title, {
      body,
      icon: '/logo.png',
      requireInteraction: true,
    });

    if (onClick) {
      notification.onclick = () => {
        window.focus();
        onClick();
        notification.close();
      };
    }

    setTimeout(() => notification.close(), 15000);
  }

  // 同时触发自定义事件，供应用内 toast 使用
  window.dispatchEvent(new CustomEvent('app-notification', {
    detail: { title, body, onClick },
  }));
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(title: string, body: string, onClick?: () => void): void {
  // 移除旧的 toast
  const oldToast = document.querySelector('.app-toast');
  if (oldToast) oldToast.remove();
  if (toastTimer) clearTimeout(toastTimer);

  const toast = document.createElement('div');
  toast.className = 'app-toast';
  toast.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; z-index: 9999;
    background: var(--bg-card); border: 1px solid var(--border-light);
    border-radius: 16px; padding: 16px 20px; min-width: 280px;
    box-shadow: var(--shadow-lg);
    cursor: pointer; animation: slideInRight 0.3s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
  `;

  toast.innerHTML = `
    <div style="display: flex; align-items: flex-start; gap: 12px;">
      <span style="font-size: 1.25rem; line-height: 1; opacity: 0.8;">&#128276;</span>
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-primary); margin-bottom: 4px;">${title}</div>
        <div style="font-size: 0.75rem; color: var(--text-secondary); white-space: pre-wrap;">${body}</div>
      </div>
      <button class="toast-close" style="color: var(--text-tertiary); background: none; border: none; cursor: pointer; font-size: 1rem; padding: 0; flex-shrink: 0;">&times;</button>
    </div>
  `;

  toast.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.toast-close')) return;
    if (onClick) onClick();
    toast.remove();
    if (toastTimer) clearTimeout(toastTimer);
  });

  toast.querySelector('.toast-close')?.addEventListener('click', () => {
    toast.remove();
    if (toastTimer) clearTimeout(toastTimer);
  });

  document.body.appendChild(toast);
  toastTimer = setTimeout(() => {
    toast.remove();
    toastTimer = null;
  }, 10000);
}
    ​​​​​‌‌‌‌​​​​​​​​​​​​​‌​‌‌‌​​​​​​​​​​‌‌​​‌‌‌​​​​​​​​​‌‌‌​‌​‌
    
