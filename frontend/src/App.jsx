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
import { api } from './services/api';

export default function App() {
  const [currentView, setCurrentView] = useState('landing');
  const [aiStatus, setAiStatus] = useState(null);

  useEffect(() => {
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // If on Landing Page
  if (currentView === 'landing') {
    return <LandingPage onEnterApp={(target) => handleNavigate(target || 'overview')} />;
  }

  // Dashboard Views
  return (
    <DashboardLayout
      currentView={currentView}
      onNavigate={handleNavigate}
      onOpenLanding={() => handleNavigate('landing')}
      aiStatus={aiStatus}
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
      {currentView === 'settings' && <SettingsView aiStatus={aiStatus} />}
    </DashboardLayout>
  );
}
