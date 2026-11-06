import React, { useEffect, useRef, useState, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { Shield, Sparkles } from 'lucide-react';

const LETTERS = ['T', 'R', 'U', 'S', 'T', 'M', 'E', 'S', 'H'];

// Multi-spectral vertical ribbons for the signature Netflix-style light explosion
const RIBBON_DATA = [
  { left: '14%', width: '3px', color: '#06b6d4', delay: '0ms', duration: '680ms', blur: '2px' },
  { left: '18%', width: '4px', color: '#3b82f6', delay: '40ms', duration: '720ms', blur: '3px' },
  { left: '22%', width: '2px', color: '#a855f7', delay: '80ms', duration: '640ms', blur: '1px' },
  { left: '26%', width: '5px', color: '#22d3ee', delay: '20ms', duration: '760ms', blur: '4px' },
  { left: '30%', width: '3px', color: '#ec4899', delay: '60ms', duration: '700ms', blur: '2px' },
  { left: '34%', width: '6px', color: '#ffffff', delay: '0ms', duration: '800ms', blur: '5px' },
  { left: '38%', width: '4px', color: '#06b6d4', delay: '50ms', duration: '740ms', blur: '3px' },
  { left: '42%', width: '5px', color: '#3b82f6', delay: '20ms', duration: '780ms', blur: '4px' },
  { left: '46%', width: '7px', color: '#38bdf8', delay: '0ms', duration: '820ms', blur: '6px' },
  { left: '50%', width: '9px', color: '#ffffff', delay: '0ms', duration: '850ms', blur: '8px' },
  { left: '54%', width: '7px', color: '#38bdf8', delay: '20ms', duration: '820ms', blur: '6px' },
  { left: '58%', width: '5px', color: '#a855f7', delay: '40ms', duration: '780ms', blur: '4px' },
  { left: '62%', width: '4px', color: '#ec4899', delay: '70ms', duration: '740ms', blur: '3px' },
  { left: '66%', width: '6px', color: '#ffffff', delay: '10ms', duration: '800ms', blur: '5px' },
  { left: '70%', width: '3px', color: '#10b981', delay: '40ms', duration: '700ms', blur: '2px' },
  { left: '74%', width: '5px', color: '#06b6d4', delay: '60ms', duration: '760ms', blur: '4px' },
  { left: '78%', width: '2px', color: '#3b82f6', delay: '90ms', duration: '640ms', blur: '1px' },
  { left: '82%', width: '4px', color: '#a855f7', delay: '30ms', duration: '720ms', blur: '3px' },
  { left: '86%', width: '3px', color: '#22d3ee', delay: '50ms', duration: '680ms', blur: '2px' },
];

export default function ExplodingLoader({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('IGNITE'); // 'IGNITE' | 'SURGE' | 'DETONATE' | 'FADEOUT'
  const [statusText, setStatusText] = useState('INITIALIZING SECURE PROTOCOL...');

  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const particlesRef = useRef([]);
  const shockwavesRef = useRef([]);
  const backgroundNodesRef = useRef([]);

  // Telemetry status messages
  useEffect(() => {
    if (progress < 25) {
      setStatusText('INITIALIZING SECURE TRUST PROTOCOLS...');
    } else if (progress < 50) {
      setStatusText('CONNECTING FEDERATED REPOSITORY GRAPH...');
    } else if (progress < 75) {
      setStatusText('CALIBRATING AI RADAR & PEER CONSENSUS...');
    } else if (progress < 95) {
      setStatusText('SYNCHRONIZING VERIFIED EVIDENCE LEDGER...');
    } else {
      setStatusText('TRUST CANONICAL ONLINE • DETONATING ACCESS GATE...');
    }
  }, [progress]);

  // Master timeline controller (~2.1 seconds total)
  useEffect(() => {
    const startTime = Date.now();
    const duration = 2100;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(Math.round((elapsed / duration) * 100), 100);
      setProgress(pct);

      if (elapsed >= 650 && elapsed < 1350) {
        setPhase((prev) => (prev === 'IGNITE' ? 'SURGE' : prev));
      } else if (elapsed >= 1350 && elapsed < 1950) {
        setPhase((prev) => {
          if (prev !== 'DETONATE' && prev !== 'FADEOUT') {
            triggerNetflixDetonation();
            return 'DETONATE';
          }
          return prev;
        });
      } else if (elapsed >= duration) {
        clearInterval(interval);
        setPhase('FADEOUT');
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 220);
      }
    }, 16);

    return () => clearInterval(interval);
  }, []);

  // Trigger the iconic Netflix-style explosion
  const triggerNetflixDetonation = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // 180 high-velocity particle sparks shooting in 3D radial space
      const colors = ['#06b6d4', '#38bdf8', '#3b82f6', '#a855f7', '#ec4899', '#ffffff', '#10b981'];
      const newParticles = [];

      for (let i = 0; i < 180; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 20 + 6;
        const size = Math.random() * 4.5 + 1.5;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const life = Math.random() * 40 + 25;

        newParticles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size,
          color,
          alpha: 1,
          life,
          maxLife: life,
          decay: Math.random() * 0.035 + 0.02,
          gravity: 0.03,
          drag: 0.96,
        });
      }
      particlesRef.current = newParticles;

      // Expanding concentric shockwave rings
      shockwavesRef.current = [
        { radius: 10, maxRadius: Math.max(canvas.width, canvas.height) * 0.95, alpha: 1, color: '#06b6d4', width: 6, speed: 42 },
        { radius: 5, maxRadius: Math.max(canvas.width, canvas.height) * 1.1, alpha: 0.9, color: '#38bdf8', width: 4, speed: 52 },
        { radius: 0, maxRadius: Math.max(canvas.width, canvas.height) * 1.3, alpha: 0.85, color: '#a855f7', width: 3, speed: 64 },
        { radius: 0, maxRadius: Math.max(canvas.width, canvas.height) * 1.5, alpha: 0.7, color: '#ffffff', width: 2, speed: 76 }
      ];
    }

    // High energy confetti blast
    try {
      confetti({
        particleCount: 80,
        spread: 120,
        origin: { y: 0.5, x: 0.5 },
        colors: ['#06b6d4', '#38bdf8', '#3b82f6', '#a855f7', '#ffffff'],
        disableForReducedMotion: false,
      });
    } catch {}
  };

  // Canvas particle and background constellation render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      // Ambient floating mesh nodes
      const nodes = [];
      const count = Math.floor((canvas.width * canvas.height) / 24000);
      for (let i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          radius: Math.random() * 2 + 1,
          color: Math.random() > 0.4 ? 'rgba(6, 182, 212, 0.45)' : 'rgba(168, 85, 247, 0.35)'
        });
      }
      backgroundNodesRef.current = nodes;
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    let tick = 0;
    const render = () => {
      tick++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Draw subtle ambient background network
      const nodes = backgroundNodesRef.current;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.x += n.vx;
        n.y += n.vy;

        if (n.x < 0) n.x = canvas.width;
        if (n.x > canvas.width) n.x = 0;
        if (n.y < 0) n.y = canvas.height;
        if (n.y > canvas.height) n.y = 0;

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.fill();

        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          const dist = Math.hypot(n.x - n2.x, n.y - n2.y);
          if (dist < 110) {
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.strokeStyle = `rgba(6, 182, 212, ${0.15 * (1 - dist / 110)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      // 2. Render shockwave expanding rings
      const waves = shockwavesRef.current;
      for (let i = waves.length - 1; i >= 0; i--) {
        const sw = waves[i];
        sw.radius += sw.speed;
        sw.alpha = Math.max(0, 1 - sw.radius / sw.maxRadius);

        if (sw.alpha > 0.01 && sw.radius < sw.maxRadius) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(canvas.width / 2, canvas.height / 2, sw.radius, 0, Math.PI * 2);
          ctx.strokeStyle = sw.color;
          ctx.globalAlpha = sw.alpha;
          ctx.lineWidth = sw.width;
          ctx.shadowColor = sw.color;
          ctx.shadowBlur = 24;
          ctx.stroke();
          ctx.restore();
        } else {
          waves.splice(i, 1);
        }
      }

      // 3. Render explosion particle sparks
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        p.alpha = Math.max(0, p.life / p.maxLife);

        if (p.alpha > 0.02) {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 12;
          ctx.fill();
          ctx.restore();
        } else {
          particles.splice(i, 1);
        }
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Quick skip handler
  const handleSkip = () => {
    setPhase('FADEOUT');
    setTimeout(() => {
      if (onComplete) onComplete();
    }, 120);
  };

  // Keyboard shortcut: Escape or Space to skip
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.code === 'Space') {
        handleSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      onClick={handleSkip}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#010308] overflow-hidden select-none transition-all duration-500 cursor-pointer ${
        phase === 'FADEOUT' ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
      style={{ perspective: '1200px' }}
    >
      {/* Background canvas for mesh grid & particles */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Deep cinematic radial spotlights */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.18)_0%,rgba(59,130,246,0.08)_35%,rgba(168,85,247,0.04)_60%,transparent_75%)] pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black to-transparent pointer-events-none opacity-80" />
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent pointer-events-none opacity-80" />

      {/* Skip Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleSkip();
        }}
        className="absolute top-6 right-6 px-4 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-[11px] font-mono text-slate-300 hover:text-cyan-300 transition-all z-30 flex items-center gap-1.5 shadow-lg backdrop-blur-md cursor-pointer"
      >
        <span>Skip Intro</span>
        <span className="text-cyan-400">→</span>
      </button>

      {/* ========================================================================= */}
      {/* NETFLIX-STYLE MULTI-COLOR VERTICAL LIGHT RIBBONS DETONATION */}
      {/* ========================================================================= */}
      {phase === 'DETONATE' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 overflow-hidden">
          {/* Anamorphic wide lens flare horizontal beam */}
          <div className="absolute w-[200vw] h-1.5 bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_80px_20px_#22d3ee] animate-netflix-horizon" />

          {/* Central Blinding Core Flare */}
          <div className="absolute w-48 h-48 rounded-full bg-white blur-xl shadow-[0_0_160px_60px_#06b6d4] animate-ping" />
          <div className="absolute w-32 h-32 rounded-full bg-cyan-300 blur-lg shadow-[0_0_120px_40px_#3b82f6]" />

          {/* The Vertical Streaming Ribbons (Netflix Signature Spectrum Breakdown) */}
          <div className="relative w-full max-w-4xl h-full flex items-center justify-center">
            {RIBBON_DATA.map((r, i) => (
              <div
                key={i}
                className="absolute top-1/2 -translate-y-1/2"
                style={{
                  left: r.left,
                  width: r.width,
                  height: '100vh',
                  background: `linear-gradient(180deg, transparent 0%, ${r.color} 30%, #ffffff 50%, ${r.color} 70%, transparent 100%)`,
                  boxShadow: `0 0 25px 5px ${r.color}`,
                  filter: `blur(${r.blur})`,
                  animation: `netflix-ribbon-stream ${r.duration} cubic-bezier(0.12, 0.8, 0.32, 1) forwards`,
                  animationDelay: r.delay,
                  transformOrigin: 'center center',
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MONOLITHIC NETFLIX-STYLE "TRUSTMESH" BRAND REVEAL */}
      {/* ========================================================================= */}
      <div
        className={`relative flex flex-col items-center justify-center z-10 transition-transform duration-700 ${
          phase === 'DETONATE'
            ? 'scale-125 animate-netflix-rumble'
            : phase === 'SURGE'
            ? 'scale-105'
            : 'scale-100'
        }`}
      >
        {/* Glowing Shield Monogram Emblem */}
        <div className="relative mb-5 flex items-center justify-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-blue-600/20 to-purple-600/20 border border-cyan-400/60 shadow-[0_0_40px_rgba(6,182,212,0.5)] backdrop-blur-md flex items-center justify-center">
            <Shield className="w-8 h-8 sm:w-10 sm:h-10 text-cyan-300 drop-shadow-[0_0_20px_rgba(6,182,212,1)]" />
          </div>
          {/* Subtle spinning cyber ring */}
          <div className="absolute -inset-2 rounded-2xl border border-cyan-500/30 border-dashed animate-spin-slow pointer-events-none" />
        </div>

        {/* The Monolithic Brand Wordmark: T R U S T M E S H */}
        <div className="relative overflow-visible px-4 py-2">
          {/* Horizon Laser Line below */}
          <div className="absolute -bottom-1 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_20px_#06b6d4] animate-netflix-horizon" />

          {/* Letter-by-Letter Stagger Container */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-[0.25em] sm:tracking-[0.32em] uppercase select-none flex items-center justify-center font-display">
            {LETTERS.map((char, index) => {
              // Stagger delay for each letter
              const delay = `${index * 55}ms`;
              return (
                <span
                  key={index}
                  className="relative inline-block text-transparent bg-clip-text transition-all duration-700 transform"
                  style={{
                    animation: `netflix-letter-rise 0.75s cubic-bezier(0.16, 1, 0.3, 1) both`,
                    animationDelay: delay,
                    backgroundImage:
                      phase === 'SURGE' || phase === 'DETONATE'
                        ? 'linear-gradient(180deg, #ffffff 0%, #a5f3fc 35%, #06b6d4 70%, #2563eb 100%)'
                        : 'linear-gradient(180deg, #ffffff 0%, #e2e8f0 45%, #67e8f9 85%, #0284c7 100%)',
                    filter:
                      phase === 'SURGE' || phase === 'DETONATE'
                        ? 'drop-shadow(0 0 30px rgba(6, 182, 212, 0.9)) drop-shadow(0 0 60px rgba(59, 130, 246, 0.7))'
                        : 'drop-shadow(0 0 16px rgba(6, 182, 212, 0.6))',
                  }}
                >
                  {char}
                </span>
              );
            })}
          </h1>

          {/* Light Sweep Anamorphic Glint Across Brand Name */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="w-1/3 h-full bg-gradient-to-r from-transparent via-white to-transparent opacity-60 skew-x-[-25deg] animate-netflix-sweep shadow-[0_0_35px_#ffffff]" />
          </div>
        </div>

        {/* Cinematic Subtitle & Verification Tag */}
        <div
          className={`mt-4 text-center transition-all duration-700 ${
            phase === 'SURGE' || phase === 'DETONATE'
              ? 'opacity-100 translate-y-0'
              : 'opacity-70 translate-y-1'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4] animate-ping" />
            <span className="text-[10px] sm:text-xs font-mono font-semibold uppercase tracking-[0.35em] text-cyan-300">
              DECENTRALIZED TRUST PROTOCOL
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4] animate-ping" />
          </div>
        </div>

        {/* Sleek Minimalist Progress HUD */}
        <div className="mt-8 w-64 sm:w-80 space-y-2">
          {/* Progress Bar with Glowing Head */}
          <div className="h-1.5 w-full bg-slate-900/90 border border-cyan-500/30 rounded-full overflow-hidden p-0.5 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 rounded-full transition-all duration-75 relative"
              style={{ width: `${progress}%` }}
            >
              <span className="absolute right-0 top-0 bottom-0 w-2.5 bg-white rounded-full shadow-[0_0_12px_#ffffff]" />
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-slate-400 truncate max-w-[200px]">{statusText}</span>
            <span className="text-cyan-400 font-bold">{progress}%</span>
          </div>
        </div>
      </div>

      {/* Ambient bottom caption */}
      <div className="absolute bottom-6 text-[10px] font-mono text-slate-500 tracking-[0.3em] uppercase">
        VERIFIABLE CRYPTOGRAPHIC CONSENSUS
      </div>
    </div>
  );
}
