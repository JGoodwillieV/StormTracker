// src/Reports.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Trophy, ChevronLeft, FileText, Filter, Loader2, AlertCircle } from 'lucide-react';

export default function Reports({ onBack }) {
  const [loading, setLoading] = useState(false);
  const [standardNames, setStandardNames] = useState([]);
  const [selectedStandard, setSelectedStandard] = useState("");
  const [qualifiers, setQualifiers] = useState([]);
  const [debugStats, setDebugStats] = useState({ s: 0, r: 0, c: 0 });

  // --- HELPERS ---
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

  const normalizeEventName = (evt) => {
    if (!evt) return "";
    
    // 1. Remove parentheses content (e.g. "(10 & Under)", "(Finals)")
    const cleanString = evt.replace(/\(.*\)/g, '').trim(); 

    // 2. Extract Distance and Stroke
    const match = cleanString.match(/(\d+)\s*(?:M|Y)?\s*(Freestyle|Free|Backstroke|Back|Breaststroke|Breast|Butterfly|Fly|Individual\s*Medley|IM)/i);
    
    if (match) {
        const dist = match[1];
        let stroke = match[2].toLowerCase();
        
        if (stroke === 'free') stroke = 'freestyle';
        if (stroke === 'back') stroke = 'backstroke';
        if (stroke === 'breast') stroke = 'breaststroke';
        if (stroke === 'fly') stroke = 'butterfly';
        if (stroke === 'individual medley') stroke = 'im'; 
        
        if (stroke === 'im') return `${dist} im`;
        return `${dist} ${stroke}`;
    }
    return evt.toLowerCase();
  };

  // --- 1. FETCH STANDARD NAMES ---
  useEffect(() => {
    const fetchStandardsList = async () => {
      const { data } = await supabase.from('time_standards').select('name');
      if (data) {
        const unique = [...new Set(data.map(d => d.name))].sort();
        setStandardNames(unique);
        // Default: Try to find a middle-ground standard, or just the first one
        if (unique.includes('BB')) setSelectedStandard('BB');
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
      setQualifiers([]);

      // A. Fetch Data
      const { data: swimmers } = await supabase.from('swimmers').select('*');
      const { data: results } = await supabase.from('results').select('*').range(0, 9999);
      const { data: cuts } = await supabase.from('time_standards').select('*').eq('name', selectedStandard);

      if (!swimmers || !results || !cuts) {
          setLoading(false);
          return;
      }
      
      setDebugStats({ s: swimmers.length, r: results.length, c: cuts.length });

      // B. Process Each Swimmer
      const qualifiedList = [];

      swimmers.forEach(swimmer => {
        // 1. Get this swimmer's results
        const myResults = results.filter(r => r.swimmer_id == swimmer.id);
        
        // 2. Find their BEST time for every event they swam
        const myBestTimes = {}; // Key: "100 freestyle" -> { val: 55.5, str: "55.50" }
        
        myResults.forEach(r => {
            const norm = normalizeEventName(r.event);
            const sec = timeToSeconds(r.time);
            
            if (sec > 0 && sec < 999999) {
                if (!myBestTimes[norm] || sec < myBestTimes[norm].val) {
                    myBestTimes[norm] = { val: sec, str: r.time, date: r.date };
                }
            }
        });

        // 3. Filter standards relevant to THIS swimmer (Age/Gender)
        const swimmerGender = (swimmer.gender || 'M').toUpperCase();
        const swimmerAge = swimmer.age || 99; // Default to Open if unknown

        const myRelevantCuts = cuts.filter(c => {
            const genderMatch = c.gender.toUpperCase() === swimmerGender;
            const ageMatch = swimmerAge >= c.age_min && swimmerAge <= c.age_max;
            return genderMatch && ageMatch;
        });

        // 4. Check for Qualifiers
        const myQualifyingEvents = [];

        myRelevantCuts.forEach(cut => {
            const cutEventNorm = normalizeEventName(cut.event);
            const myBest = myBestTimes[cutEventNorm];

            if (myBest && myBest.val <= cut.time_seconds) {
                 // Avoid duplicates (e.g. SCY vs LCM matching same normalized name)
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

      // Sort list by most qualifiers
      qualifiedList.sort((a, b) => b.events.length - a.events.length);

      setQualifiers(qualifiedList);
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
            <p>Scanning {debugStats.r > 0 ? debugStats.r : 'all'} results...</p>
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
                    <p className="text-xs mt-2 text-slate-300 font-mono">
                        Debug: Scanned {debugStats.s} swimmers, {debugStats.r} results, {debugStats.c} cuts.
                    </p>
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
        </div>
      )}
    </div>
  );
}
