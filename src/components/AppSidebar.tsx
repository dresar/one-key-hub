import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Server,
  KeyRound,
  Link2,
  Play,
  ScrollText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Key,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface AppSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export const menuItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/providers', label: 'Provider AI', icon: Server },
  { path: '/api-keys', label: 'API Key Provider', icon: KeyRound },
  { path: '/unified-api', label: 'Unified API', icon: Link2 },
  { path: '/playground', label: 'Playground', icon: Play },
  { path: '/logs', label: 'Log Aktivitas', icon: ScrollText },
  { path: '/settings', label: 'Profil & Pengaturan', icon: Settings },
  { path: '/docs', label: 'Dokumentasi', icon: BookOpen },
];

export default function AppSidebar({ isCollapsed, onToggle }: AppSidebarProps) {
  const location = useLocation();

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 72 : 256 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="fixed left-0 top-0 bottom-0 z-40 hidden md:flex flex-col bg-sidebar border-r border-sidebar-border"
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
            <Key className="w-5 h-5 text-primary" />
          </div>
          {!isCollapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="font-bold text-lg gradient-text"
            >
              One Key
            </motion.span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={cn(
                    'sidebar-menu-item relative',
                    isActive && 'active'
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute inset-0 rounded-lg bg-primary/10"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  <item.icon className={cn(
                    'w-5 h-5 shrink-0 relative z-10',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )} />
                  {!isCollapsed && (
                    <span className={cn(
                      'relative z-10 truncate',
                      isActive ? 'text-primary font-medium' : 'text-muted-foreground'
                    )}>
                      {item.label}
                    </span>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Toggle Button */}
      <div className="p-3 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="w-full justify-center text-muted-foreground hover:text-foreground"
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5 mr-2" />
              <span>Tutup</span>
            </>
          )}
        </Button>
      </div>
    </motion.aside>
  );
}
