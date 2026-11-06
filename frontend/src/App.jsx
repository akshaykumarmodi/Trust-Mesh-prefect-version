import React, { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import DashboardLayout from './layouts/DashboardLayout';
import OverviewView from './pages/OverviewView';
import TrustNetworkGraph from './graph/TrustNetworkGraph';
import ContributorsView from './pages/ContributorsView';
import ProjectsView from './pages/ProjectsView';
import VouchesView from './pages/VouchesView';
import DenouncementsView from './pages/DenouncementsView';
import CampaignsView from './pages/CampaignsView';
import EvidenceCenterView from './pages/EvidenceCenterView';
import SettingsView from './pages/SettingsView';
import AdminActivityView from './pages/AdminActivityView';
import AuthModal from './components/AuthModal';
import ExplodingLoader from './components/ExplodingLoader';
import SelfOwnedMailboxModal from './components/SelfOwnedMailboxModal';
import PullRopeToggle from './components/PullRopeToggle';
import { api } from './services/api';

const VALID_VIEWS = [
  'overview',
  'network',
  'contributors',
  'projects',
  'vouches',
  'denouncements',
  'campaigns',
  'evidence',
  'admin',
  'settings'
];

function getInitialView() {
  // 1. URL hash: e.g. #vouches, #projects
  const hash = (window.location.hash || '').replace(/^#\/?/, '').trim().toLowerCase();
  if (VALID_VIEWS.includes(hash)) {
    return hash;
  }
  // 2. URL pathname: e.g. /vouches, /projects
  const path = (window.location.pathname || '').replace(/^\//, '').trim().toLowerCase();
  if (VALID_VIEWS.includes(path)) {
    return path;
  }
  // 3. Stored session view in localStorage
  try {
    const stored = localStorage.getItem('trustmesh_current_view');
    if (stored && VALID_VIEWS.includes(stored)) {
      return stored;
    }
  } catch {}
  return 'landing';
}

function getInitialLoading(initialView) {
  // Skip exploding intro when refreshing or directly visiting an internal route
  if (initialView !== 'landing') {
    return false;
  }
  try {
    const introDone = sessionStorage.getItem('trustmesh_intro_completed');
    if (introDone === 'true') {
      return false;
    }
  } catch {}
  return true;
}

export default function App() {
  const [initialView] = useState(getInitialView);
  const [isLoading, setIsLoading] = useState(() => getInitialLoading(initialView));
  const [currentView, setCurrentView] = useState(initialView);
  const [aiStatus, setAiStatus] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [mailboxOpen, setMailboxOpen] = useState(false);

  // Dark & Light Theme State (Persisted in localStorage)
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('trustmesh_theme') || 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
    try {
      localStorage.setItem('trustmesh_theme', theme);
    } catch {}
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    // Synchronize browser history / hash change events
    const handleHashChange = () => {
      const hash = (window.location.hash || '').replace(/^#\/?/, '').trim().toLowerCase();
      if (VALID_VIEWS.includes(hash)) {
        setCurrentView(hash);
        setIsLoading(false);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    // Check local storage for existing session
    try {
      const storedUser = localStorage.getItem('trustmesh_user');
      if (storedUser) {
        setCurrentUser(JSON.parse(storedUser));
      }
    } catch {
      // ignore
    }

    async function checkStatus() {
      try {
        const status = await api.getAIStatus();
        setAiStatus(status);
      } catch (e) {
        console.warn('AI status check failed, using deterministic mode:', e);
        setAiStatus({
          model_name: 'GPT-OSS-120B',
          is_live_configured: false,
          mode: 'Deterministic Fallback Active',
        });
      }
    }
    checkStatus();
  }, []);

  const handleNavigate = (view) => {
    setCurrentView(view);
    try {
      localStorage.setItem('trustmesh_current_view', view);
      if (view === 'landing') {
        if (window.location.hash) {
          history.pushState(null, '', window.location.pathname);
        }
      } else {
        window.location.hash = `#${view}`;
      }
    } catch {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoaderComplete = () => {
    setIsLoading(false);
    try {
      sessionStorage.setItem('trustmesh_intro_completed', 'true');
    } catch {}
  };

  const handleLogout = async () => {
    try {
      await api.logout().catch(() => {});
    } finally {
      localStorage.removeItem('trustmesh_token');
      localStorage.removeItem('trustmesh_user');
      localStorage.removeItem('trustmesh_admin_key');
      localStorage.removeItem('trustmesh_current_view');
      setCurrentUser(null);
    }
  };

  // Show Moving Exploding Loader on initial site visit
  if (isLoading) {
    return <ExplodingLoader onComplete={handleLoaderComplete} />;
  }

  // If on Landing Page
  if (currentView === 'landing') {
    return (
      <>
        <PullRopeToggle theme={theme} onToggleTheme={handleToggleTheme} />
        <LandingPage onEnterApp={(target) => handleNavigate(target || 'overview')} />
      </>
    );
  }

  // Dashboard Views
  return (
    <>
      <PullRopeToggle theme={theme} onToggleTheme={handleToggleTheme} />
      <DashboardLayout
        currentView={currentView}
        onNavigate={handleNavigate}
        onOpenLanding={() => handleNavigate('landing')}
        aiStatus={aiStatus}
        currentUser={currentUser}
        onOpenAuth={() => setAuthModalOpen(true)}
        onLogout={handleLogout}
        onOpenMailbox={() => setMailboxOpen(true)}
        theme={theme}
      >
        {currentView === 'overview' && <OverviewView onNavigate={handleNavigate} />}
        {currentView === 'network' && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
                Interactive Trust Network
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Live multi-project topological graph powered by React Flow. Drag nodes, zoom, pan, and click any node to inspect explainable provenance.
              </p>
            </div>
            <TrustNetworkGraph
              onSelectContributor={(c) => handleNavigate('contributors')}
              onSelectProject={(p) => handleNavigate('projects')}
            />
          </div>
        )}
        {currentView === 'contributors' && <ContributorsView />}
        {currentView === 'projects' && <ProjectsView />}
        {currentView === 'vouches' && <VouchesView />}
        {currentView === 'denouncements' && <DenouncementsView />}
        {currentView === 'campaigns' && <CampaignsView />}
        {currentView === 'evidence' && <EvidenceCenterView />}
        {currentView === 'admin' && (
          <AdminActivityView
            onOpenAuth={() => setAuthModalOpen(true)}
            currentUser={currentUser}
            theme={theme}
          />
        )}
        {currentView === 'settings' && <SettingsView aiStatus={aiStatus} />}
      </DashboardLayout>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
        }}
      />

      <SelfOwnedMailboxModal
        isOpen={mailboxOpen}
        onClose={() => setMailboxOpen(false)}
      />
    </>
  );
}
