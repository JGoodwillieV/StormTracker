// src/Analysis.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { 
  UploadCloud, ChevronLeft, Video, Camera, Waves, Play, Pause, 
  SkipBack, SkipForward, Volume2, VolumeX, Maximize, Settings,
  Mic, MicOff, PenTool, Type, Check, X, Trash2, Save, Share2,
  Sparkles, Loader2, AlertCircle, Clock, User, Tag, Film,
  ChevronDown, ChevronUp, Eye, EyeOff, Edit3, MessageSquare,
  Zap, Target, ArrowRight, RotateCcw, Download, CheckCircle2,
  Plus, Crop, Move, RefreshCw, FileVideo, Minimize2
} from 'lucide-react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// Video type definitions
const VIDEO_TYPES = [
  { 
    id: 'over-water', 
    label: 'Over the Water', 
    icon: Camera, 
    description: 'Deck-level or above-water footage',
    color: 'blue',
    prompts: ['stroke technique', 'head position', 'body rotation', 'arm recovery', 'breathing pattern']
  },
  { 
    id: 'underwater', 
    label: 'Underwater', 
    icon: Waves, 
    description: 'Below surface footage',
    color: 'cyan',
    prompts: ['catch position', 'pull pattern', 'kick technique', 'streamline', 'underwater dolphin kicks']
  },
  { 
    id: 'full-race', 
    label: 'Full Race/Swim', 
    icon: Film, 
    description: 'Complete race or practice swim',
    color: 'purple',
    prompts: ['start reaction', 'breakout', 'turn technique', 'underwater off walls', 'finish', 'pacing']
  }
];

// Stroke options
const STROKES = ['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly', 'IM'];

// Compression quality presets
const COMPRESSION_PRESETS = [
  { id: 'high', label: 'High Quality', crf: 23, description: 'Best quality, larger file' },
  { id: 'medium', label: 'Balanced', crf: 28, description: 'Good quality, moderate size' },
  { id: 'low', label: 'Smaller File', crf: 32, description: 'Acceptable quality, smallest size' }
];

