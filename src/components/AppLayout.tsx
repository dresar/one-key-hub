import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
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
      <motion.main
        initial={false}
        animate={{ marginLeft: isMobile ? 0 : (isSidebarCollapsed ? 72 : 256) }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="min-h-screen"
      >
        <Outlet />
      </motion.main>
    </div>
  );
}
