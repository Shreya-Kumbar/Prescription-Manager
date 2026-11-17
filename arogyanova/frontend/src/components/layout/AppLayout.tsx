import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function AppLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-transparent flex flex-col transition-colors duration-200">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <div
        className={`flex-1 flex flex-col transition-all duration-300 print:!ml-0 ${
          isSidebarCollapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        <TopBar />
        <main key={location.pathname} className="page-enter flex-1 p-6 md:p-8 print:!p-0 print:!max-w-none max-w-7xl w-full mx-auto text-text dark:text-[#F1F5F9]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
