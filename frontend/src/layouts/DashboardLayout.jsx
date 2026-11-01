import React, { useState } from 'react';
import {
  Shield,
  Network,
  Users,
  FolderGit2,
  CheckCircle,
  AlertTriangle,
  Flame,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  ExternalLink,
  Cpu,
  ArrowUpRight,
  Activity,
  LogOut,
  UserCheck,
} from 'lucide-react';

export default function DashboardLayout({
  currentView,
  onNavigate,
  onOpenLanding,
  aiStatus,
  currentUser,
  onOpenAuth,
  onLogout,
  children,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { id: 'overview', label: 'Overview', icon: Shield },
    { id: 'network', label: 'Trust Network', icon: Network },
    { id: 'contributors', label: 'Contributors', icon: Users },
    { id: 'projects', label: 'Projects', icon: FolderGit2 },
    { id: 'vouches', label: 'Vouches', icon: CheckCircle },
    { id: 'denouncements', label: 'Denouncements', icon: AlertTriangle },
    { id: 'campaigns', label: 'Campaign Detection', icon: Flame },
    { id: 'evidence', label: 'Evidence Center', icon: FileText },
    { id: 'admin', label: 'Admin Monitoring', icon: Activity, badge: 'ADMIN' },
    { id: 'settings', label: 'Settings & Federation', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-[#05070a] text-slate-100 overflow-hidden font-sans">
      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 flex flex-col border-r border-slate-800/80 bg-[#090d16]/95 backdrop-blur-xl transition-all duration-300 ease-in-out ${
          collapsed ? 'w-20' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80">
          <div
            className="flex items-center gap-3 cursor-pointer overflow-hidden"
            onClick={onOpenLanding}
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-[0_0_15px_rgba(6,182,212,0.4)] shrink-0">
              <Shield className="w-5 h-5 fill-white/20" />
            </div>
            {!collapsed && (
              <div className="truncate">
                <span className="font-display font-bold text-base text-white tracking-wider flex items-center gap-1.5">
                  TRUSTMESH
                </span>
                <span className="text-[10px] text-cyan-400 font-mono tracking-widest block uppercase">
                  Team Nexora
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Live Network Status Indicator */}
        {!collapsed && (
          <div className="px-4 py-3 border-b border-slate-800/50 bg-slate-950/40">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              <span className="text-[10px] font-mono font-medium text-cyan-300 tracking-wider">
                NETWORK INITIALIZED
              </span>
            </div>
          </div>
        )}

        {/* Nav Items */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-[0_0_16px_rgba(6,182,212,0.15)] font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                {!collapsed && (
                  <div className="flex items-center justify-between flex-1 truncate">
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer / AI Status Badge */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/60">
          {!collapsed ? (
            <div className="space-y-2">
              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px]">
                <div className="flex items-center gap-1.5 text-cyan-400 font-mono text-[10px]">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>{aiStatus?.model_name || 'GPT-OSS-120B'}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 truncate">
                  {aiStatus?.mode || 'Deterministic Engine'}
                </div>
              </div>
              <button
                onClick={onOpenLanding}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 text-[11px] transition-colors"
              >
                <span>Landing Page</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLanding}
              title="Return to Landing"
              className="w-full p-2 flex justify-center text-slate-400 hover:text-white"
            >
              <ArrowUpRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-800/80 bg-[#090d16]/80 backdrop-blur-md px-6 flex items-center justify-between gap-4 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-xs text-slate-400 flex items-center gap-2 font-mono">
              <span>TrustMesh OS</span>
              <span>/</span>
              <span className="text-white capitalize font-semibold">{currentView.replace('-', ' ')}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-white font-medium max-w-[140px] truncate">
                    {currentUser.name || currentUser.email}
                  </span>
                  {currentUser.is_admin && (
                    <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[9px] border border-cyan-500/30">
                      ADMIN
                    </span>
                  )}
                </div>
                <button
                  onClick={onLogout}
                  className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs transition-all shadow-[0_0_15px_rgba(6,182,212,0.25)] flex items-center gap-1.5"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Sign In / Admin</span>
              </button>
            )}

            <button
              onClick={onOpenLanding}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-medium transition-colors"
            >
              Landing Page
            </button>
          </div>
        </header>

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-grid-pattern">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
