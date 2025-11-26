// src/Reports.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabase';
import { 
  Trophy, ChevronLeft, FileText, Filter, Loader2, AlertCircle, CheckCircle2, XCircle, 
  TrendingUp, Activity, Users, Target, ArrowRight, Layers, Database
} from 'lucide-react';

// --- SHARED HELPERS (Available to all components) ---

const timeToSeconds = (timeStr) => {
  if (!timeStr) return 999999;
  if (['DQ', 'NS', 'DFS', 'SCR', 'DNF', 'NT'].some(s => timeStr.toUpperCase().includes(s))) return 999999;
  
  const cleanStr = timeStr.replace(/[A-Z]/g, '').trim();
  if (!cleanStr) return 999999;

  const parts = cleanStr.split(':');
  let val = 0;
  if (parts.length === 2) {
      val = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
  } else {
      val = parseFloat(parts[0]);
  }
  return isNaN(val) ? 999999 : val;
};

const secondsToTime = (val) => {
  if (!val || val >= 999999) return "-";
  const mins = Math.floor(val / 60);
  const secs = (val % 60).toFixed(2);
  return mins > 0 ? `${mins}:${secs.padStart(5, '0')}` : secs;
};

const parseEvent = (evt) => {
  if (!evt) return { dist: '', stroke: '' };
  
  // Non-greedy remove of parens
  const clean = evt.toLowerCase().replace(/\(.*?\)/g, '').trim(); 
  const match = clean.match(/\b(25|50|100|200|400|500|800|1000|1500|1650)\s+(.*)/);
  
  if (match) {
      const dist = match[1];
      let stroke = match[2];
      if (stroke.includes('free')) stroke = 'free';
      else if (stroke.includes('back')) stroke = 'back';
      else if (stroke.includes('breast')) stroke = 'breast';
      else if (stroke.includes('fly') || stroke.includes('butter')) stroke = 'fly';
      else if (stroke.includes('im') || stroke.includes('medley')) stroke = 'im';
      else return { dist: '', stroke: '' };
      
      return { dist, stroke: stroke.trim() };
  }
  return { dist: '', stroke: '' };
};


