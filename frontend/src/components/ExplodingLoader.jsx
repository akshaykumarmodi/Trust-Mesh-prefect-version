import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Shield, Volume2, VolumeX } from 'lucide-react';

const LETTERS = ['T', 'R', 'U', 'S', 'T', 'M', 'E', 'S', 'H'];

/**
 * Web Audio API Engine: Synthesizes an energetic, deep cinematic movie studio
 * opening sound chord (like the iconic Netflix / HBO / Dolby intro chord with
 * chest-thumping sub-bass impact, resonant choir/vocal formant shimmer, and specular glint sheen).
 * Zero external downloads, zero latency, 100% offline safe.
 */
function playMovieIntroSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // 1. Initial Soft Pre-Impact Hit ("Ta...")
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(100, now);
    osc1.frequency.exponentialRampToValueAtTime(45, now + 0.16);
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.22);

    // 2. Powerful Sub-Bass Impact Boom ("...DUM!")
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    const filter2 = ctx.createBiquadFilter();
    filter2.type = 'lowpass';
    filter2.frequency.setValueAtTime(170, now + 0.15);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(135, now + 0.15);
    osc2.frequency.exponentialRampToValueAtTime(32, now + 1.4);

    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.setValueAtTime(0.8, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.6);

    osc2.connect(filter2);
    filter2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 1.65);

    // 3. Cinematic Vocal / Choir Formant Harmonic Resonance (Warm majestic chords)
    // Frequencies: D3 (146.8Hz), A3 (220Hz), D4 (293.7Hz), F#4 (370Hz), A4 (440Hz)
    const chordFreqs = [146.83, 220.0, 293.66, 369.99, 440.0];
    chordFreqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + 0.15);
      osc.detune.setValueAtTime((idx - 2) * 5, now + 0.15);

      // Vocal formant filter (mimics energetic cinematic voice "Aaaahh" resonance)
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1150 + idx * 100, now + 0.15);
      filter.Q.setValueAtTime(2.4, now + 0.15);

      gain.gain.setValueAtTime(0.001, now + 0.15);
      gain.gain.linearRampToValueAtTime(0.09 / (idx + 1), now + 0.42);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.85);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + 0.15);
      osc.stop(now + 1.9);
    });

    // 4. Specular Anamorphic Glint Sheen (High-frequency luxury metallic shimmer)
    const glintTime = now + 0.5;
    const oscGlint = ctx.createOscillator();
    const gainGlint = ctx.createGain();
    const filterGlint = ctx.createBiquadFilter();

    oscGlint.type = 'sine';
    oscGlint.frequency.setValueAtTime(2000, glintTime);
    oscGlint.frequency.exponentialRampToValueAtTime(3600, glintTime + 0.35);

    filterGlint.type = 'highpass';
    filterGlint.frequency.setValueAtTime(1800, glintTime);

    gainGlint.gain.setValueAtTime(0.001, glintTime);
    gainGlint.gain.linearRampToValueAtTime(0.04, glintTime + 0.12);
    gainGlint.gain.exponentialRampToValueAtTime(0.0001, glintTime + 0.45);

    oscGlint.connect(filterGlint);
    filterGlint.connect(gainGlint);
    gainGlint.connect(ctx.destination);
    oscGlint.start(glintTime);
    oscGlint.stop(glintTime + 0.5);

    return ctx;
  } catch (err) {
    console.warn('Audio auto-playback deferred until user gesture:', err);
    return null;
  }
}

export default function ExplodingLoader({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const audioContextRef = useRef(null);

  // Trigger cinematic sound on mount
  useEffect(() => {
    // Attempt audio playback
    const ctx = playMovieIntroSound();
    audioContextRef.current = ctx;

    return () => {
      try {
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(() => {});
        }
      } catch {}
    };
  }, []);

  // Smooth, snappy loading timeline (~1.85s total - clean and fast)
  useEffect(() => {
    const startTime = Date.now();
    const duration = 1850;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(Math.round((elapsed / duration) * 100), 100);
      setProgress(pct);

      if (elapsed >= duration) {
        clearInterval(interval);
        setIsFadingOut(true);
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 280);
      }
    }, 16);

    return () => clearInterval(interval);
  }, []);

  const handleSkip = useCallback(() => {
    setIsFadingOut(true);
    setTimeout(() => {
      if (onComplete) onComplete();
    }, 120);
  }, [onComplete]);

  // Keyboard shortcut: Escape or Space to skip instantly
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.code === 'Space') {
        handleSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSkip]);

  // Click-to-replay sound if user browser blocked initial autoplay
  const handleToggleSound = (e) => {
    e.stopPropagation();
    if (audioEnabled) {
      setAudioEnabled(false);
      try {
        if (audioContextRef.current) audioContextRef.current.suspend().catch(() => {});
      } catch {}
    } else {
      setAudioEnabled(true);
      playMovieIntroSound();
    }
  };

  return (
    <div
      onClick={handleSkip}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#03060c] overflow-hidden select-none transition-all duration-600 cursor-pointer ${
        isFadingOut ? 'opacity-0 scale-[1.02] pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Soft, luxury ambient vignette lighting (No chaotic noise) */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.12)_0%,rgba(15,23,42,0.35)_45%,#03060c_75%)] pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-black/80 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

      {/* Top Controls: Cinema Sound & Skip Intro */}
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-20 pointer-events-auto">
        <button
          onClick={handleToggleSound}
          className="px-3.5 py-1.5 rounded-full bg-slate-900/70 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-slate-400 hover:text-cyan-300 transition-all flex items-center gap-1.5 backdrop-blur-md cursor-pointer"
          title="Toggle energetic movie intro sound"
        >
          {audioEnabled ? <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
          <span>{audioEnabled ? 'Cinema Sound' : 'Muted'}</span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleSkip();
          }}
          className="px-4 py-1.5 rounded-full bg-slate-900/70 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-slate-400 hover:text-cyan-300 transition-all flex items-center gap-1.5 backdrop-blur-md cursor-pointer"
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
              // Smooth, luxurious stagger delay for each letter
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
