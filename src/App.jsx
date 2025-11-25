// src/App.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from './supabase'
import Login from './Login'
// IMPORT THE EXPORTED RESULT COMPONENT HERE
import Analysis, { AnalysisResult } from './Analysis' 
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts'
import { 
  LayoutDashboard, Video, Users, FileVideo, Waves, Settings, Search, Plus, 
  ChevronLeft, Trophy, FileUp, X, Play, Send, Loader2, Check, TrendingDown,
  PlayCircle, ClipboardList, Key, UploadCloud, Cpu, Sparkles, Scan, PenTool, Share2, Download
} from 'lucide-react'

// --- Icon Helper ---
const Icon = ({ name, size = 20, className = "" }) => {
  const icons = {
    'layout-dashboard': LayoutDashboard, 'video': Video, 'users': Users, 'file-video': FileVideo,
    'waves': Waves, 'settings': Settings, 'search': Search, 'plus': Plus, 'chevron-left': ChevronLeft,
    'trophy': Trophy, 'file-up': FileUp, 'x': X, 'play': Play, 'send': Send, 'loader-2': Loader2,
    'check': Check, 'trending-down': TrendingDown, 'play-circle': PlayCircle, 
    'clipboard-list': ClipboardList, 'key': Key, 'upload-cloud': UploadCloud, 'cpu': Cpu, 
    'sparkles': Sparkles, 'scan': Scan, 'pen-tool': PenTool, 'share-2': Share2, 'download': Download
  };
  const LucideIcon = icons[name] || Waves;
  return <LucideIcon size={size} className={className} />;
};

export default function App() {
  const [session, setSession] = useState(null)
  const [view, setView] = useState('dashboard')
  const [swimmers, setSwimmers] = useState([]) 
  const [selectedSwimmer, setSelectedSwimmer] = useState(null)
  const [currentAnalysis, setCurrentAnalysis] = useState(null) // NEW: Holds the analysis to view
  const [loading, setLoading] = useState(true)

  // 1. Check Login Status
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // 2. Fetch Roster
  useEffect(() => {
    if (session) fetchRoster()
  }, [session])

  const fetchRoster = async () => {
    const { data, error } = await supabase
      .from('swimmers')
      .select('*')
      .eq('coach_id', session.user.id)
    
    if (error) console.error('Error fetching roster:', error)
    else setSwimmers(data || [])
  }

  // 3. Handlers
  const navigateTo = (v) => {
    setView(v)
    if(v !== 'roster') setSelectedSwimmer(null)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setSwimmers([])
  }

  const handleViewAnalysis = (analysis) => {
    setCurrentAnalysis(analysis);
    setView('view-analysis');
  }

  // --- RENDER ---

  if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>
  if (!session) return <Login />

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <Sidebar activeTab={view} setActiveTab={navigateTo} onLogout={handleLogout} />
      
      <main className="flex-1 h-screen overflow-hidden md:ml-64">
        {view === 'dashboard' && <Dashboard navigateTo={navigateTo} swimmers={swimmers} />}
        
        {view === 'roster' && (
          <Roster 
            swimmers={swimmers} 
            setSwimmers={setSwimmers} 
            setViewSwimmer={(s) => { setSelectedSwimmer(s); setView('profile'); }}
            navigateTo={navigateTo}
            supabase={supabase} 
          />
        )}
        
        {view === 'profile' && selectedSwimmer && (
           <SwimmerProfile 
             swimmer={selectedSwimmer} 
             onBack={() => setView('roster')}
             navigateTo={navigateTo}
             onViewAnalysis={handleViewAnalysis} // Pass the handler down
           />
        )}
        
        {/* New Analysis Creation Page */}
        {view === 'analysis' && (
          <Analysis 
            swimmers={swimmers} 
            onBack={() => navigateTo('dashboard')} 
            supabase={supabase} 
          />
        )}

        {/* VIEW EXISTING ANALYSIS (The new screen) */}
        {view === 'view-analysis' && currentAnalysis && (
          <AnalysisResult 
            data={currentAnalysis.json_data} 
            videoUrl={currentAnalysis.video_url}
            onBack={() => {
                // If we have a swimmer selected, go back to their profile, otherwise dashboard
                if (selectedSwimmer) setView('profile'); 
                else setView('dashboard');
            }} 
          />
        )}
      </main>
    </div>
  )
}

