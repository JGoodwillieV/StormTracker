// src/Reports.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Trophy, ChevronLeft, FileText, Filter, Loader2, AlertCircle, Bug } from 'lucide-react';

export default function Reports({ onBack }) {
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [standardNames, setStandardNames] = useState([]);
  const [selectedStandard, setSelectedStandard] = useState("");
  const [qualifiers, setQualifiers] = useState([]);
  const [debugLog, setDebugLog] = useState(null);

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
      setQualifiers([]);
      setDebugLog(null);

      // 1. Fetch Data
      const { data: swimmers } = await supabase.from('swimmers').select('*');
      const { data: cuts } = await supabase.from('time_standards').select('*').eq('name', selectedStandard);

      // Fetch ALL results
      let allResults = [];
      let page = 0;
      const pageSize = 2000;
      let keepFetching = true;
      while (keepFetching) {
          setProgressMsg(`Fetching results ${page * pageSize}...`);
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
      const qualifiedList = [];
      let debugData = null;

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

        const swimmerAge = swimmer.age || 0; 
        const swimmerGender = (swimmer.gender || 'M').trim().toUpperCase();

        // DEEP DEBUG: Capture mismatch reasons for the first swimmer
        const debugReasons = [];
        
        const myRelevantCuts = cuts.filter(c => {
            const cutGender = c.gender.trim().toUpperCase();
            const genderMatch = cutGender === swimmerGender;
            
            // Loose Age Match: 
            // If standard is Open (0-99) or Junior (0-18), adapt logic
            const ageMatch = swimmerAge >= c.age_min && swimmerAge <= c.age_max;
            
            // Debugging Sample (Only for first few checks of first swimmer)
            if (!debugData && debugReasons.length < 5) {
                if (!genderMatch) debugReasons.push(`Gender Mismatch: Swim(${swimmerGender}) vs Cut(${cutGender})`);
                else if (!ageMatch) debugReasons.push(`Age Mismatch: Swim(${swimmerAge}) vs Cut(${c.age_min}-${c.age_max})`);
            }

            return genderMatch && ageMatch;
        });

        if (!debugData && myResults.length > 0) {
             debugData = {
                name: swimmer.name,
                standardSelected: selectedStandard,
                gender: swimmerGender,
                age: swimmerAge,
                totalCutsInDB: cuts.length,
                cutsMatchingProfile: myRelevantCuts.length,
                rejections: debugReasons,
                bestTimes: myBestTimes
            };
        }

        const myQualifyingEvents = [];
        myRelevantCuts.forEach(cut => {
            const { dist, stroke } = parseEvent(cut.event);
            const key = `${dist} ${stroke}`;
            const myBest = myBestTimes[key];

            if (myBest && myBest.val <= cut.time_seconds) {
                 if (!myQualifyingEvents.some(e => e.event === cut.event)) {
                    myQualifyingEvents.push({
                        event: cut.event,
                        time: myBest.str,
                        date: myBest.date,
                        standard: cut.time_string,
                        diff: (myBest.val - cut.time_seconds).toFixed(2)
                    });
                 }
            }
        });

        if (myQualifyingEvents.length > 0) {
            qualifiedList.push({
                ...swimmer,
                events: myQualifyingEvents.sort((a, b) => new Date(b.date) - new Date(a.date))
            });
        }
      });

      qualifiedList.sort((a, b) => b.events.length - a.events.length);
      setQualifiers(qualifiedList);
      setDebugLog(debugData);
      setLoading(false);
    };

    runReport();
  }, [selectedStandard]);

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

      {loading && (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400 animate-pulse">
            <Loader2 size={40} className="animate-spin mb-4 text-blue-500"/>
            <p>{progressMsg || "Processing..."}</p>
        </div>
      )}

      {!loading && (
        <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-6 text-white shadow-lg flex justify-between items-center">
                <div>
                    <h3 className="text-3xl font-bold">{qualifiers.length}</h3>
                    <p className="text-blue-100 text-sm font-medium">Swimmers Qualified for {selectedStandard}</p>
                </div>
                <div className="bg-white/10 p-3 rounded-xl">
                    <Trophy size={32} className="text-yellow-300"/>
                </div>
            </div>

            {qualifiers.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                    <div className="mb-2 flex justify-center"><AlertCircle size={32} className="text-slate-300"/></div>
                    <p>No swimmers found for this standard.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {qualifiers.map(swimmer => (
                        <div key={swimmer.id} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">{swimmer.name}</h3>
                                    <p className="text-slate-500 text-sm">{swimmer.age || '?'} Years Old • {swimmer.gender} • {swimmer.group_name}</p>
                                </div>
                                <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full">
                                    {swimmer.events.length} Events
                                </span>
                            </div>
                            
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
                        </div>
                    ))}
                </div>
            )}

            {/* DEEP DEBUG PANEL */}
            {debugLog && (
                <div className="p-4 bg-slate-900 text-slate-400 rounded-xl font-mono text-xs mt-8">
                    <h4 className="text-white font-bold mb-2 flex items-center gap-2"><Bug size={14}/> Deep Debug: {debugLog.name}</h4>
                    <p>Selected Standard: {debugLog.standardSelected}</p>
                    <p>Swimmer Info: {debugLog.gender}, Age {debugLog.age}</p>
                    <p>Total Cuts in DB for this Standard: {debugLog.totalCutsInDB}</p>
                    <p>Cuts Matching Profile (Age/Gender): {debugLog.cutsMatchingProfile}</p>
                    
                    {debugLog.rejections.length > 0 && (
                        <div className="mt-2 text-red-400">
                            <strong>Why were cuts rejected?</strong>
                            <ul className="list-disc pl-4">
                                {debugLog.rejections.map((r, i) => <li key={i}>{r}</li>)}
                            </ul>
                        </div>
                    )}

                    <div className="mt-2">
                        <strong className="text-slate-500">My Best Times:</strong>
                        <pre>{JSON.stringify(debugLog.bestTimes, null, 2)}</pre>
                    </div>
                </div>
            )}
        </div>
      )}
    </div>
  );
}
