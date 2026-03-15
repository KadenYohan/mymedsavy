import { LayoutDashboard, Pill, ShieldAlert, User, Flame, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';

const navItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Med Vault', url: '/vault', icon: Pill },
  { title: 'Safety', url: '/safety', icon: ShieldAlert },
  { title: 'Profile', url: '/profile', icon: User },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();

  return (
    <Sidebar collapsible="icon" className="gradient-sidebar border-r-0">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted text-xs uppercase tracking-widest mb-2">
            {!collapsed && 'SafeMeds'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const active = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                          active
                            ? 'bg-sidebar-accent text-sidebar-primary'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                        }`}
                        activeClassName=""
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        {!collapsed && <span className="font-medium">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        {!collapsed && (
          <div className="rounded-xl bg-sidebar-accent p-4 mb-3">
            <div className="flex items-center gap-2 mb-1">
              <Flame className="h-4 w-4 text-warning" />
              <span className="text-xs font-semibold text-sidebar-accent-foreground uppercase tracking-wide">Health Summary</span>
            </div>
            <p className="text-2xl font-display font-bold text-sidebar-primary">5 days</p>
            <p className="text-xs text-sidebar-muted">Adherence Streak</p>
          </div>
        )}
        <SignOutButton collapsed={collapsed} />
      </SidebarFooter>
    </Sidebar>
  );
}

function SignOutButton({ collapsed }: { collapsed: boolean }) {
  const { signOut } = useAuth();
  return (
    <button
      onClick={signOut}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all w-full"
    >
      <LogOut className="h-5 w-5 shrink-0" />
      {!collapsed && <span className="font-medium text-sm">Sign Out</span>}
    </button>
  );
}
