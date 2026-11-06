import React from 'react';
import HeroNetworkCanvas from '../components/HeroNetworkCanvas';
import {
  Shield,
  Network,
  Users,
  AlertTriangle,
  CheckCircle,
  Eye,
  Sliders,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Layers,
  Lock,
  Compass,
  FolderGit2,
} from 'lucide-react';

export default function LandingPage({ onEnterApp, onReplayIntro }) {
  return (
    <div className="min-h-screen bg-[#05070a] text-slate-100 selection:bg-cyan-500/30 font-sans overflow-x-hidden">
      {/* Top Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 h-20 bg-[#05070a]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-[0_0_20px_rgba(6,182,212,0.4)]">
              <Shield className="w-5 h-5 fill-white/20" />
            </div>
            <div>
              <span className="font-display font-bold text-lg text-white tracking-wider block">
                TRUSTMESH
              </span>
              <span className="text-[10px] text-cyan-400 font-mono tracking-widest uppercase">
                Akshay Kumar Modi
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 pr-14 sm:pr-18">
            {onReplayIntro && (
              <button
                onClick={onReplayIntro}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-mono font-semibold transition-all cursor-pointer shadow-sm"
                title="Replay cinematic Netflix-style TrustMesh intro"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Intro Animation</span>
              </button>
            )}

            <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span className="font-mono text-cyan-300">TRUST NETWORK INITIALIZED</span>
            </div>

            <button
              onClick={() => onEnterApp('overview')}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs tracking-wide shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all hover:scale-105 active:scale-95"
            >
              Enter TrustMesh
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-36 pb-28 md:pt-44 md:pb-36 px-6 overflow-hidden min-h-[85vh] flex items-center">
        {/* Interactive canvas background */}
        <HeroNetworkCanvas />

        {/* Ambient Gradient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[650px] h-[350px] bg-cyan-500/10 blur-[130px] pointer-events-none rounded-full" />
        <div className="absolute top-1/3 left-1/4 w-[400px] h-[300px] bg-indigo-500/10 blur-[120px] pointer-events-none rounded-full" />

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          {/* Live status badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-cyan-500/30 text-xs text-cyan-300 mb-8 backdrop-blur-md shadow-lg">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-beacon" />
            <span className="font-mono tracking-wider font-semibold">
              TRUST NETWORK INITIALIZED — PROBLEM 07
            </span>
          </div>

          <h1 className="font-display font-extrabold text-4xl sm:text-6xl lg:text-7xl text-white tracking-tight leading-[1.08] max-w-4xl mx-auto">
            THE OPEN SOURCE ECOSYSTEM DESERVES A{' '}
            <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500 bg-clip-text text-transparent">
              TRUST NETWORK.
            </span>
          </h1>

          <p className="mt-8 text-base sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed font-light">
            Detect coordinated abuse. Share trusted signals. Protect maintainers. Give every genuine contributor a fair chance.
          </p>

          {/* Action CTAs */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => onEnterApp('network')}
              className="px-7 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-sm shadow-[0_0_28px_rgba(6,182,212,0.4)] flex items-center gap-2.5 transition-all hover:scale-105"
            >
              <Network className="w-4 h-4" />
              <span>Explore Trust Network</span>
            </button>

            <button
              onClick={() => onEnterApp('overview')}
              className="px-7 py-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 hover:border-cyan-500/50 font-semibold text-sm flex items-center gap-2.5 transition-all"
            >
              <span>View Intelligence Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Core Principle Callout */}
          <div className="mt-14 inline-block max-w-xl mx-auto p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 backdrop-blur-md text-xs text-slate-300 font-mono">
            <span className="text-cyan-400 font-semibold block mb-1">
              "Trust should travel. Evidence should speak."
            </span>
            <span>A new contributor is not automatically suspicious. An allegation is not proof.</span>
          </div>
        </div>
      </section>

      {/* SECTION: THE PROBLEM */}
      <section className="py-24 px-6 border-t border-slate-800/60 bg-[#070b12]/60 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest">
              Supply Chain Threat Intelligence
            </span>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-white mt-3">
              One Repository Sees a Fraction of the Threat.
            </h2>
            <p className="mt-4 text-slate-400 leading-relaxed text-sm sm:text-base">
              AI-generated pull request spam, synchronized typo-fixes, and templated slop campaigns spread across independent repositories. When maintainers operate in silos, coordinated abuse slips through unnoticed.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="glass-panel p-6 rounded-2xl glass-panel-hover border border-slate-800">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-5">
                <FolderGit2 className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-lg text-white mb-2">1. Isolated Projects</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Each repository sees only its own PR queue. When a bot opens 50 trivial docstring edits across 50 repos, every maintainer treats it as an isolated first-time issue.
              </p>
            </div>

            <div className="glass-panel p-6 rounded-2xl glass-panel-hover border border-rose-900/30">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-5">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-lg text-white mb-2">2. Coordinated Abuse</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Sybil swarms and automated scripts rotate identities and subtle prompt alterations. A single repo can ban an account, but the campaign continues unabated across peer ecosystems.
              </p>
            </div>

            <div className="glass-panel p-6 rounded-2xl glass-panel-hover border border-amber-900/30">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-5">
                <Compass className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-lg text-white mb-2">3. Missing Context</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Maintainers lack a decentralized mechanism to query whether a contributor has positive peer endorsements or unresolved allegations backed by verifiable proof.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: THE SOLUTION */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="glass-panel p-8 sm:p-12 rounded-3xl border border-cyan-500/20 bg-gradient-to-b from-slate-900/80 to-slate-950/90 relative overflow-hidden">
            <div className="max-w-3xl">
              <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest">
                Decentralized Federation Architecture
              </span>
              <h2 className="font-display font-bold text-3xl sm:text-5xl text-white mt-3">
                One Network. Multiple Perspectives. Better Decisions.
              </h2>
              <p className="mt-6 text-slate-300 leading-relaxed text-sm sm:text-base font-light">
                TrustMesh connects independent open-source projects without requiring a centralized moderator or blind trust. Each project configures its own peering weights and policies: a trusted partner's vouch carries weight, while unverified allegations are never used to blindly punish contributors.
              </p>

              <div className="mt-8 flex flex-wrap gap-4 text-xs font-mono">
                <div className="px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-700 text-cyan-300 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-cyan-400" />
                  <span>Zero Central Authority</span>
                </div>
                <div className="px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-700 text-emerald-300 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Cryptographic Provenance</span>
                </div>
                <div className="px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-700 text-amber-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Explainable Decision Trees</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: CORE CAPABILITIES */}
      <section className="py-24 px-6 border-t border-slate-800/60 bg-[#070b12]/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest">
              Platform Features
            </span>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-white mt-3">
              Core Capabilities
            </h2>
            <p className="mt-4 text-slate-400 text-sm sm:text-base">
              Built for production-grade security teams, maintainers, and open-source foundations.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: 'Contributor Trust Profiles',
                desc: 'Unified provenance view showing vouches, reports, PR evidence, and multi-repo contribution history.',
                icon: Users,
                color: 'text-cyan-400',
              },
              {
                title: 'Cross-Project Trust Sharing',
                desc: 'Attributable signed trust records exchanged securely between federated repositories.',
                icon: Network,
                color: 'text-blue-400',
              },
              {
                title: 'Vouch & Denouncement',
                desc: 'Maintainers submit endorsements or reports with mandatory PR evidence URLs and source attribution.',
                icon: ShieldCheck,
                color: 'text-emerald-400',
              },
              {
                title: 'Coordinated Spam Detection',
                desc: 'Deterministic pattern correlation detecting synchronized AI docstring slop bursts across repos.',
                icon: AlertTriangle,
                color: 'text-rose-400',
              },
              {
                title: 'Evidence-Based Evaluation',
                desc: 'Explainable trust assessments that document exactly which rules were applied and which signals counted.',
                icon: Sparkles,
                color: 'text-purple-400',
              },
              {
                title: 'Interactive Trust Network',
                desc: 'Full-featured React Flow visualization with interactive node inspection, filtering, and topological graph.',
                icon: Layers,
                color: 'text-sky-400',
              },
              {
                title: 'Project-Level Policies',
                desc: 'Every project retains complete autonomy over which peer repositories it trusts and how weights apply.',
                icon: Sliders,
                color: 'text-amber-400',
              },
              {
                title: 'New Contributor Fairness',
                desc: 'Fairness Guarantee: First-time contributors are never penalized for having zero historical reputation.',
                icon: Lock,
                color: 'text-teal-400',
              },
            ].map((cap, i) => {
              const Icon = cap.icon;
              return (
                <div
                  key={i}
                  className="glass-panel p-6 rounded-2xl glass-panel-hover border border-slate-800 flex flex-col justify-between"
                >
                  <div>
                    <div className={`w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center ${cap.color} mb-4`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-white text-base mb-2">{cap.title}</h3>
                    <p className="text-slate-400 text-xs leading-relaxed">{cap.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION: HOW IT WORKS */}
      <section className="py-24 px-6 border-t border-slate-800/60">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest">
              Execution Architecture
            </span>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-white mt-3">
              How TrustMesh Operates
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: '01',
                title: 'CONNECT',
                desc: 'Repositories join the mesh and define their selective peer trust policies.',
              },
              {
                step: '02',
                title: 'SHARE',
                desc: 'Projects exchange signed vouches and reports with verifiable PR evidence links.',
              },
              {
                step: '03',
                title: 'ANALYZE',
                desc: 'Deterministic engines correlate activity bursts and cross-repository similarity.',
              },
              {
                step: '04',
                title: 'DECIDE',
                desc: 'Maintainers inspect fully explainable assessments and make fair, human decisions.',
              },
            ].map((step, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 relative overflow-hidden"
              >
                <div className="text-4xl font-display font-extrabold text-cyan-500/20 mb-3">
                  {step.step}
                </div>
                <h3 className="text-base font-bold text-white mb-2 tracking-wide">
                  {step.title}
                </h3>
                <p className="text-slate-400 text-xs leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION: FINAL CTA */}
      <section className="py-24 px-6 border-t border-slate-800/80 bg-gradient-to-b from-[#05070a] to-[#090d16] text-center relative">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display font-extrabold text-3xl sm:text-5xl text-white tracking-tight">
            Build Open Source on Trust, Not Guesswork.
          </h2>
          <p className="mt-5 text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
            Join the decentralized trust network against AI slop and coordinated abuse.
          </p>

          <button
            onClick={() => onEnterApp('overview')}
            className="mt-8 px-9 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm tracking-wide shadow-[0_0_32px_rgba(6,182,212,0.4)] transition-all hover:scale-105"
          >
            Enter TrustMesh
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-slate-900 bg-[#030508] text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-300 font-semibold">TrustMesh</span>
            <span>—</span>
            <span>Problem 07 Hackathon Project</span>
          </div>

          <div className="font-mono text-[11px] text-slate-400">
            Author: Akshay Kumar Modi
          </div>
        </div>
      </footer>
    </div>
  );
}
