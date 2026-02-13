import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PanelLeft, User, ChevronDown, Settings, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { menuItems } from '@/components/AppSidebar';
import { cn } from '@/lib/utils';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
}

export default function AppHeader({ title, subtitle }: AppHeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-6 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-30">
      <div className="flex items-center gap-3 overflow-hidden">
        <Button
          variant="ghost"
          className="md:hidden p-2 -ml-2 shrink-0"
          onClick={() => setMobileMenuOpen(true)}
        >
          <PanelLeft className="w-5 h-5" />
        </Button>
        <div className="flex flex-col overflow-hidden">
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-lg md:text-xl font-bold truncate"
          >
            {title}
          </motion.h1>
          {subtitle && (
            <p className="text-xs md:text-sm text-muted-foreground truncate hidden md:block">{subtitle}</p>
          )}
        </div>
      </div>

      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex items-center gap-2 px-2 md:px-3 py-2 hover:bg-secondary shrink-0"
          >
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
            <span className="font-medium hidden md:inline">{user?.username}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => navigate('/settings')}>
            <Settings className="w-4 h-4 mr-2" />
            Pengaturan
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
            <LogOut className="w-4 h-4 mr-2" />
            Keluar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-[85vw] sm:max-w-xs bg-sidebar border-sidebar-border text-sidebar-foreground">
          <SheetHeader className="px-6 py-4 border-b border-sidebar-border h-16 flex justify-center">
            <SheetTitle className="text-left font-bold text-lg gradient-text flex items-center gap-2">
               One Key
            </SheetTitle>
          </SheetHeader>
          <nav className="flex-1 py-4 px-3 overflow-y-auto">
            <ul className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      className={({ isActive }) => cn(
                        'sidebar-menu-item relative',
                         isActive && 'active'
                      )}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                     {({ isActive }) => (
                        <>
                          {isActive && (
                            <span className="absolute inset-0 rounded-lg bg-primary/10" />
                          )}
                          <Icon className={cn(
                            'w-5 h-5 shrink-0 relative z-10',
                            isActive ? 'text-primary' : 'text-muted-foreground'
                          )} />
                          <span className={cn(
                            'relative z-10 truncate',
                            isActive ? 'text-primary font-medium' : 'text-muted-foreground'
                          )}>{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
