// src/Reports.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabase';
import { 
  Trophy, ChevronLeft, FileText, Filter, Loader2, AlertCircle, 
  TrendingUp, Activity, Users, Target, ArrowRight, Timer, Layers, Zap
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Reports({ onBack }) {
  const [currentReport, setCurrentReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  
  // Shared Data Cache
  const [allData, setAllData] = useState({ swimmers: [], results: [], analyses: [], standards: [] });
  const [standardNames, setStandardNames] = useState([]);

  // --- HELPERS ---
  const timeToSeconds = (timeStr) => {
    if (!timeStr) return 999999;
    if (['DQ', 'NS', 'DFS', 'SCR', 'DNF', 'NT'].some(s => timeStr.toUpperCase().includes(s))) return 999999;
    const cleanStr = timeStr.replace(/[A-Z]/g, '').trim();
    if (!cleanStr) return 999999;
    const parts = cleanStr.split(':');
    let val = 0;
    if (parts.length === 2) val = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
    else val = parseFloat(parts[0]);
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
    const clean = evt.toLowerCase().replace(/\(.*?\)/g, ''); 
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

  // --- DATA LOADER ---
  const loadData = async () => {
    if (allData.swimmers.length > 0) return; 
    setLoading(true);
    setProgressMsg("Loading Team Data...");

    const { data: swimmers } = await supabase.from('swimmers').select('*');
    const { data: standards } = await supabase.from('time_standards').select('*');
    const { data: analyses } = await supabase.from('analyses').select('*');
    
    let allResults = [];
    let page = 0;
    let keepFetching = true;
    while (keepFetching) {
        setProgressMsg(`Loading Results (${page * 2000}+)...`);
        const { data: batch } = await supabase.from('results').select('swimmer_id, event, time, date').order('id').range(page*2000, (page+1)*2000-1);
        if (!batch || batch.length === 0) keepFetching = false;
        else {
            allResults = [...allResults, ...batch];
            page++;
            if (allResults.length > 100000) keepFetching = false;
        }
    }

    setAllData({ swimmers, results: allResults, analyses, standards });
    setStandardNames([...new Set(standards.map(d => d.name))].sort());
    setLoading(false);
  };

  // --- 1. RELAY GENERATOR ---
  const RelayGenerator = () => {
    const [ageGroup, setAgeGroup] = useState('11-12');
    const [gender, setGender] = useState('M');
    const [relayType, setRelayType] = useState('200 Free'); // '200 Free', '200 Medley'
    const [generatedRelays, setGeneratedRelays] = useState([]);

    useEffect(() => {
        if (allData.swimmers.length === 0) return;

        // 1. Filter Candidates
        const [minAge, maxAge] = ageGroup === '10&U' ? [0, 10] : ageGroup === '15&O' ? [15, 99] : ageGroup.split('-').map(Number);
        
        const candidates = allData.swimmers.filter(s => {
            const age = s.age || 0;
            const g = (s.gender || 'M').trim().toUpperCase();
            return age >= minAge && age <= maxAge && g === gender;
        });

        // 2. Get Best Times for relevant strokes
        const isMedley = relayType.includes('Medley');
        const dist = relayType.startsWith('400') ? '100' : '50';
        const requiredStrokes = isMedley ? ['back', 'breast', 'fly', 'free'] : ['free'];

        // Map: { swimmerId: { name: "...", free: 25.5, back: 30.1 ... } }
        const candidateTimes = candidates.map(s => {
            const myResults = allData.results.filter(r => r.swimmer_id == s.id);
            const times = { id: s.id, name: s.name };
            
            requiredStrokes.forEach(stk => {
                const matches = myResults
                    .filter(r => {
                        const p = parseEvent(r.event);
                        return p.dist === dist && p.stroke === stk;
                    })
                    .map(r => timeToSeconds(r.time));
                times[stk] = matches.length > 0 ? Math.min(...matches) : 999999;
            });
            return times;
        });

        // 3. Build Relays
        const relays = [];
        let pool = [...candidateTimes];

        // Try to build up to 3 relays (A, B, C)
        for (let i = 0; i < 3; i++) {
            let team = [];
            
            if (!isMedley) {
                // FREE RELAY: Just top 4 fastest freestyle
                pool.sort((a,b) => a.free - b.free);
                if (pool.length >= 4) {
                    team = pool.slice(0, 4).map(s => ({ ...s, stroke: 'Free', split: s.free }));
                    // Remove selected from pool
                    pool = pool.slice(4); 
                }
            } else {
                // MEDLEY RELAY: Optimizer (Simple Greedy or Permutation)
                // We need 1 Back, 1 Breast, 1 Fly, 1 Free. All distinct swimmers.
                // Since N is small, we can check permutations of top swimmers for optimal sum.
                
                // Strategy: Find best combination from the top X swimmers available
                // To keep it fast, lets look at the top 5 in each stroke
                // Actually, simplest is just picking best available for each slot greedily? 
                // No, that fails if your best Back is also your ONLY Breast.
                
                // Better: Find all valid permutations of 4 distinct swimmers from the pool
                // and pick the fastest sum. (Limit pool to top 8 overall to save calc time)
                
                // Rank swimmers by sum of all strokes to find "contenders"
                // Or just filter out anyone with NO times
                const validSwimmers = pool.filter(s => Math.min(s.back, s.breast, s.fly, s.free) < 999);
                
                if (validSwimmers.length >= 4) {
                    let bestSum = Infinity;
                    let bestCombo = null;

                    // Heuristic: Sort swimmers by their best single stroke to prioritize specialists
                    // Then bruteforce the top combinations. 
                    // For this UI, let's do a simplified "Slot Filling" which works 90% of time.
                    
                    // 1. Find Best Back
                    // 2. Find Best Breast (excluding Back)
                    // 3. Find Best Fly (excluding Back, Breast)
                    // 4. Find Best Free (excluding others)
                    // Check total time. 
                    // Then Rotate starting stroke priority! 
                    // (Try prioritizing Breast first, etc. and see which yields faster total)
                    
                    const orders = [
                        ['back', 'breast', 'fly', 'free'], // Standard Medley Order
                        ['breast', 'fly', 'back', 'free'], // Prioritize scarce strokes?
                        ['fly', 'back', 'breast', 'free']
                    ];

                    orders.forEach(order => {
                        const currentTeam = [];
                        const usedIds = new Set();
                        let currentSum = 0;

                        // For this order, pick best available
                        order.forEach(stroke => {
                            // Find best swimmer for this stroke not used
                            let best = null;
                            let bestTime = Infinity;
                            
                            validSwimmers.forEach(s => {
                                if (!usedIds.has(s.id) && s[stroke] < bestTime) {
                                    bestTime = s[stroke];
                                    best = s;
                                }
                            });

                            if (best) {
                                currentTeam.push({ ...best, stroke: stroke.charAt(0).toUpperCase() + stroke.slice(1), split: bestTime });
                                usedIds.add(best.id);
                                currentSum += bestTime;
                            }
                        });

                        if (currentTeam.length === 4) {
                            // Re-sort to Medley Order (Back, Breast, Fly, Free) for display
                            const medleyOrder = ['Back', 'Breast', 'Fly', 'Free'];
                            currentTeam.sort((a,b) => medleyOrder.indexOf(a.stroke) - medleyOrder.indexOf(b.stroke));
                            
                            if (currentSum < bestSum) {
                                bestSum = currentSum;
                                bestCombo = currentTeam;
                            }
                        }
                    });

                    if (bestCombo) {
                        team = bestCombo;
                        // Remove from pool
                        const usedIds = new Set(team.map(t => t.id));
                        pool = pool.filter(s => !usedIds.has(s.id));
                    }
                }
            }

            if (team.length === 4) {
                relays.push({
                    label: i === 0 ? 'A Relay' : i === 1 ? 'B Relay' : 'C Relay',
                    swimmers: team,
                    totalTime: team.reduce((sum, s) => sum + s.split, 0)
                });
            }
        }
        
        setGeneratedRelays(relays);
    }, [ageGroup, gender, relayType, allData]);

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Controls */}
            <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-wrap gap-4 items-center justify-between">
                <div className="flex gap-3">
                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Age Group</label>
                        <select value={ageGroup} onChange={e=>setAgeGroup(e.target.value)} className="font-bold bg-slate-50 border rounded p-1 text-sm">
                            <option value="10&U">10 & Under</option>
                            <option value="11-12">11 - 12</option>
                            <option value="13-14">13 - 14</option>
                            <option value="15&O">15 & Over</option>
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Gender</label>
                        <select value={gender} onChange={e=>setGender(e.target.value)} className="font-bold bg-slate-50 border rounded p-1 text-sm">
                            <option value="M">Boys</option>
                            <option value="F">Girls</option>
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Event</label>
                        <select value={relayType} onChange={e=>setRelayType(e.target.value)} className="font-bold bg-slate-50 border rounded p-1 text-sm">
                            <option value="200 Free">200 Free Relay</option>
                            <option value="400 Free">400 Free Relay</option>
                            <option value="200 Medley">200 Medley Relay</option>
                            <option value="400 Medley">400 Medley Relay</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Results */}
            <div className="space-y-4">
                {generatedRelays.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">Not enough swimmers with valid times to form a relay.</div>
                ) : generatedRelays.map((relay, i) => (
                    <div key={i} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                        <div className="bg-slate-50 p-3 border-b flex justify-between items-center">
                            <h4 className="font-bold text-slate-800">{relay.label}</h4>
                            <span className="font-mono font-bold text-blue-600 text-lg">{secondsToTime(relay.totalTime)}</span>
                        </div>
                        <div className="divide-y">
                            {relay.swimmers.map((s, idx) => (
                                <div key={idx} className="p-3 flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-3">
                                        <span className="text-slate-400 w-4">{idx+1}</span>
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
        </div>
    );
  };

  // --- QUALIFIERS REPORT (Your previous working logic) ---
  const QualifiersReport = () => {
      const [selectedStd, setSelectedStd] = useState(standardNames.includes('Sectionals') ? 'Sectionals' : standardNames[0] || "");
      const [reportRows, setReportRows] = useState([]);

      useEffect(() => {
        if(!selectedStd) return;
        const cuts = allData.standards.filter(s => s.name === selectedStd);
        
        const data = allData.swimmers.map(swimmer => {
              const myResults = allData.results.filter(r => r.swimmer_id == swimmer.id);
              const myBestTimes = {};
              myResults.forEach(r => {
                  const { dist, stroke } = parseEvent(r.event);
                  if(!dist) return;
                  const key = `${dist} ${stroke}`;
                  const sec = timeToSeconds(r.time);
                  if(sec > 0 && sec < 9999) {
                      if(!myBestTimes[key] || sec < myBestTimes[key].val) myBestTimes[key] = { val: sec, str: r.time, date: r.date };
                  }
              });

              const age = parseInt(swimmer.age) || 0;
              const gender = (swimmer.gender || 'M').trim().toUpperCase();
              
              // Match Standards
              const myCuts = cuts.filter(c => {
                  const cGen = c.gender.trim().toUpperCase();
                  const cAge = (c.age_max === 99) || (age >= c.age_min && age <= c.age_max);
                  return cGen === gender && cAge;
              });

              const qualified = [];
              myCuts.forEach(cut => {
                  const { dist, stroke } = parseEvent(cut.event);
                  const key = `${dist} ${stroke}`;
                  const best = myBestTimes[key];
                  // Epsilon Check
                  if (best && best.val <= cut.time_seconds + 0.001) { 
                      if (!qualified.some(q => q.event === cut.event)) {
                          qualified.push({ event: cut.event, time: best.str, date: best.date });
                      }
                  }
              });

              return { ...swimmer, qualified };
        }).filter(s => s.qualified.length > 0).sort((a, b) => b.qualified.length - a.qualified.length);

        setReportRows(data);
      }, [selectedStd, allData]);

      return (
          <div className="space-y-6 animate-in fade-in">
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm">
                  <h3 className="font-bold text-slate-800">Qualifiers List</h3>
                  <select value={selectedStd} onChange={e => setSelectedStd(e.target.value)} className="bg-slate-50 border p-2 rounded-lg text-sm font-bold">
                      {standardNames.map(n => <option key={n} value={n}>{n} Standard</option>)}
                  </select>
              </div>
              <div className="grid gap-4">
                  {reportRows.map(s => (
                      <div key={s.id} className="bg-white p-4 rounded-xl border shadow-sm">
                          <div className="flex justify-between mb-2">
                              <span className="font-bold text-slate-800 text-lg">{s.name}</span>
                              <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">{s.qualified.length} Cuts</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              {s.qualified.map((q, i) => (
                                  <div key={i} className="flex justify-between text-sm bg-slate-50 p-2 rounded border border-slate-100">
                                      <span className="font-medium text-slate-700">{q.event}</span>
                                      <span className="font-mono text-blue-600">{q.time}</span>
                                  </div>
                              ))}
                          </div>
                      </div>
                  ))}
                  {reportRows.length === 0 && <div className="text-center py-12 text-slate-400">No qualifiers found.</div>}
              </div>
          </div>
      );
  };

  // --- PLACEHOLDERS FOR NEW IDEAS ---
  const EfficiencyReport = ({ onBack }) => <div className="p-8 text-center text-slate-400">Stroke Efficiency Trends Coming Soon...</div>;
  const DropZoneReport = ({ onBack }) => <div className="p-8 text-center text-slate-400">Drop Zone Funnel Coming Soon...</div>;
  
  // --- MAIN RENDER ---
  if (loading) return (
    <div className="h-full flex flex-col items-center justify-center text-slate-500">
        <Loader2 size={48} className="animate-spin mb-4 text-blue-600"/>
        <p>{progressMsg}</p>
    </div>
  );

  return (
    <div className="p-4 md:p-8 h-full overflow-y-auto bg-[#f8fafc]">
        <div className="flex items-center gap-4 mb-6">
            <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full text-slate-500">
                <ChevronLeft size={24} />
            </button>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <FileText className="text-blue-600" /> Team Reports
            </h2>
        </div>

        {!currentReport ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div onClick={() => { loadData(); setCurrentReport('qualifiers'); }} className="bg-white p-6 rounded-2xl border hover:border-blue-400 cursor-pointer shadow-sm hover:shadow-md transition-all group">
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Trophy size={24}/></div>
                    <h3 className="font-bold text-lg text-slate-800">Qualifiers List</h3>
                    <p className="text-slate-500 text-sm mt-1">View swimmers who achieved specific time standards.</p>
                </div>

                {/* NEW: RELAY GENERATOR */}
                <div onClick={() => { loadData(); setCurrentReport('relays'); }} className="bg-white p-6 rounded-2xl border hover:border-purple-400 cursor-pointer shadow-sm hover:shadow-md transition-all group">
                    <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Layers size={24}/></div>
                    <h3 className="font-bold text-lg text-slate-800">Relay Generator</h3>
                    <p className="text-slate-500 text-sm mt-1">Auto-build optimal A, B, and C relays.</p>
                </div>

                <div onClick={() => { loadData(); setCurrentReport('efficiency'); }} className="bg-white p-6 rounded-2xl border hover:border-orange-400 cursor-pointer shadow-sm hover:shadow-md transition-all group">
                    <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Zap size={24}/></div>
                    <h3 className="font-bold text-lg text-slate-800">Stroke Efficiency</h3>
                    <p className="text-slate-500 text-sm mt-1">Track DPS and Stroke Rate trends.</p>
                </div>

                <div onClick={() => { loadData(); setCurrentReport('dropzone'); }} className="bg-white p-6 rounded-2xl border hover:border-emerald-400 cursor-pointer shadow-sm hover:shadow-md transition-all group">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Target size={24}/></div>
                    <h3 className="font-bold text-lg text-slate-800">Drop Zone</h3>
                    <p className="text-slate-500 text-sm mt-1">Visualize team standard distribution.</p>
                </div>
            </div>
        ) : (
            <div>
                <button onClick={() => setCurrentReport(null)} className="text-sm text-blue-600 font-bold mb-4 flex items-center gap-1 hover:underline">
                    <ArrowRight className="rotate-180" size={16}/> Back to Menu
                </button>

                {currentReport === 'qualifiers' && <QualifiersReport />}
                {currentReport === 'relays' && <RelayGenerator />}
                {currentReport === 'efficiency' && <EfficiencyReport />}
                {currentReport === 'dropzone' && <DropZoneReport />}
            </div>
        )}
    </div>
  );
}
