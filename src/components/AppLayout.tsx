import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import { useIsMobile } from '@/hooks/use-mobile';

export default function AppLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <main
        style={{
          marginLeft: isMobile ? 0 : (isSidebarCollapsed ? 72 : 256),
          transition: 'margin-left 0.2s ease-in-out',
        }}
        className="min-h-screen"
      >
        <Outlet />
      </main>
    </div>
  );
}