export default function Analysis({ swimmers, onBack, supabase: sb }) {
  const [step, setStep] = useState('setup'); // setup, compressing, uploading, analyzing, editor
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [saveApiKey, setSaveApiKey] = useState(!!localStorage.getItem('gemini_api_key'));
  
  // Video metadata
  const [selectedSwimmerId, setSelectedSwimmerId] = useState('');
  const [videoType, setVideoType] = useState('');
  const [stroke, setStroke] = useState('Freestyle');
  const [videoTitle, setVideoTitle] = useState('');
  
  // Upload state
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  
  // Video & Analysis data
  const [videoFile, setVideoFile] = useState(null);
  const [compressedFile, setCompressedFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [originalSize, setOriginalSize] = useState(0);
  const [compressedSize, setCompressedSize] = useState(0);
  
  // Compression settings
  const [compressionPreset, setCompressionPreset] = useState('medium');
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [ffmpegLoading, setFfmpegLoading] = useState(false);
  
  // Swimmer selection (bounding box)
  const [firstFrame, setFirstFrame] = useState(null);
  const [swimmerBoundingBox, setSwimmerBoundingBox] = useState(null);
  const [isDrawingBox, setIsDrawingBox] = useState(false);
  const [boxDrawStart, setBoxDrawStart] = useState(null);
  const [showSwimmerSelect, setShowSwimmerSelect] = useState(false);
  
  const fileInputRef = useRef(null);
  const ffmpegRef = useRef(new FFmpeg());
  const swimmerCanvasRef = useRef(null);

  // Handle API key storage preference
  useEffect(() => {
    if (saveApiKey && apiKey) {
      localStorage.setItem('gemini_api_key', apiKey);
    } else {
      localStorage.removeItem('gemini_api_key');
    }
  }, [saveApiKey, apiKey]);

  // Load FFmpeg
  // Load FFmpeg
const loadFFmpeg = async () => {
  if (ffmpegLoaded) return true;
  
  setFfmpegLoading(true);
  try {
    const ffmpeg = ffmpegRef.current;
    
    ffmpeg.on('log', ({ message }) => {
      console.log('[FFmpeg]', message);
    });
    
    ffmpeg.on('progress', ({ progress }) => {
      setCompressionProgress(Math.round(progress * 100));
    });
    
    // Try loading from unpkg CDN
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    
    setFfmpegLoaded(true);
    setFfmpegLoading(false);
    return true;
  } catch (error) {
    console.error('Failed to load FFmpeg:', error);
    console.error('Error details:', error.message);
    setFfmpegLoading(false);
    return false;
  }
};

  // Extract first frame from video
  const extractFirstFrame = (file) => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      
      video.onloadeddata = () => {
        video.currentTime = 0.1; // Get frame slightly after start
      };
      
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        resolve({
          dataUrl,
          width: video.videoWidth,
          height: video.videoHeight
        });
        
        URL.revokeObjectURL(video.src);
      };
      
      video.src = URL.createObjectURL(file);
    });
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setVideoFile(file);
      setCompressedFile(null);
      setOriginalSize(file.size);
      setCompressedSize(0);
      setVideoUrl(URL.createObjectURL(file));
      setSwimmerBoundingBox(null);
      
      if (!videoTitle) {
        setVideoTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
      
      // Extract first frame for swimmer selection
      try {
        const frame = await extractFirstFrame(file);
        setFirstFrame(frame);
        setShowSwimmerSelect(true);
      } catch (err) {
        console.error('Failed to extract first frame:', err);
      }
    }
  };

  // Compress video
  const compressVideo = async () => {
    if (!videoFile) return null;
    
    const loaded = await loadFFmpeg();
    if (!loaded) {
      alert('Failed to load video processor. Using original file.');
      return videoFile;
    }
    
    setStep('compressing');
    setCompressionProgress(0);
    setProgressMessage('Preparing video compression...');
    
    try {
      const ffmpeg = ffmpegRef.current;
      const inputName = 'input' + videoFile.name.substring(videoFile.name.lastIndexOf('.'));
      const outputName = 'output.mp4';
      
      // Write input file
      await ffmpeg.writeFile(inputName, await fetchFile(videoFile));
      
      setProgressMessage('Compressing video & removing audio...');
      
      // Get CRF from preset
      const preset = COMPRESSION_PRESETS.find(p => p.id === compressionPreset);
      const crf = preset?.crf || 28;
      
      // FFmpeg command: compress video, remove audio, scale if needed
      await ffmpeg.exec([
        '-i', inputName,
        '-c:v', 'libx264',
        '-crf', crf.toString(),
        '-preset', 'fast',
        '-an', // Remove audio
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', // Ensure even dimensions
        '-movflags', '+faststart',
        outputName
      ]);
      
      // Read output file
      const data = await ffmpeg.readFile(outputName);
      const compressedBlob = new Blob([data.buffer], { type: 'video/mp4' });
      const compressed = new File([compressedBlob], videoFile.name.replace(/\.[^/.]+$/, '') + '_compressed.mp4', {
        type: 'video/mp4'
      });
      
      setCompressedFile(compressed);
      setCompressedSize(compressed.size);
      
      // Clean up
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
      
      return compressed;
    } catch (error) {
      console.error('Compression failed:', error);
      setProgressMessage('Compression failed, using original file...');
      return videoFile;
    }
  };

  // Swimmer bounding box drawing handlers
  const getSwimmerCanvasCoordinates = (e) => {
    const canvas = swimmerCanvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleSwimmerBoxMouseDown = (e) => {
    const coords = getSwimmerCanvasCoordinates(e);
    if (coords) {
      setIsDrawingBox(true);
      setBoxDrawStart(coords);
      setSwimmerBoundingBox(null);
    }
  };

  const handleSwimmerBoxMouseMove = (e) => {
    if (!isDrawingBox || !boxDrawStart) return;
    
    const coords = getSwimmerCanvasCoordinates(e);
    if (coords) {
      const box = {
        x: Math.min(boxDrawStart.x, coords.x),
        y: Math.min(boxDrawStart.y, coords.y),
        width: Math.abs(coords.x - boxDrawStart.x),
        height: Math.abs(coords.y - boxDrawStart.y)
      };
      setSwimmerBoundingBox(box);
      drawSwimmerFrame(box);
    }
  };

  const handleSwimmerBoxMouseUp = () => {
    setIsDrawingBox(false);
    setBoxDrawStart(null);
  };

  // Draw the frame with bounding box overlay
  const drawSwimmerFrame = useCallback((box = swimmerBoundingBox) => {
    const canvas = swimmerCanvasRef.current;
    if (!canvas || !firstFrame) return;
    
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      if (box && box.width > 10 && box.height > 10) {
        // Darken everything outside the box
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, box.y);
        ctx.fillRect(0, box.y, box.x, box.height);
        ctx.fillRect(box.x + box.width, box.y, canvas.width - box.x - box.width, box.height);
        ctx.fillRect(0, box.y + box.height, canvas.width, canvas.height - box.y - box.height);
        
        // Draw box border
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.strokeRect(box.x, box.y, box.width, box.height);
        
        // Corner handles
        const handleSize = 10;
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(box.x - handleSize/2, box.y - handleSize/2, handleSize, handleSize);
        ctx.fillRect(box.x + box.width - handleSize/2, box.y - handleSize/2, handleSize, handleSize);
        ctx.fillRect(box.x - handleSize/2, box.y + box.height - handleSize/2, handleSize, handleSize);
        ctx.fillRect(box.x + box.width - handleSize/2, box.y + box.height - handleSize/2, handleSize, handleSize);
        
        // Label
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(box.x, box.y - 28, 120, 24);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px system-ui';
        ctx.fillText('Target Swimmer', box.x + 8, box.y - 10);
      }
    };
    
    img.src = firstFrame.dataUrl;
  }, [firstFrame, swimmerBoundingBox]);

  // Initialize canvas when first frame is ready
  useEffect(() => {
    if (firstFrame && swimmerCanvasRef.current) {
      const canvas = swimmerCanvasRef.current;
      canvas.width = firstFrame.width;
      canvas.height = firstFrame.height;
      drawSwimmerFrame();
    }
  }, [firstFrame, drawSwimmerFrame]);

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Calculate compression ratio
  const compressionRatio = originalSize > 0 && compressedSize > 0 
    ? Math.round((1 - compressedSize / originalSize) * 100) 
    : 0;

  const handleStartAnalysis = async () => {
    if (!videoFile) return alert('Please select a video file.');
    if (!selectedSwimmerId) return alert('Please select a swimmer.');
    if (!videoType) return alert('Please select a video type.');
    if (!apiKey) return alert('Please enter your Gemini API key.');

    // Compress video first
    const fileToUpload = await compressVideo();
    if (!fileToUpload) return;

    setStep('uploading');
    setUploadProgress(0);
    setProgressMessage('Uploading compressed video...');

    try {
      // 1. Upload to Supabase Storage
      const fileName = `${selectedSwimmerId}/${Date.now()}_${fileToUpload.name}`;
      
      // Simulate progress (Supabase doesn't have upload progress callback)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const { error: uploadError } = await supabase.storage
        .from('race-videos')
        .upload(fileName, fileToUpload);

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('race-videos')
        .getPublicUrl(fileName);

      setVideoUrl(publicUrl);
      setProgressMessage('Upload complete! Starting AI analysis...');

      // 2. Start AI Analysis
      setStep('analyzing');
      setAnalysisProgress(0);

      await runAIAnalysis(publicUrl, fileToUpload);

    } catch (error) {
      console.error(error);
      alert('Error: ' + error.message);
      setStep('setup');
    }
  };

  const runAIAnalysis = async (url, file) => {
    setProgressMessage('Preparing video for analysis...');
    setAnalysisProgress(10);

    try {
      // Convert video to base64 for Gemini
      const videoBlob = await fetch(file ? URL.createObjectURL(file) : url).then(r => r.blob());
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(videoBlob);
      });

      setProgressMessage('Sending to Gemini AI...');
      setAnalysisProgress(30);

      // Build context-aware prompt based on video type
      const videoTypeInfo = VIDEO_TYPES.find(v => v.id === videoType);
      const focusAreas = videoTypeInfo?.prompts.join(', ') || 'general technique';

      // Build swimmer focus instruction if bounding box is set
      let swimmerFocusInstruction = '';
      if (swimmerBoundingBox && firstFrame && swimmerBoundingBox.width > 10) {
        const relX = Math.round((swimmerBoundingBox.x / firstFrame.width) * 100);
        const relY = Math.round((swimmerBoundingBox.y / firstFrame.height) * 100);
        const relW = Math.round((swimmerBoundingBox.width / firstFrame.width) * 100);
        const relH = Math.round((swimmerBoundingBox.height / firstFrame.height) * 100);
        
        swimmerFocusInstruction = `
IMPORTANT - SWIMMER IDENTIFICATION:
The user has marked a specific swimmer to analyze. In the first frame of the video, the target swimmer is located in a bounding box at approximately:
- Position: ${relX}% from left, ${relY}% from top
- Size: ${relW}% width, ${relH}% height of frame
Focus your ENTIRE analysis on this specific swimmer. Ignore all other swimmers in the pool. Track this swimmer throughout the video based on their initial position, lane, and appearance.
`;
      }

      const prompt = `You are an expert swimming coach and video analyst. Analyze this ${videoType.replace('-', ' ')} video of a ${stroke} swimmer.

VIDEO TYPE: ${videoTypeInfo?.label}
STROKE: ${stroke}
FOCUS AREAS: ${focusAreas}
${swimmerFocusInstruction}

Please provide a detailed analysis in the following JSON format (return ONLY valid JSON, no markdown):
{
  "overallScore": <number 1-100>,
  "summary": "<2-3 sentence overview of the swimmer's technique>",
  "strengths": [
    { "title": "<strength name>", "description": "<detailed explanation>", "timestamp": <seconds or null> }
  ],
  "improvements": [
    { 
      "id": "<unique_id>",
      "title": "<issue name>", 
      "description": "<what's happening>",
      "suggestion": "<how to fix it>",
      "severity": "<High|Medium|Low>",
      "timestamp": <seconds or null>,
      "status": "pending"
    }
  ],
  "drills": [
    { "name": "<drill name>", "purpose": "<what it addresses>", "description": "<how to do it>" }
  ],
  "metrics": {
    "strokeRate": "<estimated strokes per minute or null>",
    "distancePerStroke": "<estimated if visible or null>",
    "bodyPosition": "<rating 1-10>",
    "timing": "<rating 1-10>",
    "efficiency": "<rating 1-10>"
  },
  "keyMoments": [
    { "timestamp": <seconds>, "description": "<what happens at this moment>" }
  ]
}

Be specific and actionable. Reference specific timestamps when possible. Focus on the most impactful observations for ${videoType.replace('-', ' ')} footage.`;

      setAnalysisProgress(50);
      setProgressMessage('AI is analyzing technique...');

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inlineData: { mimeType: 'video/mp4', data: base64 } }
              ]
            }]
          })
        }
      );

      setAnalysisProgress(80);
      setProgressMessage('Processing results...');

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      const text = data.candidates[0].content.parts[0].text;
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const analysisResult = JSON.parse(cleanJson);

      // Add IDs to improvements if not present
      analysisResult.improvements = analysisResult.improvements.map((imp, idx) => ({
        ...imp,
        id: imp.id || `ai-${idx}`,
        status: 'pending',
        isAI: true
      }));

      setAiAnalysis(analysisResult);
      setAnalysisProgress(100);
      setProgressMessage('Analysis complete!');

      setTimeout(() => setStep('editor'), 500);

    } catch (error) {
      console.error('Analysis error:', error);
      alert('Analysis failed: ' + error.message);
      setStep('setup');
    }
  };

  // Render based on step
  if (step === 'compressing') {
    return <CompressionProgress progress={compressionProgress} message={progressMessage} />;
  }

  if (step === 'uploading' || step === 'analyzing') {
    return <ProgressStep step={step} uploadProgress={uploadProgress} analysisProgress={analysisProgress} progressMessage={progressMessage} />;
  }

  if (step === 'editor' && aiAnalysis) {
    return (
      <EditorStep
        videoUrl={videoUrl}
        videoTitle={videoTitle}
        setVideoTitle={setVideoTitle}
        aiAnalysis={aiAnalysis}
        setAiAnalysis={setAiAnalysis}
        selectedSwimmerId={selectedSwimmerId}
        stroke={stroke}
        videoType={videoType}
        swimmers={swimmers}
        onBack={() => setStep('setup')}
        supabase={supabase}
      />
    );
  }

  // Setup Step
  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-2 hover:bg-white rounded-xl text-slate-500 transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Video className="text-blue-600" /> Video Analysis Studio
          </h2>
          <p className="text-slate-500 text-sm">AI-powered technique analysis with smart compression</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Video Type Selection */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Film size={18} className="text-slate-400" /> Video Type
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {VIDEO_TYPES.map(type => {
              const Icon = type.icon;
              const isSelected = videoType === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => setVideoType(type.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
                    isSelected ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <Icon size={20} />
                  </div>
                  <h4 className="font-bold text-slate-800">{type.label}</h4>
                  <p className="text-xs text-slate-500 mt-1">{type.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Swimmer & Stroke Selection */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <User size={18} className="text-slate-400" /> Swimmer Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Select Swimmer</label>
              <select
                value={selectedSwimmerId}
                onChange={e => setSelectedSwimmerId(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Choose a swimmer...</option>
                {swimmers?.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Stroke</label>
              <select
                value={stroke}
                onChange={e => setStroke(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {STROKES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Video Upload */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <UploadCloud size={18} className="text-slate-400" /> Upload Video
          </h3>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {!videoFile ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-blue-200 bg-blue-50/50 rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-all"
            >
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 text-blue-500">
                <UploadCloud size={32} />
              </div>
              <h4 className="font-bold text-slate-800 text-lg mb-1">Click to upload video</h4>
              <p className="text-slate-500 text-sm">MP4, MOV, WebM • No size limit (will be compressed)</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Video Preview */}
              <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
                <video 
                  src={videoUrl}
                  className="w-full h-full object-contain"
                  controls
                />
              </div>
              
              {/* File Info & Compression Settings */}
              <div className="flex flex-wrap gap-4 items-center justify-between p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <FileVideo size={24} className="text-slate-400" />
                  <div>
                    <p className="font-medium text-slate-700">{videoFile.name}</p>
                    <p className="text-sm text-slate-500">
                      Original: {formatFileSize(originalSize)}
                      {compressedSize > 0 && (
                        <span className="text-green-600 ml-2">
                          → {formatFileSize(compressedSize)} ({compressionRatio}% smaller)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-blue-600 text-sm font-medium hover:underline"
                >
                  Change video
                </button>
              </div>

              {/* Compression Quality Preset */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Compression Quality</label>
                <div className="grid grid-cols-3 gap-3">
                  {COMPRESSION_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => setCompressionPreset(preset.id)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        compressionPreset === preset.id 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <p className="font-medium text-slate-800">{preset.label}</p>
                      <p className="text-xs text-slate-500">{preset.description}</p>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Video Title */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Video Title</label>
                <input
                  type="text"
                  value={videoTitle}
                  onChange={e => setVideoTitle(e.target.value)}
                  placeholder="Enter a title for this analysis..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Swimmer Selection (Bounding Box) */}
        {firstFrame && showSwimmerSelect && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Target size={18} className="text-purple-500" /> Select Your Swimmer
              </h3>
              <button
                onClick={() => setShowSwimmerSelect(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <Minimize2 size={20} />
              </button>
            </div>
            
            <p className="text-sm text-slate-500 mb-4">
              Draw a box around the swimmer you want to analyze. This helps the AI focus on the correct swimmer when there are multiple people in the pool.
            </p>
            
            <div className="relative bg-slate-900 rounded-xl overflow-hidden">
              <canvas
                ref={swimmerCanvasRef}
                onMouseDown={handleSwimmerBoxMouseDown}
                onMouseMove={handleSwimmerBoxMouseMove}
                onMouseUp={handleSwimmerBoxMouseUp}
                onMouseLeave={handleSwimmerBoxMouseUp}
                className="w-full h-auto cursor-crosshair"
                style={{ maxHeight: '400px', objectFit: 'contain' }}
              />
            </div>
            
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2 text-sm">
                {swimmerBoundingBox && swimmerBoundingBox.width > 10 ? (
                  <span className="flex items-center gap-1.5 text-green-600">
                    <CheckCircle2 size={16} />
                    Swimmer selected
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Crop size={16} />
                    Click and drag to select swimmer
                  </span>
                )}
              </div>
              
              {swimmerBoundingBox && (
                <button
                  onClick={() => {
                    setSwimmerBoundingBox(null);
                    drawSwimmerFrame(null);
                  }}
                  className="text-sm text-red-500 hover:text-red-600 flex items-center gap-1"
                >
                  <RotateCcw size={14} />
                  Reset selection
                </button>
              )}
            </div>
          </div>
        )}

        {/* Show swimmer select button if hidden */}
        {firstFrame && !showSwimmerSelect && (
          <button
            onClick={() => setShowSwimmerSelect(true)}
            className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-left hover:bg-slate-50 transition-colors flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Target size={20} className="text-purple-500" />
              <div>
                <p className="font-medium text-slate-700">Swimmer Selection</p>
                <p className="text-sm text-slate-500">
                  {swimmerBoundingBox && swimmerBoundingBox.width > 10 
                    ? 'Target swimmer marked' 
                    : 'Optional: Mark specific swimmer to track'}
                </p>
              </div>
            </div>
            {swimmerBoundingBox && swimmerBoundingBox.width > 10 && (
              <CheckCircle2 size={20} className="text-green-500" />
            )}
          </button>
        )}

        {/* API Key */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Sparkles size={18} className="text-purple-500" /> AI Configuration
          </h3>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Google Gemini API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Enter your Gemini API key..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="saveKey"
                checked={saveApiKey}
                onChange={e => setSaveApiKey(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="saveKey" className="text-sm text-slate-500">
                Remember API key for future sessions
              </label>
            </div>
          </div>
        </div>

        {/* FFmpeg Loading Status */}
        {ffmpegLoading && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
            <Loader2 size={20} className="text-amber-600 animate-spin" />
            <p className="text-amber-800 text-sm">Loading video processor...</p>
          </div>
        )}

        {/* Start Analysis Button */}
        <button
          onClick={handleStartAnalysis}
          disabled={!videoFile || !selectedSwimmerId || !videoType || !apiKey || ffmpegLoading}
          className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-xl text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
        >
          <Sparkles size={20} />
          Compress & Analyze Video
        </button>

        <p className="text-center text-xs text-slate-400">
          Video will be compressed and audio removed before upload to reduce file size
        </p>
      </div>
    </div>
  );
}

// ============================================
// COMPRESSION PROGRESS COMPONENT
// ============================================
const CompressionProgress = ({ progress, message }) => {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-purple-50 p-8">
      <div className="bg-white rounded-3xl p-12 shadow-xl border border-slate-200 max-w-md w-full text-center">
        {/* Animated Icon */}
        <div className="relative w-32 h-32 mx-auto mb-8">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle 
              cx="50" cy="50" r="45" 
              fill="none" 
              stroke="#e2e8f0" 
              strokeWidth="8"
            />
            <circle 
              cx="50" cy="50" r="45" 
              fill="none" 
              stroke="url(#compressionGradient)" 
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${progress * 2.83} 283`}
              className="transition-all duration-500"
            />
            <defs>
              <linearGradient id="compressionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <RefreshCw size={32} className="text-purple-500 animate-spin" />
          </div>
        </div>

        <h3 className="text-2xl font-bold text-slate-800 mb-2">
          Compressing Video
        </h3>
        <p className="text-slate-500 mb-4">{message}</p>
        <div className="text-3xl font-bold text-purple-600">{progress}%</div>
        
        <p className="text-xs text-slate-400 mt-6">
          Removing audio & optimizing for analysis...
        </p>
      </div>
    </div>
  );
};

// ============================================
// PROGRESS STEP COMPONENT
// ============================================
const ProgressStep = ({ step, uploadProgress, analysisProgress, progressMessage }) => {
  const progress = step === 'uploading' ? uploadProgress : analysisProgress;
  
  return (
    <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-8">
      <div className="bg-white rounded-3xl p-12 shadow-xl border border-slate-200 max-w-md w-full text-center">
        {/* Animated Icon */}
        <div className="relative w-32 h-32 mx-auto mb-8">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle 
              cx="50" cy="50" r="45" 
              fill="none" 
              stroke="#e2e8f0" 
              strokeWidth="8"
            />
            <circle 
              cx="50" cy="50" r="45" 
              fill="none" 
              stroke="url(#gradient)" 
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${progress * 2.83} 283`}
              className="transition-all duration-500"
            />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-bold text-slate-800">{Math.round(progress)}%</span>
          </div>
        </div>

        <h3 className="text-2xl font-bold text-slate-800 mb-2">
          {step === 'uploading' ? 'Uploading Video' : 'AI Analysis in Progress'}
        </h3>
        <p className="text-slate-500">{progressMessage}</p>

        {step === 'analyzing' && (
          <div className="mt-6 flex items-center justify-center gap-2 text-purple-600">
            <Sparkles size={16} className="animate-pulse" />
            <span className="text-sm font-medium">Gemini is analyzing technique...</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// EDITOR STEP COMPONENT
// ============================================
const EditorStep = ({ 
  videoUrl, videoTitle, setVideoTitle, 
  aiAnalysis, setAiAnalysis,
  selectedSwimmerId, stroke, videoType, swimmers,
  onBack, supabase 
}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  
  // Drawing state - redesigned for straight lines
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawingColor, setDrawingColor] = useState('#ef4444');
  const [lineThickness, setLineThickness] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lineStart, setLineStart] = useState(null);
  const [linePreview, setLinePreview] = useState(null);
  
  // Saved annotations (lines with timestamps)
  const [annotations, setAnnotations] = useState([]);
  const [selectedAnnotation, setSelectedAnnotation] = useState(null);
  const [annotationLabel, setAnnotationLabel] = useState('');
  const [showAnnotationModal, setShowAnnotationModal] = useState(false);
  const [pendingLine, setPendingLine] = useState(null);
  
  // Display settings
  const [annotationDuration, setAnnotationDuration] = useState(3); // seconds to show each annotation
  const [showAllAnnotations, setShowAllAnnotations] = useState(false);
  
  // Coach annotations
  const [coachNotes, setCoachNotes] = useState('');
  const [coachFeedback, setCoachFeedback] = useState([]);
  const [newFeedbackText, setNewFeedbackText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  
  // UI state
  const [activePanel, setActivePanel] = useState('ai'); // ai, coach, drills, annotations
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // Video controls
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

  const seekTo = (time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const skip = (seconds) => {
    if (videoRef.current) {
      const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
      seekTo(newTime);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const formatTimeShort = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get canvas coordinates
  const getCanvasPos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
      // Also store as percentage for responsive playback
      xPercent: (clientX - rect.left) / rect.width,
      yPercent: (clientY - rect.top) / rect.height
    };
  };

  // Drawing handlers for straight lines
  const handleMouseDown = (e) => {
    if (!isDrawingMode) return;
    e.preventDefault();
    
    // Pause video when starting to draw
    if (videoRef.current && isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    
    const pos = getCanvasPos(e);
    if (pos) {
      setIsDrawing(true);
      setLineStart(pos);
      setLinePreview(null);
    }
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || !lineStart) return;
    e.preventDefault();
    
    const pos = getCanvasPos(e);
    if (pos) {
      setLinePreview(pos);
    }
  };

  const handleMouseUp = (e) => {
    if (!isDrawing || !lineStart) {
      setIsDrawing(false);
      return;
    }
    
    const endPos = getCanvasPos(e);
    if (endPos) {
      // Calculate line length to avoid accidental clicks
      const dx = endPos.x - lineStart.x;
      const dy = endPos.y - lineStart.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      
      if (length > 20) { // Minimum line length
        // Store the pending line and show label modal
        setPendingLine({
          id: `line-${Date.now()}`,
          startX: lineStart.xPercent,
          startY: lineStart.yPercent,
          endX: endPos.xPercent,
          endY: endPos.yPercent,
          color: drawingColor,
          thickness: lineThickness,
          timestamp: currentTime,
          duration: annotationDuration,
          label: ''
        });
        setAnnotationLabel('');
        setShowAnnotationModal(true);
      }
    }
    
    setIsDrawing(false);
    setLineStart(null);
    setLinePreview(null);
  };

  // Save annotation with optional label
  const saveAnnotation = (withLabel = true) => {
    if (pendingLine) {
      const newAnnotation = {
        ...pendingLine,
        label: withLabel ? annotationLabel : ''
      };
      setAnnotations(prev => [...prev, newAnnotation]);
      setPendingLine(null);
      setShowAnnotationModal(false);
      setAnnotationLabel('');
    }
  };

  const cancelAnnotation = () => {
    setPendingLine(null);
    setShowAnnotationModal(false);
    setAnnotationLabel('');
  };

  const deleteAnnotation = (id) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
    if (selectedAnnotation === id) {
      setSelectedAnnotation(null);
    }
  };

  // Get visible annotations based on current time
  const getVisibleAnnotations = () => {
    if (showAllAnnotations) return annotations;
    
    return annotations.filter(ann => {
      const timeDiff = currentTime - ann.timestamp;
      return timeDiff >= 0 && timeDiff <= ann.duration;
    });
  };

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw visible annotations
      const visible = getVisibleAnnotations();
      visible.forEach(ann => {
        const startX = ann.startX * canvas.width;
        const startY = ann.startY * canvas.height;
        const endX = ann.endX * canvas.width;
        const endY = ann.endY * canvas.height;
        
        // Calculate opacity based on time (fade out effect)
        let opacity = 1;
        if (!showAllAnnotations) {
          const timeDiff = currentTime - ann.timestamp;
          const fadeStart = ann.duration - 0.5; // Start fading 0.5s before end
          if (timeDiff > fadeStart) {
            opacity = Math.max(0, 1 - (timeDiff - fadeStart) / 0.5);
          }
        }
        
        // Highlight selected annotation
        const isSelected = selectedAnnotation === ann.id;
        
        ctx.save();
        ctx.globalAlpha = opacity;
        
        // Draw line shadow for better visibility
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = ann.thickness + 4;
        ctx.lineCap = 'round';
        ctx.stroke();
        
        // Draw main line
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = isSelected ? '#ffffff' : ann.color;
        ctx.lineWidth = ann.thickness + (isSelected ? 2 : 0);
        ctx.lineCap = 'round';
        ctx.stroke();
        
        // Draw endpoints
        [{ x: startX, y: startY }, { x: endX, y: endY }].forEach(point => {
          ctx.beginPath();
          ctx.arc(point.x, point.y, ann.thickness + 2, 0, Math.PI * 2);
          ctx.fillStyle = ann.color;
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.8)';
          ctx.lineWidth = 2;
          ctx.stroke();
        });
        
        // Draw label if exists
        if (ann.label) {
          const midX = (startX + endX) / 2;
          const midY = (startY + endY) / 2;
          
          ctx.font = 'bold 14px system-ui';
          const textMetrics = ctx.measureText(ann.label);
          const padding = 6;
          const bgWidth = textMetrics.width + padding * 2;
          const bgHeight = 20;
          
          // Label background
          ctx.fillStyle = 'rgba(0,0,0,0.8)';
          ctx.beginPath();
          ctx.roundRect(midX - bgWidth/2, midY - bgHeight/2 - 15, bgWidth, bgHeight, 4);
          ctx.fill();
          
          // Label text
          ctx.fillStyle = ann.color;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(ann.label, midX, midY - 15);
        }
        
        ctx.restore();
      });
      
      // Draw preview line while drawing
      if (isDrawing && lineStart && linePreview) {
        ctx.beginPath();
        ctx.moveTo(lineStart.x, lineStart.y);
        ctx.lineTo(linePreview.x, linePreview.y);
        ctx.strokeStyle = drawingColor;
        ctx.lineWidth = lineThickness;
        ctx.lineCap = 'round';
        ctx.setLineDash([10, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw endpoints
        [lineStart, linePreview].forEach(point => {
          ctx.beginPath();
          ctx.arc(point.x, point.y, lineThickness + 2, 0, Math.PI * 2);
          ctx.fillStyle = drawingColor;
          ctx.globalAlpha = 0.5;
          ctx.fill();
          ctx.globalAlpha = 1;
        });
      }
      
      requestAnimationFrame(render);
    };
    
    const animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, [annotations, currentTime, isDrawing, lineStart, linePreview, drawingColor, lineThickness, showAllAnnotations, selectedAnnotation]);

  // Resize canvas to match video
  useEffect(() => {
    const resizeCanvas = () => {
      if (canvasRef.current && videoRef.current) {
        canvasRef.current.width = videoRef.current.clientWidth;
        canvasRef.current.height = videoRef.current.clientHeight;
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Also resize when video loads
    if (videoRef.current) {
      videoRef.current.addEventListener('loadeddata', resizeCanvas);
    }
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [videoUrl]);

  // Handle AI feedback status
  const updateFeedbackStatus = (id, status) => {
    setAiAnalysis(prev => ({
      ...prev,
      improvements: prev.improvements.map(imp => 
        imp.id === id ? { ...imp, status } : imp
      )
    }));
  };

  // Add coach feedback
  const addCoachFeedback = () => {
    if (!newFeedbackText.trim()) return;
    
    const newFeedback = {
      id: `coach-${Date.now()}`,
      text: newFeedbackText,
      timestamp: currentTime,
      createdAt: new Date().toISOString(),
      isCoach: true
    };
    
    setCoachFeedback(prev => [...prev, newFeedback]);
    setNewFeedbackText('');
  };

  const removeCoachFeedback = (id) => {
    setCoachFeedback(prev => prev.filter(f => f.id !== id));
  };

  // Save analysis
  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      // Include all metadata in json_data since the table may not have all columns
      const analysisData = {
        swimmer_id: selectedSwimmerId,
        video_url: videoUrl,
        json_data: {
          ...aiAnalysis,
          title: videoTitle,
          videoType: videoType,
          stroke: stroke,
          coachNotes,
          coachFeedback,
          annotations, // Save line annotations
          savedAt: new Date().toISOString()
        }
      };

      const { error } = await supabase
        .from('analyses')
        .insert([analysisData]);

      if (error) throw error;

      alert('Analysis saved successfully!');
    } catch (error) {
      console.error(error);
      alert('Error saving: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const swimmer = swimmers.find(s => s.id === selectedSwimmerId);

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-700 rounded-full text-slate-400">
            <ChevronLeft size={24} />
          </button>
          <div>
            {isEditingTitle ? (
              <input
                type="text"
                value={videoTitle}
                onChange={e => setVideoTitle(e.target.value)}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={e => e.key === 'Enter' && setIsEditingTitle(false)}
                autoFocus
                className="bg-slate-700 text-white font-bold text-lg px-2 py-1 rounded border border-slate-600 focus:border-blue-500 outline-none"
              />
            ) : (
              <h2 
                onClick={() => setIsEditingTitle(true)}
                className="text-lg font-bold cursor-pointer hover:text-blue-400 flex items-center gap-2"
              >
                {videoTitle || 'Untitled Analysis'}
                <Edit3 size={14} className="text-slate-500" />
              </h2>
            )}
            <p className="text-xs text-slate-400">
              {swimmer?.name} • {stroke} • {VIDEO_TYPES.find(v => v.id === videoType)?.label}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Drawing Tools */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${isDrawingMode ? 'bg-blue-500/20 border border-blue-500' : 'bg-slate-700 border border-slate-600'}`}>
            <button
              onClick={() => setIsDrawingMode(!isDrawingMode)}
              className={`p-1.5 rounded flex items-center gap-1.5 ${isDrawingMode ? 'text-blue-400' : 'text-slate-400 hover:text-white'}`}
              title="Draw straight lines on video"
            >
              <PenTool size={18} />
              <span className="text-xs font-medium hidden md:inline">
                {isDrawingMode ? 'Drawing' : 'Draw'}
              </span>
            </button>
            
            {isDrawingMode && (
              <>
                <div className="w-px h-5 bg-slate-600" />
                
                {/* Colors */}
                {['#ef4444', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ffffff'].map(c => (
                  <button
                    key={c}
                    onClick={() => setDrawingColor(c)}
                    className={`w-5 h-5 rounded-full border-2 transition-transform ${drawingColor === c ? 'border-white scale-110' : 'border-transparent hover:scale-110'}`}
                    style={{ background: c }}
                  />
                ))}
                
                <div className="w-px h-5 bg-slate-600" />
                
                {/* Line thickness */}
                <select
                  value={lineThickness}
                  onChange={e => setLineThickness(Number(e.target.value))}
                  className="bg-slate-600 text-white text-xs rounded px-1.5 py-1 border-0"
                >
                  <option value={2}>Thin</option>
                  <option value={3}>Medium</option>
                  <option value={5}>Thick</option>
                </select>
              </>
            )}
          </div>

          {/* Show all annotations toggle */}
          {annotations.length > 0 && (
            <button
              onClick={() => setShowAllAnnotations(!showAllAnnotations)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                showAllAnnotations 
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500' 
                  : 'bg-slate-700 text-slate-400 border border-slate-600 hover:text-white'
              }`}
              title={showAllAnnotations ? 'Show annotations at their timestamps' : 'Show all annotations'}
            >
              {showAllAnnotations ? <Eye size={14} /> : <EyeOff size={14} />}
              {showAllAnnotations ? 'All Visible' : 'Timed'}
            </button>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Panel */}
        <div className="flex-1 flex flex-col p-4">
          {/* Video Container */}
          <div className="relative bg-black rounded-xl overflow-hidden flex-1 mb-4">
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-contain"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onClick={() => !isDrawingMode && togglePlay()}
            />
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 w-full h-full ${isDrawingMode ? 'cursor-crosshair' : 'pointer-events-none'}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => { setIsDrawing(false); setLinePreview(null); }}
              onTouchStart={handleMouseDown}
              onTouchMove={handleMouseMove}
              onTouchEnd={handleMouseUp}
            />
            
            {/* Drawing Mode Indicator */}
            {isDrawingMode && (
              <div className="absolute top-4 left-4 bg-blue-500/90 backdrop-blur px-3 py-1.5 rounded-full flex items-center gap-2 text-sm font-medium">
                <PenTool size={14} />
                Click and drag to draw a line
              </div>
            )}
            
            {/* Play/Pause Overlay */}
            {!isPlaying && !isDrawingMode && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
                  <Play size={32} className="text-white ml-1" />
                </div>
              </div>
            )}

            {/* Score Badge */}
            {aiAnalysis?.overallScore && (
              <div className="absolute top-4 right-4 bg-black/70 backdrop-blur px-4 py-2 rounded-lg">
                <div className="text-xs text-slate-400 uppercase">AI Score</div>
                <div className={`text-2xl font-bold ${
                  aiAnalysis.overallScore >= 80 ? 'text-emerald-400' :
                  aiAnalysis.overallScore >= 60 ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {aiAnalysis.overallScore}
                </div>
              </div>
            )}
            
            {/* Annotations count badge */}
            {annotations.length > 0 && (
              <div className="absolute bottom-20 right-4 bg-purple-500/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold">
                {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          {/* Video Controls */}
          <div className="bg-slate-800 rounded-xl p-4">
            {/* Progress Bar with Annotation Markers */}
            <div 
              className="h-3 bg-slate-700 rounded-full mb-4 cursor-pointer relative group"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                seekTo(percent * duration);
              }}
            >
              {/* Progress fill */}
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full relative"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              
              {/* Annotation Markers */}
              {annotations.map(ann => (
                <div
                  key={ann.id}
                  className={`absolute top-1/2 -translate-y-1/2 w-2 h-4 rounded-sm cursor-pointer hover:scale-150 transition-transform ${
                    selectedAnnotation === ann.id ? 'bg-white' : 'bg-purple-400'
                  }`}
                  style={{ 
                    left: `${(ann.timestamp / duration) * 100}%`,
                    backgroundColor: ann.color 
                  }}
                  title={ann.label || `Annotation at ${formatTimeShort(ann.timestamp)}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    seekTo(ann.timestamp);
                    setSelectedAnnotation(ann.id);
                    setActivePanel('annotations');
                  }}
                />
              ))}
              
              {/* Key Moments Markers */}
              {aiAnalysis?.keyMoments?.map((moment, i) => (
                <div
                  key={i}
                  className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-yellow-400 rounded-full cursor-pointer hover:scale-150 transition-transform"
                  style={{ left: `${(moment.timestamp / duration) * 100}%` }}
                  title={moment.description}
                  onClick={(e) => {
                    e.stopPropagation();
                    seekTo(moment.timestamp);
                  }}
                />
              ))}
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={() => skip(-5)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400">
                  <SkipBack size={20} />
                </button>
                <button onClick={togglePlay} className="p-3 bg-white text-slate-900 rounded-full hover:bg-slate-200">
                  {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
                </button>
                <button onClick={() => skip(5)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400">
                  <SkipForward size={20} />
                </button>
                
                <div className="text-sm font-mono text-slate-400 ml-2">
                  {formatTimeShort(currentTime)} / {formatTimeShort(duration)}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-2 hover:bg-slate-700 rounded-lg text-slate-400"
                >
                  {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Side Panel */}
        <div className="w-96 bg-slate-800 border-l border-slate-700 flex flex-col overflow-hidden">
          {/* Panel Tabs */}
          <div className="flex border-b border-slate-700 shrink-0">
            {[
              { id: 'ai', label: 'AI Analysis', icon: Sparkles },
              { id: 'coach', label: 'Coach', icon: MessageSquare },
              { id: 'annotations', label: 'Lines', icon: PenTool }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActivePanel(tab.id)}
                className={`flex-1 py-3 px-2 text-xs font-bold uppercase flex items-center justify-center gap-1.5 transition-colors ${
                  activePanel === tab.id
                    ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-700/50'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* AI Analysis Panel */}
            {activePanel === 'ai' && (
              <div className="space-y-6">
                {/* Summary */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Summary</h4>
                  <p className="text-sm text-slate-300">{aiAnalysis?.summary}</p>
                </div>

                {/* Strengths */}
                {aiAnalysis?.strengths?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-400" /> Strengths
                    </h4>
                    <div className="space-y-2">
                      {aiAnalysis.strengths.map((s, i) => (
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

                {/* Improvements */}
                {aiAnalysis?.improvements?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                      <AlertCircle size={14} className="text-amber-400" /> Areas to Improve
                    </h4>
                    <div className="space-y-2">
                      {aiAnalysis.improvements.map((imp) => (
                        <div 
                          key={imp.id} 
                          className={`rounded-lg p-3 border transition-all ${
                            imp.status === 'accepted' 
                              ? 'bg-emerald-500/10 border-emerald-500/30' 
                              : imp.status === 'rejected'
                              ? 'bg-slate-700/30 border-slate-600 opacity-50'
                              : 'bg-amber-500/10 border-amber-500/20'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="font-medium text-amber-400 text-sm">{imp.title}</div>
                              <p className="text-xs text-slate-400 mt-1">{imp.description}</p>
                              {imp.suggestion && (
                                <p className="text-xs text-blue-400 mt-2">💡 {imp.suggestion}</p>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => updateFeedbackStatus(imp.id, 'accepted')}
                                className={`p-1.5 rounded ${imp.status === 'accepted' ? 'bg-emerald-500 text-white' : 'hover:bg-slate-700 text-slate-400'}`}
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => updateFeedbackStatus(imp.id, 'rejected')}
                                className={`p-1.5 rounded ${imp.status === 'rejected' ? 'bg-red-500 text-white' : 'hover:bg-slate-700 text-slate-400'}`}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                          {imp.timestamp && (
                            <button
                              onClick={() => seekTo(imp.timestamp)}
                              className="text-xs text-amber-400 mt-2 hover:underline"
                            >
                              @ {formatTime(imp.timestamp)}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Drills */}
                {aiAnalysis?.drills?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                      <Target size={14} className="text-purple-400" /> Recommended Drills
                    </h4>
                    <div className="space-y-2">
                      {aiAnalysis.drills.map((drill, i) => (
                        <div key={i} className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                          <div className="font-medium text-purple-400 text-sm">{drill.name}</div>
                          <p className="text-xs text-slate-500 mt-0.5">{drill.purpose}</p>
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

            {/* Coach Panel */}
            {activePanel === 'coach' && (
              <div className="space-y-6">
                {/* Coach Notes */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Overall Notes</h4>
                  <textarea
                    value={coachNotes}
                    onChange={e => setCoachNotes(e.target.value)}
                    placeholder="Add your overall observations, goals, or notes for this swimmer..."
                    className="w-full h-32 bg-slate-700 border border-slate-600 rounded-xl p-3 text-sm text-white placeholder-slate-500 resize-none focus:border-blue-500 focus:ring-0"
                  />
                </div>

                {/* Timestamped Feedback */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Timestamped Feedback</h4>
                  
                  {/* Add New Feedback */}
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      value={newFeedbackText}
                      onChange={e => setNewFeedbackText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addCoachFeedback()}
                      placeholder={`Add note at ${formatTimeShort(currentTime)}...`}
                      className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500"
                    />
                    <button
                      onClick={addCoachFeedback}
                      disabled={!newFeedbackText.trim()}
                      className="px-3 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50 hover:bg-blue-600"
                    >
                      <Plus size={18} />
                    </button>
                  </div>

                  {/* Feedback List */}
                  <div className="space-y-2">
                    {coachFeedback.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-4">
                        No feedback added yet. Pause the video and add timestamped notes.
                      </p>
                    ) : (
                      coachFeedback
                        .sort((a, b) => a.timestamp - b.timestamp)
                        .map(feedback => (
                          <div 
                            key={feedback.id}
                            className="bg-slate-700/50 rounded-lg p-3 border border-slate-600 group"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <button
                                  onClick={() => seekTo(feedback.timestamp)}
                                  className="text-xs font-mono text-blue-400 hover:underline mb-1"
                                >
                                  {formatTimeShort(feedback.timestamp)}
                                </button>
                                <p className="text-sm text-white">{feedback.text}</p>
                              </div>
                              <button
                                onClick={() => removeCoachFeedback(feedback.id)}
                                className="p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Annotations Panel */}
            {activePanel === 'annotations' && (
              <div className="space-y-4">
                {/* Instructions */}
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-purple-400 uppercase mb-2 flex items-center gap-2">
                    <PenTool size={14} /> Drawing Lines
                  </h4>
                  <p className="text-sm text-slate-400">
                    Enable drawing mode above, then click and drag on the video to draw straight lines. 
                    Each line is saved at the current timestamp and will appear when the video plays that moment.
                  </p>
                </div>

                {/* Annotation List */}
                {annotations.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">
                    No annotations yet. Enable drawing mode and draw on the video.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {annotations
                      .sort((a, b) => a.timestamp - b.timestamp)
                      .map(ann => (
                        <div 
                          key={ann.id}
                          onClick={() => {
                            seekTo(ann.timestamp);
                            setSelectedAnnotation(ann.id);
                          }}
                          className={`bg-slate-700/50 rounded-lg p-3 border cursor-pointer transition-all ${
                            selectedAnnotation === ann.id 
                              ? 'border-purple-500 bg-purple-500/10' 
                              : 'border-slate-600 hover:border-slate-500'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: ann.color }}
                              />
                              <span className="text-xs font-mono text-slate-400">
                                {formatTimeShort(ann.timestamp)}
                              </span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteAnnotation(ann.id);
                              }}
                              className="p-1 text-slate-500 hover:text-red-400"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          {ann.label && (
                            <p className="text-sm text-white mt-1">{ann.label}</p>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Annotation Label Modal */}
      {showAnnotationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <PenTool size={20} className="text-purple-400" />
              Add Line Label
            </h3>
            
            <div className="mb-4">
              <p className="text-sm text-slate-400 mb-3">
                Annotation at <span className="text-blue-400 font-mono">{formatTime(pendingLine?.timestamp || 0)}</span>
              </p>
              <input
                type="text"
                value={annotationLabel}
                onChange={e => setAnnotationLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveAnnotation(true)}
                placeholder="e.g., 'Elbow drop', 'Head position'..."
                autoFocus
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-0"
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={cancelAnnotation}
                className="flex-1 py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => saveAnnotation(false)}
                className="flex-1 py-2 px-4 bg-slate-600 hover:bg-slate-500 text-white rounded-xl font-medium"
              >
                No Label
              </button>
              <button
                onClick={() => saveAnnotation(true)}
                className="flex-1 py-2 px-4 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-medium"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

