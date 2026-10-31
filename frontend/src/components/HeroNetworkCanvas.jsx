import React, { useEffect, useRef } from 'react';

export default function HeroNetworkCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let width = (canvas.width = canvas.parentElement.clientWidth);
    let height = (canvas.height = canvas.parentElement.clientHeight);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    // Mouse interactive coordinates
    const mouse = { x: -1000, y: -1000, radius: 140 };
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    // Generate balanced network nodes
    const nodeCount = Math.min(36, Math.floor(width / 28));
    const nodes = [];

    // Colors matching theme
    const colors = [
      { fill: '#06b6d4', glow: 'rgba(6, 182, 212, 0.5)', type: 'project' },
      { fill: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)', type: 'contributor' },
      { fill: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.4)', type: 'trust' },
      { fill: '#10b981', glow: 'rgba(16, 185, 129, 0.4)', type: 'verified' },
    ];

    for (let i = 0; i < nodeCount; i++) {
      const colorScheme = colors[i % colors.length];
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: colorScheme.type === 'project' ? 5.5 : 3.5,
        color: colorScheme.fill,
        glow: colorScheme.glow,
        type: colorScheme.type,
        pulseOffset: Math.random() * Math.PI * 2,
      });
    }

    // Floating signal packets along edges
    const packets = [
      { from: 0, to: 1, progress: 0.1, speed: 0.007, color: '#06b6d4' },
      { from: 2, to: 4, progress: 0.4, speed: 0.009, color: '#10b981' },
      { from: 5, to: 7, progress: 0.7, speed: 0.006, color: '#8b5cf6' },
      { from: 8, to: 3, progress: 0.2, speed: 0.008, color: '#38bdf8' },
    ];

    let time = 0;

    const render = () => {
      time += 0.02;
      ctx.clearRect(0, 0, width, height);

      // Update positions
      nodes.forEach((node) => {
        node.x += node.vx;
        node.y += node.vy;

        // Bounce on boundaries
        if (node.x < 10 || node.x > width - 10) node.vx *= -1;
        if (node.y < 10 || node.y > height - 10) node.vy *= -1;

        // Mouse repelling/attraction effect
        const dx = mouse.x - node.x;
        const dy = mouse.y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouse.radius) {
          const force = (mouse.radius - dist) / mouse.radius;
          node.x -= (dx / dist) * force * 1.5;
          node.y -= (dy / dist) * force * 1.5;
        }
      });

      // Draw Edges
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 130;

          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.22;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(148, 163, 184, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      // Draw Signal Packets
      packets.forEach((pkt) => {
        if (pkt.from < nodes.length && pkt.to < nodes.length) {
          pkt.progress += pkt.speed;
          if (pkt.progress > 1) {
            pkt.progress = 0;
            pkt.from = Math.floor(Math.random() * nodes.length);
            pkt.to = (pkt.from + 1 + Math.floor(Math.random() * 4)) % nodes.length;
          }
          const n1 = nodes[pkt.from];
          const n2 = nodes[pkt.to];
          const px = n1.x + (n2.x - n1.x) * pkt.progress;
          const py = n1.y + (n2.y - n1.y) * pkt.progress;

          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = pkt.color;
          ctx.shadowColor = pkt.color;
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      // Draw Nodes
      nodes.forEach((node) => {
        const pulse = Math.sin(time + node.pulseOffset) * 0.7;
        const r = node.radius + pulse;

        // Outer glow
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 2.5, 0, Math.PI * 2);
        ctx.fillStyle = node.glow;
        ctx.fill();

        // Core node
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-auto cursor-crosshair opacity-75"
    />
  );
}
