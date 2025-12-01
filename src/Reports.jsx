// src/Reports.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabase';
import { 
  Trophy, ChevronLeft, FileText, Filter, Loader2, AlertCircle, CheckCircle2, XCircle, 
  TrendingUp, Activity, Users, Target, ArrowRight, Layers, Database, Clock, Zap,
  ChevronDown, Search, User
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

// Stroke order for sorting
const STROKE_ORDER = {
  'free': 1, 'freestyle': 1,
  'back': 2, 'backstroke': 2,
  'breast': 3, 'breaststroke': 3,
  'fly': 4, 'butterfly': 4,
  'im': 5, 'individual medley': 5
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

            {/* 4. CLOSE CALLS - NEW */}
            <div onClick={() => setCurrentReport('closecalls')} className="bg-white p-6 rounded-2xl border hover:border-orange-400 cursor-pointer shadow-sm hover:shadow-md transition-all group">
                <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Target size={24}/></div>
                <h3 className="font-bold text-lg text-slate-800">Close Calls</h3>
                <p className="text-slate-500 text-sm mt-1">Swimmers within striking distance of a time standard.</p>
            </div>
        </div>
    </div>
  );
}

// --- SUB-COMPONENTS ---

// 4. CLOSE CALLS REPORT
const CloseCallsReport = ({ onBack }) => {
  // Filter State
  const [ageGroup, setAgeGroup] = useState('all');
  const [gender, setGender] = useState('all');
  const [selectedStandard, setSelectedStandard] = useState('');
  const [withinSeconds, setWithinSeconds] = useState(3);
  
  // Data State
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [standardNames, setStandardNames] = useState([]);
  const [results, setResults] = useState([]);
  const [hasGenerated, setHasGenerated] = useState(false);

  // Fetch available standards on mount
  useEffect(() => {
    const fetchStandards = async () => {
      const { data } = await supabase.from('time_standards').select('name');
      if (data) {
        const unique = [...new Set(data.map(d => d.name))].sort();
        setStandardNames(unique);
        // Default to first motivational standard if available
        const motivational = ['B', 'BB', 'A', 'AA', 'AAA', 'AAAA'];
        const defaultStd = unique.find(s => motivational.includes(s)) || unique[0];
        if (defaultStd) setSelectedStandard(defaultStd);
      }
    };
    fetchStandards();
  }, []);

  const generateReport = async () => {
    if (!selectedStandard) return alert('Please select a time standard.');
    
    setLoading(true);
    setResults([]);
    setHasGenerated(true);

    try {
      // 1. Fetch Swimmers
      setProgressMsg('Loading swimmers...');
      const { data: swimmers } = await supabase.from('swimmers').select('*');

      // 2. Fetch Standards for selected cut
      setProgressMsg('Loading time standards...');
      const { data: standards } = await supabase
        .from('time_standards')
        .select('*')
        .eq('name', selectedStandard);

      // 3. Fetch ALL results (paginated)
      let allResults = [];
      let page = 0;
      let keepFetching = true;
      
      while (keepFetching) {
        setProgressMsg(`Fetching results ${page * 1000 + 1} - ${(page + 1) * 1000}...`);
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

      if (!swimmers || !standards) {
        setLoading(false);
        return;
      }

      setProgressMsg('Analyzing close calls...');

      // 4. Filter swimmers by age group and gender
      const filteredSwimmers = swimmers.filter(s => {
        // Gender filter
        if (gender !== 'all') {
          const swimmerGender = (s.gender || 'M').trim().toUpperCase();
          if (swimmerGender !== gender) return false;
        }
        
        // Age group filter
        if (ageGroup !== 'all') {
          const swimmerAge = parseInt(s.age) || 0;
          if (ageGroup === '10U' && swimmerAge > 10) return false;
          if (ageGroup === '11-12' && (swimmerAge < 11 || swimmerAge > 12)) return false;
          if (ageGroup === '13-14' && (swimmerAge < 13 || swimmerAge > 14)) return false;
          if (ageGroup === '15-18' && (swimmerAge < 15 || swimmerAge > 18)) return false;
          if (ageGroup === '15O' && swimmerAge < 15) return false;
        }
        
        return true;
      });

      // 5. Process each swimmer
      const closeCalls = [];

      filteredSwimmers.forEach(swimmer => {
        const swimmerAge = parseInt(swimmer.age) || 0;
        const swimmerGender = (swimmer.gender || 'M').trim().toUpperCase();

        // Get swimmer's results
        const myResults = allResults.filter(r => r.swimmer_id === swimmer.id);
        
        // Build best times map
        const bestTimes = {};
        myResults.forEach(r => {
          const { dist, stroke } = parseEvent(r.event);
          if (!dist || !stroke) return;
          const key = `${dist} ${stroke}`;
          const sec = timeToSeconds(r.time);
          if (sec > 0 && sec < 999999) {
            if (!bestTimes[key] || sec < bestTimes[key].val) {
              bestTimes[key] = { val: sec, str: r.time, date: r.date };
            }
          }
        });

        // Get relevant standards for this swimmer
        const relevantStandards = standards.filter(std => {
          const stdGender = std.gender.trim().toUpperCase();
          const genderMatch = stdGender === swimmerGender;
          const ageMatch = (std.age_max === 99) || (swimmerAge >= std.age_min && swimmerAge <= std.age_max);
          return genderMatch && ageMatch;
        });

        // Check each standard
        relevantStandards.forEach(std => {
          const { dist, stroke } = parseEvent(std.event);
          const key = `${dist} ${stroke}`;
          const myBest = bestTimes[key];

          if (myBest) {
            const diff = myBest.val - std.time_seconds;
            
            // Only include if SLOWER than the cut (positive diff) and within threshold
            if (diff > 0 && diff <= withinSeconds) {
              closeCalls.push({
                swimmerId: swimmer.id,
                swimmerName: swimmer.name,
                swimmerAge: swimmerAge,
                swimmerGender: swimmerGender,
                swimmerGroup: swimmer.group_name,
                event: std.event,
                eventKey: key,
                bestTime: myBest.str,
                bestTimeSeconds: myBest.val,
                bestTimeDate: myBest.date,
                cutTime: std.time_string || secondsToTime(std.time_seconds),
                cutTimeSeconds: std.time_seconds,
                diff: diff,
                diffStr: diff.toFixed(2)
              });
            }
          }
        });
      });

      // Sort by diff (closest first), then by event
      closeCalls.sort((a, b) => {
        if (a.diff !== b.diff) return a.diff - b.diff;
        
        // Secondary sort by stroke order and distance
        const aEvent = parseEvent(a.event);
        const bEvent = parseEvent(b.event);
        const aStrokeOrder = STROKE_ORDER[aEvent.stroke] || 99;
        const bStrokeOrder = STROKE_ORDER[bEvent.stroke] || 99;
        
        if (aStrokeOrder !== bStrokeOrder) return aStrokeOrder - bStrokeOrder;
        return parseInt(aEvent.dist) - parseInt(bEvent.dist);
      });

      setResults(closeCalls);

    } catch (error) {
      console.error(error);
      alert('Error generating report: ' + error.message);
    } finally {
      setLoading(false);
      setProgressMsg('');
    }
  };

  // Group results by swimmer for summary view
  const groupedBySwimmer = useMemo(() => {
    const groups = {};
    results.forEach(r => {
      if (!groups[r.swimmerId]) {
        groups[r.swimmerId] = {
          swimmer: {
            id: r.swimmerId,
            name: r.swimmerName,
            age: r.swimmerAge,
            gender: r.swimmerGender,
            group: r.swimmerGroup
          },
          events: []
        };
      }
      groups[r.swimmerId].events.push(r);
    });
    
    // Sort groups by closest call
    return Object.values(groups).sort((a, b) => {
      const aMin = Math.min(...a.events.map(e => e.diff));
      const bMin = Math.min(...b.events.map(e => e.diff));
      return aMin - bMin;
    });
  }, [results]);

  // Stats
  const stats = useMemo(() => {
    const uniqueSwimmers = new Set(results.map(r => r.swimmerId)).size;
    const within1 = results.filter(r => r.diff <= 1).length;
    const within2 = results.filter(r => r.diff <= 2).length;
    const closestCall = results[0];
    return { uniqueSwimmers, within1, within2, closestCall, totalEvents: results.length };
  }, [results]);

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-blue-600 font-bold text-sm hover:underline">
          <ArrowRight className="rotate-180" size={16}/> Back to Reports
        </button>
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Target className="text-orange-500" size={24} /> Close Calls Report
        </h2>
      </div>

      {/* Filters Panel */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Filter size={18} className="text-slate-400" /> Report Filters
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Age Group */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Age Group</label>
            <select 
              value={ageGroup} 
              onChange={e => setAgeGroup(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Ages</option>
              <option value="10U">10 & Under</option>
              <option value="11-12">11-12</option>
              <option value="13-14">13-14</option>
              <option value="15-18">15-18</option>
              <option value="15O">15 & Over</option>
            </select>
          </div>

          {/* Gender */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Gender</label>
            <select 
              value={gender} 
              onChange={e => setGender(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All</option>
              <option value="M">Boys</option>
              <option value="F">Girls</option>
            </select>
          </div>

          {/* Time Standard */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Time Standard</label>
            <select 
              value={selectedStandard} 
              onChange={e => setSelectedStandard(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select Standard...</option>
              {standardNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* Within Seconds */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Within</label>
            <select 
              value={withinSeconds} 
              onChange={e => setWithinSeconds(parseFloat(e.target.value))}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={0.5}>0.5 seconds</option>
              <option value={1}>1 second</option>
              <option value={2}>2 seconds</option>
              <option value={3}>3 seconds</option>
              <option value={5}>5 seconds</option>
              <option value={10}>10 seconds</option>
            </select>
          </div>

          {/* Generate Button */}
          <div className="flex items-end">
            <button 
              onClick={generateReport}
              disabled={loading || !selectedStandard}
              className="w-full p-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap size={16} />
                  Generate Report
                </>
              )}
            </button>
          </div>
        </div>

        {progressMsg && (
          <div className="mt-4 text-sm text-slate-500 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            {progressMsg}
          </div>
        )}
      </div>

      {/* Results */}
      {hasGenerated && !loading && (
        <>
          {/* Stats Summary */}
          {results.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-2xl font-bold text-slate-800">{stats.uniqueSwimmers}</div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">Swimmers</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-2xl font-bold text-slate-800">{stats.totalEvents}</div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">Close Calls</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm bg-emerald-50">
                <div className="text-2xl font-bold text-emerald-600">{stats.within1}</div>
                <div className="text-xs text-emerald-600 uppercase tracking-wider">Within 1 sec</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-yellow-200 shadow-sm bg-yellow-50">
                <div className="text-2xl font-bold text-yellow-600">{stats.within2}</div>
                <div className="text-xs text-yellow-600 uppercase tracking-wider">Within 2 sec</div>
              </div>
            </div>
          )}

          {/* Results List */}
          {results.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <Target size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="font-bold text-slate-700 text-lg mb-2">No Close Calls Found</h3>
              <p className="text-slate-500 text-sm">
                No swimmers are within {withinSeconds} second{withinSeconds !== 1 ? 's' : ''} of a {selectedStandard} cut with the selected filters.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedBySwimmer.map(group => (
                <div key={group.swimmer.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* Swimmer Header */}
                  <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {group.swimmer.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800">{group.swimmer.name}</h4>
                        <p className="text-xs text-slate-500">
                          {group.swimmer.age} yrs • {group.swimmer.gender === 'M' ? 'Male' : 'Female'} • {group.swimmer.group || 'Unassigned'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-orange-500">{group.events.length}</div>
                      <div className="text-[10px] text-slate-400 uppercase">Close Call{group.events.length !== 1 ? 's' : ''}</div>
                    </div>
                  </div>

                  {/* Events Table */}
                  <div className="divide-y divide-slate-100">
                    {group.events
                      .sort((a, b) => a.diff - b.diff)
                      .map((evt, idx) => (
                        <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                          <div className="flex-1">
                            <div className="font-medium text-slate-800">{evt.event}</div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              Best: {evt.bestTimeDate ? new Date(evt.bestTimeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : 'N/A'}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-6">
                            {/* Best Time */}
                            <div className="text-right">
                              <div className="text-xs text-slate-400 uppercase">Best</div>
                              <div className="font-mono font-bold text-slate-700">{evt.bestTime}</div>
                            </div>

                            {/* Arrow */}
                            <div className="text-slate-300">→</div>

                            {/* Cut Time */}
                            <div className="text-right">
                              <div className="text-xs text-slate-400 uppercase">{selectedStandard}</div>
                              <div className="font-mono font-bold text-blue-600">{evt.cutTime}</div>
                            </div>

                            {/* Diff Badge */}
                            <div className={`
                              min-w-[80px] px-3 py-1.5 rounded-full text-center font-bold text-sm
                              ${evt.diff <= 0.5 
                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                                : evt.diff <= 1 
                                  ? 'bg-green-100 text-green-700 border border-green-200'
                                  : evt.diff <= 2 
                                    ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                                    : evt.diff <= 3
                                      ? 'bg-orange-100 text-orange-700 border border-orange-200'
                                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }
                            `}>
                              -{evt.diffStr}s
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Initial State */}
      {!hasGenerated && !loading && (
        <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-2xl border border-orange-200 p-12 text-center">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Target size={32} className="text-orange-500" />
          </div>
          <h3 className="font-bold text-slate-800 text-xl mb-2">Find Your Close Calls</h3>
          <p className="text-slate-600 max-w-md mx-auto">
            Select filters above to find swimmers who are within striking distance of achieving a time standard. 
            Great for identifying who needs just a little more work to hit their next cut!
          </p>
        </div>
      )}
    </div>
  );
};


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
const FlawHeatmapReport = ({ onBack }) => <div className="p-8"><button onClick={onBack}>Back</button><h3>Heatmap Coming Soon</h3></div>;
const GroupProgressionReport = ({ onBack }) => <div className="p-8"><button onClick={onBack}>Back</button><h3>Group Progression Coming Soon</h3></div>;
