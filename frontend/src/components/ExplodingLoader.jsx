import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Shield, Volume2, Sparkles } from 'lucide-react';

const LETTERS = ['T', 'R', 'U', 'S', 'T', 'M', 'E', 'S', 'H'];

// Global singleton audio instance to bypass browser gesture boundaries across components
let globalCinemaAudio = null;

export function playGlobalCinemaAudio() {
  try {
    if (!globalCinemaAudio) {
      globalCinemaAudio = new Audio('/cinema-intro.wav');
      globalCinemaAudio.volume = 1.0;
      globalCinemaAudio.preload = 'auto';
      globalCinemaAudio.setAttribute('playsinline', 'true');
    }
    globalCinemaAudio.currentTime = 0;
    const playPromise = globalCinemaAudio.play();
    return playPromise;
  } catch (err) {
    console.warn('[Cinema Audio] Initial play deferred until interaction:', err);
    return Promise.reject(err);
  }
}

export default function ExplodingLoader({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const hasTriggeredAudio = useRef(false);
  const audioElementRef = useRef(null);
  const soundButtonRef = useRef(null);
  const topSoundButtonRef = useRef(null);

  // Trigger sound automatically
  const triggerAudio = useCallback(async () => {
    if (hasTriggeredAudio.current) return;
    try {
      if (audioElementRef.current) {
        audioElementRef.current.volume = 1.0;
        const playPromise = audioElementRef.current.play();
        if (playPromise !== undefined) {
          await playPromise;
          hasTriggeredAudio.current = true;
          setIsPlayingAudio(true);
          return;
        }
      }
      const promise = playGlobalCinemaAudio();
      if (promise && typeof promise.then === 'function') {
        await promise;
        hasTriggeredAudio.current = true;
        setIsPlayingAudio(true);
      }
    } catch {
      // Browser blocked cold unsolicited autoplay; will unlock on first user gesture
    }
  }, []);

  // Multi-tiered automatic start:
  // 1. Programmatically click sound buttons automatically when entering
  // 2. Global gesture listeners (triggers the instant user touches mouse, screen, or keyboard)
  useEffect(() => {
    if (soundButtonRef.current) {
      soundButtonRef.current.click();
    }
    if (topSoundButtonRef.current) {
      topSoundButtonRef.current.click();
    }
    triggerAudio();

    const t1 = setTimeout(() => {
      if (soundButtonRef.current) soundButtonRef.current.click();
      if (topSoundButtonRef.current) topSoundButtonRef.current.click();
      triggerAudio();
    }, 50);

    const t2 = setTimeout(() => {
      if (!hasTriggeredAudio.current) {
        if (soundButtonRef.current) soundButtonRef.current.click();
        triggerAudio();
      }
    }, 200);

    const handleUnlockGesture = () => {
      if (soundButtonRef.current) soundButtonRef.current.click();
      triggerAudio();
    };

    window.addEventListener('pointerdown', handleUnlockGesture);
    window.addEventListener('touchstart', handleUnlockGesture);
    window.addEventListener('keydown', handleUnlockGesture);
    window.addEventListener('click', handleUnlockGesture);
    window.addEventListener('mousemove', handleUnlockGesture, { once: true });

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('pointerdown', handleUnlockGesture);
      window.removeEventListener('touchstart', handleUnlockGesture);
      window.removeEventListener('keydown', handleUnlockGesture);
      window.removeEventListener('click', handleUnlockGesture);
      window.removeEventListener('mousemove', handleUnlockGesture);
    };
  }, [triggerAudio]);

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

  const handleScreenClick = () => {
    if (!hasTriggeredAudio.current) {
      triggerAudio();
    }
  };

  return (
    <div
      onClick={handleScreenClick}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#02050b] overflow-hidden select-none transition-all duration-600 ${
        isFadingOut ? 'opacity-0 scale-[1.02] pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Native HTML5 Audio for Maximum Browser Autoplay Compatibility */}
      <audio
        ref={audioElementRef}
        src="/cinema-intro.wav"
        preload="auto"
        autoPlay
        playsInline
        onPlay={() => setIsPlayingAudio(true)}
      />

      {/* Soft luxury ambient spotlight */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.14)_0%,rgba(15,23,42,0.4)_45%,#02050b_75%)] pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-black/85 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-black/85 to-transparent pointer-events-none" />

      {/* Top Controls: Cinema Sound Status & Skip Button */}
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-20 pointer-events-auto">
        <button
          ref={topSoundButtonRef}
          onClick={(e) => {
            e.stopPropagation();
            triggerAudio();
          }}
          className="px-3.5 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-slate-300 hover:text-cyan-300 transition-all flex items-center gap-1.5 backdrop-blur-md cursor-pointer shadow-sm"
          title="Play energetic movie intro sound"
        >
          <Volume2 className={`w-3.5 h-3.5 ${isPlayingAudio ? 'text-cyan-400' : 'text-slate-500'}`} />
          <span>{isPlayingAudio ? 'Sound: On' : 'Play Sound'}</span>
        </button>

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

        {/* Audio Trigger Prompt (Automatically clicked on enter) */}
        {!isPlayingAudio && (
          <button
            ref={soundButtonRef}
            onClick={(e) => {
              e.stopPropagation();
              triggerAudio();
            }}
            className="mt-4 px-4 py-1.5 rounded-full bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-semibold flex items-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.25)] animate-pulse transition-all cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Sound Enabled 🔊</span>
          </button>
        )}

        {/* Minimalist Hairline Progress Bar */}
        <div className="mt-6 w-48 sm:w-60 space-y-2">
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
