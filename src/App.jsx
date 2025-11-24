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
// Using Lucide-React directly now, so we don't need the old Icon helper!
// Anywhere your old code used <Icon name="x" />, change it to the actual component <X /> 
// OR use this wrapper to keep your old code working:
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
  const [swimmers, setSwimmers] = useState([]) // Empty initially, fetched from DB
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
    // This assumes you ran the SQL I gave you to create the 'swimmers' table
    const { data, error } = await supabase
      .from('swimmers')
      .select('*')
      .eq('coach_id', session.user.id) // Only show THIS coach's swimmers
    
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
            supabase={supabase} // Pass supabase down for uploads
          />
        )}
        {view === 'profile' && selectedSwimmer && (
           <SwimmerProfile 
             swimmer={selectedSwimmer} 
             onBack={() => setView('roster')}
             navigateTo={navigateTo}
           />
        )}
        {view === 'analysis' && <div className="p-8">Analysis Page (Needs your Component)</div>}
      </main>
    </div>
  )
}

// --- SUB COMPONENTS (You need to paste your UI logic back in here) ---

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
  // Simple example using real data count
  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
           <p className="text-slate-500 text-sm">Active Swimmers</p>
           <h3 className="text-3xl font-bold">{swimmers.length}</h3>
        </div>
      </div>
      const Dashboard = ({ navigateTo, swimmers }) => {
  // We use the real length of the database results for the count
  const activeCount = swimmers ? swimmers.length : 0;

  return (
    <div className="p-4 md:p-8 space-y-8 overflow-y-auto h-full">
      {/* Header */}
      <header className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search swimmers..." 
              className="bg-white border border-slate-200 pl-10 pr-4 py-2 rounded-full text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/20" 
            />
          </div>
          <div className="w-9 h-9 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm shadow-sm">
            HC
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Metric 1 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-slate-500 text-sm font-medium mb-2">Team Efficiency</p>
          <h3 className="text-3xl font-bold text-slate-800">84%</h3>
          <p className="text-xs font-semibold mt-2 text-emerald-500 flex items-center gap-1">
             <Icon name="trending-down" size={12} className="rotate-180" /> +2.4%
          </p>
        </div>

        {/* Metric 2: Connected to Real Data */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-slate-500 text-sm font-medium mb-2">Active Swimmers</p>
          <h3 className="text-3xl font-bold text-slate-800">{activeCount}</h3>
          <p className="text-xs font-semibold mt-2 text-slate-400">Total Roster</p>
        </div>

        {/* Metric 3 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-slate-500 text-sm font-medium mb-2">Videos Analyzed</p>
          <h3 className="text-3xl font-bold text-slate-800">142</h3>
          <p className="text-xs font-semibold mt-2 text-slate-400">This month</p>
        </div>

        {/* Call to Action */}
        <div 
          onClick={() => navigateTo('analysis')} 
          className="bg-blue-600 p-6 rounded-2xl shadow-lg shadow-blue-200 text-white relative overflow-hidden cursor-pointer hover:bg-blue-700 transition-colors group"
        >
          <div className="relative z-10">
            <h3 className="text-lg font-bold">New Analysis</h3>
            <p className="text-blue-100 text-sm mt-1">Upload stroke video</p>
          </div>
          <div className="absolute bottom-4 right-4 bg-white/20 p-2 rounded-lg group-hover:bg-white/30 transition-colors z-10">
            <Icon name="plus" size={24} className="text-white" />
          </div>
          {/* Decorative Circle */}
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-blue-500 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
        </div>
      </div>

      {/* Content Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-8">
        {/* Left Column: Alerts */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-slate-800 text-lg">Attention Required</h3>
            <button className="text-blue-600 text-sm font-medium hover:underline">View All</button>
          </div>
          
          {/* Mock Alerts List */}
          {[
            { name: "Mia Kobayashi", msg: "Efficiency dropped -4%", ctx: "Butterfly", type: "bad", initial: "M" },
            { name: "Sarah Miller", msg: "Efficiency dropped -4%", ctx: "Freestyle", type: "bad", initial: "S" },
            { name: "Leo Davidson", msg: "Personal Best Efficiency", ctx: "Freestyle", type: "good", initial: "L" },
          ].map((alert, i) => (
            <div key={i} className={`p-4 rounded-xl flex items-center justify-between border transition-all hover:scale-[1.01] ${alert.type === 'bad' ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-sm ${alert.type === 'bad' ? 'bg-white text-red-500' : 'bg-white text-emerald-600'}`}>
                  {alert.initial}
                </div>
                <div>
                  <h4 className="font-bold text-slate-800">{alert.name}</h4>
                  <p className={`text-xs font-medium flex items-center gap-1 ${alert.type === 'bad' ? 'text-red-500' : 'text-emerald-600'}`}>
                    {alert.msg} <span className="text-slate-400 font-normal">in {alert.ctx}</span>
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => navigateTo('roster')} className="bg-white px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors">View Profile</button>
                {alert.type === 'bad' && (
                  <button onClick={() => navigateTo('analysis')} className="bg-white px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors">Analyze</button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Right Column: Top Performers */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm h-fit">
          <h3 className="font-bold text-slate-800 text-lg mb-6">Top Performers</h3>
          {[
            { r: 1, l: "A", s: 85, color: "bg-amber-100 text-amber-700" },
            { r: 2, l: "B", s: 80, color: "bg-slate-100 text-slate-600" },
            { r: 3, l: "C", s: 75, color: "bg-orange-100 text-orange-700" },
          ].map((p) => (
            <div key={p.r} className="flex items-center gap-4 mb-4 last:mb-0">
              <span className="text-slate-300 font-bold text-sm w-4">0{p.r}</span>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${p.color}`}>
                {p.l}
              </div>
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${p.s}%` }}></div>
              </div>
              <span className="text-slate-600 font-bold text-sm">{p.s}</span>
            </div>
          ))}
          <button onClick={() => navigateTo('roster')} className="w-full mt-6 py-2 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            View Full Leaderboard
          </button>
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

    // --- 2. Helper: Manual Add Swimmer (Quick Prompt) ---
    const handleAddManual = async () => {
        const name = window.prompt("Enter Swimmer Name:");
        if (!name) return;

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();

        const newSwimmer = {
            name: name,
            group_name: "Unassigned", // Default group
            status: "New",
            efficiency_score: 50, // Default score
            coach_id: user.id
        };

        const { data, error } = await supabase
            .from('swimmers')
            .insert([newSwimmer])
            .select();

        if (error) {
            alert("Error adding swimmer: " + error.message);
        } else {
            // Update UI immediately
            setSwimmers(prev => [...prev, ...data]);
        }
    };

    // --- 3. Parsing Logic (SD3 / CSV) ---
    const parseSD3Roster = async (text) => {
        const lines = text.split(/\r\n|\n/);
        const newEntries = [];
        const { data: { user } } = await supabase.auth.getUser();
        
        // SD3 "D0" Record Regex
        const d0Regex = /^D0\d[A-Z0-9]{2,6}\s+(.+?)\s+[A-Z0-9]{8,}/;

        lines.forEach((line) => {
            if (line.startsWith("D0")) {
                let cleanName = "";
                let age = null;

                const match = line.match(d0Regex);
                if (match && match[1]) {
                    cleanName = match[1].trim();
                } else {
                    // Fallback for fixed width
                    let rawSection = line.substring(5, 45);
                    cleanName = rawSection.replace(/^[A-Z0-9]{2,6}\s+/, '').trim();
                    cleanName = cleanName.replace(/\s+[A-Z0-9]{5,}$/, '').trim();
                }

                if (cleanName) {
                    cleanName = cleanName.replace(/\s[A-Z0-9]{6,}$/i, '').trim();
                    const dobStr = line.substring(55, 63).trim();
                    age = calculateAge(dobStr);

                    // Name Formatting (Last, First M)
                    if (cleanName.includes(',')) {
                        const parts = cleanName.split(',');
                        if (parts.length >= 2) {
                            cleanName = `${parts[1].trim()} ${parts[0].trim()}`;
                        }
                    }
                    
                    // Title Case
                    const formattedName = cleanName.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                    
                    newEntries.push({
                        name: formattedName,
                        group_name: "Imported",
                        status: "New",
                        efficiency_score: 70, // Baseline
                        age: age,
                        coach_id: user.id
                    });
                }
            }
        });
        return newEntries;
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
                    // 1. Parse Data
                    const newSwimmersData = await parseSD3Roster(text);
                    
                    if (newSwimmersData.length > 0) {
                        // 2. Insert into Supabase
                        const { data, error } = await supabase
                            .from('swimmers')
                            .insert(newSwimmersData)
                            .select();

                        if (error) throw error;

                        // 3. Update State
                        setSwimmers(prev => [...prev, ...data]);
                        alert(`Successfully imported ${data.length} swimmers!`);
                        setShowImport(false);
                    } else {
                        alert("No valid roster records found in file.");
                    }
                } else {
                    alert("Result import not yet connected to database (Coming Soon)");
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

            // Fetch Results
            const { data: resultsData } = await supabase
                .from('results')
                .select('*')
                .eq('swimmer_id', swimmer.id)
                .order('date', { ascending: false });
            
            if (resultsData) setResults(resultsData);

            // Fetch AI Analyses
            const { data: analysesData } = await supabase
                .from('analyses')
                .select('*')
                .eq('swimmer_id', swimmer.id)
                .order('created_at', { ascending: false });

            if (analysesData) setAnalyses(analysesData);
        };

        fetchData();
    }, [swimmer]);

    // --- 2. Charting Helpers ---
    const uniqueEvents = useMemo(() => {
        const events = [...new Set(results.map(r => r.event))];
        return events.sort();
    }, [results]);

    useEffect(() => {
        if (uniqueEvents.length > 0 && !selectedEvent) {
            setSelectedEvent(uniqueEvents[0]);
        }
    }, [uniqueEvents, selectedEvent]);

    const timeToSeconds = (timeStr) => {
        if (!timeStr) return 0;
        const cleanStr = timeStr.replace(/[A-Z]/g, '').trim();
        const parts = cleanStr.split(':');
        return parts.length === 2 
            ? parseInt(parts[0]) * 60 + parseFloat(parts[1]) 
            : parseFloat(parts[0]);
    };

    const chartData = useMemo(() => {
        return results
            .filter(r => r.event === selectedEvent)
            .map(r => ({
                date: new Date(r.date).toLocaleDateString(),
                timeStr: r.time,
                seconds: timeToSeconds(r.time),
            }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [selectedEvent, results]);

    // --- 3. Video Upload Logic ---
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
            
            // A. Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from('race-videos')
                .upload(fileName, file);
            
            if (uploadError) throw uploadError;

            // B. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('race-videos')
                .getPublicUrl(fileName);

            // C. Update Database Record
            const { error: dbError } = await supabase
                .from('results')
                .update({ video_url: publicUrl })
                .eq('id', uploadingResultId);

            if (dbError) throw dbError;

            alert("Video uploaded successfully!");
            
            // Refresh local state to show "Watch Analysis" button
            setResults(prev => prev.map(r => 
                r.id === uploadingResultId ? { ...r, video_url: publicUrl } : r
            ));

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
                                    <p className="text-slate-500 text-xs">Time progression over season</p>
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
                                            <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                                            <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                                            <Line type="monotone" dataKey="seconds" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff'}} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-slate-400 text-sm bg-slate-50 rounded-lg">
                                        No results available to graph.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {/* Right Column: Recent Analysis & Notes */}
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

                    {results.length > 0 ? (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Event</th>
                                    <th className="px-6 py-4 font-medium">Date</th>
                                    <th className="px-6 py-4 font-medium">Time</th>
                                    <th className="px-6 py-4 font-medium text-right">Race Video</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {results.map((r, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900">{r.event}</td>
                                        <td className="px-6 py-4 text-slate-500">{new Date(r.date).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 font-mono font-bold text-blue-600">{r.time}</td>
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
                                ))}
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
