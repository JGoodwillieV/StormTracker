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

            {/* 2. RELAY GENERATOR */}
            <div onClick={() => setCurrentReport('relays')} className="bg-white p-6 rounded-2xl border hover:border-purple-400 cursor-pointer shadow-sm hover:shadow-md transition-all group">
                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Layers size={24}/></div>
                <h3 className="font-bold text-lg text-slate-800">Relay Generator</h3>
                <p className="text-slate-500 text-sm mt-1">Auto-build optimal A, B, and C relays.</p>
            </div>

            {/* 3. BIG MOVERS */}
            <div onClick={() => setCurrentReport('movers')} className="bg-white p-6 rounded-2xl border hover:border-emerald-400 cursor-pointer shadow-sm hover:shadow-md transition-all group">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><TrendingUp size={24}/></div>
                <h3 className="font-bold text-lg text-slate-800">Big Movers</h3>
                <p className="text-slate-500 text-sm mt-1">Leaderboard of total time dropped this season.</p>
            </div>
        </div>
    </div>
  );
}

// --- SUB-COMPONENTS ---

// 1. QUALIFIERS REPORT
const QualifiersReport = ({ onBack }) => {
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [standardNames, setStandardNames] = useState([]);
  const [selectedStandard, setSelectedStandard] = useState("");
  const [rows, setRows] = useState([]);
  const [showQualifiersOnly, setShowQualifiersOnly] = useState(true);

  useEffect(() => {
    const fetchStandardsList = async () => {
      const { data } = await supabase.from('time_standards').select('name');
      if (data) {
        const unique = [...new Set(data.map(d => d.name))].sort();
        setStandardNames(unique);
        if (unique.includes('Sectionals')) setSelectedStandard('Sectionals');
        else if (unique.length > 0) setSelectedStandard(unique[0]);
      }
    };
    fetchStandardsList();
  }, []);

  useEffect(() => {
    const runReport = async () => {
      if (!selectedStandard) return;
      setLoading(true);
      setRows([]);

      const { data: swimmers } = await supabase.from('swimmers').select('*');
      const { data: cuts } = await supabase.from('time_standards').select('*').eq('name', selectedStandard);

      // Fetch ALL results
      let allResults = [];
      let page = 0;
      let keepFetching = true;
      
      while (keepFetching) {
          setProgressMsg(`Fetching results ${page * 1000} - ${(page + 1) * 1000}...`);
          const { data: batch, error } = await supabase
            .from('results')
            .select('swimmer_id, event, time, date')
            .order('id', { ascending: true }) 
            .range(page * 1000, (page + 1) * 1000 - 1);
          
          if (error || !batch || batch.length === 0) keepFetching = false;
          else {
              allResults = [...allResults, ...batch];
              page++;
              if (allResults.length > 200000) keepFetching = false; 
          }
      }

      if (!swimmers || !cuts) { setLoading(false); return; }

      setProgressMsg("Analyzing data...");
      const processedList = [];

      swimmers.forEach((swimmer) => {
        const myResults = allResults.filter(r => r.swimmer_id == swimmer.id);
        const myBestTimes = {}; 

        myResults.forEach(r => {
            const { dist, stroke } = parseEvent(r.event);
            if (!dist || !stroke) return;
            const key = `${dist} ${stroke}`; 
            const sec = timeToSeconds(r.time);
            if (sec > 0 && sec < 999999) {
                if (!myBestTimes[key] || sec < myBestTimes[key].val) {
                    myBestTimes[key] = { val: sec, str: r.time, date: r.date };
                }
            }
        });

        const swimmerAge = parseInt(swimmer.age) || 0; 
        const swimmerGender = (swimmer.gender || 'M').trim().toUpperCase();

        const myRelevantCuts = cuts.filter(c => {
            const cutGender = c.gender.trim().toUpperCase();
            const genderMatch = cutGender === swimmerGender;
            const ageMatch = (c.age_max === 99) || (swimmerAge >= c.age_min && swimmerAge <= c.age_max);
            return genderMatch && ageMatch;
        });

        const myQualifyingEvents = [];
        let closestMiss = null;

        myRelevantCuts.forEach(cut => {
            const { dist, stroke } = parseEvent(cut.event);
            const key = `${dist} ${stroke}`;
            const myBest = myBestTimes[key];

            if (myBest) {
                const diff = myBest.val - cut.time_seconds;
                if (diff <= 0.00001) {
                     if (!myQualifyingEvents.some(e => e.event === cut.event)) {
                        myQualifyingEvents.push({
                            event: cut.event,
                            time: myBest.str,
                            date: myBest.date,
                            standard: cut.time_string,
                            diff: Math.abs(diff).toFixed(2)
                        });
                     }
                } else {
                    if (!closestMiss || diff < closestMiss.diffVal) {
                        closestMiss = {
                            event: cut.event,
                            time: myBest.str,
                            standard: cut.time_string,
                            diff: diff.toFixed(2),
                            diffVal: diff
                        };
                    }
                }
            }
        });

        processedList.push({
            ...swimmer,
            events: myQualifyingEvents.sort((a, b) => new Date(b.date) - new Date(a.date)),
            isQualified: myQualifyingEvents.length > 0,
            closestMiss: closestMiss
        });
      });

      processedList.sort((a, b) => {
          if (a.isQualified !== b.isQualified) return a.isQualified ? -1 : 1;
          return a.name.localeCompare(b.name);
      });

      setRows(processedList);
      setLoading(false);
    };

    runReport();
  }, [selectedStandard]);

  const displayedRows = showQualifiersOnly ? rows.filter(r => r.isQualified) : rows;

  return (
      <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border shadow-sm">
              <button onClick={onBack} className="flex items-center gap-1 text-blue-600 font-bold text-sm hover:underline"><ArrowRight className="rotate-180" size={16}/> Back to Reports</button>
              <div className="flex gap-4 items-center">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-600 cursor-pointer select-none">
                    <input type="checkbox" checked={showQualifiersOnly} onChange={() => setShowQualifiersOnly(!showQualifiersOnly)} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"/>
                    Show Qualifiers Only
                </label>
                <select value={selectedStandard} onChange={(e) => setSelectedStandard(e.target.value)} className="bg-slate-50 border p-2 rounded-lg text-sm font-bold text-slate-800">
                    {standardNames.map(name => <option key={name} value={name}>{name} Standard</option>)}
                </select>
              </div>
          </div>

          {loading && (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 animate-pulse">
                <Loader2 size={40} className="animate-spin mb-4 text-blue-500"/>
                <p>{progressMsg || "Processing..."}</p>
            </div>
          )}

          {!loading && displayedRows.length === 0 && (
              <div className="text-center py-12 text-slate-400">No swimmers match criteria.</div>
          )}

          {!loading && (
            <div className="grid grid-cols-1 gap-4">
                {displayedRows.map(swimmer => (
                    <div key={swimmer.id} className={`border rounded-xl p-6 shadow-sm transition-shadow ${swimmer.isQualified ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-70'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    {swimmer.name}
                                    {swimmer.isQualified ? <CheckCircle2 size={16} className="text-emerald-500"/> : <XCircle size={16} className="text-slate-400"/>}
                                </h3>
                                <p className="text-slate-500 text-sm">{swimmer.age} Years • {swimmer.gender} • {swimmer.group_name}</p>
                            </div>
                            {swimmer.isQualified && <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full">{swimmer.events.length} Events</span>}
                        </div>
                        
                        {swimmer.isQualified && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {swimmer.events.map((evt, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                        <div>
                                            <div className="font-bold text-sm text-slate-700">{evt.event}</div>
                                            <div className="text-xs text-slate-400">{new Date(evt.date).toLocaleDateString()}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-mono font-bold text-blue-600 text-sm">{evt.time}</div>
                                            <div className="text-[10px] text-emerald-600 font-bold">-{Math.abs(evt.diff)}s</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {!swimmer.isQualified && swimmer.closestMiss && (
                            <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded-lg text-sm">
                                <p className="font-bold text-red-800 mb-1">Closest Attempt:</p>
                                <div className="flex justify-between">
                                    <span>{swimmer.closestMiss.event}</span>
                                    <span className="font-mono text-red-600">{swimmer.closestMiss.time} (Cut: {swimmer.closestMiss.standard}) <span className="ml-2 font-bold">+{swimmer.closestMiss.diff}s</span></span>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
          )}
      </div>
  );
};

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

        // Filter Candidates
        const [minAge, maxAge] = ageGroup === '10&U' ? [0, 10] : ageGroup === '15&O' ? [15, 99] : ageGroup.split('-').map(Number);
        const candidates = swimmers.filter(s => {
            const age = s.age || 0;
            const g = (s.gender || 'M').trim().toUpperCase();
            return age >= minAge && age <= maxAge && g === gender;
        });

        // Build "Time Matrix"
        const isMedley = relayType.includes('Medley');
        const dist = relayType.startsWith('400') ? '100' : '50';
        const requiredStrokes = isMedley ? ['back', 'breast', 'fly', 'free'] : ['free'];

        const candidateTimes = candidates.map(s => {
            const myResults = allResults.filter(r => r.swimmer_id == s.id);
            const times = { id: s.id, name: s.name };
            
            requiredStrokes.forEach(stk => {
                const matches = myResults.map(r => {
                    const p = parseEvent(r.event);
                    return (p.dist === dist && p.stroke === stk) ? timeToSeconds(r.time) : 999999;
                }).filter(t => t < 999999);
                
                times[stk] = matches.length > 0 ? Math.min(...matches) : 999999;
            });
            return times;
        });

        // Build Relays
        const builtRelays = [];
        let pool = [...candidateTimes];

        for (let i = 0; i < 3; i++) {
            let team = [];

            if (!isMedley) {
                // FREE RELAY: Simple Sort
                pool.sort((a,b) => a.free - b.free);
                const eligible = pool.filter(p => p.free < 999999);
                if (eligible.length >= 4) {
                    team = eligible.slice(0, 4).map(s => ({ ...s, stroke: 'Free', split: s.free }));
                    const usedIds = new Set(team.map(t => t.id));
                    pool = pool.filter(s => !usedIds.has(s.id));
                }
            } else {
                // MEDLEY RELAY: Smart Permutation
                const topBack = [...pool].sort((a,b) => a.back - b.back).slice(0, 5);
                const topBreast = [...pool].sort((a,b) => a.breast - b.breast).slice(0, 5);
                const topFly = [...pool].sort((a,b) => a.fly - b.fly).slice(0, 5);
                const topFree = [...pool].sort((a,b) => a.free - b.free).slice(0, 5);

                let bestCombo = null;
                let bestTime = Infinity;

                for (const b of topBack) {
                    for (const br of topBreast) {
                        if (br.id === b.id) continue; 
                        for (const fl of topFly) {
                            if (fl.id === b.id || fl.id === br.id) continue;
                            for (const fr of topFree) {
                                if (fr.id === b.id || fr.id === br.id || fr.id === fl.id) continue;

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
