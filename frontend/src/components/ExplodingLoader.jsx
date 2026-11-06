import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Shield, Sparkles } from 'lucide-react';

const LETTERS = ['T', 'R', 'U', 'S', 'T', 'M', 'E', 'S', 'H'];

/**
 * Web Audio API Synthesis Engine:
 * Generates an energetic cinematic movie opening chord (Netflix "Ta-dum" / HBO style)
 * with deep sub-bass impacts, analog soft-clipping saturation, choir formant swell,
 * and high-frequency specular glint sheen.
 * Acts as an instant zero-latency fallback if the WAV file has network or decode issues.
 */
function createCinematicMovieSound(ctx) {
  try {
    const now = ctx.currentTime + 0.05;

    // Master Gain Node
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.9, now);
    masterGain.connect(ctx.destination);

    // Soft-Clipping Distortion for Warm Analog Theater Harmonics
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
    gain1.gain.setValueAtTime(0.55, now);
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
    gain2.gain.linearRampToValueAtTime(0.95, subTime + 0.02);
    gain2.gain.exponentialRampToValueAtTime(0.001, subTime + 1.7);

    osc2.connect(filter2);
    filter2.connect(gain2);
    gain2.connect(waveShaper);
    osc2.start(subTime);
    osc2.stop(subTime + 1.75);

    // 3. Energetic Cinematic Choir / Vocal Formant Swell ("Ahhhh")
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

    // 4. Specular Anamorphic Glint Sheen
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

/**
 * Robust Singleton Audio Manager:
 * Manages the physical cinematic audio asset (/cinema-intro.wav) and Web Audio API fallback.
 * Strictly prevents duplicate overlapping playback and handles browser autoplay boundaries.
 */
class CinemaAudioManager {
  constructor() {
    this.audio = null;
    this.audioCtx = null;
    this.isPlaying = false;
  }

  getAudio() {
    if (typeof window === 'undefined') return null;
    if (!this.audio) {
      this.audio = new Audio('/cinema-intro.wav');
      this.audio.preload = 'auto';
      this.audio.volume = 0.9;
      this.audio.setAttribute('playsinline', 'true');
    }
    return this.audio;
  }

  getAudioContext() {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      this.audioCtx = new AudioCtx();
    }
    return this.audioCtx;
  }

  async play() {
    // Prevent duplicate overlapping triggers
    if (this.isPlaying) return true;

    // 1. Primary: Use physical stereo sound asset (/cinema-intro.wav)
    try {
      const audio = this.getAudio();
      if (audio) {
        audio.volume = 0.9;
        try {
          if (audio.readyState >= 1) {
            audio.currentTime = 0;
          }
        } catch {}

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          await playPromise;
          this.isPlaying = true;
          audio.onended = () => {
            this.isPlaying = false;
          };
          return true;
        }
      }
    } catch (err) {
      // Browser blocked unmuted autoplay without user gesture
      if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
        return false;
      }
      // If error was not autoplay rejection (e.g. loading error), try Web Audio fallback
    }

    // 2. Dual Fallback: Web Audio API synthesis
    try {
      const ctx = this.getAudioContext();
      if (ctx) {
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        if (ctx.state === 'running') {
          this.isPlaying = true;
          createCinematicMovieSound(ctx);
          setTimeout(() => {
            this.isPlaying = false;
          }, 2400);
          return true;
        }
      }
    } catch (err) {
      if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
        return false;
      }
    }

    return false;
  }

  stop() {
    try {
      if (this.audio) {
        this.audio.pause();
        this.audio.currentTime = 0;
      }
    } catch {}
    this.isPlaying = false;
  }
}

export const cinemaAudioManager = new CinemaAudioManager();

export function playGlobalCinemaAudio() {
  return cinemaAudioManager.play();
}

