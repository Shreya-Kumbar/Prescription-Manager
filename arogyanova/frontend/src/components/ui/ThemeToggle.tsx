import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export default function ThemeToggle({ className = '', showLabel = false }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`theme-btn relative inline-flex items-center justify-center p-2 rounded-lg text-text-secondary dark:text-slate-300 hover:bg-background dark:hover:bg-slate-800 hover:text-text dark:hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary ${className}`}
    >
      <div className="relative w-5 h-5 flex items-center justify-center">
        {isDark ? (
          <Sun className="theme-sun w-5 h-5 text-amber-400 animate-fade-in" />
        ) : (
          <Moon className="theme-moon w-5 h-5 text-slate-600 dark:text-slate-300" />
        )}
      </div>
      {showLabel && (
        <span className="ml-2 text-xs font-medium">
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </span>
      )}
    </button>
  );
}
