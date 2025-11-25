// src/AnalysisResult.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Play, ChevronLeft, Pause, PenTool, Scan } from 'lucide-react';

export default function AnalysisResult({ data, videoUrl, onBack }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [telestratorActive, setTelestratorActive] = useState(false);
  const [color, setColor] = useState('#ef4444');
  const strokesRef = useRef([]); 

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    if (!telestratorActive) return;
    setIsDrawing(true);
    const pos = getPos(e);
    strokesRef.current.push({ points: [pos], color, timestamp: Date.now(), opacity: 1 });
  };

  const draw = (e) => {
    if (!isDrawing || !telestratorActive) return;
    const pos = getPos(e);
    const currentStroke = strokesRef.current[strokesRef.current.length - 1];
    if (currentStroke) currentStroke.points.push(pos);
  };

  const stopDrawing = () => setIsDrawing(false);

  useEffect(() => {
    const animate = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const now = Date.now();
        strokesRef.current = strokesRef.current.filter(s => s.opacity > 0);
        strokesRef.current.forEach(stroke => {
          if (now - stroke.timestamp > 2000) stroke.opacity -= 0.02;
          ctx.beginPath();
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.globalAlpha = Math.max(0, stroke.opacity);
          if (stroke.points.length > 0) {
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            stroke.points.forEach(p => ctx.lineTo(p.x, p.y));
          }
          ctx.stroke();
          ctx.globalAlpha = 1;
        });
      }
      requestAnimationFrame(animate);
    };
    const id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if(canvasRef.current && videoRef.current) {
      canvasRef.current.width = videoRef.current.clientWidth;
      canvasRef.current.height = videoRef.current.clientHeight;
    }
  }, [videoUrl]);

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white">
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-lg font-bold">AI Analysis Results</h2>
        </div>
        <div className="flex gap-2">
          <div className={`flex items-center gap-2 px-2 py-1 rounded-lg bg-black/50 border border-white/10 ${telestratorActive ? 'ring-2 ring-blue-500' : ''}`}>
            <button 
              onClick={() => setTelestratorActive(!telestratorActive)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 ${telestratorActive ? 'bg-blue-500 text-white' : 'text-slate-300'}`}
            >
              <PenTool size={14} /> Draw
            </button>
            {telestratorActive && (
              <div className="flex gap-1 pl-2 border-l border-white/20">
                {['#ef4444', '#eab308', '#22c55e', '#3b82f6'].map(c => (
                  <button key={c} onClick={() => setColor(c)} className={`w-4 h-4 rounded-full border ${color===c ? 'border-white' : 'border-transparent'}`} style={{background: c}} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">
          <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl aspect-video border border-slate-700">
            <video 
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-contain"
              onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
              onClick={() => { if(videoRef.current.paused) {videoRef.current.play(); setIsPlaying(true)} else {videoRef.current.pause(); setIsPlaying(false)} }}
            />
            <canvas 
              ref={canvasRef}
              className={`absolute inset-0 w-full h-full z-20 ${telestratorActive ? 'cursor-crosshair' : 'pointer-events-none'}`}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
            />
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex items-center gap-4">
              <button onClick={() => { if(videoRef.current.paused) {videoRef.current.play(); setIsPlaying(true)} else {videoRef.current.pause(); setIsPlaying(false)} }}>
                {isPlaying ? <Pause className="fill-white" /> : <Play className="fill-white" />}
              </button>
              <div className="text-xs font-mono">{Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(2).padStart(5, '0')}</div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            {[
              { l: 'Stroke Rate', v: data?.strokeRate },
              { l: 'Dist. Per Stroke', v: data?.dps },
              { l: 'Turn Time', v: data?.turnTime },
              { l: 'Underwater', v: data?.underwater }
            ].map((m, i) => (
              <div key={i} className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <div className="text-slate-400 text-xs font-bold uppercase mb-1">{m.l}</div>
                <div className="text-xl font-bold">{m.v || 'N/A'}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="w-96 bg-slate-800 border-l border-slate-700 p-6 overflow-y-auto">
          <div className="bg-blue-900/30 border border-blue-500/30 p-4 rounded-xl mb-6">
            <h4 className="text-blue-300 text-sm font-bold mb-2 flex items-center gap-2"><Scan size={16}/> AI Insight</h4>
            <p className="text-sm text-blue-100 leading-relaxed">{data?.insight || "No insight available."}</p>
          </div>

          <h4 className="text-xs font-bold text-slate-400 uppercase mb-4">Detected Flaws</h4>
          <div className="space-y-3">
            {data?.flaws?.map((flaw, i) => (
              <div key={i} 
                onClick={() => { if(videoRef.current) { videoRef.current.currentTime = flaw.timestamp; videoRef.current.pause(); setIsPlaying(false); }}}
                className="p-3 bg-slate-700/50 border border-slate-600 rounded-xl hover:border-blue-500 cursor-pointer transition-colors"
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-sm text-white">{flaw.title}</span>
                  <span className="text-xs font-mono bg-slate-800 px-1.5 rounded text-slate-400">{flaw.timestamp}s</span>
                </div>
                <p className="text-xs text-slate-400">{flaw.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
