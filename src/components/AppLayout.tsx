import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { Outlet } from 'react-router-dom';

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <div className="hidden md:block">
          <AppSidebar />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b px-4 bg-card/80 backdrop-blur-sm sticky top-0 z-40">
            <SidebarTrigger className="hidden md:flex" />
            <h1 className="font-display font-bold text-lg text-foreground">SafeMeds</h1>
          </header>
          <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
            <Outlet />
          </main>
        </div>
      </div>
      <MobileBottomNav />
    </SidebarProvider>
  );
}
