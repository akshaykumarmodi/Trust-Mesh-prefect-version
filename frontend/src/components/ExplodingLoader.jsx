import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Shield, Volume2 } from 'lucide-react';

const LETTERS = ['T', 'R', 'U', 'S', 'T', 'M', 'E', 'S', 'H'];

/**
 * Web Audio API Engine: Synthesizes an energetic, deep cinematic movie studio
 * opening sound (like the iconic Netflix "Ta-dum" / HBO / cinema intro chord with
 * chest-thumping sub-bass impact, warm analog harmonic saturation, resonant choir formant swell,
 * and high-frequency specular glint sheen).
 * 100% self-contained, zero external downloads, zero latency, 100% reliable.
 */
function createCinematicMovieSound(ctx) {
  try {
    const now = ctx.currentTime + 0.05; // tiny pre-delay for hardware clock stabilization

    // Master Gain Node
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(1.0, now);
    masterGain.connect(ctx.destination);

    // Soft-Clipping Distortion for Rich Analog Movie Theater Warmth
    const waveShaper = ctx.createWaveShaper();
    const n_samples = 4096;
    const curve = new Float32Array(n_samples);
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((Math.PI + 4) * x) / (Math.PI + 4 * Math.abs(x));
    }
    waveShaper.curve = curve;
    waveShaper.connect(masterGain);

    // 1. Initial "Ta..." Impact (110Hz -> 45Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(110, now);
    osc1.frequency.exponentialRampToValueAtTime(45, now + 0.16);
    gain1.gain.setValueAtTime(0.6, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc1.connect(gain1);
    gain1.connect(waveShaper);
    osc1.start(now);
    osc1.stop(now + 0.22);

    // 2. Main Massive Sub-Bass Impact "...DUM!" (+160ms)
    const subTime = now + 0.16;
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    const filter2 = ctx.createBiquadFilter();
    filter2.type = 'lowpass';
    filter2.frequency.setValueAtTime(180, subTime);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(145, subTime);
    osc2.frequency.exponentialRampToValueAtTime(32, subTime + 1.5);

    gain2.gain.setValueAtTime(0.001, subTime);
    gain2.gain.linearRampToValueAtTime(1.0, subTime + 0.02);
    gain2.gain.exponentialRampToValueAtTime(0.001, subTime + 1.7);

    osc2.connect(filter2);
    filter2.connect(gain2);
    gain2.connect(waveShaper);
    osc2.start(subTime);
    osc2.stop(subTime + 1.75);

    // 3. Energetic Cinematic Choir / Vocal Formant Swell ("Ahhhh")
    // D Major Triad: D3 (146.8Hz), A3 (220Hz), D4 (293.7Hz), F#4 (370Hz), A4 (440Hz), D5 (587Hz)
    const chord = [146.83, 220.0, 293.66, 369.99, 440.0, 587.33];
    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, subTime);
      osc.detune.setValueAtTime((idx - 2.5) * 6, subTime);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200 + idx * 80, subTime);
      filter.Q.setValueAtTime(2.2, subTime);

      gain.gain.setValueAtTime(0.001, subTime);
      gain.gain.linearRampToValueAtTime(0.14 / (1 + idx * 0.3), subTime + 0.35);
      gain.gain.exponentialRampToValueAtTime(0.0001, subTime + 1.9);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(waveShaper);
      osc.start(subTime);
      osc.stop(subTime + 1.95);
    });

    // 4. Specular Anamorphic Glint Sheen (High metallic shimmer as letters assemble)
    const glintTime = now + 0.5;
    const oscGlint = ctx.createOscillator();
    const gainGlint = ctx.createGain();
    const filterGlint = ctx.createBiquadFilter();

    oscGlint.type = 'sine';
    oscGlint.frequency.setValueAtTime(2200, glintTime);
    oscGlint.frequency.exponentialRampToValueAtTime(4200, glintTime + 0.4);

    filterGlint.type = 'highpass';
    filterGlint.frequency.setValueAtTime(1900, glintTime);

    gainGlint.gain.setValueAtTime(0.001, glintTime);
    gainGlint.gain.linearRampToValueAtTime(0.08, glintTime + 0.12);
    gainGlint.gain.exponentialRampToValueAtTime(0.0001, glintTime + 0.48);

    oscGlint.connect(filterGlint);
    filterGlint.connect(gainGlint);
    gainGlint.connect(masterGain);
    oscGlint.start(glintTime);
    oscGlint.stop(glintTime + 0.52);
  } catch (err) {
    console.warn('[WebAudio] Synthesizer error:', err);
  }
}

// Global AudioContext Singleton
let globalAudioCtx = null;
let lastSoundStartTime = 0;

export function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!globalAudioCtx || globalAudioCtx.state === 'closed') {
    globalAudioCtx = new AudioCtx();
  }
  return globalAudioCtx;
}

// Global HTML5 Audio fallback
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

export async function playGlobalCinemaAudio() {
  const now = Date.now();
  // Prevent duplicate overlapping triggers within 2 seconds
  if (now - lastSoundStartTime < 2000) {
    return true;
  }

  // 1. Primary Engine: Instant Web Audio API Synthesizer
  try {
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      if (ctx.state === 'running') {
        lastSoundStartTime = Date.now();
        createCinematicMovieSound(ctx);
        return true;
      }
    }
  } catch (err) {
    console.warn('[WebAudio] synthesis deferred:', err);
  }

  // 2. Dual Fallback: Native HTML5 Audio
  try {
    const audio = getCinemaAudio();
    if (audio) {
      audio.volume = 1.0;
      try {
        if (audio.readyState >= 1) {
          audio.currentTime = 0;
        }
      } catch {}
      await audio.play();
      lastSoundStartTime = Date.now();
      return true;
    }
  } catch (err) {
    console.warn('[HTML5 Audio] play deferred:', err);
  }

  return false;
}

export default function ExplodingLoader({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [audioPlayed, setAudioPlayed] = useState(false);
  const hasTriggeredRef = useRef(false);

  // Attempt automatic audio playback
  const attemptPlay = useCallback(async () => {
    if (hasTriggeredRef.current) return;
    try {
      const success = await playGlobalCinemaAudio();
      if (success) {
        hasTriggeredRef.current = true;
        setAudioPlayed(true);
      }
    } catch {
      // Ignored
    }
  }, []);

  // Multi-tiered automatic start:
  // 1. Immediate trigger on component mount (0ms, 40ms, 150ms)
  // 2. Passive window listeners: any touch, click, scroll or keypress starts sound instantly
  useEffect(() => {
    attemptPlay();

    const t1 = setTimeout(attemptPlay, 40);
    const t2 = setTimeout(attemptPlay, 150);
    const t3 = setTimeout(attemptPlay, 350);

    const unlockEvents = [
      'pointerdown',
      'mousedown',
      'touchstart',
      'keydown',
      'click',
      'wheel'
    ];

    const handleUnlock = () => {
      attemptPlay();
    };

    unlockEvents.forEach((evt) => {
      window.addEventListener(evt, handleUnlock, { capture: true });
    });

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      unlockEvents.forEach((evt) => {
        window.removeEventListener(evt, handleUnlock, { capture: true });
      });
    };
  }, [attemptPlay]);

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
      onClick={attemptPlay}
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

        {/* Subtle Classy Tap Prompt ONLY if browser blocked autoplay */}
        {!audioPlayed && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              attemptPlay();
            }}
            className="mt-4 px-4 py-1.5 rounded-full bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-medium flex items-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.25)] animate-pulse transition-all cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Tap to enable cinema sound 🔊</span>
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
