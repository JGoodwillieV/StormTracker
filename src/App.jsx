// src/App.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from './supabase'
import Login from './Login'
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

  // 2. Fetch Roster from Supabase
  useEffect(() => {
    if (session) {
      fetchRoster()
    }
  }, [session])

  const fetchRoster = async () => {
    const { data, error } = await supabase
      .from('swimmers')
      .select('*')
      .eq('coach_id', session.user.id)
    
    if (error) console.error('Error fetching roster:', error)
    else setSwimmers(data || [])
  }

  // 3. Navigation Handlers
  const navigateTo = (v) => {
    setView(v)
    if(v !== 'roster') setSelectedSwimmer(null)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setSwimmers([])
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
           />
        )}
        {view === 'analysis' && <div className="p-8">Analysis Page (Coming Soon)</div>}
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
          <div className="w-9 h-9 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm shadow-sm">
            HC
          </div>
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

        <div 
          onClick={() => navigateTo('analysis')} 
          className="bg-blue-600 p-6 rounded-2xl shadow-lg shadow-blue-200 text-white relative overflow-hidden cursor-pointer hover:bg-blue-700 transition-colors group"
        >
          <div>
            <h3 className="text-lg font-bold">New Analysis</h3>
            <p className="text-blue-100 text-sm mt-1">Upload stroke video</p>
          </div>
        </div>
      </div>
      
      <div className="mt-8">
         <h3 className="font-bold text-slate-800 text-lg mb-4">Attention Required</h3>
         <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-center gap-4">
            <div className="w-10 h-10 bg-white text-red-500 rounded-full flex items-center justify-center font-bold">M</div>
            <div>
               <h4 className="font-bold text-slate-800">Mia Kobayashi</h4>
               <p className="text-xs text-red-500 font-medium">Efficiency dropped -4%</p>
            </div>
         </div>
      </div>
    </div>
  );
};

