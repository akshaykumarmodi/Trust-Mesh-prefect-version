import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Shield, Sparkles, Zap, Activity } from 'lucide-react';

export default function ExplodingLoader({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('INITIALIZING DECENTRALIZED MESH...');
  const [isExploding, setIsExploding] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const particlesRef = useRef([]);
  const shockwavesRef = useRef([]);
  const backgroundNodesRef = useRef([]);

  // Telemetry status messages
  useEffect(() => {
    if (progress < 25) {
      setStatusText('INITIALIZING DECENTRALIZED TRUST PROTOCOLS...');
    } else if (progress < 50) {
      setStatusText('CONNECTING FEDERATED REPOSITORY GRAPH...');
    } else if (progress < 75) {
      setStatusText('CALIBRATING AI SLOP RADAR & PEER POLICIES...');
    } else if (progress < 95) {
      setStatusText('SYNCHRONIZING VERIFIED EVIDENCE LEDGER...');
    } else {
      setStatusText('SYSTEM ONLINE • DETONATING ACCESS GATE...');
    }
  }, [progress]);

  // Smooth loading progress progression (Fast & responsive: ~950ms)
  useEffect(() => {
    const startTime = Date.now();
    const duration = 950; // Fast and snappy loading progression

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(Math.round((elapsed / duration) * 100), 100);
      setProgress(pct);

      if (pct >= 100) {
        clearInterval(timer);
        triggerExplosion();
      }
    }, 16);

    return () => clearInterval(timer);
  }, []);

  // Trigger high-energy particle explosion
  const triggerExplosion = () => {
    setIsExploding(true);

    const canvas = canvasRef.current;
    if (canvas) {
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // Create 180 high-velocity explosive particle sparks
      const colors = ['#06b6d4', '#3b82f6', '#10b981', '#a855f7', '#38bdf8', '#f59e0b', '#ffffff'];
      const newParticles = [];

      for (let i = 0; i < 180; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 16 + 5;
        const size = Math.random() * 4 + 1.5;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const life = Math.random() * 35 + 25;

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
          gravity: 0.04,
          drag: 0.955,
        });
      }
      particlesRef.current = newParticles;

      // Fast expanding shockwave rings
      shockwavesRef.current = [
        { radius: 10, maxRadius: Math.max(canvas.width, canvas.height) * 0.9, alpha: 1, color: '#06b6d4', width: 6, speed: 36 },
        { radius: 5, maxRadius: Math.max(canvas.width, canvas.height) * 1.0, alpha: 0.9, color: '#3b82f6', width: 4, speed: 44 },
        { radius: 0, maxRadius: Math.max(canvas.width, canvas.height) * 1.2, alpha: 0.8, color: '#a855f7', width: 3, speed: 52 }
      ];
    }

    // Secondary festive confetti blast
    try {
      confetti({
        particleCount: 70,
        spread: 110,
        origin: { y: 0.5, x: 0.5 },
        colors: ['#06b6d4', '#3b82f6', '#10b981', '#a855f7'],
        disableForReducedMotion: false,
      });
    } catch {
      // safe fallback
    }

    // Schedule smooth, synchronized transition into website
    setTimeout(() => {
      setIsFadingOut(true);
      setTimeout(() => {
        if (onComplete) onComplete();
      }, 240);
    }, 320);
  };

  // Canvas particle and background mesh physics loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      // Seed ambient background floating nodes
      const nodes = [];
      const count = Math.floor((canvas.width * canvas.height) / 28000);
      for (let i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.6,
          radius: Math.random() * 2 + 1,
          color: Math.random() > 0.4 ? 'rgba(6, 182, 212, 0.4)' : 'rgba(59, 130, 246, 0.4)'
        });
      }
      backgroundNodesRef.current = nodes;
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Animation render loop
    let tick = 0;
    const render = () => {
      tick++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Draw ambient floating network nodes & connecting lines
      const nodes = backgroundNodesRef.current;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.x += n.vx;
        n.y += n.vy;

        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.fill();

        // Connect nearby nodes
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          const dx = n.x - n2.x;
          const dy = n.y - n2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.strokeStyle = `rgba(6, 182, 212, ${0.15 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }
      }

      // 2. Render expanding shockwave rings (using lighter composite for fast GPU blend)
      const shockwaves = shockwavesRef.current;
      if (shockwaves.length > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = shockwaves.length - 1; i >= 0; i--) {
          const sw = shockwaves[i];
          sw.radius += sw.speed;
          sw.alpha = Math.max(0, 1 - sw.radius / sw.maxRadius);

          if (sw.alpha > 0) {
            ctx.beginPath();
            ctx.arc(canvas.width / 2, canvas.height / 2, sw.radius, 0, Math.PI * 2);
            ctx.strokeStyle = sw.color;
            ctx.lineWidth = sw.width * sw.alpha;
            ctx.globalAlpha = sw.alpha;
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // 3. Render exploding particles (fast 60/120fps GPU blend without CPU blur lag)
      const particles = particlesRef.current;
      if (particles.length > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= p.drag;
          p.vy = p.vy * p.drag + p.gravity;
          p.alpha -= p.decay;

          if (p.alpha > 0) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0.5, p.size * p.alpha), 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.max(0, p.alpha);
            ctx.fill();
          } else {
            particles.splice(i, 1);
          }
        }
        ctx.restore();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const handleSkip = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      if (onComplete) onComplete();
    }, 200);
  };

  return (
    <div
      onClick={handleSkip}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#030712] overflow-hidden select-none transition-all duration-500 cursor-pointer ${
        isFadingOut ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Background canvas for mesh grid & particles */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Radial cyber glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.12)_0%,rgba(59,130,246,0.06)_40%,transparent_70%)] pointer-events-none" />

      {/* Skip Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleSkip();
        }}
        className="absolute top-6 right-6 px-3.5 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-[11px] font-mono text-slate-400 hover:text-cyan-300 transition-all z-10 flex items-center gap-1.5 shadow-md"
      >
        <span>Skip Intro</span>
        <span>→</span>
      </button>

      {/* Central Moving Core Container */}
      <div className="relative flex flex-col items-center justify-center z-10">
        {/* Core Moving & Pulsing Body */}
        <div
          className={`relative flex items-center justify-center transition-all duration-300 ${
            isExploding ? 'scale-125 opacity-0 pointer-events-none' : 'animate-bounce-subtle'
          }`}
        >
          {/* Outer rotating cyber ring */}
          <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-full border border-dashed border-cyan-500/30 animate-spin-slow flex items-center justify-center" />

          {/* Middle counter-rotating neon ring */}
          <div className="absolute w-40 h-40 sm:w-48 sm:h-48 rounded-full border border-cyan-400/50 animate-reverse-spin flex items-center justify-center">
            <span className="absolute -top-1.5 w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_15px_#06b6d4]" />
            <span className="absolute -bottom-1.5 w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_15px_#3b82f6]" />
          </div>

          {/* Glowing central orb */}
          <div className="absolute w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-cyan-500/30 via-blue-600/30 to-purple-600/30 border border-cyan-400/80 shadow-[0_0_50px_rgba(6,182,212,0.6)] backdrop-blur-md flex items-center justify-center">
            <Shield className="w-10 h-10 sm:w-12 sm:h-12 text-cyan-300 drop-shadow-[0_0_15px_rgba(6,182,212,0.9)] animate-pulse" />
          </div>

          {/* Exploding flash burst aura */}
          {isExploding && (
            <div className="absolute -inset-10 rounded-full bg-cyan-400/40 shadow-[0_0_120px_#06b6d4] animate-ping" />
          )}
        </div>

        {/* Brand & Progress Section */}
        <div className="mt-10 text-center max-w-sm px-4 space-y-3">
          <div className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="font-display font-black tracking-widest text-xl sm:text-2xl text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 uppercase">
              TrustMesh
            </span>
          </div>

          {/* Status Message */}
          <p className="text-[11px] sm:text-xs font-mono text-cyan-300 tracking-wider h-5 overflow-hidden text-ellipsis whitespace-nowrap">
            {statusText}
          </p>

          {/* Progress Bar */}
          <div className="w-64 sm:w-72 mx-auto">
            <div className="h-2 w-full bg-slate-900/90 border border-cyan-500/40 rounded-full overflow-hidden p-0.5 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 rounded-full transition-all duration-75 relative"
                style={{ width: `${progress}%` }}
              >
                <span className="absolute right-0 top-0 bottom-0 w-2 bg-white rounded-full shadow-[0_0_10px_#ffffff]" />
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-2">
              <span className="text-cyan-400/80">NEURAL MESH ENGINE</span>
              <span className="font-bold text-white text-xs">{progress}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cyberpunk grid bottom subtle accent */}
      <div className="absolute bottom-6 text-[10px] font-mono text-slate-600 tracking-widest">
        SYSTEM VERIFICATION • ZERO SLOP TOLERANCE
      </div>
    </div>
  );
}

