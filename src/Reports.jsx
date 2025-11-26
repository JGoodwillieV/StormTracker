// src/Reports.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { 
  Trophy, ChevronLeft, FileText, Filter, Loader2, AlertCircle, CheckCircle2, XCircle, 
  TrendingUp, Activity, Users, Target, ArrowRight
} from 'lucide-react';

export default function Reports({ onBack }) {
  const [currentReport, setCurrentReport] = useState(null);

  const renderReport = () => {
    switch (currentReport) {
      case 'qualifiers': return <QualifiersReport onBack={() => setCurrentReport(null)} />;
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

            {/* 2. BIG MOVERS */}
            <div onClick={() => setCurrentReport('movers')} className="bg-white p-6 rounded-2xl border hover:border-emerald-400 cursor-pointer shadow-sm hover:shadow-md transition-all group">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><TrendingUp size={24}/></div>
                <h3 className="font-bold text-lg text-slate-800">Big Movers</h3>
                <p className="text-slate-500 text-sm mt-1">Leaderboard of total time dropped this season.</p>
            </div>

            {/* 3. CLOSE CALLS */}
            <div onClick={() => setCurrentReport('closecalls')} className="bg-white p-6 rounded-2xl border hover:border-orange-400 cursor-pointer shadow-sm hover:shadow-md transition-all group">
                <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Target size={24}/></div>
                <h3 className="font-bold text-lg text-slate-800">Close Calls</h3>
                <p className="text-slate-500 text-sm mt-1">Swimmers within 0.5s of a new standard.</p>
            </div>

            {/* 4. FLAW HEATMAP */}
            <div onClick={() => setCurrentReport('heatmap')} className="bg-white p-6 rounded-2xl border hover:border-rose-400 cursor-pointer shadow-sm hover:shadow-md transition-all group">
                <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Activity size={24}/></div>
                <h3 className="font-bold text-lg text-slate-800">Flaw Heatmap</h3>
                <p className="text-slate-500 text-sm mt-1">Most common technical errors detected by AI.</p>
            </div>

            {/* 5. GROUPS */}
            <div onClick={() => setCurrentReport('groups')} className="bg-white p-6 rounded-2xl border hover:border-purple-400 cursor-pointer shadow-sm hover:shadow-md transition-all group">
                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Users size={24}/></div>
                <h3 className="font-bold text-lg text-slate-800">Group Progression</h3>
                <p className="text-slate-500 text-sm mt-1">Average improvement per training group.</p>
            </div>
        </div>
    </div>
  );
}

// --- SUB-COMPONENTS ---

// 1. QUALIFIERS REPORT (Using the EXACT logic from your "Working" version)
const QualifiersReport = ({ onBack }) => {
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [standardNames, setStandardNames] = useState([]);
  const [selectedStandard, setSelectedStandard] = useState("");
  const [rows, setRows] = useState([]);
  const [showQualifiersOnly, setShowQualifiersOnly] = useState(true);
  
  // --- HELPERS ---
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

  const parseEvent = (evt) => {
    if (!evt) return { dist: '', stroke: '' };
    
    // 1. Remove content in parentheses
    let clean = evt.toLowerCase().replace(/\(.*?\)/g, '');
    
    // 2. Remove "X & Over", "X & Under", "X-Y" age groups
    clean = clean.replace(/\d+\s*&\s*(over|under)/g, '');
    clean = clean.replace(/\b\d{1,2}-\d{1,2}\b/g, ''); 

    // 3. Find standard swimming distances
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

      // A. Fetch Data
      const { data: swimmers } = await supabase.from('swimmers').select('*');
      const { data: cuts } = await supabase.from('time_standards').select('*').eq('name', selectedStandard);

      let allResults = [];
      let page = 0;
      const pageSize = 2000;
      let keepFetching = true;
      while (keepFetching) {
          setProgressMsg(`Scanning database... (${page * pageSize} records)`);
          const { data: batch, error } = await supabase
            .from('results')
            .select('swimmer_id, event, time, date')
            .range(page * pageSize, (page + 1) * pageSize - 1);
          
          if (error || !batch || batch.length === 0) {
              keepFetching = false;
          } else {
              allResults = [...allResults, ...batch];
              page++;
              if (allResults.length > 50000) keepFetching = false;
          }
      }

      if (!swimmers || !cuts) {
          setLoading(false);
          return;
      }

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
                    myBestTimes[key] = { val: sec, str: r.time, date: r.date, original: r.event };
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

// --- PLACEHOLDERS FOR OTHER REPORTS ---
const BigMoversReport = ({ onBack }) => <div className="p-8"><button onClick={onBack} className="text-blue-600 font-bold mb-4">&larr; Back</button><div className="text-center text-slate-400 py-12">Big Movers Report Coming Soon...</div></div>;
const CloseCallsReport = ({ onBack }) => <div className="p-8"><button onClick={onBack} className="text-blue-600 font-bold mb-4">&larr; Back</button><div className="text-center text-slate-400 py-12">Close Calls Report Coming Soon...</div></div>;
const FlawHeatmapReport = ({ onBack }) => <div className="p-8"><button onClick={onBack} className="text-blue-600 font-bold mb-4">&larr; Back</button><div className="text-center text-slate-400 py-12">Heatmap Report Coming Soon...</div></div>;
const GroupProgressionReport = ({ onBack }) => <div className="p-8"><button onClick={onBack} className="text-blue-600 font-bold mb-4">&larr; Back</button><div className="text-center text-slate-400 py-12">Group Progression Report Coming Soon...</div></div>;