const Roster = ({ swimmers, setSwimmers, setViewSwimmer, navigateTo, supabase }) => {
    const [showImport, setShowImport] = useState(false);
    const [importType, setImportType] = useState('roster'); // 'roster' or 'results'
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef(null);

    // --- 1. Helper: Calculate Age ---
    const calculateAge = (dobStr) => {
        if (!dobStr || dobStr.length !== 8) return null;
        const month = parseInt(dobStr.substring(0, 2)) - 1;
        const day = parseInt(dobStr.substring(2, 4));
        const year = parseInt(dobStr.substring(4, 8));
        
        const birthDate = new Date(year, month, day);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    // --- 2. Helper: CSV Parser (Handles quoted commas) ---
    const parseCSVWithQuotes = (text) => {
        const rows = [];
        let currentRow = [];
        let currentCell = '';
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    currentCell += '"'; 
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                currentRow.push(currentCell.trim());
                currentCell = '';
            } else if ((char === '\r' || char === '\n') && !inQuotes) {
                if (currentCell || currentRow.length > 0) {
                    currentRow.push(currentCell.trim());
                    rows.push(currentRow);
                    currentRow = [];
                    currentCell = '';
                }
                if (char === '\r' && nextChar === '\n') i++; 
            } else {
                currentCell += char;
            }
        }
        if (currentCell || currentRow.length > 0) {
            currentRow.push(currentCell.trim());
            rows.push(currentRow);
        }
        return rows;
    };

    // --- 3. Helper: Process Results CSV and Upload to Supabase ---
    const handleResultsImport = async (text) => {
        const rows = parseCSVWithQuotes(text);
        const entriesToInsert = [];

        // Create a smart lookup map
        const swimmerMap = {}; 
        swimmers.forEach(s => {
            // 1. Store "First Middle Last" (Standard)
            swimmerMap[s.name.toLowerCase().trim()] = s.id;
        });

        // Skip header row (i=1)
        for(let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if(row.length < 5) continue; 

            // CSV Columns based on your file:
            // Col 1: Name (Last, First M\nID)
            // Col 2: Event Name
            // Col 5: Prelim Time (if exists)
            // Col 6: Finals Time (if exists)
            // Col 10: Date
            const nameCell = row[1]; 
            const eventCell = row[2]; 
            const prelimTime = row[4];
            const finalsTime = row[5]; 
            const dateStr = row[10];  

            if (!nameCell) continue;

            // --- NAME MATCHING LOGIC ---
            let targetId = null;
            
            // 1. Clean Name Cell (Remove ID after newline if present)
            let rawName = nameCell.split('\n')[0].replace(/['"]/g, '').trim(); // "Anderson, Marielle A"

            // 2. Convert "Last, First" -> "First Last"
            let formattedName = rawName;
            if (rawName.includes(',')) {
                const parts = rawName.split(',');
                if (parts.length >= 2) {
                    // "Anderson" , " Marielle A" -> "Marielle A Anderson"
                    formattedName = `${parts[1].trim()} ${parts[0].trim()}`;
                }
            }

            // 3. Try Match
            if (swimmerMap[formattedName.toLowerCase()]) {
                targetId = swimmerMap[formattedName.toLowerCase()];
            }

            // --- TIME VALIDATION LOGIC ---
            // Check if we have a valid time in Prelims OR Finals
            const isValidTime = (t) => t && t !== "0.00" && t.trim() !== "" && !t.includes("NaN");
            
            // Prefer Finals time, fallback to Prelim time
            let bestTime = null;
            let type = 'Finals';

            if (isValidTime(finalsTime)) {
                bestTime = finalsTime;
            } else if (isValidTime(prelimTime)) {
                bestTime = prelimTime;
                type = 'Prelim';
            }

            if (targetId && bestTime) {
                // Clean Event Name (remove newlines)
                let cleanEvent = eventCell.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

                // Clean Date (MM/DD/YY -> YYYY-MM-DD)
                let cleanDate = new Date().toISOString().split('T')[0];
                if (dateStr) {
                    const dParts = dateStr.split('/'); // 11/15/25
                    if (dParts.length === 3) {
                        // Assume 20xx for year
                        cleanDate = `20${dParts[2]}-${dParts[0].padStart(2, '0')}-${dParts[1].padStart(2, '0')}`;
                    }
                }

                entriesToInsert.push({
                    swimmer_id: targetId,
                    event: `${cleanEvent} (${type})`,
                    time: bestTime,
                    date: cleanDate,
                    video_url: null
                });
            }
        }

        if (entriesToInsert.length > 0) {
            // Bulk Insert into Supabase
            const { error } = await supabase
                .from('results')
                .insert(entriesToInsert);

            if (error) {
                alert("Database error: " + error.message);
            } else {
                alert(`Success! Imported ${entriesToInsert.length} results.`);
                setShowImport(false);
                // Ideally trigger a refresh here or wait for the user to navigate
            }
        } else {
            alert("Found 0 matches. \n\nDebug:\nCSV Name: " + rows[1][1].split('\n')[0] + "\nExpected Roster Name: " + swimmers[0]?.name);
        }
    };

    // --- 4. Main File Handler ---
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
                    } else {
                        alert("No valid roster records found in file.");
                    }
                } else {
                    // --- RUN RESULTS IMPORT ---
                    await handleResultsImport(text);
                }
            } catch (err) {
                console.error(err);
                alert("Error importing: " + err.message);
            } finally {
                setIsImporting(false);
            }
        };
        reader.readAsText(file);
        e.target.value = null; 
    };

    // --- 5. SD3 Parser Logic (Existing) ---
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
                    
                    newEntries.push({
                        name: formattedName,
                        group_name: "Imported",
                        status: "New",
                        efficiency_score: 70,
                        age: age,
                        coach_id: user.id
                    });
                }
            }
        });
        return newEntries;
    };

    // --- 6. Helper: Manual Add Swimmer (Quick Prompt) ---
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
                     <button onClick={() => { setImportType('results'); setShowImport(true); }} className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 hover:text-blue-600 transition-colors">
                        <Icon name="trophy" size={16} /> Import Results
                    </button>
                     <button onClick={() => { setImportType('roster'); setShowImport(true); }} className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                        <Icon name="file-up" size={16} /> Import Roster
                    </button>
                    <button onClick={handleAddManual} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                        <Icon name="plus" size={16} /> Add Swimmer
                    </button>
                </div>
            </header>

            <div className="bg-white border border-slate-200 rounded-xl overflow-y-auto flex-1 min-h-0 shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-6 py-4 font-medium bg-slate-50">Name</th>
                            <th className="px-6 py-4 font-medium bg-slate-50">Group</th>
                            <th className="px-6 py-4 font-medium bg-slate-50">Status</th>
                            <th className="px-6 py-4 font-medium bg-slate-50">Efficiency Score</th>
                            <th className="px-6 py-4 font-medium text-right bg-slate-50">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {swimmers.length === 0 && (
                            <tr>
                                <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                                    No swimmers found. Add one manually or import a roster file.
                                </td>
                            </tr>
                        )}
                        {swimmers.map(s => (
                            <tr key={s.id} onClick={() => { setViewSwimmer(s); }} className="hover:bg-slate-50 cursor-pointer transition-colors group">
                                <td className="px-6 py-4 font-medium text-slate-900">{s.name}</td>
                                <td className="px-6 py-4 text-slate-500">{s.group_name || 'Unassigned'}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${s.status === 'Needs Attention' ? 'text-red-500 bg-red-50' : 'text-emerald-500 bg-emerald-50'}`}>
                                        {s.status || 'Active'}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full ${s.efficiency_score < 75 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                                                style={{ width: `${s.efficiency_score || 50}%` }}>
                                            </div>
                                        </div>
                                        <span className="font-bold text-slate-700">{s.efficiency_score || '-'}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">Edit</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Import Modal */}
            {showImport && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-800">
                                {importType === 'roster' ? 'Import Team Roster' : 'Import Meet Results'}
                            </h3>
                            <button onClick={() => setShowImport(false)} className="text-slate-400 hover:text-slate-600"><Icon name="x" size={20} /></button>
                        </div>
                        
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileSelect} 
                            className="hidden" 
                            accept={importType === 'roster' ? ".sd3,.csv" : ".csv,.xls,.xlsx"} 
                        />
                        
                        <div 
                            onClick={() => fileInputRef.current.click()}
                            className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center bg-slate-50 mb-6 group cursor-pointer transition-colors ${importType === 'results' ? 'border-yellow-300 hover:bg-yellow-50' : 'border-slate-300 hover:bg-slate-100 hover:border-blue-400'}`}
                        >
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform ${importType === 'results' ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'}`}>
                                <Icon name={importType === 'results' ? 'trophy' : 'file-up'} size={24} />
                            </div>
                            <p className="text-slate-800 font-bold text-lg mb-1">
                                {isImporting ? 'Processing...' : 'Drag & drop or click to upload'}
                            </p>
                            <p className="text-slate-500 text-sm">
                                {importType === 'roster' ? 'Supports .sd3 (Standard) or .csv' : 'Supports .csv export from Meet Manager'}
                            </p>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowImport(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const SwimmerProfile = ({ swimmer, onBack, navigateTo }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [results, setResults] = useState([]);
    const [analyses, setAnalyses] = useState([]);
    const [selectedEvent, setSelectedEvent] = useState("");
    const [uploadingResultId, setUploadingResultId] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const videoInputRef = useRef(null);

    // --- 1. Fetch Real Data on Mount ---
    useEffect(() => {
        const fetchData = async () => {
            if (!swimmer?.id) return;

            // Fetch Results (Ordered by Date Ascending for easier graph calculation)
            const { data: resultsData } = await supabase
                .from('results')
                .select('*')
                .eq('swimmer_id', swimmer.id)
                .order('date', { ascending: true }); // Oldest first for graph
            
            if (resultsData) setResults(resultsData);

            const { data: analysesData } = await supabase
                .from('analyses')
                .select('*')
                .eq('swimmer_id', swimmer.id)
                .order('created_at', { ascending: false });

            if (analysesData) setAnalyses(analysesData);
        };

        fetchData();
    }, [swimmer]);

    // --- 2. Smart Event Cleaners ---
    // Extracts "100 Free" from "Female (10 & Under) 100 Free (Finals)"
    const getBaseEventName = (eventName) => {
        if (!eventName) return "";
        // 1. Remove (Finals) or (Prelim)
        let clean = eventName.replace(/\s*\((Finals|Prelim)\)/i, '');
        // 2. Try to match standard distance/stroke patterns (e.g. 100 Free, 50 Fly)
        // This regex looks for a number followed by text
        const match = clean.match(/(\d+)\s*(?:M|Y)?\s*(Free|Back|Breast|Fly|IM|Freestyle|Backstroke|Breaststroke|Butterfly|Ind\.?\s*Medley)/i);
        if (match) {
            // Returns "100 Free" formatted nicely
            return `${match[1]} ${match[2]}`;
        }
        return clean.trim();
    };

    const uniqueEvents = useMemo(() => {
        const events = new Set(results.map(r => getBaseEventName(r.event)));
        return Array.from(events).sort();
    }, [results]);

    useEffect(() => {
        if (uniqueEvents.length > 0 && !selectedEvent) {
            setSelectedEvent(uniqueEvents[0]);
        }
    }, [uniqueEvents, selectedEvent]);

    // --- 3. Time & Chart Helpers ---
    const timeToSeconds = (timeStr) => {
        if (!timeStr) return 0;
        const cleanStr = timeStr.replace(/[A-Z]/g, '').trim();
        const parts = cleanStr.split(':');
        return parts.length === 2 
            ? parseInt(parts[0]) * 60 + parseFloat(parts[1]) 
            : parseFloat(parts[0]);
    };

    const secondsToTime = (val) => {
        if (!val) return "0.00";
        const mins = Math.floor(val / 60);
        const secs = (val % 60).toFixed(2);
        return mins > 0 ? `${mins}:${secs.padStart(5, '0')}` : secs;
    };

    const chartData = useMemo(() => {
        // Filter all results that match the selected BASE event (ignoring prelim/final status)
        return results
            .filter(r => getBaseEventName(r.event) === selectedEvent)
            .map(r => ({
                date: new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }),
                fullDate: r.date,
                timeStr: r.time,
                seconds: timeToSeconds(r.time),
                type: r.event.includes('Prelim') ? 'Prelim' : 'Finals'
            }))
            // Ensure chronological sort
            .sort((a, b) => new Date(a.fullDate) - new Date(b.fullDate));
    }, [selectedEvent, results]);

    // --- 4. Improvement Calculation ---
    const getImprovement = (currentResult, allResults) => {
        // Find previous result for SAME event
        const baseName = getBaseEventName(currentResult.event);
        const currentSeconds = timeToSeconds(currentResult.time);
        const currentDate = new Date(currentResult.date);

        // Filter for same event, but older date
        const previousResults = allResults
            .filter(r => getBaseEventName(r.event) === baseName && new Date(r.date) < currentDate)
            .sort((a, b) => new Date(b.date) - new Date(a.date)); // Newest of the old ones first

        if (previousResults.length === 0) return null; // First time swimming it

        const prevSeconds = timeToSeconds(previousResults[0].time);
        const diff = currentSeconds - prevSeconds;
        return diff;
    };

    // --- 5. Upload Handlers ---
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

            alert("Video uploaded successfully!");
            setResults(prev => prev.map(r => r.id === uploadingResultId ? { ...r, video_url: publicUrl } : r));
        } catch (err) {
            console.error(err);
            alert("Upload failed: " + err.message);
        } finally {
            setIsUploading(false);
            setUploadingResultId(null);
            e.target.value = null;
        }
    };

    // Sort results for the Table View (Newest First)
    const tableResults = [...results].sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
        <div className="p-4 md:p-8 space-y-8 overflow-y-auto h-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
                        <Icon name="chevron-left" size={24}/>
                    </button>
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900">{swimmer.name}</h2>
                        <p className="text-slate-500">{swimmer.group_name || 'Unassigned'} • {swimmer.age || 'N/A'} Years Old</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${activeTab === 'overview' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}>Overview</button>
                    <button onClick={() => setActiveTab('results')} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors flex items-center gap-2 ${activeTab === 'results' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}><Icon name="trophy" size={14} /> Meet Results</button>
                    <button onClick={() => setActiveTab('analysis')} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors flex items-center gap-2 ${activeTab === 'analysis' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}><Icon name="video" size={14} /> Video Analysis</button>
                </div>
            </div>

            {/* --- TAB 1: OVERVIEW --- */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        {/* Performance Chart */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">Performance Trend</h3>
                                    <p className="text-slate-500 text-xs">Combined Prelims & Finals</p>
                                </div>
                                <select 
                                    value={selectedEvent} 
                                    onChange={(e) => setSelectedEvent(e.target.value)} 
                                    className="bg-slate-50 border border-slate-200 py-2 px-3 rounded-lg text-sm font-medium"
                                >
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
                                            <YAxis 
                                                domain={['auto', 'auto']} 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{fill: '#94a3b8', fontSize: 12}} 
                                                tickFormatter={secondsToTime} 
                                                width={50}
                                            />
                                            <Tooltip 
                                                contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}}
                                                formatter={(value, name, props) => [secondsToTime(value), props.payload.type]}
                                            />
                                            <Line 
                                                type="monotone" 
                                                dataKey="seconds" 
                                                stroke="#3b82f6" 
                                                strokeWidth={3} 
                                                dot={{r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff'}} 
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-slate-400 text-sm bg-slate-50 rounded-lg">
                                        Select an event to see progress.
                                    </div>
                                )}
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
                            <button className="w-full py-2 bg-blue-600 text-white font-bold rounded-lg text-sm hover:bg-blue-700 transition-colors">
                                Save Note
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- TAB 2: RESULTS --- */}
            {activeTab === 'results' && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm min-h-[400px]">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800 text-lg">Meet Results</h3>
                        <button className="text-blue-600 text-sm font-medium hover:underline">Import New CSV</button>
                    </div>
                    
                    {/* Hidden Input for Uploads */}
                    <input type="file" ref={videoInputRef} onChange={handleFileChange} className="hidden" accept="video/mp4,video/quicktime" />

                    {tableResults.length > 0 ? (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Event</th>
                                    <th className="px-6 py-4 font-medium">Date</th>
                                    <th className="px-6 py-4 font-medium">Time</th>
                                    <th className="px-6 py-4 font-medium">Improvement</th>
                                    <th className="px-6 py-4 font-medium text-right">Race Video</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {tableResults.map((r, idx) => {
                                    const improvement = getImprovement(r, results);
                                    return (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-slate-900">{getBaseEventName(r.event)} <span className="text-slate-400 font-normal text-xs ml-1">{r.event.includes('Prelim') ? '(P)' : '(F)'}</span></td>
                                            <td className="px-6 py-4 text-slate-500">{new Date(r.date).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 font-mono font-bold text-blue-600">{r.time}</td>
                                            <td className="px-6 py-4">
                                                {improvement !== null ? (
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${improvement < 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                                        <Icon name={improvement < 0 ? "trending-down" : "trending-up"} size={12} />
                                                        {Math.abs(improvement).toFixed(2)}s
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 text-xs">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {r.video_url ? (
                                                    <a href={r.video_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                                                        <Icon name="play-circle" size={14} /> Watch
                                                    </a>
                                                ) : (
                                                    <button 
                                                        onClick={() => handleUploadClick(r.id)}
                                                        disabled={isUploading}
                                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
                                                    >
                                                        {isUploading && uploadingResultId === r.id ? (
                                                            <Icon name="loader-2" size={14} className="animate-spin" />
                                                        ) : (
                                                            <Icon name="upload-cloud" size={14} />
                                                        )}
                                                        Upload
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <Icon name="clipboard-list" size={32} className="opacity-50 mb-4" />
                            <p>No results found for this swimmer.</p>
                        </div>
                    )}
                </div>
            )}

            {/* --- TAB 3: ANALYSIS --- */}
            {activeTab === 'analysis' && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm min-h-[400px]">
                    <div className="p-6 border-b border-slate-100">
                        <h3 className="font-bold text-slate-800 text-lg">AI Video Analyses</h3>
                    </div>
                    {analyses.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                            {analyses.map((analysis, idx) => (
                                <div key={idx} className="group relative aspect-video bg-slate-900 rounded-xl overflow-hidden cursor-pointer shadow-md hover:shadow-xl transition-all">
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-colors">
                                        <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <Icon name="play" size={24} className="text-white fill-white ml-1" />
                                        </div>
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                                        <p className="text-white font-bold text-sm">Analysis #{analysis.id}</p>
                                        <p className="text-slate-300 text-xs">{new Date(analysis.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <Icon name="video" size={32} className="opacity-50 mb-4" />
                            <p>No AI analyses saved yet.</p>
                            <button onClick={() => navigateTo('analysis')} className="mt-2 text-blue-600 hover:underline text-sm font-medium">Go to Analysis Tool</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
