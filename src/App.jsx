// src/App.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from './supabase'
import Login from './Login'
import Standards from './Standards'
import Analysis from './Analysis'
import AnalysisResult from './AnalysisResult' 
import TrophyCase from './TrophyCase'
import VersatilityChart from './VersatilityChart'
import PhotoGallery from './PhotoGallery'
import AllPhotos from './AllPhotos' // NEW IMPORT
import Reports from './Reports'
import { FileText } from 'lucide-react' // Ensure FileText is imported

import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts'
import { 
  LayoutDashboard, Video, Users, FileVideo, Waves, Settings, Search, Plus, 
  ChevronLeft, Trophy, FileUp, X, Play, Send, Loader2, Check, TrendingDown,
  PlayCircle, ClipboardList, Key, UploadCloud, Cpu, Sparkles, Scan, PenTool, Share2, Download, TrendingUp, LogOut, Image as ImageIcon, Camera
} from 'lucide-react'

// --- Icon Helper ---
const Icon = ({ name, size = 20, className = "" }) => {
  const icons = {
    'layout-dashboard': LayoutDashboard, 'video': Video, 'users': Users, 'file-video': FileVideo,
    'waves': Waves, 'settings': Settings, 'search': Search, 'plus': Plus, 'chevron-left': ChevronLeft,
    'trophy': Trophy, 'file-up': FileUp, 'x': X, 'play': Play, 'send': Send, 'loader-2': Loader2,
    'check': Check, 'trending-down': TrendingDown, 'trending-up': TrendingUp, 'play-circle': PlayCircle, 
    'clipboard-list': ClipboardList, 'key': Key, 'upload-cloud': UploadCloud, 'cpu': Cpu, 
    'sparkles': Sparkles, 'scan': Scan, 'pen-tool': PenTool, 'share-2': Share2, 'download': Download, 'log-out': LogOut,
    'file-text': FileText,
    'image': ImageIcon, 'camera': Camera
  };
  const LucideIcon = icons[name] || Waves;
  return <LucideIcon size={size} className={className} />;
};

export default function App() {
  const [session, setSession] = useState(null)
  const [view, setView] = useState('dashboard')
  const [swimmers, setSwimmers] = useState([]) 
  const [selectedSwimmer, setSelectedSwimmer] = useState(null)
  const [currentAnalysis, setCurrentAnalysis] = useState(null) 
  const [loading, setLoading] = useState(true)
  
  // Dashboard Stats
  const [stats, setStats] = useState({ photos: 0, analyses: 0 });

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

  useEffect(() => {
    if (session) {
        fetchRoster();
        fetchStats();
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

  const fetchStats = async () => {
      // Get count of analyses
      const { count: analysisCount } = await supabase
        .from('analyses')
        .select('*', { count: 'exact', head: true });
        
      // Get count of photos
      const { count: photoCount } = await supabase
        .from('photos')
        .select('*', { count: 'exact', head: true });

      setStats({ 
          analyses: analysisCount || 0, 
          photos: photoCount || 0 
      });
  }

  const navigateTo = (v) => {
    setView(v)
    if(v !== 'roster' && v !== 'view-analysis') setSelectedSwimmer(null)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setSwimmers([])
  }

  const handleViewAnalysis = (analysis) => {
    setCurrentAnalysis(analysis);
    setView('view-analysis');
  }

  if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>
  if (!session) return <Login />

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      {view !== 'view-analysis' && (
        <Sidebar activeTab={view} setActiveTab={navigateTo} onLogout={handleLogout} />
      )}

      {view !== 'view-analysis' && (
        <MobileNav activeTab={view} setActiveTab={navigateTo} />
      )}
      
      <main className={`flex-1 h-screen overflow-hidden ${view !== 'view-analysis' ? 'md:ml-64' : ''}`}>
        
        {view === 'dashboard' && (
            <Dashboard 
                navigateTo={navigateTo} 
                swimmers={swimmers} 
                stats={stats} // Pass real stats
                onLogout={handleLogout} 
            />
        )}
        
        {view === 'all-photos' && (
            <AllPhotos onBack={() => navigateTo('dashboard')} />
        )}

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
             swimmers={swimmers}
             onBack={() => setView('roster')}
             navigateTo={navigateTo}
             onViewAnalysis={handleViewAnalysis} 
           />
        )}
        
        {view === 'analysis' && (
          <Analysis 
            swimmers={swimmers} 
            onBack={() => navigateTo('dashboard')} 
            supabase={supabase} 
          />
        )}

        {view === 'view-analysis' && currentAnalysis && (
          <AnalysisResult 
            data={currentAnalysis.json_data} 
            videoUrl={currentAnalysis.video_url}
            onBack={() => {
                if (selectedSwimmer) setView('profile'); 
                else setView('dashboard');
            }} 
          />
        )}

        {/* REPORTS PAGE */}
{view === 'reports' && (
  <Reports onBack={() => navigateTo('dashboard')} />
)}
        
      </main>
    </div>
  )
}

