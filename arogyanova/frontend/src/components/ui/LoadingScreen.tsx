import React from 'react';

export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 relative flex items-center justify-center">
          <img src="/logo.svg" alt="ArogyaNova Logo" className="w-10 h-10 animate-pulse" />
          <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-text">ArogyaNova</h2>
          <p className="text-xs text-text-secondary mt-1">Healthcare, reimagined through innovation</p>
        </div>
      </div>
    </div>
  );
}
