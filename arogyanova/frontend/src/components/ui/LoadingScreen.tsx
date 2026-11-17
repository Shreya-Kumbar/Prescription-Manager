import React from 'react';

export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center gap-5">
        <div className="relative w-20 h-20 flex items-center justify-center">
          {/* spinning gradient ring */}
          <div
            className="absolute inset-0 rounded-full animate-spin"
            style={{
              background: 'conic-gradient(from 0deg, transparent 0deg, #4FA67A 300deg, #4FA67A 360deg)',
              WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))',
              mask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))',
              animationDuration: '1.1s',
            }}
          />
          <img src="/logo.svg" alt="ArogyaNova Logo" className="relative w-11 h-11 float" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-gradient">ArogyaNova</h2>
          <p className="text-xs text-text-secondary dark:text-slate-400 mt-1">Healthcare, reimagined through innovation</p>
        </div>
        <div className="flex gap-1.5" aria-label="Loading">
          {['#4FA67A', '#7CC4A0', '#E6B566'].map((c, i) => (
            <span
              key={c}
              className="w-2 h-2 rounded-full animate-bounce"
              style={{ backgroundColor: c, animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
