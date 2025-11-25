// src/Analysis.jsx
import React, { useState } from 'react';
import { UploadCloud } from 'lucide-react';
// IMPORT THE VIEWER FROM THE NEW FILE
import AnalysisResult from './AnalysisResult'; 

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

export default function Analysis({ swimmers, onBack, supabase }) {
  const [step, setStep] = useState('upload'); // upload, analyzing, results
  const [apiKey, setApiKey] = useState('');
  const [selectedSwimmerId, setSelectedSwimmerId] = useState('');
  const [stroke, setStroke] = useState('Freestyle');
  const [progress, setProgress] = useState(0);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [uploadFileName, setUploadFileName] = useState("");

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

      // 2. Prepare Gemini Request
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
      // Using gemini-1.5-flash as it's currently the most stable for video, 
      // but you can change to gemini-1.5-pro if needed.
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
      
      if(data.error) {
         throw new Error(data.error.message);
      }

      const text = data.candidates[0].content.parts[0].text;
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