// --- MAIN COMPONENT ---
export default function Reports({ onBack }) {
  const [currentReport, setCurrentReport] = useState(null);

  const renderReport = () => {
    switch (currentReport) {
      case 'qualifiers': return <QualifiersReport onBack={() => setCurrentReport(null)} />;
      case 'relays': return <RelayGenerator onBack={() => setCurrentReport(null)} />;
      // Placeholders
      case 'movers': return <BigMoversReport onBack={() => setCurrentReport(null)} />;
      case 'closecalls': return <CloseCallsReport onBack={() => setCurrentReport(null)} />;
      case 'heatmap': return <FlawHeatmapReport onBack={() => setCurrentReport(null)} />;
      case 'groups': return <GroupProgressionReport onBack={() => setCurrentReport(null)} />;
      default: return null;
    }
  };

  if (currentReport) {
    return <div className="p-4 md:p-8 h-full overflow-y-auto bg-[#f8fafc]">{renderReport()}</div>;
  }

  // --- DASHBOARD MENU VIEW ---
  return (
    <div className="p-4 md:p-8 h-full overflow-y-auto bg-[#f8fafc]">
        <div className="flex items-center gap-4 mb-8">
            <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                <ChevronLeft size={24} />
            </button>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <FileText className="text-blue-600" /> Team Reports
            </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 1. QUALIFIERS */}
            <div onClick={() => setCurrentReport('qualifiers')} className="bg-white p-6 rounded-2xl border hover:border-blue-400 cursor-pointer shadow-sm hover:shadow-md transition-all group">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Trophy size={24}/></div>
                <h3 className="font-bold text-lg text-slate-800">Qualifiers List</h3>
                <p className="text-slate-500 text-sm mt-1">See who made the cut for Champs, Sectionals, etc.</p>
            </div>

            // --- 2. RELAY GENERATOR (SMART PERMUTATIONS) ---
const RelayGenerator = ({ onBack }) => {
    const [ageGroup, setAgeGroup] = useState('11-12');
    const [gender, setGender] = useState('M');
    const [relayType, setRelayType] = useState('200 Free');
    const [relays, setRelays] = useState([]);
    const [loading, setLoading] = useState(false);
    const [progressMsg, setProgressMsg] = useState("");

    const generate = async () => {
        setLoading(true);
        setProgressMsg("Fetching swimmer times...");

        // A. Fetch Data (Optimized)
        const { data: swimmers } = await supabase.from('swimmers').select('*');
        
        let allResults = [];
        let page = 0;
        let keepFetching = true;
        while (keepFetching) {
            setProgressMsg(`Scanning results batch ${page + 1}...`);
            const { data: batch } = await supabase.from('results').select('swimmer_id, event, time').order('id').range(page*2000, (page+1)*2000-1);
            if (!batch || batch.length === 0) keepFetching = false;
            else {
                allResults = [...allResults, ...batch];
                page++;
                if (allResults.length > 100000) keepFetching = false; 
            }
        }

        // B. Filter Candidates (Age/Gender)
        const [minAge, maxAge] = ageGroup === '10&U' ? [0, 10] : ageGroup === '15&O' ? [15, 99] : ageGroup.split('-').map(Number);
        const candidates = swimmers.filter(s => {
            const age = s.age || 0;
            const g = (s.gender || 'M').trim().toUpperCase();
            return age >= minAge && age <= maxAge && g === gender;
        });

        // C. Build "Time Matrix" for Candidates
        // This creates a lightweight object for each swimmer with their best times
        const isMedley = relayType.includes('Medley');
        const dist = relayType.startsWith('400') ? '100' : '50';
        const requiredStrokes = isMedley ? ['back', 'breast', 'fly', 'free'] : ['free'];

        const candidateTimes = candidates.map(s => {
            const myResults = allResults.filter(r => r.swimmer_id == s.id);
            const times = { id: s.id, name: s.name };
            
            requiredStrokes.forEach(stk => {
                const matches = myResults.map(r => {
                    const p = parseEvent(r.event);
                    // Strict match: "50 Free" should not match "500 Free"
                    // We use our strict parser
                    return (p.dist === dist && p.stroke === stk) ? timeToSeconds(r.time) : 999999;
                }).filter(t => t < 999999);
                
                times[stk] = matches.length > 0 ? Math.min(...matches) : 999999;
            });
            return times;
        });

        // D. Build Relays
        const builtRelays = [];
        // We work on a copy of the pool so we can remove swimmers as they get assigned to A, B, C relays
        let pool = [...candidateTimes];

        for (let i = 0; i < 3; i++) {
            let team = [];

            if (!isMedley) {
                // FREE RELAY: Simple Sort is Optimal
                pool.sort((a,b) => a.free - b.free);
                // Filter out people with NO time (999999)
                const validFree = pool.filter(p => p.free < 999999);
                
                if (validFree.length >= 4) {
                    team = validFree.slice(0, 4).map(s => ({ ...s, stroke: 'Free', split: s.free }));
                    // Remove these IDs from the pool for the next relay (B Team)
                    const usedIds = new Set(team.map(t => t.id));
                    pool = pool.filter(s => !usedIds.has(s.id));
                }
            } else {
                // MEDLEY RELAY: "Smart Permutation" Solver
                // 1. Identify the Top 4 contenders for EACH stroke to limit search space
                // (We don't need to check the 20th fastest backstroker)
                const topBack = [...pool].sort((a,b) => a.back - b.back).slice(0, 5);
                const topBreast = [...pool].sort((a,b) => a.breast - b.breast).slice(0, 5);
                const topFly = [...pool].sort((a,b) => a.fly - b.fly).slice(0, 5);
                const topFree = [...pool].sort((a,b) => a.free - b.free).slice(0, 5);

                // 2. Brute-force every valid combination of these top contenders
                // Since it's only 5*5*5*5 = 625 combos max, this is instant for a computer.
                let bestCombo = null;
                let bestTime = Infinity;

                for (const b of topBack) {
                    for (const br of topBreast) {
                        if (br.id === b.id) continue; // Same person can't swim twice
                        for (const fl of topFly) {
                            if (fl.id === b.id || fl.id === br.id) continue;
                            for (const fr of topFree) {
                                if (fr.id === b.id || fr.id === br.id || fr.id === fl.id) continue;

                                // We have a valid 4-person team! Check total time.
                                const total = b.back + br.breast + fl.fly + fr.free;
                                if (total < bestTime && total < 999999) {
                                    bestTime = total;
                                    bestCombo = [
                                        { ...b, stroke: 'Back', split: b.back },
                                        { ...br, stroke: 'Breast', split: br.breast },
                                        { ...fl, stroke: 'Fly', split: fl.fly },
                                        { ...fr, stroke: 'Free', split: fr.free }
                                    ];
                                }
                            }
                        }
                    }
                }

                if (bestCombo) {
                    team = bestCombo;
                    const usedIds = new Set(team.map(t => t.id));
                    pool = pool.filter(s => !usedIds.has(s.id));
                }
            }

            if (team.length === 4) {
                builtRelays.push({
                    label: ['A', 'B', 'C'][i] + ' Relay',
                    swimmers: team,
                    total: team.reduce((sum, t) => sum + t.split, 0)
                });
            }
        }
        setRelays(builtRelays);
        setLoading(false);
    };

    return (
        <div className="space-y-6 animate-in fade-in">
             <div className="bg-white p-4 rounded-xl border shadow-sm">
                <div className="flex justify-between items-center mb-4">
                     <button onClick={onBack} className="flex items-center gap-1 text-blue-600 font-bold text-sm hover:underline"><ArrowRight className="rotate-180" size={16}/> Back</button>
                     <h3 className="font-bold text-slate-800 text-lg">Relay Generator</h3>
                </div>
                
                <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Age Group</label>
                        <select value={ageGroup} onChange={e=>setAgeGroup(e.target.value)} className="font-bold bg-slate-50 border rounded p-2 text-sm">
                            <option value="10&U">10 & Under</option>
                            <option value="11-12">11 - 12</option>
                            <option value="13-14">13 - 14</option>
                            <option value="15&O">15 & Over</option>
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Gender</label>
                        <select value={gender} onChange={e=>setGender(e.target.value)} className="font-bold bg-slate-50 border rounded p-2 text-sm">
                            <option value="M">Boys</option>
                            <option value="F">Girls</option>
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Event</label>
                        <select value={relayType} onChange={e=>setRelayType(e.target.value)} className="font-bold bg-slate-50 border rounded p-2 text-sm">
                            <option value="200 Free">200 Free Relay</option>
                            <option value="400 Free">400 Free Relay</option>
                            <option value="200 Medley">200 Medley Relay</option>
                            <option value="400 Medley">400 Medley Relay</option>
                        </select>
                    </div>
                    <button onClick={generate} disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 disabled:opacity-50">
                        {loading ? "Optimizing..." : "Build Relays"}
                    </button>
                </div>
            </div>
            
            {loading && <div className="text-center py-8 text-slate-400 animate-pulse">{progressMsg}</div>}
            
            {!loading && relays.length > 0 && (
                <div className="grid gap-4">
                    {relays.map((r, i) => (
                        <div key={i} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                            <div className="bg-slate-50 p-3 border-b flex justify-between items-center">
                                <h4 className="font-bold text-slate-800">{r.label}</h4>
                                <span className="font-mono font-bold text-blue-600 text-lg">{secondsToTime(r.total)}</span>
                            </div>
                            <div className="divide-y">
                                {r.swimmers.map((s, idx) => (
                                    <div key={idx} className="p-3 flex justify-between items-center text-sm">
                                        <div className="flex items-center gap-3">
                                            <span className="text-slate-400 w-4 font-mono">{idx+1}</span>
                                            <div>
                                                <div className="font-bold text-slate-700">{s.name}</div>
                                                <div className="text-xs text-slate-400">{s.stroke} Leg</div>
                                            </div>
                                        </div>
                                        <span className="font-mono text-slate-600">{secondsToTime(s.split)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
  };

// --- PLACEHOLDERS FOR OTHER REPORTS (Will Implement Next) ---
const BigMoversReport = ({ onBack }) => <div className="p-8"><button onClick={onBack}>Back</button><h3>Big Movers Coming Soon</h3></div>;
const CloseCallsReport = ({ onBack }) => <div className="p-8"><button onClick={onBack}>Back</button><h3>Close Calls Coming Soon</h3></div>;
const FlawHeatmapReport = ({ onBack }) => <div className="p-8"><button onClick={onBack}>Back</button><h3>Heatmap Coming Soon</h3></div>;
const GroupProgressionReport = ({ onBack }) => <div className="p-8"><button onClick={onBack}>Back</button><h3>Group Progression Coming Soon</h3></div>;