export default function ExplodingLoader({ onComplete }) {
  // 'initializing' | 'playing' | 'awaiting_interaction' | 'completed'
  const [status, setStatus] = useState('initializing');
  const [progress, setProgress] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);

  const statusRef = useRef('initializing');
  const progressIntervalRef = useRef(null);

  // Synchronized Cinematic Launch:
  // Starts the dramatic audio and letter convergence animation at the exact same moment
  const startExperience = useCallback(async () => {
    if (statusRef.current === 'playing' || statusRef.current === 'completed') return;

    statusRef.current = 'playing';
    setStatus('playing');

    // Trigger audio immediately
    await cinemaAudioManager.play();

    // Progression timer synchronized with the 2.4s audio asset duration
    const startTime = Date.now();
    const duration = 2400;

    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(Math.round((elapsed / duration) * 100), 100);
      setProgress(pct);

      if (elapsed >= duration) {
        clearInterval(progressIntervalRef.current);
        statusRef.current = 'completed';
        setIsFadingOut(true);
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 350);
      }
    }, 16);
  }, [onComplete]);

  // Initial Autoplay Attempt on Mount:
  // 1. Tries to autoplay immediately when intro starts.
  // 2. If browser policy permits -> launches seamlessly with sound and animation.
  // 3. If browser policy blocks cold autoplay -> displays minimal "ENTER EXPERIENCE" prompt.
  useEffect(() => {
    let isCancelled = false;

    const attemptAutoplay = async () => {
      // If already triggered or active in current session
      if (cinemaAudioManager.isPlaying) {
        startExperience();
        return;
      }

      const allowed = await cinemaAudioManager.play();
      if (isCancelled) return;

      if (allowed) {
        startExperience();
      } else {
        statusRef.current = 'awaiting_interaction';
        setStatus('awaiting_interaction');
      }
    };

    attemptAutoplay();

    return () => {
      isCancelled = true;
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [startExperience]);

  // Global Interaction Listeners for seamless entry when awaiting interaction
  useEffect(() => {
    const handleGlobalInteraction = (e) => {
      if (statusRef.current === 'awaiting_interaction') {
        startExperience();
      }
    };

    window.addEventListener('keydown', handleGlobalInteraction);
    window.addEventListener('pointerdown', handleGlobalInteraction);

    return () => {
      window.removeEventListener('keydown', handleGlobalInteraction);
      window.removeEventListener('pointerdown', handleGlobalInteraction);
    };
  }, [startExperience]);

  const handleSkip = useCallback(() => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    cinemaAudioManager.stop();
    setIsFadingOut(true);
    setTimeout(() => {
      if (onComplete) onComplete();
    }, 120);
  }, [onComplete]);

  // Escape key to skip
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
      onClick={() => {
        if (status === 'awaiting_interaction') {
          startExperience();
        }
      }}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#02050b] overflow-hidden select-none transition-all duration-500 ${
        isFadingOut ? 'opacity-0 scale-[1.02] pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Luxury ambient spotlight */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.14)_0%,rgba(15,23,42,0.4)_45%,#02050b_75%)] pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-black/85 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-black/85 to-transparent pointer-events-none" />

      {/* Top Controls: Minimal Skip Button */}
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
                  className={`relative inline-block text-transparent bg-clip-text ${
                    status === 'playing' ? 'animate-letter-converge' : 'opacity-90'
                  }`}
                  style={{
                    animationDelay: status === 'playing' ? delay : '0ms',
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
          {status === 'playing' && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="w-1/3 h-full bg-gradient-to-r from-transparent via-white/80 to-transparent opacity-85 skew-x-[-20deg] animate-specular-sheen shadow-[0_0_30px_#ffffff]" />
            </div>
          )}

          {/* Elegant Hairline Divider Line */}
          <div
            className={`mt-3 sm:mt-4 h-[1px] w-full bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent ${
              status === 'playing' ? 'animate-hairline-expand' : 'opacity-40'
            }`}
          />
        </div>

        {/* Minimalist Premium Subtitle */}
        <div className="mt-4 flex items-center justify-center gap-2">
          <span className="w-1 h-1 rounded-full bg-cyan-400" />
          <span className="text-[10px] sm:text-xs font-mono font-medium uppercase tracking-[0.38em] text-slate-400">
            Decentralized Trust Intelligence
          </span>
          <span className="w-1 h-1 rounded-full bg-cyan-400" />
        </div>

        {/* BROWSER AUTOPLAY FALLBACK: Minimal "ENTER EXPERIENCE" Interaction */}
        {status === 'awaiting_interaction' && (
          <div className="mt-8 flex flex-col items-center gap-3 animate-fade-in pointer-events-auto">
            <button
              onClick={(e) => {
                e.stopPropagation();
                startExperience();
              }}
              className="group relative inline-flex items-center gap-3 px-8 py-3.5 rounded-full bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-cyan-500/20 hover:from-cyan-500/35 hover:to-blue-500/35 border border-cyan-400/50 text-cyan-200 text-xs sm:text-sm font-mono font-bold tracking-[0.28em] uppercase shadow-[0_0_35px_rgba(6,182,212,0.35)] hover:shadow-[0_0_50px_rgba(6,182,212,0.6)] transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md"
            >
              <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span>ENTER EXPERIENCE</span>
              <span className="text-cyan-400 group-hover:translate-x-1 transition-transform">→</span>
            </button>
            <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">
              Click anywhere to start with sound
            </span>
          </div>
        )}

        {/* Minimalist Hairline Progress Bar (Synchronized with 2.4s Audio Playback) */}
        {status === 'playing' && (
          <div className="mt-8 w-48 sm:w-60 space-y-2 animate-fade-in">
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
        )}
      </div>

      {/* Subtle bottom note */}
      <div className="absolute bottom-6 text-[10px] font-mono text-slate-600 tracking-[0.3em] uppercase">
        VERIFIABLE CRYPTOGRAPHIC LEDGER
      </div>
    </div>
  );
}
