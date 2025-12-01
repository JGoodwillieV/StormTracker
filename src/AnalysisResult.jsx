// src/AnalysisResult.jsx
import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, ChevronLeft, Pause, PenTool, Scan, RotateCcw, CheckCircle2,
  AlertCircle, Sparkles, Target, MessageSquare, Clock, User, Share2,
  Download, Trash2, Edit3, X, Check
} from 'lucide-react';

export default function AnalysisResult({ data, videoUrl, onBack, title, swimmerName, stroke, videoType }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [telestratorActive, setTelestratorActive] = useState(false);
  const [color, setColor] = useState('#ef4444');
  const strokesRef = useRef(data?.drawings || []);
  const [activePanel, setActivePanel] = useState('overview');

  // Load saved drawings if present
  useEffect(() => {
    if (data?.drawings) {
      strokesRef.current = data.drawings;
    }
  }, [data]);

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

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const seekTo = (time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Filter improvements by status
  const acceptedImprovements = data?.improvements?.filter(i => i.status === 'accepted') || [];
  const pendingImprovements = data?.improvements?.filter(i => i.status === 'pending') || [];

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h2 className="text-lg font-bold">{title || 'Video Analysis'}</h2>
            <p className="text-xs text-slate-400">
              {swimmerName && `${swimmerName} • `}
              {stroke && `${stroke} • `}
              {videoType && videoType.replace('-', ' ')}
            </p>
          </div>
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
        {/* Video Section */}
        <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">
          <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl aspect-video border border-slate-700">
            <video 
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-contain"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onClick={togglePlay}
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
              <button onClick={togglePlay}>
                {isPlaying ? <Pause className="fill-white" /> : <Play className="fill-white" />}
              </button>
              <div className="text-xs font-mono">{formatTime(currentTime)} / {formatTime(duration)}</div>
              
              {/* Progress Bar */}
              <div 
                className="flex-1 h-1 bg-slate-700 rounded-full cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = (e.clientX - rect.left) / rect.width;
                  seekTo(percent * duration);
                }}
              >
                <div 
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                />
              </div>
            </div>

            {/* Score Badge */}
            {data?.overallScore && (
              <div className="absolute top-4 right-4 bg-black/70 backdrop-blur px-4 py-2 rounded-lg">
                <div className="text-xs text-slate-400 uppercase">Score</div>
                <div className={`text-2xl font-bold ${
                  data.overallScore >= 80 ? 'text-emerald-400' :
                  data.overallScore >= 60 ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {data.overallScore}
                </div>
              </div>
            )}
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { l: 'Stroke Rate', v: data?.metrics?.strokeRate || data?.strokeRate },
              { l: 'Dist. Per Stroke', v: data?.metrics?.distancePerStroke || data?.dps },
              { l: 'Body Position', v: data?.metrics?.bodyPosition ? `${data.metrics.bodyPosition}/10` : null },
              { l: 'Timing', v: data?.metrics?.timing ? `${data.metrics.timing}/10` : null },
              { l: 'Efficiency', v: data?.metrics?.efficiency ? `${data.metrics.efficiency}/10` : null }
            ].filter(m => m.v).map((m, i) => (
              <div key={i} className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <div className="text-slate-400 text-xs font-bold uppercase mb-1">{m.l}</div>
                <div className="text-xl font-bold">{m.v || 'N/A'}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-96 bg-slate-800 border-l border-slate-700 flex flex-col overflow-hidden">
          {/* Panel Tabs */}
          <div className="flex border-b border-slate-700 shrink-0">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'feedback', label: 'Feedback' },
              { id: 'coach', label: 'Coach Notes' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActivePanel(tab.id)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activePanel === tab.id 
                    ? 'text-white bg-slate-700/50 border-b-2 border-blue-500' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {/* Overview Panel */}
            {activePanel === 'overview' && (
              <div className="space-y-6">
                {/* AI Summary */}
                {(data?.insight || data?.summary) && (
                  <div className="bg-blue-900/30 border border-blue-500/30 p-4 rounded-xl">
                    <h4 className="text-blue-300 text-sm font-bold mb-2 flex items-center gap-2">
                      <Scan size={16}/> AI Insight
                    </h4>
                    <p className="text-sm text-blue-100 leading-relaxed">{data?.summary || data?.insight}</p>
                  </div>
                )}

                {/* Strengths */}
                {data?.strengths?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-400" /> Strengths
                    </h4>
                    <div className="space-y-2">
                      {data.strengths.map((s, i) => (
                        <div key={i} className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                          <div className="font-medium text-emerald-400 text-sm">{s.title}</div>
                          <p className="text-xs text-slate-400 mt-1">{s.description}</p>
                          {s.timestamp && (
                            <button 
                              onClick={() => seekTo(s.timestamp)}
                              className="text-xs text-emerald-400 mt-2 hover:underline"
                            >
                              @ {formatTime(s.timestamp)}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Drills */}
                {data?.drills?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                      <Target size={14} className="text-purple-400" /> Recommended Drills
                    </h4>
                    <div className="space-y-2">
                      {data.drills.map((drill, i) => (
                        <div key={i} className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                          <div className="font-medium text-purple-400 text-sm">{drill.name}</div>
                          <p className="text-xs text-slate-500 mt-0.5">{drill.focus || drill.purpose}</p>
                          {drill.description && (
                            <p className="text-xs text-slate-400 mt-2">{drill.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Feedback Panel */}
            {activePanel === 'feedback' && (
              <div className="space-y-6">
                {/* Accepted Improvements */}
                {acceptedImprovements.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-emerald-400 uppercase mb-3 flex items-center gap-2">
                      <Check size={14} /> Accepted Feedback ({acceptedImprovements.length})
                    </h4>
                    <div className="space-y-2">
                      {acceptedImprovements.map((flaw, i) => (
                        <div key={i} 
                          onClick={() => { if(videoRef.current && flaw.timestamp) { videoRef.current.currentTime = flaw.timestamp; videoRef.current.pause(); setIsPlaying(false); }}}
                          className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl cursor-pointer transition-colors"
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-bold text-sm text-emerald-400">{flaw.title}</span>
                            {flaw.timestamp && <span className="text-xs font-mono bg-slate-800 px-1.5 rounded text-slate-400">{formatTime(flaw.timestamp)}</span>}
                          </div>
                          <p className="text-xs text-slate-400">{flaw.desc || flaw.description}</p>
                          {flaw.suggestion && (
                            <p className="text-xs text-blue-400 mt-2">
                              <span className="font-bold">Fix:</span> {flaw.suggestion}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* All/Pending Flaws */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                    <AlertCircle size={14} className="text-yellow-400" /> 
                    {acceptedImprovements.length > 0 ? 'Other Detected Issues' : 'Detected Issues'}
                  </h4>
                  <div className="space-y-2">
                    {(data?.flaws || pendingImprovements)?.map((flaw, i) => (
                      <div key={i} 
                        onClick={() => { if(videoRef.current && flaw.timestamp) { videoRef.current.currentTime = flaw.timestamp; videoRef.current.pause(); setIsPlaying(false); }}}
                        className="p-3 bg-slate-700/50 border border-slate-600 rounded-xl hover:border-blue-500 cursor-pointer transition-colors"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-sm text-white">{flaw.title}</span>
                          {flaw.timestamp && <span className="text-xs font-mono bg-slate-800 px-1.5 rounded text-slate-400">{formatTime(flaw.timestamp)}</span>}
                        </div>
                        <p className="text-xs text-slate-400">{flaw.desc || flaw.description}</p>
                        {flaw.severity && (
                          <span className={`inline-block mt-2 text-xs font-bold px-1.5 py-0.5 rounded ${
                            flaw.severity === 'High' ? 'bg-red-500/20 text-red-400' :
                            flaw.severity === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-slate-500/20 text-slate-400'
                          }`}>
                            {flaw.severity}
                          </span>
                        )}
                      </div>
                    ))}
                    {(!data?.flaws || data.flaws.length === 0) && pendingImprovements.length === 0 && (
                      <p className="text-sm text-slate-500 text-center py-4">No issues detected</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Coach Notes Panel */}
            {activePanel === 'coach' && (
              <div className="space-y-6">
                {/* General Notes */}
                {data?.coachNotes && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">General Notes</h4>
                    <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600">
                      <p className="text-sm text-slate-300 whitespace-pre-wrap">{data.coachNotes}</p>
                    </div>
                  </div>
                )}

                {/* Timestamped Feedback */}
                {data?.coachFeedback?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                      <MessageSquare size={14} /> Coach Feedback ({data.coachFeedback.length})
                    </h4>
                    <div className="space-y-2">
                      {data.coachFeedback
                        .sort((a, b) => a.timestamp - b.timestamp)
                        .map((feedback, i) => (
                          <div 
                            key={i}
                            onClick={() => seekTo(feedback.timestamp)}
                            className="bg-slate-700/50 rounded-lg p-3 border border-slate-600 cursor-pointer hover:border-blue-500 transition-colors"
                          >
                            <div className="text-xs font-mono text-blue-400 mb-1">
                              {formatTime(feedback.timestamp)}
                            </div>
                            <p className="text-sm text-white">{feedback.text}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {!data?.coachNotes && (!data?.coachFeedback || data.coachFeedback.length === 0) && (
                  <div className="text-center py-8 text-slate-500">
                    <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No coach notes for this analysis</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
