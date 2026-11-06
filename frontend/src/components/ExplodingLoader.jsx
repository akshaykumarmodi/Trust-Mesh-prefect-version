import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Shield } from 'lucide-react';

const LETTERS = ['T', 'R', 'U', 'S', 'T', 'M', 'E', 'S', 'H'];

// Global singleton cinema audio instance to maintain continuous playback across views
let globalCinemaAudio = null;

export function getCinemaAudio() {
  if (typeof window === 'undefined') return null;
  if (!globalCinemaAudio) {
    globalCinemaAudio = new Audio('/cinema-intro.wav');
    globalCinemaAudio.preload = 'auto';
    globalCinemaAudio.volume = 1.0;
    globalCinemaAudio.setAttribute('playsinline', 'true');
  }
  return globalCinemaAudio;
}

export function playGlobalCinemaAudio() {
  try {
    const audio = getCinemaAudio();
    if (!audio) return Promise.resolve();

    // If already playing smoothly near the start, let it continue uninterrupted
    if (!audio.paused && audio.currentTime > 0 && audio.currentTime < 2.2) {
      return Promise.resolve();
    }

    audio.currentTime = 0;
    audio.volume = 1.0;
    const playPromise = audio.play();
    return playPromise || Promise.resolve();
  } catch (err) {
    return Promise.reject(err);
  }
}

export default function ExplodingLoader({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const audioStartedRef = useRef(false);

  // Play audio automatically without requiring any manual button click
  const startAudioPlayback = useCallback(() => {
    if (audioStartedRef.current) return;
    try {
      const p = playGlobalCinemaAudio();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          audioStartedRef.current = true;
        }).catch(() => {
          // If browser policy deferred cold unmuted playback, listeners will unlock on first gesture
        });
      } else {
        audioStartedRef.current = true;
      }
    } catch {
      // Ignored
    }
  }, []);

  // Automatic Audio Playback on Mount:
  // 1. Plays immediately as soon as the component loads
  // 2. Retries after brief DOM initialization ticks
  // 3. Captures any user interaction on the window to immediately unlock if blocked by browser
  useEffect(() => {
    startAudioPlayback();

    const t1 = setTimeout(startAudioPlayback, 30);
    const t2 = setTimeout(startAudioPlayback, 120);

    const unlockEvents = ['pointerdown', 'mousedown', 'touchstart', 'keydown', 'click'];
    const handleInteraction = () => {
      startAudioPlayback();
    };

    unlockEvents.forEach((evt) => {
      window.addEventListener(evt, handleInteraction, { capture: true, once: true });
    });

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      unlockEvents.forEach((evt) => {
        window.removeEventListener(evt, handleInteraction, { capture: true });
      });
    };
  }, [startAudioPlayback]);

  // Loading timeline progression (~2.1s total)
  useEffect(() => {
    const startTime = Date.now();
    const duration = 2100;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(Math.round((elapsed / duration) * 100), 100);
      setProgress(pct);

      if (elapsed >= duration) {
        clearInterval(interval);
        setIsFadingOut(true);
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 300);
      }
    }, 16);

    return () => clearInterval(interval);
  }, [onComplete]);

  const handleSkip = useCallback(() => {
    setIsFadingOut(true);
    setTimeout(() => {
      if (onComplete) onComplete();
    }, 120);
  }, [onComplete]);

  // Escape to skip
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSkip]);

  return (
    <div
      onClick={startAudioPlayback}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#02050b] overflow-hidden select-none transition-all duration-600 ${
        isFadingOut ? 'opacity-0 scale-[1.02] pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Soft luxury ambient spotlight */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.14)_0%,rgba(15,23,42,0.4)_45%,#02050b_75%)] pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-black/85 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-black/85 to-transparent pointer-events-none" />

      {/* Top Controls: Clean Skip Button */}
      <div className="absolute top-6 right-6 z-20 pointer-events-auto">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleSkip();
          }}
          className="px-4 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-slate-300 hover:text-cyan-300 transition-all flex items-center gap-1.5 backdrop-blur-md cursor-pointer shadow-sm"
        >
          <span>Skip</span>
          <span className="text-cyan-400">→</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* CLASSY & CLEAN BRAND ASSEMBLY: "NAME BECOMING FROM LETTERS" */}
      {/* ========================================================================= */}
      <div className="relative flex flex-col items-center justify-center z-10 max-w-4xl px-6 text-center">
        {/* Minimalist Emblem Icon (Apple/Tesla class) */}
        <div className="mb-6 flex items-center justify-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-cyan-500/30 flex items-center justify-center shadow-[0_0_35px_rgba(6,182,212,0.25)] animate-emblem-glow">
            <Shield className="w-7 h-7 sm:w-8 sm:h-8 text-cyan-400 drop-shadow-[0_0_12px_rgba(6,182,212,0.8)]" />
          </div>
        </div>

        {/* Wordmark Container: Letters Form into Place */}
        <div className="relative overflow-visible py-2">
          {/* Staggered Letter Assembly */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-[0.22em] sm:tracking-[0.32em] uppercase select-none flex items-center justify-center font-display">
            {LETTERS.map((char, index) => {
              const delay = `${index * 55}ms`;
              return (
                <span
                  key={index}
                  className="relative inline-block text-transparent bg-clip-text animate-letter-converge"
                  style={{
                    animationDelay: delay,
                    backgroundImage: 'linear-gradient(180deg, #ffffff 0%, #e2e8f0 40%, #94a3b8 75%, #38bdf8 100%)',
                    filter: 'drop-shadow(0 0 20px rgba(6, 182, 212, 0.45))',
                  }}
                >
                  {char}
                </span>
              );
            })}
          </h1>

          {/* Single Classy Specular Light Glint Sheen Sweeping Across Letters */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="w-1/3 h-full bg-gradient-to-r from-transparent via-white/80 to-transparent opacity-85 skew-x-[-20deg] animate-specular-sheen shadow-[0_0_30px_#ffffff]" />
          </div>

          {/* Elegant Hairline Divider Line */}
          <div className="mt-3 sm:mt-4 h-[1px] w-full bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent animate-hairline-expand" />
        </div>

        {/* Minimalist Premium Subtitle */}
        <div className="mt-4 flex items-center justify-center gap-2">
          <span className="w-1 h-1 rounded-full bg-cyan-400" />
          <span className="text-[10px] sm:text-xs font-mono font-medium uppercase tracking-[0.38em] text-slate-400">
            Decentralized Trust Intelligence
          </span>
          <span className="w-1 h-1 rounded-full bg-cyan-400" />
        </div>

        {/* Minimalist Hairline Progress Bar */}
        <div className="mt-8 w-48 sm:w-60 space-y-2">
          <div className="h-[2px] w-full bg-slate-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-75 relative"
              style={{ width: `${progress}%` }}
            >
              <span className="absolute right-0 top-0 bottom-0 w-2 bg-white rounded-full shadow-[0_0_8px_#ffffff]" />
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span>PROTOCOL CANONICAL</span>
            <span className="text-cyan-400 font-semibold">{progress}%</span>
          </div>
        </div>
      </div>

      {/* Subtle bottom note */}
      <div className="absolute bottom-6 text-[10px] font-mono text-slate-600 tracking-[0.3em] uppercase">
        VERIFIABLE CRYPTOGRAPHIC LEDGER
      </div>
    </div>
  );
}
