// src/Reports.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Trophy, ChevronLeft, FileText, Filter, Loader2, AlertCircle, Bug, CheckCircle2, XCircle } from 'lucide-react';

export default function Reports({ onBack }) {
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [standardNames, setStandardNames] = useState([]);
  const [selectedStandard, setSelectedStandard] = useState("");
  const [rows, setRows] = useState([]);
  const [showQualifiersOnly, setShowQualifiersOnly] = useState(true);
  
  // DEBUG TOOLS
  const [debugName, setDebugName] = useState("");
  const [debugLog, setDebugLog] = useState(null);

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
    
    // Non-greedy remove of parens
    const clean = evt.replace(/\(.*?\)/g, '').trim().toLowerCase(); 
    const match = clean.match(/(\d+)\s*(?:M|Y)?\s*(.*)/);
    
    if (match) {
        let stroke = match[2];
        if (stroke.includes('free')) stroke = 'free';
        else if (stroke.includes('back')) stroke = 'back';
        else if (stroke.includes('breast')) stroke = 'breast';
        else if (stroke.includes('fly') || stroke.includes('butter')) stroke = 'fly';
        else if (stroke.includes('im') || stroke.includes('medley')) stroke = 'im';
        
        return { dist: match[1], stroke: stroke.trim() };
    }
    return { dist: '', stroke: clean };
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
      setDebugLog(null);

      // A. Fetch Data
      const { data: swimmers } = await supabase.from('swimmers').select('*');
      const { data: cuts } = await supabase.from('time_standards').select('*').eq('name', selectedStandard);

      let allResults = [];
      let page = 0;
      const pageSize = 2000;
      let keepFetching = true;
      
      // FIX: Added .order('id') to guarantee consistent pagination
      while (keepFetching) {
          setProgressMsg(`Fetching results ${page * pageSize}...`);
          const { data: batch, error } = await supabase
            .from('results')
            .select('swimmer_id, event, time, date')
            .order('id', { ascending: true }) 
            .range(page * pageSize, (page + 1) * pageSize - 1);
          
          if (error || !batch || batch.length === 0) {
              keepFetching = false;
          } else {
              allResults = [...allResults, ...batch];
              page++;
              if (allResults.length > 100000) keepFetching = false; // Increased limit
          }
      }

      if (!swimmers || !cuts) {
          setLoading(false);
          return;
      }

      setProgressMsg("Analyzing data...");
      const processedList = [];
      let debugTarget = null;

      swimmers.forEach((swimmer) => {
        const myResults = allResults.filter(r => r.swimmer_id == swimmer.id);
        const myBestTimes = {}; 
        const history = []; 

        myResults.forEach(r => {
            const { dist, stroke } = parseEvent(r.event);
            if (!dist || !stroke) return;

            const key = `${dist} ${stroke}`; 
            const sec = timeToSeconds(r.time);
            
            // Store debug info
            if (debugName && swimmer.name.toLowerCase().includes(debugName.toLowerCase())) {
                 history.push({ event: r.event, parsed: key, time: r.time, sec });
            }

            if (sec > 0 && sec < 999999) {
                if (!myBestTimes[key] || sec < myBestTimes[key].val) {
                    myBestTimes[key] = { val: sec, str: r.time, date: r.date, original: r.event };
                }
            }
        });

        const swimmerAge = parseInt(swimmer.age) || 0; 
        const swimmerGender = (swimmer.gender || 'M').trim().toUpperCase();

        if (debugName && swimmer.name.toLowerCase().includes(debugName.toLowerCase())) {
             debugTarget = {
                name: swimmer.name,
                age: swimmerAge,
                gender: swimmerGender,
                totalResultsFound: myResults.length,
                bestTimes: myBestTimes,
                history: history.slice(-20), // Show last 20 scanned
                rejections: []
             };
        }

        const myRelevantCuts = cuts.filter(c => {
            const cutGender = c.gender.trim().toUpperCase();
            const genderMatch = cutGender === swimmerGender;
            const ageMatch = (c.age_max === 99) || (swimmerAge >= c.age_min && swimmerAge <= c.age_max);
            
            if (debugTarget && debugTarget.name === swimmer.name && !genderMatch) {
                 if (debugTarget.rejections.length < 3) debugTarget.rejections.push(`Gender Mismatch: Swim(${swimmerGender}) vs Cut(${cutGender})`);
            }
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
                // Use epsilon for float comparison
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
      if (debugTarget) setDebugLog(debugTarget);
      setLoading(false);
    };

    runReport();
  }, [selectedStandard, debugName]); 

  const displayedRows = showQualifiersOnly ? rows.filter(r => r.isQualified) : rows;

  return (
    <div className="p-4 md:p-8 h-full overflow-y-auto bg-[#f8fafc]">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="text-blue-600" /> Team Reports
            </h2>
            <p className="text-slate-500">Championship Qualifier List</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
            <Filter size={16} className="text-slate-400 ml-2"/>
            <select 
                value={selectedStandard} 
                onChange={(e) => setSelectedStandard(e.target.value)}
                className="bg-transparent font-bold text-slate-700 text-sm outline-none min-w-[150px]"
            >
                {standardNames.map(name => (
                    <option key={name} value={name}>{name} Standard</option>
                ))}
            </select>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1">
              <Bug size={14} className="text-slate-400"/>
              <input 
                type="text" 
                placeholder="Debug Swimmer Name..." 
                value={debugName}
                onChange={(e) => setDebugName(e.target.value)}
                className="bg-transparent text-xs outline-none w-32"
              />
          </div>

          <label className="flex items-center gap-2 text-sm font-bold text-slate-600 cursor-pointer select-none">
              <input 
                  type="checkbox" 
                  checked={showQualifiersOnly} 
                  onChange={() => setShowQualifiersOnly(!showQualifiersOnly)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              Show Qualifiers Only
          </label>
      </div>

      {loading && (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400 animate-pulse">
            <Loader2 size={40} className="animate-spin mb-4 text-blue-500"/>
            <p>{progressMsg || "Processing..."}</p>
        </div>
      )}

      {!loading && (
        <div className="space-y-6">
             {/* DEBUG PANEL */}
             {debugLog && (
                <div className="p-4 bg-slate-900 text-slate-400 rounded-xl font-mono text-xs mb-6 border-l-4 border-yellow-500 shadow-lg max-h-96 overflow-y-auto">
                    <h4 className="text-white font-bold mb-2 flex items-center gap-2"><Bug size={14}/> Debug Analysis: {debugLog.name}</h4>
                    <p>Swimmer Data: {debugLog.gender}, Age {debugLog.age}</p>
                    <p>Total Results for Swimmer: {debugLog.totalResultsFound}</p>
                    
                    <div className="mt-2 border-t border-slate-700 pt-2">
                        <strong className="text-yellow-400">Latest 20 Parsed Events:</strong>
                        <ul className="space-y-1 mt-1">
                            {debugLog.history.slice(-20).map((h, i) => (
                                <li key={i} className="flex flex-col border-b border-slate-800 pb-1">
                                    <span>{h.event}</span>
                                    <span className="text-blue-400">Parsed: {h.parsed} ({h.sec}s)</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="mt-4 pt-2 border-t border-slate-700">
                        <strong className="text-green-400">Final Best Times Selected:</strong>
                        <pre className="mt-1 bg-black/30 p-2 rounded">{JSON.stringify(debugLog.bestTimes, null, 2)}</pre>
                    </div>
                </div>
            )}

            <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-6 text-white shadow-lg flex justify-between items-center">
                <div>
                    <h3 className="text-3xl font-bold">{rows.filter(r => r.isQualified).length}</h3>
                    <p className="text-blue-100 text-sm font-medium">Swimmers Qualified for {selectedStandard}</p>
                </div>
                <div className="bg-white/10 p-3 rounded-xl">
                    <Trophy size={32} className="text-yellow-300"/>
                </div>
            </div>

            {displayedRows.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                    <div className="mb-2 flex justify-center"><AlertCircle size={32} className="text-slate-300"/></div>
                    <p>No swimmers match criteria.</p>
                </div>
            ) : (
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
                                {swimmer.isQualified && (
                                    <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full">
                                        {swimmer.events.length} Events
                                    </span>
                                )}
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
                                        <span className="font-mono text-red-600">
                                            {swimmer.closestMiss.time} (Cut: {swimmer.closestMiss.standard}) 
                                            <span className="ml-2 font-bold">+{swimmer.closestMiss.diff}s</span>
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
      )}
    </div>
  );
}
