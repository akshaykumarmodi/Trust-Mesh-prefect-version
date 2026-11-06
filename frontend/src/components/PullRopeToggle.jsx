import React, { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Sparkles } from 'lucide-react';

export default function PullRopeToggle({ theme, onToggleTheme }) {
  const [isPulling, setIsPulling] = useState(false);
  const [isRecoiling, setIsRecoiling] = useState(false);
  const [showSpark, setShowSpark] = useState(false);
  const isDark = theme === 'dark';

  const playClickSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Sharp vintage mechanical cord snap
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(350, ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch {}
  };

  const handlePull = () => {
    if (isPulling || isRecoiling) return;

    // 1. Pull down with physical tension
    setIsPulling(true);
    playClickSound();

    setTimeout(() => {
      // 2. Detonate spark and toggle theme at maximum pull extension
      setShowSpark(true);
      if (onToggleTheme) onToggleTheme();

      setTimeout(() => {
        // 3. Elastic spring release and overshoot
        setIsPulling(false);
        setIsRecoiling(true);
        setShowSpark(false);

        setTimeout(() => {
          setIsRecoiling(false);
        }, 500);
      }, 140);
    }, 180);
  };

  return (
    <div
      className="fixed top-0 right-10 sm:right-14 z-[99] select-none pointer-events-auto"
      title={isDark ? 'Pull cord for Light Mode' : 'Pull cord for Dark Mode'}
    >
      {/* Ceiling Mount Bracket */}
      <div className="flex flex-col items-center">
        <div className="w-6 h-2 rounded-b-md bg-gradient-to-r from-slate-400 via-slate-200 to-slate-400 shadow-md border-b border-slate-500" />
        <div className="w-1.5 h-1.5 rounded-full bg-slate-300 shadow-inner -mt-0.5" />

        {/* Hanging Braided Cord Container */}
        <div
          onClick={handlePull}
          className={`group flex flex-col items-center cursor-pointer transition-transform ${
            isPulling
              ? 'translate-y-11 duration-150 ease-out'
              : isRecoiling
              ? 'translate-y-[-6px] duration-300 ease-elastic'
              : 'translate-y-0 duration-400 ease-out hover:translate-y-1.5'
          }`}
          style={{
            transformOrigin: 'top center',
            transitionTimingFunction: isRecoiling ? 'cubic-bezier(0.175, 0.885, 0.32, 1.4)' : undefined,
          }}
        >
          {/* Beaded / Braided Rope Cord */}
          <div className="w-[3px] h-20 sm:h-24 bg-gradient-to-b from-amber-100 via-amber-300 to-amber-200 shadow-[0_0_4px_rgba(251,191,36,0.5)] relative flex flex-col items-center justify-between py-1">
            {/* Cord Texture Segments */}
            {[...Array(6)].map((_, i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-amber-300 to-amber-100 border border-amber-400/60 shadow-xs"
              />
            ))}
          </div>

          {/* Golden Brass Ferrule Connector */}
          <div className="w-2.5 h-2.5 rounded-sm bg-gradient-to-b from-amber-400 to-amber-600 border border-amber-300 shadow-sm" />

          {/* Lamp Toggle Switch Knob / Tassel */}
          <div
            className={`relative -mt-0.5 flex items-center justify-center rounded-2xl p-2.5 transition-all duration-300 ${
              isDark
                ? 'bg-gradient-to-b from-slate-800 to-slate-950 border-2 border-cyan-400/80 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.4)] group-hover:shadow-[0_0_25px_rgba(6,182,212,0.7)] group-hover:scale-110'
                : 'bg-gradient-to-b from-amber-100 to-amber-300 border-2 border-amber-500 text-amber-800 shadow-[0_0_20px_rgba(245,158,11,0.5)] group-hover:shadow-[0_0_25px_rgba(245,158,11,0.8)] group-hover:scale-110'
            }`}
          >
            {isDark ? (
              <Moon className="w-4 h-4 fill-cyan-400/30 text-cyan-300 transition-transform group-hover:rotate-12" />
            ) : (
              <Sun className="w-4 h-4 fill-amber-500/40 text-amber-600 transition-transform group-hover:rotate-45" />
            )}

            {/* Spark burst on toggle */}
            {showSpark && (
              <div className="absolute -inset-2 rounded-full bg-cyan-400/60 animate-ping pointer-events-none" />
            )}

            {/* Small glowing pull indicator badge on hover */}
            <span
              className={`absolute -bottom-6 px-1.5 py-0.5 rounded text-[9px] font-mono tracking-wider opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-md ${
                isDark ? 'bg-slate-900 text-cyan-300 border border-cyan-500/40' : 'bg-white text-slate-800 border border-slate-300'
              }`}
            >
              {isDark ? 'PULL FOR LIGHT' : 'PULL FOR DARK'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
