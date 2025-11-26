// src/Reports.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabase';
import { 
  Trophy, ChevronLeft, FileText, Filter, Loader2, AlertCircle, 
  TrendingUp, Activity, Users, Target, ArrowRight
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Reports({ onBack }) {
  const [currentReport, setCurrentReport] = useState(null); // 'qualifiers', 'movers', 'heatmap', 'closecalls', 'groups'
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  
  // Shared Data Cache
  const [swimmers, setSwimmers] = useState([]);
  const [results, setResults] = useState([]);
  const [analyses, setAnalyses] = useState([]);
  const [standards, setStandards] = useState([]);
  const [standardNames, setStandardNames] = useState([]);

  // --- HELPERS ---
  const timeToSeconds = (timeStr) => {
    if (!timeStr) return 999999;
    if (['DQ', 'NS', 'DFS', 'SCR', 'DNF', 'NT'].some(s => timeStr.toUpperCase().includes(s))) return 999999;
    const cleanStr = timeStr.replace(/[A-Z]/g, '').trim();
    const parts = cleanStr.split(':');
    let val = 0;
    if (parts.length === 2) val = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
    else val = parseFloat(parts[0]);
    return isNaN(val) ? 999999 : val;
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

  // --- DATA LOADING ---
  const loadAllData = async () => {
    if (swimmers.length > 0) return; // Already loaded
    setLoading(true);
    setProgressMsg("Loading Team Data...");

    // 1. Fetch Swimmers
    const { data: sData } = await supabase.from('swimmers').select('*');
    setSwimmers(sData || []);

    // 2. Fetch Standards Names
    const { data: stdData } = await supabase.from('time_standards').select('*');
    setStandards(stdData || []);
    setStandardNames([...new Set(stdData.map(d => d.name))].sort());

    // 3. Fetch Analyses
    const { data: aData } = await supabase.from('analyses').select('*');
    setAnalyses(aData || []);

    // 4. Fetch Results (Chunked)
    let allResults = [];
    let page = 0;
    let keepFetching = true;
    while (keepFetching) {
        setProgressMsg(`Fetching results ${page * 2000}...`);
        const { data: batch } = await supabase
          .from('results')
          .select('swimmer_id, event, time, date')
          .order('id', { ascending: true })
          .range(page * 2000, (page + 1) * 2000 - 1);
        
        if (!batch || batch.length === 0) keepFetching = false;
        else {
            allResults = [...allResults, ...batch];
            page++;
            if (allResults.length > 500000) keepFetching = false; 
        }
    }
    setResults(allResults);
    setLoading(false);
  };

  // --- SUB-COMPONENTS ---

  const QualifiersReport = () => {
      const [selectedStd, setSelectedStd] = useState(standardNames[0] || "");
      
      const data = useMemo(() => {
          if (!selectedStd) return [];
          const targetCuts = standards.filter(s => s.name === selectedStd);
          return swimmers.map(swimmer => {
              const myResults = results.filter(r => r.swimmer_id == swimmer.id);
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

              const qualified = [];
              const swimmerAge = swimmer.age || 0;
              const swimmerGender = (swimmer.gender || 'M').trim().toUpperCase();

              targetCuts.filter(c => {
                  return (c.gender.toUpperCase() === swimmerGender) && 
                         (c.age_max === 99 || (swimmerAge >= c.age_min && swimmerAge <= c.age_max));
              }).forEach(cut => {
                  const { dist, stroke } = parseEvent(cut.event);
                  const key = `${dist} ${stroke}`;
                  const myBest = myBestTimes[key];
                  if(myBest && myBest.val <= cut.time_seconds) {
                      if(!qualified.some(q => q.event === cut.event)) {
                          qualified.push({ event: cut.event, time: myBest.str, standard: cut.time_string });
                      }
                  }
              });
              return { ...swimmer, qualified };
          }).filter(s => s.qualified.length > 0).sort((a,b) => b.qualified.length - a.qualified.length);
      }, [selectedStd, swimmers, results, standards]);

      return (
          <div className="space-y-4">
              <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold">Qualifiers List</h3>
                  <select className="bg-white border p-2 rounded-lg text-sm" value={selectedStd} onChange={e => setSelectedStd(e.target.value)}>
                      {standardNames.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
              </div>
              <div className="grid gap-4">
                  {data.map(s => (
                      <div key={s.id} className="bg-white p-4 rounded-xl border shadow-sm">
                          <div className="flex justify-between mb-2">
                              <span className="font-bold text-slate-800">{s.name}</span>
                              <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded-full font-bold">{s.qualified.length} Cuts</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                              {s.qualified.map((q, i) => (
                                  <div key={i} className="flex justify-between text-slate-600 bg-slate-50 p-2 rounded">
                                      <span>{q.event}</span>
                                      <span className="font-mono text-emerald-600">{q.time}</span>
                                  </div>
                              ))}
                          </div>
                      </div>
                  ))}
                  {data.length === 0 && <div className="text-center py-10 text-slate-400">No qualifiers found.</div>}
              </div>
          </div>
      );
  };

  const BigMoversReport = () => {
      const data = useMemo(() => {
          return swimmers.map(swimmer => {
              const myResults = results.filter(r => r.swimmer_id == swimmer.id);
              const events = {};
              // Track first and best time for each event
              myResults.forEach(r => {
                  const { dist, stroke } = parseEvent(r.event);
                  if(!dist) return;
                  const key = `${dist} ${stroke}`;
                  const sec = timeToSeconds(r.time);
                  if(sec > 0 && sec < 9999) {
                      if(!events[key]) events[key] = { first: sec, best: sec, firstDate: r.date, bestDate: r.date };
                      else {
                          if (new Date(r.date) < new Date(events[key].firstDate)) events[key].first = sec;
                          if (sec < events[key].best) events[key].best = sec;
                      }
                  }
              });
              
              let totalDrop = 0;
              Object.values(events).forEach(e => {
                  if(e.first > e.best) totalDrop += (e.first - e.best);
              });
              return { ...swimmer, totalDrop };
          }).sort((a,b) => b.totalDrop - a.totalDrop).slice(0, 20); // Top 20
      }, [swimmers, results]);

      return (
          <div className="space-y-4">
              <h3 className="text-lg font-bold">Top 20 Time Droppers (Season Total)</h3>
              <div className="bg-white rounded-xl border overflow-hidden">
                  {data.map((s, i) => (
                      <div key={s.id} className="flex justify-between p-4 border-b last:border-0 items-center hover:bg-slate-50">
                          <div className="flex items-center gap-4">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${i<3 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>#{i+1}</div>
                              <div>
                                  <div className="font-bold text-slate-800">{s.name}</div>
                                  <div className="text-xs text-slate-500">{s.group_name}</div>
                              </div>
                          </div>
                          <div className="text-emerald-600 font-bold text-lg">-{s.totalDrop.toFixed(2)}s</div>
                      </div>
                  ))}
              </div>
          </div>
      );
  };

  const CloseCallsReport = () => {
      const [selectedStd, setSelectedStd] = useState(standardNames[0] || "");
      const data = useMemo(() => {
          if (!selectedStd) return [];
          const targetCuts = standards.filter(s => s.name === selectedStd);
          const misses = [];

          swimmers.forEach(swimmer => {
              const myResults = results.filter(r => r.swimmer_id == swimmer.id);
              const myBestTimes = {};
              myResults.forEach(r => {
                  const { dist, stroke } = parseEvent(r.event);
                  if(!dist) return;
                  const key = `${dist} ${stroke}`;
                  const sec = timeToSeconds(r.time);
                  if(sec > 0 && sec < 9999) {
                      if(!myBestTimes[key] || sec < myBestTimes[key].val) myBestTimes[key] = { val: sec, str: r.time };
                  }
              });

              const swimmerAge = swimmer.age || 0;
              const swimmerGender = (swimmer.gender || 'M').trim().toUpperCase();

              targetCuts.filter(c => {
                return (c.gender.toUpperCase() === swimmerGender) && 
                       (c.age_max === 99 || (swimmerAge >= c.age_min && swimmerAge <= c.age_max));
              }).forEach(cut => {
                  const { dist, stroke } = parseEvent(cut.event);
                  const key = `${dist} ${stroke}`;
                  const myBest = myBestTimes[key];
                  
                  if(myBest) {
                      const diff = myBest.val - cut.time_seconds;
                      // "Close Call" = Missed by less than 0.5 seconds
                      if(diff > 0 && diff <= 0.5) {
                          misses.push({
                              swimmerName: swimmer.name,
                              event: cut.event,
                              time: myBest.str,
                              cut: cut.time_string,
                              diff: diff.toFixed(2)
                          });
                      }
                  }
              });
          });
          return misses.sort((a,b) => a.diff - b.diff);
      }, [selectedStd, swimmers, results, standards]);

      return (
          <div className="space-y-4">
              <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold">Close Calls (Within 0.5s)</h3>
                  <select className="bg-white border p-2 rounded-lg text-sm" value={selectedStd} onChange={e => setSelectedStd(e.target.value)}>
                      {standardNames.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
              </div>
              <div className="grid grid-cols-1 gap-3">
                  {data.map((m, i) => (
                      <div key={i} className="bg-white p-3 rounded-xl border border-red-100 flex justify-between items-center shadow-sm">
                          <div>
                              <div className="font-bold text-slate-800">{m.swimmerName}</div>
                              <div className="text-xs text-slate-500">{m.event}</div>
                          </div>
                          <div className="text-right">
                              <div className="text-xs text-slate-400">Need {m.cut}</div>
                              <div className="font-bold text-red-500">+{m.diff}s</div>
                          </div>
                      </div>
                  ))}
                  {data.length === 0 && <div className="text-center py-10 text-slate-400">No close calls found.</div>}
              </div>
          </div>
      );
  };

  const FlawHeatmapReport = () => {
      const data = useMemo(() => {
          const counts = {};
          analyses.forEach(a => {
              if(a.json_data?.flaws) {
                  a.json_data.flaws.forEach(f => {
                      counts[f.title] = (counts[f.title] || 0) + 1;
                  });
              }
          });
          return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a,b) => b.count - a.count)
            .slice(0, 10);
      }, [analyses]);

      return (
          <div className="space-y-4">
              <h3 className="text-lg font-bold">Most Common Technical Flaws</h3>
              <div className="h-64 bg-white p-4 rounded-xl border">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 10}} />
                          <Tooltip />
                          <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>
      );
  };

  const GroupProgressionReport = () => {
      const data = useMemo(() => {
          const groupStats = {};
          
          swimmers.forEach(swimmer => {
              const group = swimmer.group_name || "Unassigned";
              if(!groupStats[group]) groupStats[group] = { totalDrop: 0, count: 0 };
              
              const myResults = results.filter(r => r.swimmer_id == swimmer.id);
              const events = {};
              myResults.forEach(r => {
                  const { dist, stroke } = parseEvent(r.event);
                  if(!dist) return;
                  const key = `${dist} ${stroke}`;
                  const sec = timeToSeconds(r.time);
                  if(sec > 0 && sec < 9999) {
                      if(!events[key]) events[key] = { first: sec, best: sec };
                      else {
                          // Simple logic: assume chronologically imported, or just max diff
                          if (sec < events[key].best) events[key].best = sec;
                          if (sec > events[key].first) events[key].first = sec; // Rough approx of 'first' as 'slowest'
                      }
                  }
              });
              
              let drop = 0;
              Object.values(events).forEach(e => { if(e.first > e.best) drop += (e.first - e.best); });
              
              if(drop > 0) {
                  groupStats[group].totalDrop += drop;
                  groupStats[group].count += 1;
              }
          });

          return Object.entries(groupStats).map(([name, stat]) => ({
              name,
              avgDrop: stat.count > 0 ? (stat.totalDrop / stat.count).toFixed(2) : 0
          })).sort((a,b) => b.avgDrop - a.avgDrop);
      }, [swimmers, results]);

      return (
          <div className="space-y-4">
              <h3 className="text-lg font-bold">Avg Time Drop by Group</h3>
              <div className="h-64 bg-white p-4 rounded-xl border">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" tick={{fontSize: 10}} />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="avgDrop" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>
      );
  };

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
            // MENU VIEW
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div onClick={() => { loadAllData(); setCurrentReport('qualifiers'); }} className="bg-white p-6 rounded-2xl border hover:border-blue-400 cursor-pointer shadow-sm hover:shadow-md transition-all group">
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Trophy size={24}/></div>
                    <h3 className="font-bold text-lg text-slate-800">Qualifiers List</h3>
                    <p className="text-slate-500 text-sm mt-1">See who made the cut for Champs, Sectionals, etc.</p>
                </div>

                <div onClick={() => { loadAllData(); setCurrentReport('movers'); }} className="bg-white p-6 rounded-2xl border hover:border-emerald-400 cursor-pointer shadow-sm hover:shadow-md transition-all group">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><TrendingUp size={24}/></div>
                    <h3 className="font-bold text-lg text-slate-800">Big Movers</h3>
                    <p className="text-slate-500 text-sm mt-1">Leaderboard of total time dropped this season.</p>
                </div>

                <div onClick={() => { loadAllData(); setCurrentReport('closecalls'); }} className="bg-white p-6 rounded-2xl border hover:border-orange-400 cursor-pointer shadow-sm hover:shadow-md transition-all group">
                    <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Target size={24}/></div>
                    <h3 className="font-bold text-lg text-slate-800">Close Calls</h3>
                    <p className="text-slate-500 text-sm mt-1">Swimmers within 0.5s of a new standard.</p>
                </div>

                <div onClick={() => { loadAllData(); setCurrentReport('heatmap'); }} className="bg-white p-6 rounded-2xl border hover:border-rose-400 cursor-pointer shadow-sm hover:shadow-md transition-all group">
                    <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Activity size={24}/></div>
                    <h3 className="font-bold text-lg text-slate-800">Flaw Heatmap</h3>
                    <p className="text-slate-500 text-sm mt-1">Most common technical errors detected by AI.</p>
                </div>

                <div onClick={() => { loadAllData(); setCurrentReport('groups'); }} className="bg-white p-6 rounded-2xl border hover:border-purple-400 cursor-pointer shadow-sm hover:shadow-md transition-all group">
                    <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Users size={24}/></div>
                    <h3 className="font-bold text-lg text-slate-800">Group Progression</h3>
                    <p className="text-slate-500 text-sm mt-1">Average improvement per training group.</p>
                </div>
            </div>
        ) : (
            // REPORT VIEW
            <div>
                <button onClick={() => setCurrentReport(null)} className="text-sm text-blue-600 font-bold mb-4 flex items-center gap-1 hover:underline">
                    <ArrowRight className="rotate-180" size={16}/> Back to Menu
                </button>

                {currentReport === 'qualifiers' && <QualifiersReport />}
                {currentReport === 'movers' && <BigMoversReport />}
                {currentReport === 'closecalls' && <CloseCallsReport />}
                {currentReport === 'heatmap' && <FlawHeatmapReport />}
                {currentReport === 'groups' && <GroupProgressionReport />}
            </div>
        )}
    </div>
  );
}
