// src/Reports.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Trophy, ChevronLeft, FileText, Filter, Loader2, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

export default function Reports({ onBack }) {
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [standardNames, setStandardNames] = useState([]);
  const [selectedStandard, setSelectedStandard] = useState("");
  const [rows, setRows] = useState([]);
  const [showQualifiersOnly, setShowQualifiersOnly] = useState(true);

  // --- SHARED HELPERS (MATCHING SWIMMER PROFILE EXACTLY) ---
  
  // 1. Event Normalizer
  // Converts "Male (11-12) 100 Free (Finals)" -> "100 Freestyle"
  const getBaseEventName = (eventName) => {
    if (!eventName) return "";
    // Remove (Finals), (Prelims), (Age Groups)
    let clean = eventName.replace(/\s*\((.*?)\)/g, '').trim(); 
    
    // Regex to find "100" + "Stroke"
    const match = clean.match(/(\d+)\s*(?:M|Y)?\s*(Free|Back|Breast|Fly|IM|Freestyle|Backstroke|Breaststroke|Butterfly|Ind\.?\s*Medley)/i);
    
    if (match) {
        const dist = match[1];
        let stroke = match[2].toLowerCase();
        
        // Normalize to full names to match DB standards
        if (stroke.startsWith('free')) stroke = 'Freestyle';
        else if (stroke.startsWith('back')) stroke = 'Backstroke';
        else if (stroke.startsWith('breast')) stroke = 'Breaststroke';
        else if (stroke.startsWith('fly') || stroke.startsWith('butter')) stroke = 'Butterfly';
        else if (stroke.startsWith('im') || stroke.startsWith('ind')) stroke = 'IM'; // DB uses "200 IM" typically
        
        return `${dist} ${stroke}`;
    }
    return clean.trim();
  };

  // 2. Time Parser
  const timeToSeconds = (timeStr) => {
    if (!timeStr) return 999999;
    if (['DQ', 'NS', 'DFS', 'SCR', 'DNF'].some(s => timeStr.toUpperCase().includes(s))) return 999999;
    
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

  // --- 1. FETCH STANDARD NAMES ---
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

  // --- 2. CALCULATE QUALIFIERS ---
  useEffect(() => {
    const runReport = async () => {
      if (!selectedStandard) return;
      setLoading(true);
      setRows([]);

      // A. Fetch Data
      const { data: swimmers } = await supabase.from('swimmers').select('*');
      const { data: cuts } = await supabase.from('time_standards').select('*').eq('name', selectedStandard);

      // B. Fetch ALL Results (Chunked Loop)
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

      setProgressMsg("Processing qualifiers...");
      const processedList = [];

      swimmers.forEach((swimmer) => {
        const myResults = allResults.filter(r => r.swimmer_id == swimmer.id);
        const myBestTimes = {}; 
        
        // 1. Find Best Time per Normalized Event
        myResults.forEach(r => {
            const normEvent = getBaseEventName(r.event); // "100 Freestyle"
            if (!normEvent) return;

            const sec = timeToSeconds(r.time);
            
            if (sec > 0 && sec < 999999) {
                // Keep the fastest time found for this event
                if (!myBestTimes[normEvent] || sec < myBestTimes[normEvent].val) {
                    myBestTimes[normEvent] = { val: sec, str: r.time, date: r.date };
                }
            }
        });

        // 2. Filter Standards for this Swimmer
        const swimmerAge = swimmer.age || 0; 
        const swimmerGender = (swimmer.gender || 'M').trim().toUpperCase();

        const myRelevantCuts = cuts.filter(c => {
            const cutGender = c.gender.trim().toUpperCase();
            if (cutGender !== swimmerGender) return false;
            if (c.age_max === 99) return true; 
            return swimmerAge >= c.age_min && swimmerAge <= c.age_max;
        });

        // 3. Check Matches
        const myQualifyingEvents = [];
        let closestMiss = null; 

        myRelevantCuts.forEach(cut => {
            // We assume the Cut Event Name in DB is already "Clean" (e.g. "100 Freestyle")
            // But we run it through normalizer just in case to match keys
            const cutKey = getBaseEventName(cut.event); 
            const myBest = myBestTimes[cutKey];

            if (myBest) {
                const diff = myBest.val - cut.time_seconds;
                
                // Use a small epsilon for float comparison safety, or just <=
                if (diff <= 0.00001) { 
                     // Prevent duplicates if multiple standards map to same event key
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
                    // Track closest miss
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

      // Sort: Most qualified events at top
      processedList.sort((a, b) => {
          if (a.isQualified !== b.isQualified) return a.isQualified ? -1 : 1;
          if (a.events.length !== b.events.length) return b.events.length - a.events.length;
          return a.name.localeCompare(b.name);
      });

      setRows(processedList);
      setLoading(false);
    };

    runReport();
  }, [selectedStandard]);

  const displayedRows = showQualifiersOnly ? rows.filter(r => r.isQualified) : rows;

  return (
    <div className="p-4 md:p-8 h-full overflow-y-auto bg-[#f8fafc]">
      {/* Header */}
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

      {/* Filter Toggle */}
      <div className="flex justify-end mb-4">
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
            {/* Summary Card */}
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
                            
                            {/* QUALIFIED EVENTS */}
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

                            {/* MISSED CUT DETAILS */}
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
