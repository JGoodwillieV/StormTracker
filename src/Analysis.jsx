// src/Analysis.jsx
import React, { useState, useRef, useEffect } from 'react';
import { 
  UploadCloud, Play, ChevronLeft, Pause, PenTool, Scan 
} from 'lucide-react';

// Helper: Convert File to Base64 for Gemini
const fileToGenerativePart = async (file) => {
  const base64EncodedDataPromise = new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

// --- Sub-Component: Results View with Telestrator ---
// (Defined BEFORE usage to ensure scope clarity, though function hoisting usually handles it)
const AnalysisResult = ({ data, videoUrl, onBack }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [telestratorActive, setTelestratorActive] = useState(false);
  const [color, setColor] = useState('#ef4444'); // Red default
  const strokesRef = useRef([]); // Store drawing paths

  // Canvas Drawing Logic
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

  // Canvas Animation Loop (Fade out effect)
  useEffect(() => {
    const animate = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const now = Date.now();

        // Filter out old strokes
        strokesRef.current = strokesRef.current.filter(s => s.opacity > 0);

        strokesRef.current.forEach(stroke => {
          if (now - stroke.timestamp > 2000) stroke.opacity -= 0.02; // Fade after 2s
          
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

  // Resize canvas to match video
  useEffect(() => {
    if(canvasRef.current && videoRef.current) {
      canvasRef.current.width = videoRef.current.clientWidth;
      canvasRef.current.height = videoRef.current.clientHeight;
    }
  }, [videoUrl]);

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white overflow-hidden">
      {/* Toolbar */}
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
        {/* Video Stage */}
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
            {/* Floating Controls */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex items-center gap-4">
              <button onClick={() => { if(videoRef.current.paused) {videoRef.current.play(); setIsPlaying(true)} else {videoRef.current.pause(); setIsPlaying(false)} }}>
                {isPlaying ? <Pause className="fill-white" /> : <Play className="fill-white" />}
              </button>
              <div className="text-xs font-mono">{Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(2).padStart(5, '0')}</div>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { l: 'Stroke Rate', v: data.strokeRate },
              { l: 'Dist. Per Stroke', v: data.dps },
              { l: 'Turn Time', v: data.turnTime },
              { l: 'Underwater', v: data.underwater }
            ].map((m, i) => (
              <div key={i} className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <div className="text-slate-400 text-xs font-bold uppercase mb-1">{m.l}</div>
                <div className="text-xl font-bold">{m.v || 'N/A'}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar Results */}
        <div className="w-96 bg-slate-800 border-l border-slate-700 p-6 overflow-y-auto">
          <div className="bg-blue-900/30 border border-blue-500/30 p-4 rounded-xl mb-6">
            <h4 className="text-blue-300 text-sm font-bold mb-2 flex items-center gap-2"><Scan size={16}/> AI Insight</h4>
            <p className="text-sm text-blue-100 leading-relaxed">{data.insight}</p>
          </div>

          <h4 className="text-xs font-bold text-slate-400 uppercase mb-4">Detected Flaws</h4>
          <div className="space-y-3">
            {data.flaws?.map((flaw, i) => (
              <div key={i} 
                onClick={() => { videoRef.current.currentTime = flaw.timestamp; videoRef.current.pause(); setIsPlaying(false); }}
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
};

export default function Analysis({ swimmers, onBack, supabase }) {
  const [step, setStep] = useState('upload'); // upload, analyzing, results
  const [apiKey, setApiKey] = useState('');
  const [selectedSwimmerId, setSelectedSwimmerId] = useState('');
  const [stroke, setStroke] = useState('Freestyle');
  const [progress, setProgress] = useState(0);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [uploadFileName, setUploadFileName] = useState("");

  // --- ACTION: Handle Analysis ---
  const handleAnalyze = async (file) => {
    if (!apiKey) return alert("Please enter a Google Gemini API Key.");
    if (!selectedSwimmerId) return alert("Please select a swimmer.");

    setUploadFileName(file.name);
    setStep('analyzing');
    
    try {
      // 1. Upload to Supabase Storage
      const fileName = `${selectedSwimmerId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('race-videos')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('race-videos')
        .getPublicUrl(fileName);
      
      setVideoUrl(publicUrl);

      // 2. Prepare Gemini Request (Mock progress bar)
      let p = 0;
      const interval = setInterval(() => { p += 5; if(p < 90) setProgress(p); }, 500);

      const videoPart = await fileToGenerativePart(file);
      
      const prompt = `Analyze this swimming video of a ${stroke} race. 
      Return ONLY a raw JSON object (no markdown formatting) with these keys:
      - strokeRate (string, e.g. "32 SPM")
      - dps (string, e.g. "1.85 m")
      - turnTime (string, e.g. "0.95 s")
      - underwater (string, e.g. "12.5 m")
      - insight (string, 2 sentence summary of main issue)
      - flaws: array of objects { title, timestamp (seconds as number), severity (High/Medium/Low), desc }
      - drills: array of objects { name, focus }`;

      // 3. Call Gemini API
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, videoPart] }]
        })
      });

      clearInterval(interval);
      setProgress(100);

      const data = await response.json();
      if(data.error) throw new Error(data.error.message);

      const text = data.candidates[0].content.parts[0].text;
      // Clean up markdown code blocks if Gemini adds them
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const resultData = JSON.parse(cleanJson);

      // 4. Save to Database
      const { error: dbError } = await supabase
        .from('analyses')
        .insert([{
          swimmer_id: selectedSwimmerId,
          json_data: resultData,
          video_url: publicUrl
        }]);

      if (dbError) throw dbError;

      setAnalysisResult(resultData);
      setStep('results');

    } catch (error) {
      console.error(error);
      alert("Analysis Failed: " + error.message);
      setStep('upload');
    }
  };

  if (step === 'upload') return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-slate-800 mb-2">New Video Analysis</h2>
      <p className="text-slate-500 mb-8">Upload raw footage for AI processing</p>

      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">GOOGLE API KEY</label>
          <input 
            type="password" 
            value={apiKey} 
            onChange={e => setApiKey(e.target.value)}
            placeholder="Paste your Gemini API Key..." 
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" 
          />
          <p className="text-xs text-slate-400 mt-1">Key is never saved, only used for this session.</p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Swimmer</label>
            <select 
              value={selectedSwimmerId}
              onChange={(e) => setSelectedSwimmerId(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl"
            >
              <option value="">-- Select --</option>
              {swimmers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Stroke</label>
            <select 
              value={stroke}
              onChange={(e) => setStroke(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl"
            >
              {['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="border-2 border-dashed border-blue-200 bg-blue-50/50 rounded-2xl h-64 flex flex-col items-center justify-center relative cursor-pointer hover:bg-blue-50 transition-colors">
          <input 
            type="file" 
            className="absolute inset-0 opacity-0 cursor-pointer"
            accept="video/mp4,video/quicktime"
            onChange={(e) => e.target.files[0] && handleAnalyze(e.target.files[0])}
          />
          <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 text-blue-500">
            <UploadCloud size={32} />
          </div>
          <h3 className="font-bold text-slate-800 text-lg">Click to upload video</h3>
          <p className="text-slate-500 text-sm mt-1">MP4, MOV up to 50MB</p>
        </div>
      </div>
    </div>
  );

  if (step === 'analyzing') return (
    <div className="h-full flex flex-col items-center justify-center">
      <div className="relative w-48 h-48 flex items-center justify-center">
        <svg className="animate-spin w-full h-full text-blue-100" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-bold text-blue-600 text-xl">{progress}%</div>
      </div>
      <h3 className="mt-8 text-2xl font-bold text-slate-800">Gemini is Analyzing...</h3>
      <p className="text-slate-500 mt-2">Calculating skeletal vectors and stroke efficiency</p>
    </div>
  );

  return (
    <AnalysisResult 
      data={analysisResult} 
      videoUrl={videoUrl} 
      onBack={() => { setStep('upload'); setAnalysisResult(null); }} 
    />
  );
}