// --- SUB COMPONENTS ---

const Sidebar = ({ activeTab, setActiveTab, onLogout }) => {
  const items = [
    { id: 'dashboard', icon: 'layout-dashboard', label: 'Dashboard' },
    { id: 'analysis', icon: 'video', label: 'AI Analysis' },
    { id: 'roster', icon: 'users', label: 'Roster' },
  ];

  return (
    <aside className="w-64 bg-[#0f172a] flex-col p-6 fixed h-full z-10 hidden md:flex">
       <div className="flex items-center gap-3 mb-10 px-2">
           <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
               <Icon name="waves" className="text-white" size={20} />
           </div>
           <h1 className="text-white font-bold text-xl">StormTracker</h1>
       </div>
       <nav className="space-y-2 flex-1">
           {items.map(item => (
               <div key={item.id} onClick={() => setActiveTab(item.id)} 
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer ${activeTab === item.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                   <Icon name={item.icon} size={20} />
                   <span className="font-medium">{item.label}</span>
               </div>
           ))}
       </nav>
       <button onClick={onLogout} className="text-slate-400 hover:text-white text-sm">Sign Out</button>
    </aside>
  );
};

const Dashboard = ({ navigateTo, swimmers }) => {
  const activeCount = swimmers ? swimmers.length : 0;

  return (
    <div className="p-4 md:p-8 space-y-8 overflow-y-auto h-full">
      <header className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm shadow-sm">HC</div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-slate-500 text-sm font-medium mb-2">Team Efficiency</p>
          <h3 className="text-3xl font-bold text-slate-800">84%</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-slate-500 text-sm font-medium mb-2">Active Swimmers</p>
          <h3 className="text-3xl font-bold text-slate-800">{activeCount}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-slate-500 text-sm font-medium mb-2">Videos Analyzed</p>
          <h3 className="text-3xl font-bold text-slate-800">142</h3>
        </div>
        <div onClick={() => navigateTo('analysis')} className="bg-blue-600 p-6 rounded-2xl shadow-lg shadow-blue-200 text-white relative overflow-hidden cursor-pointer hover:bg-blue-700 transition-colors group">
          <div><h3 className="text-lg font-bold">New Analysis</h3><p className="text-blue-100 text-sm mt-1">Upload stroke video</p></div>
        </div>
      </div>
    </div>
  );
};

const Roster = ({ swimmers, setSwimmers, setViewSwimmer, navigateTo, supabase }) => {
    const [showImport, setShowImport] = useState(false);
    const [importType, setImportType] = useState('roster'); 
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef(null);

    const calculateAge = (dobStr) => {
        if (!dobStr || dobStr.length !== 8) return null;
        const month = parseInt(dobStr.substring(0, 2)) - 1;
        const day = parseInt(dobStr.substring(2, 4));
        const year = parseInt(dobStr.substring(4, 8));
        const birthDate = new Date(year, month, day);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
        return age;
    };

    const parseCSVWithQuotes = (text) => {
        const rows = [];
        let currentRow = [];
        let currentCell = '';
        let inQuotes = false;
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i + 1];
            if (char === '"') {
                if (inQuotes && nextChar === '"') { currentCell += '"'; i++; } 
                else { inQuotes = !inQuotes; }
            } else if (char === ',' && !inQuotes) {
                currentRow.push(currentCell.trim());
                currentCell = '';
            } else if ((char === '\r' || char === '\n') && !inQuotes) {
                if (currentCell || currentRow.length > 0) { currentRow.push(currentCell.trim()); rows.push(currentRow); currentRow = []; currentCell = ''; }
                if (char === '\r' && nextChar === '\n') i++; 
            } else { currentCell += char; }
        }
        if (currentCell || currentRow.length > 0) { currentRow.push(currentCell.trim()); rows.push(currentRow); }
        return rows;
    };

    const handleResultsImport = async (text) => {
        const rows = parseCSVWithQuotes(text);
        const entriesToInsert = [];
        const swimmerMap = {}; 
        swimmers.forEach(s => { swimmerMap[s.name.toLowerCase().trim()] = s.id; });

        for(let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if(row.length < 5) continue; 
            const nameCell = row[1]; 
            const eventCell = row[2]; 
            const prelimTime = row[4];
            const finalsTime = row[5]; 
            const dateStr = row[10];  
            if (!nameCell) continue;

            let targetId = null;
            let rawName = nameCell.split('\n')[0].replace(/['"]/g, '').trim(); 
            let formattedName = rawName;
            if (rawName.includes(',')) {
                const parts = rawName.split(',');
                if (parts.length >= 2) formattedName = `${parts[1].trim()} ${parts[0].trim()}`;
            }
            if (swimmerMap[formattedName.toLowerCase()]) targetId = swimmerMap[formattedName.toLowerCase()];

            if (targetId) {
                let cleanEvent = eventCell.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
                let cleanDate = new Date().toISOString().split('T')[0];
                if (dateStr) {
                    const dParts = dateStr.split('/'); 
                    if (dParts.length === 3) cleanDate = `20${dParts[2]}-${dParts[0].padStart(2, '0')}-${dParts[1].padStart(2, '0')}`;
                }
                const isValidTime = (t) => t && t !== "0.00" && t.trim() !== "" && !t.includes("NaN");
                
                if (isValidTime(prelimTime)) {
                    entriesToInsert.push({ swimmer_id: targetId, event: `${cleanEvent} (Prelim)`, time: prelimTime, date: cleanDate, video_url: null });
                }
                if (isValidTime(finalsTime)) {
                    entriesToInsert.push({ swimmer_id: targetId, event: `${cleanEvent} (Finals)`, time: finalsTime, date: cleanDate, video_url: null });
                }
            }
        }

        if (entriesToInsert.length > 0) {
            const { error } = await supabase.from('results').insert(entriesToInsert);
            if (error) alert("Database error: " + error.message);
            else { alert(`Success! Imported ${entriesToInsert.length} results.`); setShowImport(false); }
        } else {
            alert("Found 0 matches.");
        }
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target.result;
            try {
                if (importType === 'roster') {
                    const newSwimmersData = await parseSD3Roster(text);
                    if (newSwimmersData.length > 0) {
                        const { data, error } = await supabase.from('swimmers').insert(newSwimmersData).select();
                        if (error) throw error;
                        setSwimmers(prev => [...prev, ...data]);
                        alert(`Successfully imported ${data.length} swimmers!`);
                        setShowImport(false);
                    } else { alert("No valid roster records found."); }
                } else { await handleResultsImport(text); }
            } catch (err) { console.error(err); alert("Error importing: " + err.message); } 
            finally { setIsImporting(false); }
        };
        reader.readAsText(file);
        e.target.value = null; 
    };

    const parseSD3Roster = async (text) => {
        const lines = text.split(/\r\n|\n/);
        const newEntries = [];
        const { data: { user } } = await supabase.auth.getUser();
        const d0Regex = /^D0\d[A-Z0-9]{2,6}\s+(.+?)\s+[A-Z0-9]{8,}/;
        lines.forEach((line) => {
            if (line.startsWith("D0")) {
                let cleanName = "";
                let age = null;
                const match = line.match(d0Regex);
                if (match && match[1]) cleanName = match[1].trim();
                else {
                    let rawSection = line.substring(5, 45);
                    cleanName = rawSection.replace(/^[A-Z0-9]{2,6}\s+/, '').trim().replace(/\s+[A-Z0-9]{5,}$/, '').trim();
                }
                if (cleanName) {
                    cleanName = cleanName.replace(/\s[A-Z0-9]{6,}$/i, '').trim();
                    age = calculateAge(line.substring(55, 63).trim());
                    if (cleanName.includes(',')) {
                        const parts = cleanName.split(',');
                        if (parts.length >= 2) cleanName = `${parts[1].trim()} ${parts[0].trim()}`;
                    }
                    const formattedName = cleanName.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                    newEntries.push({ name: formattedName, group_name: "Imported", status: "New", efficiency_score: 70, age: age, coach_id: user.id });
                }
            }
        });
        return newEntries;
    };

    const handleAddManual = async () => {
        const name = window.prompt("Enter Swimmer Name:");
        if (!name) return;
        const { data: { user } } = await supabase.auth.getUser();
        const newSwimmer = { name, group_name: "Unassigned", status: "New", efficiency_score: 50, coach_id: user.id };
        const { data, error } = await supabase.from('swimmers').insert([newSwimmer]).select();
        if (!error) setSwimmers(prev => [...prev, ...data]);
    };

    return (
        <div className="p-4 md:p-8 h-full flex flex-col relative">
             <header className="flex justify-between items-center mb-8 shrink-0">
                <h2 className="text-2xl font-bold text-slate-800">Team Roster</h2>
                <div className="flex gap-3">
                     <button onClick={() => { setImportType('results'); setShowImport(true); }} className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 hover:text-blue-600 transition-colors"><Icon name="trophy" size={16} /> Import Results</button>
                     <button onClick={() => { setImportType('roster'); setShowImport(true); }} className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"><Icon name="file-up" size={16} /> Import Roster</button>
                    <button onClick={handleAddManual} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"><Icon name="plus" size={16} /> Add Swimmer</button>
                </div>
            </header>
            <div className="bg-white border border-slate-200 rounded-xl overflow-y-auto flex-1 min-h-0 shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                        <tr><th className="px-6 py-4 font-medium bg-slate-50">Name</th><th className="px-6 py-4 font-medium bg-slate-50">Group</th><th className="px-6 py-4 font-medium bg-slate-50">Status</th><th className="px-6 py-4 font-medium bg-slate-50">Efficiency Score</th><th className="px-6 py-4 font-medium text-right bg-slate-50">Action</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {swimmers.map(s => (
                            <tr key={s.id} onClick={() => { setViewSwimmer(s); }} className="hover:bg-slate-50 cursor-pointer transition-colors group">
                                <td className="px-6 py-4 font-medium text-slate-900">{s.name}</td>
                                <td className="px-6 py-4 text-slate-500">{s.group_name || 'Unassigned'}</td>
                                <td className="px-6 py-4"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${s.status === 'Needs Attention' ? 'text-red-500 bg-red-50' : 'text-emerald-500 bg-emerald-50'}`}>{s.status || 'Active'}</span></td>
                                <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${s.efficiency_score < 75 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${s.efficiency_score || 50}%` }}></div></div><span className="font-bold text-slate-700">{s.efficiency_score || '-'}</span></div></td>
                                <td className="px-6 py-4 text-right"><button className="text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">Edit</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {showImport && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6"><h3 className="text-lg font-bold text-slate-800">{importType === 'roster' ? 'Import Team Roster' : 'Import Meet Results'}</h3><button onClick={() => setShowImport(false)} className="text-slate-400 hover:text-slate-600"><Icon name="x" size={20} /></button></div>
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept={importType === 'roster' ? ".sd3,.csv" : ".csv,.xls,.xlsx"} />
                        <div onClick={() => fileInputRef.current.click()} className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center bg-slate-50 mb-6 group cursor-pointer transition-colors ${importType === 'results' ? 'border-yellow-300 hover:bg-yellow-50' : 'border-slate-300 hover:bg-slate-100 hover:border-blue-400'}`}>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform ${importType === 'results' ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'}`}><Icon name={importType === 'results' ? 'trophy' : 'file-up'} size={24} /></div>
                            <p className="text-slate-800 font-bold text-lg mb-1">{isImporting ? 'Processing...' : 'Drag & drop or click to upload'}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const SwimmerProfile = ({ swimmer, onBack, navigateTo, onViewAnalysis }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [results, setResults] = useState([]);
    const [analyses, setAnalyses] = useState([]);
    const [selectedEvent, setSelectedEvent] = useState("");
    const [uploadingResultId, setUploadingResultId] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const videoInputRef = useRef(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!swimmer?.id) return;
            const { data: resultsData } = await supabase.from('results').select('*').eq('swimmer_id', swimmer.id).order('date', { ascending: true });
            if (resultsData) setResults(resultsData);
            const { data: analysesData } = await supabase.from('analyses').select('*').eq('swimmer_id', swimmer.id).order('created_at', { ascending: false });
            if (analysesData) setAnalyses(analysesData);
        };
        fetchData();
    }, [swimmer]);

    const getBaseEventName = (eventName) => {
        if (!eventName) return "";
        let clean = eventName.replace(/\s*\((Finals|Prelim)\)/i, '');
        const match = clean.match(/(\d+)\s*(?:M|Y)?\s*(Free|Back|Breast|Fly|IM|Freestyle|Backstroke|Breaststroke|Butterfly|Ind\.?\s*Medley)/i);
        if (match) return `${match[1]} ${match[2]}`;
        return clean.trim();
    };

    const timeToSeconds = (timeStr) => {
        if (!timeStr) return 999999; 
        const cleanStr = timeStr.replace(/[A-Z]/g, '').trim();
        const parts = cleanStr.split(':');
        return parts.length === 2 ? parseInt(parts[0]) * 60 + parseFloat(parts[1]) : parseFloat(parts[0]);
    };

    const secondsToTime = (val) => {
        if (!val || val === 999999) return "-";
        const mins = Math.floor(val / 60);
        const secs = (val % 60).toFixed(2);
        return mins > 0 ? `${mins}:${secs.padStart(5, '0')}` : secs;
    };

    const uniqueEvents = useMemo(() => {
        const events = new Set(results.map(r => getBaseEventName(r.event)));
        return Array.from(events).sort();
    }, [results]);

    useEffect(() => {
        if (uniqueEvents.length > 0 && !selectedEvent) setSelectedEvent(uniqueEvents[0]);
    }, [uniqueEvents, selectedEvent]);

    const chartData = useMemo(() => {
        const eventResults = results.filter(r => getBaseEventName(r.event) === selectedEvent);
        const bestTimePerDay = {};
        eventResults.forEach(r => {
            const dateKey = r.date; 
            const seconds = timeToSeconds(r.time);
            if (!bestTimePerDay[dateKey] || seconds < bestTimePerDay[dateKey].seconds) {
                bestTimePerDay[dateKey] = {
                    date: new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }),
                    fullDate: r.date,
                    seconds: seconds,
                    timeStr: r.time,
                    type: r.event.includes('Prelim') ? 'Prelim' : 'Finals'
                };
            }
        });
        return Object.values(bestTimePerDay).sort((a, b) => new Date(a.fullDate) - new Date(b.fullDate));
    }, [selectedEvent, results]);

    const groupedResults = useMemo(() => {
        const groups = {};
        results.forEach(r => {
            const baseName = getBaseEventName(r.event);
            const dateKey = r.date;
            const key = `${dateKey}_${baseName}`;
            if (!groups[key]) groups[key] = { key, date: r.date, event: baseName, prelim: null, finals: null };
            if (r.event.includes('Prelim')) groups[key].prelim = r;
            else groups[key].finals = r;
        });
        return Object.values(groups).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [results]);

    const getImprovement = (group, allGroups) => {
        const pTime = group.prelim ? timeToSeconds(group.prelim.time) : 999999;
        const fTime = group.finals ? timeToSeconds(group.finals.time) : 999999;
        const bestToday = Math.min(pTime, fTime);
        if (bestToday === 999999) return null;
        const previousGroups = allGroups.filter(g => g.event === group.event && new Date(g.date) < new Date(group.date));
        if (previousGroups.length === 0) return null;
        const lastSwim = previousGroups.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        const lastP = lastSwim.prelim ? timeToSeconds(lastSwim.prelim.time) : 999999;
        const lastF = lastSwim.finals ? timeToSeconds(lastSwim.finals.time) : 999999;
        const bestLast = Math.min(lastP, lastF);
        return bestToday - bestLast;
    };

    const handleUploadClick = (resultId) => {
        setUploadingResultId(resultId);
        videoInputRef.current.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file || !uploadingResultId) return;
        setIsUploading(true);
        try {
            const fileName = `${swimmer.id}/${Date.now()}_${file.name}`;
            const { error: uploadError } = await supabase.storage.from('race-videos').upload(fileName, file);
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage.from('race-videos').getPublicUrl(fileName);
            const { error: dbError } = await supabase.from('results').update({ video_url: publicUrl }).eq('id', uploadingResultId);
            if (dbError) throw dbError;
            alert("Video uploaded!");
            setResults(prev => prev.map(r => r.id === uploadingResultId ? { ...r, video_url: publicUrl } : r));
        } catch (err) { console.error(err); alert("Upload failed: " + err.message); } 
        finally { setIsUploading(false); setUploadingResultId(null); e.target.value = null; }
    };

    return (
        <div className="p-4 md:p-8 space-y-8 overflow-y-auto h-full">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><Icon name="chevron-left" size={24}/></button>
                    <div><h2 className="text-3xl font-bold text-slate-900">{swimmer.name}</h2><p className="text-slate-500">{swimmer.group_name || 'Unassigned'} • {swimmer.age || 'N/A'} Years Old</p></div>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${activeTab === 'overview' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}>Overview</button>
                    <button onClick={() => setActiveTab('results')} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors flex items-center gap-2 ${activeTab === 'results' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}><Icon name="trophy" size={14} /> Meet Results</button>
                    <button onClick={() => setActiveTab('analysis')} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors flex items-center gap-2 ${activeTab === 'analysis' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}><Icon name="video" size={14} /> Video Analysis</button>
                </div>
            </div>

            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <div><h3 className="text-lg font-bold text-slate-800">Performance Trend</h3><p className="text-slate-500 text-xs">Fastest time per meet</p></div>
                                <select value={selectedEvent} onChange={(e) => setSelectedEvent(e.target.value)} className="bg-slate-50 border border-slate-200 py-2 px-3 rounded-lg text-sm font-medium">
                                    {uniqueEvents.length === 0 && <option>No Data</option>}
                                    {uniqueEvents.map(ev => <option key={ev} value={ev}>{ev}</option>)}
                                </select>
                            </div>
                            <div className="h-64 w-full">
                                {chartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                                            <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} tickFormatter={secondsToTime} width={50} />
                                            <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} formatter={(value) => [secondsToTime(value), "Time"]} labelStyle={{color: '#64748b', marginBottom: '0.25rem'}} />
                                            <Line type="monotone" dataKey="seconds" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff'}} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : <div className="h-full flex items-center justify-center text-slate-400 text-sm bg-slate-50 rounded-lg">Select an event to see progress.</div>}
                            </div>
                        </div>
                    </div>
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                            <h3 className="font-bold text-slate-800 mb-4">Coach's Notes</h3>
                            <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 mb-4">
                                <p className="text-xs font-bold text-yellow-700 mb-2">Focus for this week:</p>
                                <textarea className="w-full bg-transparent border-0 focus:ring-0 p-0 text-sm text-yellow-800 leading-relaxed resize-none focus:outline-none" placeholder="Add a note..." rows={4} />
                            </div>
                            <button className="w-full py-2 bg-blue-600 text-white font-bold rounded-lg text-sm hover:bg-blue-700 transition-colors">Save Note</button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'results' && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm min-h-[400px]">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center"><h3 className="font-bold text-slate-800 text-lg">Meet Results</h3><button className="text-blue-600 text-sm font-medium hover:underline">Import New CSV</button></div>
                    <input type="file" ref={videoInputRef} onChange={handleFileChange} className="hidden" accept="video/mp4,video/quicktime" />
                    {groupedResults.length > 0 ? (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                <tr><th className="px-6 py-4 font-medium">Date</th><th className="px-6 py-4 font-medium">Event</th><th className="px-6 py-4 font-medium">Prelim</th><th className="px-6 py-4 font-medium">Finals</th><th className="px-6 py-4 font-medium">Improvement</th><th className="px-6 py-4 font-medium text-right">Video</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {groupedResults.map((group, idx) => {
                                    const improvement = getImprovement(group, groupedResults);
                                    return (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 text-slate-500">{new Date(group.date).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 font-medium text-slate-900">{group.event}</td>
                                            <td className="px-6 py-4 text-slate-600">{group.prelim ? <div className="flex flex-col"><span className="font-mono">{group.prelim.time}</span></div> : <span className="text-slate-300">-</span>}</td>
                                            <td className="px-6 py-4 font-bold text-blue-600">{group.finals ? <span className="font-mono">{group.finals.time}</span> : <span className="text-slate-300 font-normal">-</span>}</td>
                                            <td className="px-6 py-4">{improvement !== null ? <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${improvement < 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}><Icon name={improvement < 0 ? "trending-down" : "trending-up"} size={12} />{Math.abs(improvement).toFixed(2)}s</span> : <span className="text-slate-400 text-xs">-</span>}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    {group.finals && (group.finals.video_url ? <a href={group.finals.video_url} target="_blank" rel="noreferrer" className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200" title="Finals Video"><Icon name="play-circle" size={16} /></a> : <button onClick={() => handleUploadClick(group.finals.id)} className="p-2 border border-slate-200 text-slate-400 rounded-lg hover:text-blue-600 hover:border-blue-400" title="Upload Finals"><Icon name="upload-cloud" size={16} /></button>)}
                                                    {group.prelim && (group.prelim.video_url ? <a href={group.prelim.video_url} target="_blank" rel="noreferrer" className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200" title="Prelim Video"><Icon name="play-circle" size={16} /></a> : <button onClick={() => handleUploadClick(group.prelim.id)} className="p-2 border border-slate-200 text-slate-400 rounded-lg hover:text-slate-600 hover:border-slate-400" title="Upload Prelim"><Icon name="upload-cloud" size={16} /></button>)}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : <div className="flex flex-col items-center justify-center h-64 text-slate-400"><Icon name="clipboard-list" size={32} className="opacity-50 mb-4" /><p>No results found for this swimmer.</p></div>}
                </div>
            )}

            {activeTab === 'analysis' && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm min-h-[400px]">
                    <div className="p-6 border-b border-slate-100"><h3 className="font-bold text-slate-800 text-lg">AI Video Analyses</h3></div>
                    {analyses.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                            {analyses.map((analysis, idx) => (
                                <div key={idx} onClick={() => onViewAnalysis(analysis)} className="group relative aspect-video bg-slate-900 rounded-xl overflow-hidden cursor-pointer shadow-md hover:shadow-xl transition-all">
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-colors"><div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"><Icon name="play" size={24} className="text-white fill-white ml-1" /></div></div>
                                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent"><p className="text-white font-bold text-sm">Analysis #{analysis.id}</p><p className="text-slate-300 text-xs">{new Date(analysis.created_at).toLocaleDateString()}</p></div>
                                </div>
                            ))}
                        </div>
                    ) : <div className="flex flex-col items-center justify-center h-64 text-slate-400"><Icon name="video" size={32} className="opacity-50 mb-4" /><p>No AI analyses saved yet.</p><button onClick={() => navigateTo('analysis')} className="mt-2 text-blue-600 hover:underline text-sm font-medium">Go to Analysis Tool</button></div>}
                </div>
            )}
        </div>
    );
};"