// --- SUB COMPONENTS ---

const MobileNav = ({ activeTab, setActiveTab }) => {
  const items = [
    { id: 'dashboard', icon: 'layout-dashboard', label: 'Home' },
    { id: 'analysis', icon: 'video', label: 'Analyze' },
    { id: 'roster', icon: 'users', label: 'Roster' },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-3 z-50 pb-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      {items.map(item => (
        <button 
          key={item.id} 
          onClick={() => setActiveTab(item.id)}
          className={`flex flex-col items-center gap-1 min-w-[60px] ${activeTab === item.id ? 'text-blue-600' : 'text-slate-400'}`}
        >
          <div className={`p-1 rounded-xl transition-colors ${activeTab === item.id ? 'bg-blue-50' : ''}`}>
            <Icon name={item.icon} size={24} />
          </div>
          <span className="text-[10px] font-bold">{item.label}</span>
        </button>
      ))}
    </div>
  );
};

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
       <button onClick={onLogout} className="text-slate-400 hover:text-white text-sm flex items-center gap-2 px-4">
         <Icon name="log-out" size={16} /> Sign Out
       </button>
    </aside>
  );
};

const Dashboard = ({ navigateTo, swimmers, stats, onLogout }) => {
  const activeCount = swimmers ? swimmers.length : 0;

  return (
    <div className="p-4 md:p-8 space-y-8 overflow-y-auto h-full pb-24 md:pb-8">
      <header className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
        <div className="flex items-center gap-4">
           <button onClick={onLogout} className="md:hidden text-slate-400 p-2">
             <Icon name="log-out" size={20} />
           </button>
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
          <h3 className="text-3xl font-bold text-slate-800">{stats?.analyses || 0}</h3>
        </div>
        
        {/* NEW PHOTOS CARD */}
        <div 
            onClick={() => navigateTo('all-photos')}
            className="bg-indigo-600 p-6 rounded-2xl shadow-lg shadow-indigo-200 text-white relative overflow-hidden cursor-pointer hover:bg-indigo-700 transition-colors group"
        >
          <div className="relative z-10">
             <div className="flex items-center justify-between mb-2">
                <p className="text-indigo-100 text-sm font-medium">Team Photos</p>
                <Icon name="camera" size={20} className="text-indigo-200"/>
             </div>
             <h3 className="text-3xl font-bold">{stats?.photos || 0}</h3>
             <p className="text-xs text-indigo-200 mt-1">View full gallery</p>
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-indigo-500 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
        </div>
      </div>
      
      <div className="mt-8">
         <h3 className="font-bold text-slate-800 text-lg mb-4">Quick Actions</h3>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div onClick={() => navigateTo('analysis')} className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center gap-4 cursor-pointer hover:bg-blue-100 transition-colors">
                <div className="w-10 h-10 bg-white text-blue-600 rounded-full flex items-center justify-center shadow-sm"><Icon name="video" size={20}/></div>
                <div className="font-bold text-blue-900">New AI Analysis</div>
            </div>
            <div onClick={() => navigateTo('roster')} className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center gap-4 cursor-pointer hover:bg-emerald-100 transition-colors">
                <div className="w-10 h-10 bg-white text-emerald-600 rounded-full flex items-center justify-center shadow-sm"><Icon name="users" size={20}/></div>
                <div className="font-bold text-emerald-900">Manage Roster</div>
            </div>
           <div onClick={() => navigateTo('reports')} className="bg-purple-50 border border-purple-100 p-4 rounded-xl flex items-center gap-4 cursor-pointer hover:bg-purple-100 transition-colors">
                <div className="w-10 h-10 bg-white text-purple-600 rounded-full flex items-center justify-center shadow-sm"><Icon name="file-text" size={20}/></div>
                <div className="font-bold text-purple-900">Team Reports</div>
          </div>
         </div>
      </div>
    </div>
  );
};

