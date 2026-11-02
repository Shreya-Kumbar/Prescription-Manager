import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function AppLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background dark:bg-[#0B132B] flex flex-col transition-colors duration-200">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          isSidebarCollapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        <TopBar />
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto animate-fade-in text-text dark:text-[#F1F5F9]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
