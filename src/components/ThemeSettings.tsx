import React from 'react';
import { ThemeMode, ThemeColor, THEME_COLORS } from '../utils/types';
import { IconSun, IconMoon } from './Icons';

interface ThemeSettingsProps {
  mode: ThemeMode;
  color: ThemeColor;
  onSetMode: (m: ThemeMode) => void;
  onSetColor: (c: ThemeColor) => void;
}

const ThemeSettings: React.FC<ThemeSettingsProps> = ({ mode, color, onSetMode, onSetColor }) => {
  return (
    <div style={{ maxWidth: 480 }}>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <h2 className="page-title">主题设置</h2>
      </div>
      <div className="theme-settings">
        <div>
          <div className="theme-section-label">外观模式</div>
          <div className="mode-switch">
            <button
              className={`mode-switch-btn ${mode === 'light' ? 'active' : ''}`}
              onClick={() => onSetMode('light')}
            >
              <IconSun size={16} />
              <span>浅色</span>
            </button>
            <button
              className={`mode-switch-btn ${mode === 'dark' ? 'active' : ''}`}
              onClick={() => onSetMode('dark')}
            >
              <IconMoon size={16} />
              <span>深色</span>
            </button>
          </div>
        </div>
        <div>
          <div className="theme-section-label">主题色</div>
          <div className="theme-color-grid">
            {THEME_COLORS.map(theme => (
              <button
                key={theme.key}
                className={`theme-color-swatch ${color === theme.key ? 'selected' : ''}`}
                style={{ background: theme.light }}
                onClick={() => onSetColor(theme.key)}
                title={theme.label}
                aria-label={`选择 ${theme.label} 主题`}
              >
                {theme.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemeSettings;