const Roster = ({ swimmers, setSwimmers, setViewSwimmer, navigateTo, supabase }) => {
    const [showImport, setShowImport] = useState(false);
    const [importType, setImportType] = useState('roster'); 
    const [isImporting, setIsImporting] = useState(false);
    const [searchQuery, setSearchQuery] = useState(""); 
    const fileInputRef = useRef(null);

    // --- FILTER & SORT ---
    const filteredSwimmers = useMemo(() => {
        const filtered = swimmers.filter(s => 
            s.name.toLowerCase().includes(searchQuery.toLowerCase())
        );

        return filtered.sort((a, b) => {
            const lastA = a.name.trim().split(' ').pop().toLowerCase();
            const lastB = b.name.trim().split(' ').pop().toLowerCase();
            
            if (lastA === lastB) {
                return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
            }
            return lastA.localeCompare(lastB);
        });
    }, [swimmers, searchQuery]);

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

    // CSV Parser
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

    // --- IMPORT HANDLER (Supports CSV & Excel Rows) ---
    const handleResultsImport = async (rows) => {
        const entriesToInsert = [];
        const swimmerMap = {}; 
        
        // Build Name Map
        swimmers.forEach(s => {
            const parts = s.name.toLowerCase().trim().split(' ');
            const first = parts[0];
            const last = parts[parts.length - 1];
            swimmerMap[`${last}, ${first}`] = s.id;
            swimmerMap[`${last},${first}`] = s.id;
        });

        // Skip header (i=1)
        for(let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if(!row || row.length < 5) continue; 

            const nameCell = row[1]; 
            const eventCell = row[2]; 
            const prelimTime = row[4];
            const finalsTime = row[5]; 
            const dateVal = row[10];  

            if (!nameCell) continue;

            let rawName = String(nameCell).split('\n')[0].replace(/['"]/g, '').trim().toLowerCase();
            let targetId = null;
            
            if (rawName.includes(',')) {
                const p = rawName.split(',');
                const last = p[0].trim();
                const firstChunk = p[1].trim().split(' ')[0]; 
                const key = `${last}, ${firstChunk}`;
                if (swimmerMap[key]) targetId = swimmerMap[key];
            }

            if (targetId) {
                let cleanEvent = String(eventCell).replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
                
                // Handle Date (Excel Object vs CSV String)
                let cleanDate = new Date().toISOString().split('T')[0];
                if (dateVal) {
                    if (dateVal instanceof Date) {
                        cleanDate = dateVal.toISOString().split('T')[0];
                    } else if (typeof dateVal === 'string' && dateVal.includes('/')) {
                        const dParts = dateVal.split('/'); 
                        if (dParts.length === 3) cleanDate = `20${dParts[2]}-${dParts[0].padStart(2, '0')}-${dParts[1].padStart(2, '0')}`;
                    }
                }

                // Check for valid time
                const isValidTime = (t) => {
                    const s = String(t);
                    return s && s !== "0.00" && s.trim() !== "" && !s.includes("NaN") && !['DQ','NS','DFS','SCR'].some(x => s.toUpperCase().includes(x));
                };
                
                if (isValidTime(prelimTime)) {
                    entriesToInsert.push({ swimmer_id: targetId, event: `${cleanEvent} (Prelim)`, time: String(prelimTime), date: cleanDate, video_url: null });
                }
                if (isValidTime(finalsTime)) {
                    entriesToInsert.push({ swimmer_id: targetId, event: `${cleanEvent} (Finals)`, time: String(finalsTime), date: cleanDate, video_url: null });
                }
            }
        }

        if (entriesToInsert.length > 0) {
            // Duplicate Check
            const uniqueSwimmerIds = [...new Set(entriesToInsert.map(e => e.swimmer_id))];
            const { data: existingData } = await supabase
                .from('results')
                .select('swimmer_id, event, time, date')
                .in('swimmer_id', uniqueSwimmerIds);

            const existingSignatures = new Set(existingData?.map(r => `${r.swimmer_id}|${r.event}|${r.time}|${r.date}`));
            
            const newEntries = entriesToInsert.filter(e => !existingSignatures.has(`${e.swimmer_id}|${e.event}|${e.time}|${e.date}`));

            if (newEntries.length > 0) {
                const { error } = await supabase.from('results').insert(newEntries);
                if (error) alert("Database error: " + error.message);
                else { 
                    alert(`Success! Imported ${newEntries.length} results. (${entriesToInsert.length - newEntries.length} skipped as duplicates)`); 
                    setShowImport(false); 
                }
            } else {
                alert("No new results found. All entries were duplicates.");
                setShowImport(false);
            }
        } else {
            alert("Found 0 valid matches.");
        }
    };

    // --- FILE SELECTION & PARSING ---
    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsImporting(true);
        
        const isExcel = file.name.match(/\.(xls|xlsx)$/i);
        const reader = new FileReader();

        reader.onload = async (event) => {
            try {
                // A. EXCEL FILE
                if (isExcel) {
                    const data = new Uint8Array(event.target.result);
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true }); // Parse dates automatically
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
                    
                    if (importType === 'results') {
                        await handleResultsImport(rows);
                    } else {
                        alert("Excel import is currently only supported for Results. Use .sd3 for Roster.");
                    }
                } 
                // B. TEXT/CSV FILE
                else {
                    const text = event.target.result;
                    if (importType === 'roster') {
                        const newSwimmersData = await parseSD3Roster(text);
                        if (newSwimmersData.length > 0) {
                            const { data, error } = await supabase.from('swimmers').insert(newSwimmersData).select();
                            if (error) throw error;
                            setSwimmers(prev => [...prev, ...data]);
                            alert(`Successfully imported ${data.length} swimmers!`);
                            setShowImport(false);
                        } else { alert("No valid roster records found."); }
                    } else { 
                        const rows = parseCSVWithQuotes(text);
                        await handleResultsImport(rows); 
                    }
                }
            } catch (err) { 
                console.error(err); 
                alert("Error importing: " + err.message); 
            } finally { 
                setIsImporting(false); 
            }
        };

        if (isExcel) reader.readAsArrayBuffer(file);
        else reader.readAsText(file);
        
        e.target.value = null; 
    };

    // SD3 Logic (Unchanged)
    const parseSD3Roster = async (text) => {
        const lines = text.split(/\r\n|\n/);
        const newEntries = [];
        const { data: { user } } = await supabase.auth.getUser();
        const d0Regex = /^D0\d[A-Z0-9]{2,6}\s+(.+?)\s+[A-Z0-9]{8,}/;
        lines.forEach((line) => {
            if (line.startsWith("D0")) {
                let cleanName = "";
                let age = null;
                let gender = 'M';
                const match = line.match(d0Regex);
                if (match && match[1]) cleanName = match[1].trim();
                else {
                    let rawSection = line.substring(5, 45);
                    cleanName = rawSection.replace(/^[A-Z0-9]{2,6}\s+/, '').trim().replace(/\s+[A-Z0-9]{5,}$/, '').trim();
                }
                if (cleanName) {
                    cleanName = cleanName.replace(/\s[A-Z0-9]{6,}$/i, '').trim();
                    age = calculateAge(line.substring(55, 63).trim());
                    const genderMatch = line.match(/\d{8}\s*\d{1,2}([MF])/);
                    if (genderMatch) gender = genderMatch[1];

                    if (cleanName.includes(',')) {
                        const parts = cleanName.split(',');
                        if (parts.length >= 2) cleanName = `${parts[1].trim()} ${parts[0].trim()}`;
                    }
                    const formattedName = cleanName.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                    newEntries.push({ name: formattedName, group_name: "Imported", status: "New", efficiency_score: 70, age: age, gender: gender, coach_id: user.id });
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
        <div className="p-4 md:p-8 h-full flex flex-col relative pb-24 md:pb-8">
             <header className="flex flex-col md:flex-row justify-between md:items-center mb-8 shrink-0 gap-4">
                <h2 className="text-2xl font-bold text-slate-800">Team Roster</h2>
                
                <div className="relative w-full md:w-64">
                    <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search roster..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                    />
                </div>

                <div className="flex gap-3 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
                     <button onClick={() => { setImportType('results'); setShowImport(true); }} className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 hover:text-blue-600 transition-colors whitespace-nowrap"><Icon name="trophy" size={16} /> Import Results</button>
                     <button onClick={() => { setImportType('roster'); setShowImport(true); }} className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors whitespace-nowrap"><Icon name="file-up" size={16} /> Import Roster</button>
                    <button onClick={handleAddManual} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"><Icon name="plus" size={16} /> Add Swimmer</button>
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
                        {filteredSwimmers.length > 0 ? filteredSwimmers.map(s => (
                            <tr key={s.id} onClick={() => { setViewSwimmer(s); }} className="hover:bg-slate-50 cursor-pointer transition-colors group">
                                <td className="px-6 py-4 font-medium text-slate-900">{s.name}</td>
                                <td className="px-6 py-4 text-slate-500">{s.group_name || 'Unassigned'}</td>
                                <td className="px-6 py-4"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${s.status === 'Needs Attention' ? 'text-red-500 bg-red-50' : 'text-emerald-500 bg-emerald-50'}`}>{s.status || 'Active'}</span></td>
                                <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${s.efficiency_score < 75 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${s.efficiency_score || 50}%` }}></div></div><span className="font-bold text-slate-700">{s.efficiency_score || '-'}</span></div></td>
                                <td className="px-6 py-4 text-right"><button className="text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">Edit</button></td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                                    No swimmers match "{searchQuery}"
                                </td>
                            </tr>
                        )}
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
const SwimmerProfile = ({ swimmer, swimmers, onBack, navigateTo, onViewAnalysis }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [results, setResults] = useState([]);
    const [analyses, setAnalyses] = useState([]);
    const [selectedEvent, setSelectedEvent] = useState("");
    const [uploadingResultId, setUploadingResultId] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const videoInputRef = useRef(null);

    // --- 1. Fetch Real Data ---
    useEffect(() => {
        const fetchData = async () => {
            if (!swimmer?.id) return;

            // Fetch Results
            const { data: resultsData } = await supabase
                .from('results')
                .select('*')
                .eq('swimmer_id', swimmer.id)
                .order('date', { ascending: true });
            
            if (resultsData) setResults(resultsData);

            // Fetch Analyses
            const { data: analysesData } = await supabase
                .from('analyses')
                .select('*')
                .eq('swimmer_id', swimmer.id)
                .order('created_at', { ascending: false });

            if (analysesData) setAnalyses(analysesData);
        };

        fetchData();
    }, [swimmer]);

    // --- 2. Helpers ---
    const getBaseEventName = (eventName) => {
        if (!eventName) return "";
        let clean = eventName.replace(/\s*\((Finals|Prelim)\)/i, '');
        const match = clean.match(/(\d+)\s*(?:M|Y)?\s*(Free|Back|Breast|Fly|IM|Freestyle|Backstroke|Breaststroke|Butterfly|Ind\.?\s*Medley)/i);
        if (match) return `${match[1]} ${match[2]}`;
        return clean.trim();
    };

    // Robust Time Parser (Handles DQs)
    const timeToSeconds = (timeStr) => {
        if (!timeStr) return null;
        if (['DQ', 'NS', 'DFS', 'SCR', 'DNF'].some(s => timeStr.toUpperCase().includes(s))) return null;
        
        const cleanStr = timeStr.replace(/[A-Z]/g, '').trim();
        if (!cleanStr) return null;

        const parts = cleanStr.split(':');
        let val = 0;
        if (parts.length === 2) {
            val = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
        } else {
            val = parseFloat(parts[0]);
        }
        return isNaN(val) ? null : val;
    };

    const secondsToTime = (val) => {
        if (!val || val === 999999) return "-";
        const mins = Math.floor(val / 60);
        const secs = (val % 60).toFixed(2);
        return mins > 0 ? `${mins}:${secs.padStart(5, '0')}` : secs;
    };

    // --- 3. Chart Data & Best Time Calculation ---
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
            
            if (seconds === null) return; // Skip DQs for graph

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

        return Object.values(bestTimePerDay)
            .sort((a, b) => new Date(a.fullDate) - new Date(b.fullDate));
    }, [selectedEvent, results]);

    // Calculate Best Time Overall
    const bestTimeOverall = useMemo(() => {
        const validTimes = chartData.map(d => d.seconds).filter(s => s !== null);
        if (validTimes.length === 0) return null;
        return Math.min(...validTimes);
    }, [chartData]);

    // --- 4. Table Data Grouping ---
    const groupedResults = useMemo(() => {
        const groups = {};

        results.forEach(r => {
            const baseName = getBaseEventName(r.event);
            const dateKey = r.date;
            const key = `${dateKey}_${baseName}`; 

            if (!groups[key]) {
                groups[key] = {
                    key,
                    date: r.date,
                    event: baseName,
                    prelim: null,
                    finals: null
                };
            }
            if (r.event.includes('Prelim')) groups[key].prelim = r;
            else groups[key].finals = r;
        });

        return Object.values(groups).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [results]);

    const getImprovement = (group, allGroups) => {
        const pTime = group.prelim ? timeToSeconds(group.prelim.time) : null;
        const fTime = group.finals ? timeToSeconds(group.finals.time) : null;
        
        const validToday = [pTime, fTime].filter(t => t !== null && t > 0);
        if (validToday.length === 0) return null;
        const bestToday = Math.min(...validToday);

        const previousGroups = allGroups.filter(g => 
            g.event === group.event && new Date(g.date) < new Date(group.date)
        );
        
        if (previousGroups.length === 0) return null;

        const lastSwim = previousGroups.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        const lastP = lastSwim.prelim ? timeToSeconds(lastSwim.prelim.time) : null;
        const lastF = lastSwim.finals ? timeToSeconds(lastSwim.finals.time) : null;
        
        const validLast = [lastP, lastF].filter(t => t !== null && t > 0);
        if (validLast.length === 0) return null;
        const bestLast = Math.min(...validLast);

        return bestToday - bestLast;
    };

    // --- 5. Upload Logic ---
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
        } catch (err) {
            console.error(err);
            alert("Upload failed: " + err.message);
        } finally {
            setIsUploading(false);
            setUploadingResultId(null);
            e.target.value = null;
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-8 overflow-y-auto h-full pb-24 md:pb-8">
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
                <div className="flex gap-3 overflow-x-auto pb-2 md:pb-0">
                    <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'overview' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}>Overview</button>
                    <button onClick={() => setActiveTab('results')} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'results' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}><Icon name="trophy" size={14} /> Meet Results</button>
                    <button onClick={() => setActiveTab('analysis')} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'analysis' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}><Icon name="video" size={14} /> Video Analysis</button>
                    <button onClick={() => setActiveTab('photos')} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'photos' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}><ImageIcon size={14} /> Photos</button>
                </div>
            </div>

            {/* --- TAB 1: OVERVIEW --- */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">Performance Trend</h3>
                                    <p className="text-slate-500 text-xs">Fastest time per meet</p>
                                </div>
                                <select 
                                    value={selectedEvent} 
                                    onChange={(e) => setSelectedEvent(e.target.value)} 
                                    className="bg-slate-50 border border-slate-200 py-2 px-3 rounded-lg text-sm font-medium max-w-[150px]"
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
                                                formatter={(value) => [secondsToTime(value), "Time"]}
                                                labelStyle={{color: '#64748b', marginBottom: '0.25rem'}}
                                            />
                                            <Line 
                                                type="monotone" 
                                                dataKey="seconds" 
                                                stroke="#3b82f6" 
                                                strokeWidth={3} 
                                                connectNulls={true} 
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
                            
                            {bestTimeOverall && (
                                <Standards 
                                    eventName={selectedEvent}
                                    bestTime={bestTimeOverall}
                                    gender={swimmer.gender || 'M'} 
                                    age={swimmer.age}
                                />
                            )}
                        </div>
                    </div>
                    
                    <div className="space-y-6">
                        
                        {/* TROPHY CASE (Badges) */}
                        <TrophyCase 
                            swimmerId={swimmer.id}
                            age={swimmer.age}
                            gender={swimmer.gender || 'M'}
                        />

                        {/* VERSATILITY CHART (Radar) */}
                        <VersatilityChart 
                            swimmerId={swimmer.id} 
                            age={swimmer.age} 
                            gender={swimmer.gender || 'M'} 
                        />

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

            {/* --- TAB 2: RESULTS --- */}
            {activeTab === 'results' && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm min-h-[400px]">
                    <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <h3 className="font-bold text-slate-800 text-lg">Meet Results</h3>
                        <button className="text-blue-600 text-sm font-medium hover:underline">Import New CSV</button>
                    </div>
                    
                    <input type="file" ref={videoInputRef} onChange={handleFileChange} className="hidden" accept="video/mp4,video/quicktime" />

                    {groupedResults.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm min-w-[600px]">
                                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4 font-medium whitespace-nowrap">Date</th>
                                        <th className="px-6 py-4 font-medium whitespace-nowrap">Event</th>
                                        <th className="px-6 py-4 font-medium whitespace-nowrap">Prelim</th>
                                        <th className="px-6 py-4 font-medium whitespace-nowrap">Finals</th>
                                        <th className="px-6 py-4 font-medium whitespace-nowrap">Improvement</th>
                                        <th className="px-6 py-4 font-medium text-right whitespace-nowrap">Video</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {groupedResults.map((group, idx) => {
                                        const improvement = getImprovement(group, groupedResults);
                                        return (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 text-slate-500 whitespace-nowrap">{new Date(group.date).toLocaleDateString()}</td>
                                                <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">{group.event}</td>
                                                
                                                <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                                                    {group.prelim ? (
                                                        <span className="font-mono">{group.prelim.time}</span>
                                                    ) : <span className="text-slate-300">-</span>}
                                                </td>

                                                <td className="px-6 py-4 font-bold text-blue-600 whitespace-nowrap">
                                                    {group.finals ? (
                                                        <span className="font-mono">{group.finals.time}</span>
                                                    ) : <span className="text-slate-300 font-normal">-</span>}
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {improvement !== null ? (
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${improvement < 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                                            <Icon name={improvement < 0 ? "trending-down" : "trending-up"} size={12} />
                                                            {Math.abs(improvement).toFixed(2)}s
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs">-</span>
                                                    )}
                                                </td>

                                                <td className="px-6 py-4 text-right whitespace-nowrap">
                                                    <div className="flex justify-end gap-2">
                                                        {group.finals && (
                                                            group.finals.video_url ? (
                                                                <a href={group.finals.video_url} target="_blank" rel="noreferrer" className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200" title="Finals Video"><Icon name="play-circle" size={16} /></a>
                                                            ) : (
                                                                <button onClick={() => handleUploadClick(group.finals.id)} className="p-2 border border-slate-200 text-slate-400 rounded-lg hover:text-blue-600 hover:border-blue-400" title="Upload Finals"><Icon name="upload-cloud" size={16} /></button>
                                                            )
                                                        )}
                                                        {group.prelim && (
                                                            group.prelim.video_url ? (
                                                                <a href={group.prelim.video_url} target="_blank" rel="noreferrer" className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200" title="Prelim Video"><Icon name="play-circle" size={16} /></a>
                                                            ) : (
                                                                <button onClick={() => handleUploadClick(group.prelim.id)} className="p-2 border border-slate-200 text-slate-400 rounded-lg hover:text-slate-600 hover:border-slate-400" title="Upload Prelim"><Icon name="upload-cloud" size={16} /></button>
                                                            )
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
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
                                <div key={idx} onClick={() => onViewAnalysis(analysis)} className="group relative aspect-video bg-slate-900 rounded-xl overflow-hidden cursor-pointer shadow-md hover:shadow-xl transition-all">
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
            
             {/* --- TAB 4: PHOTOS --- */}
            {activeTab === 'photos' && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm min-h-[400px] p-6">
                    <PhotoGallery 
                        swimmerId={swimmer.id} 
                        roster={swimmers} 
                    />
                </div>
            )}
        </div>
    );
};
