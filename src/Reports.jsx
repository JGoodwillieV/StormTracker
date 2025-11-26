// src/Reports.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabase';
import { Trophy, ChevronLeft, FileText, Filter, CheckCircle, Loader2, Download } from 'lucide-react';

export default function Reports({ onBack }) {
  const [loading, setLoading] = useState(false);
  const [standardNames, setStandardNames] = useState([]);
  const [selectedStandard, setSelectedStandard] = useState("");
  const [qualifiers, setQualifiers] = useState([]);

  // --- HELPERS ---
  const timeToSeconds = (t) => {
    if (!t) return 999999;
    if (['DQ', 'NS', 'DFS', 'SCR'].some(s => t.toUpperCase().includes(s))) return 999999;
    const parts = t.replace(/[A-Z]/g, '').trim().split(':');
    return parts.length === 2 
      ? parseInt(parts[0]) * 60 + parseFloat(parts[1]) 
      : parseFloat(parts[0]);
  };

  const normalizeEventName = (evt) => {
    if (!evt) return "";
    const match = evt.match(/(\d+)\s*(?:M|Y)?\s*(Freestyle|Free|Backstroke|Back|Breaststroke|Breast|Butterfly|Fly|Individual\s*Medley|IM)/i);
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
      // We fetch all to get unique names. 
      // (Supabase doesn't have a distinct() helper easily accessible on client, so we fetch "name" and dedup in JS)
      const { data } = await supabase.from('time_standards').select('name');
      if (data) {
        const unique = [...new Set(data.map(d => d.name))].sort();
        setStandardNames(unique);
        // Default to a high-level one if available, else the first one
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
      setQualifiers([]);

      // A. Fetch Everything (Roster, Results, Specific Standards)
      // In a larger app, you'd filter this more server-side, but for ~100 swimmers this is fast.
      const { data: swimmers } = await supabase.from('swimmers').select('*');
      const { data: results } = await supabase.from('results').select('*');
      const { data: cuts } = await supabase.from('time_standards').select('*').eq('name', selectedStandard);

      if (!swimmers || !results || !cuts) {
          setLoading(false);
          return;
      }

      // B. Process Each Swimmer
      const qualifiedList = [];

      swimmers.forEach(swimmer => {
        const myResults = results.filter(r => r.swimmer_id === swimmer.id);
        const myQualifyingEvents = [];

        // Group my best times by event
        const myBestTimes = {};
        myResults.forEach(r => {
            const norm = normalizeEventName(r.event);
            const sec = timeToSeconds(r.time);
            if (sec > 0 && sec < 999999) {
                if (!myBestTimes[norm] || sec < myBestTimes[norm].val) {
                    myBestTimes[norm] = { val: sec, str: r.time, date: r.date };
                }
            }
        });

        // Check against cuts
        // Filter cuts relevant to this swimmer's age and gender
        const relevantCuts = cuts.filter(c => 
            c.gender === (swimmer.gender || 'M') && 
            swimmer.age >= c.age_min && 
            swimmer.age <= c.age_max
        );

        relevantCuts.forEach(cut => {
            const cutEventNorm = normalizeEventName(cut.event);
            const myBest = myBestTimes[cutEventNorm];

            if (myBest && myBest.val <= cut.time_seconds) {
                myQualifyingEvents.push({
                    event: cut.event,
                    time: myBest.str,
                    date: myBest.date,
                    standard: cut.time_string,
                    diff: (myBest.val - cut.time_seconds).toFixed(2)
                });
            }
        });

        if (myQualifyingEvents.length > 0) {
            qualifiedList.push({
                ...swimmer,
                events: myQualifyingEvents.sort((a, b) => new Date(b.date) - new Date(a.date))
            });
        }
      });

      // Sort by number of qualifying events (most first), then name
      qualifiedList.sort((a, b) => {
          if (b.events.length !== a.events.length) return b.events.length - a.events.length;
          return a.name.localeCompare(b.name);
      });

      setQualifiers(qualifiedList);
      setLoading(false);
    };

    runReport();
  }, [selectedStandard]);

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

        {/* Filter Controls */}
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

      {/* Loading State */}
      {loading && (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400 animate-pulse">
            <Loader2 size={40} className="animate-spin mb-4 text-blue-500"/>
            <p>Scanning all results for qualifiers...</p>
        </div>
      )}

      {/* Results List */}
      {!loading && (
        <div className="space-y-6">
            {/* Summary Card */}
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
                    No swimmers have achieved this standard yet.
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {qualifiers.map(swimmer => (
                        <div key={swimmer.id} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">{swimmer.name}</h3>
                                    <p className="text-slate-500 text-sm">{swimmer.age} Years Old • {swimmer.gender} • {swimmer.group_name}</p>
                                </div>
                                <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full">
                                    {swimmer.events.length} Events
                                </span>
                            </div>
                            
                            {/* Events Grid */}
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
