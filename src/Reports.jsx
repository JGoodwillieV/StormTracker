// src/Reports.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabase';
import MeetReportGenerator from './MeetReportGenerator';
import { 
  Trophy, ChevronLeft, FileText, Filter, Loader2, AlertCircle, CheckCircle2, XCircle, 
  TrendingUp, Activity, Users, Target, ArrowRight, Layers, Database, Clock, Zap,
  ChevronDown, Search, User, X, Award, Calendar, Star, TrendingDown
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
      case 'funnel': return <TeamFunnelReport onBack={() => setCurrentReport(null)} />;
      case 'heatmap': return <FlawHeatmapReport onBack={() => setCurrentReport(null)} />;
      case 'groups': return <GroupProgressionReport onBack={() => setCurrentReport(null)} />;
      case 'meetreport': return <MeetReportGenerator onBack={() => setCurrentReport(null)} />;
      case 'teamrecords': return <TeamRecordsReport onBack={() => setCurrentReport(null)} />;
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
            {/* MEET REPORT - Add this card */}
              <div onClick={() => setCurrentReport('meetreport')} className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-2xl cursor-pointer shadow-lg hover:shadow-xl transition-all group text-white">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><FileText size={24} /></div>
                <h3 className="font-bold text-lg">Meet Report</h3>
                <p className="text-indigo-100 text-sm mt-1">Generate comprehensive post-meet reports with stats & charts.</p>
              </div>
          
          
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

            {/* 4. CLOSE CALLS */}
            <div onClick={() => setCurrentReport('closecalls')} className="bg-white p-6 rounded-2xl border hover:border-orange-400 cursor-pointer shadow-sm hover:shadow-md transition-all group">
                <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Target size={24}/></div>
                <h3 className="font-bold text-lg text-slate-800">Close Calls</h3>
                <p className="text-slate-500 text-sm mt-1">Swimmers within striking distance of a time standard.</p>
            </div>

            {/* 5. TEAM FUNNEL - NEW */}
            <div onClick={() => setCurrentReport('funnel')} className="bg-white p-6 rounded-2xl border hover:border-cyan-400 cursor-pointer shadow-sm hover:shadow-md transition-all group">
                <div className="w-12 h-12 bg-cyan-100 text-cyan-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Activity size={24}/></div>
                <h3 className="font-bold text-lg text-slate-800">Team Funnel</h3>
                <p className="text-slate-500 text-sm mt-1">Visualize team progression through time standards.</p>
            </div>

            {/* 6. TEAM RECORDS */}
            <div onClick={() => setCurrentReport('teamrecords')} className="bg-white p-6 rounded-2xl border hover:border-amber-400 cursor-pointer shadow-sm hover:shadow-md transition-all group">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Award size={24}/></div>
                <h3 className="font-bold text-lg text-slate-800">Team Records</h3>
                <p className="text-slate-500 text-sm mt-1">Analyze team record breaks and history.</p>
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
                          {group.swimmer.age} yrs • {(group.swimmer.gender === 'M' || group.swimmer.gender === 'Male') ? 'Male' : 'Female'} • {group.swimmer.group || 'Unassigned'}
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
                              Best: {evt.bestTimeDate ? (() => {
                                const [year, month, day] = evt.bestTimeDate.split('T')[0].split('-');
                                const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                                return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
                              })() : 'N/A'}
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
                                            <div className="text-xs text-slate-400">{(() => {
                                              const [year, month, day] = evt.date.split('T')[0].split('-');
                                              const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                                              return dateObj.toLocaleDateString();
                                            })()}</div>
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

// 6. TEAM RECORDS REPORT
const TeamRecordsReport = ({ onBack }) => {
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [recordData, setRecordData] = useState(null);

  // Initialize date range to capture all recent records
  useEffect(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    
    // Set to current swim season (Sept 1 - present)
    // Or start of year if we're early in the season
    let startYear = currentYear;
    let startMonth = '09';
    
    // If we're in Jan-Aug, go back to Sept of previous year
    if (currentMonth < 8) {
      startYear = currentYear - 1;
    }
    
    // But if there might be records before Sept, start from Jan 1 of previous year
    // This ensures we capture all records for reporting
    const reportStartYear = currentMonth < 8 ? currentYear - 1 : currentYear - 1;
    
    setDateRange({
      start: `${reportStartYear}-01-01`,
      end: today.toISOString().split('T')[0]
    });
  }, []);

  const generateReport = async () => {
    if (!dateRange.start || !dateRange.end) {
      alert('Please select both start and end dates.');
      return;
    }

    setLoading(true);
    setProgressMsg('Loading record history...');

    try {
      // 1. Fetch record history within date range (filter by swim date, not when it was logged)
      const { data: recordHistory, error: historyError } = await supabase
        .from('record_history')
        .select('*')
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)
        .order('date', { ascending: false });

      if (historyError) {
        console.error('Error fetching record history:', historyError);
        
        // Check if table doesn't exist
        if (historyError.code === 'PGRST116' || historyError.message?.includes('does not exist')) {
          alert('The record_history table has not been created yet. Please run the database/record_history_schema.sql file in Supabase first.');
          setLoading(false);
          return;
        }
        throw historyError;
      }

      console.log(`Found ${recordHistory?.length || 0} record breaks in date range`);

      // 2. Fetch current team records to calculate longest-held
      setProgressMsg('Analyzing current records...');
      const { data: currentRecords, error: recordsError } = await supabase
        .from('team_records')
        .select('*');

      if (recordsError) throw recordsError;

      setProgressMsg('Processing insights...');

      // --- INSIGHT 1: Records broken multiple times ---
      const eventBreaks = {};
      
      (recordHistory || []).forEach(record => {
        const key = `${record.event}|${record.age_group}|${record.gender}`;
        if (!eventBreaks[key]) {
          eventBreaks[key] = {
            event: record.event,
            age_group: record.age_group,
            gender: record.gender,
            breaks: [],
            swimmers: new Set(),
            totalImprovement: 0
          };
        }
        
        eventBreaks[key].breaks.push(record);
        eventBreaks[key].swimmers.add(record.swimmer_name);
        if (record.improvement_seconds) {
          eventBreaks[key].totalImprovement += parseFloat(record.improvement_seconds);
        }
      });

      // Convert to array and sort by number of breaks
      const multiBreakEvents = Object.values(eventBreaks)
        .map(e => ({
          ...e,
          breakCount: e.breaks.length,
          swimmerCount: e.swimmers.size,
          swimmers: Array.from(e.swimmers)
        }))
        .filter(e => e.breakCount > 0)
        .sort((a, b) => b.breakCount - a.breakCount);

      // Most competitive event
      const mostCompetitiveEvent = multiBreakEvents[0] || null;

      // --- INSIGHT 2: Individual swimmer achievements ---
      const swimmerAchievements = {};
      
      (recordHistory || []).forEach(record => {
        if (!swimmerAchievements[record.swimmer_name]) {
          swimmerAchievements[record.swimmer_name] = {
            name: record.swimmer_name,
            swimmer_id: record.swimmer_id,
            records: [],
            totalRecords: 0,
            uniqueEvents: new Set(),
            totalImprovement: 0
          };
        }
        
        swimmerAchievements[record.swimmer_name].records.push(record);
        swimmerAchievements[record.swimmer_name].totalRecords++;
        swimmerAchievements[record.swimmer_name].uniqueEvents.add(record.event);
        
        if (record.improvement_seconds) {
          swimmerAchievements[record.swimmer_name].totalImprovement += parseFloat(record.improvement_seconds);
        }
      });

      // Convert to array and calculate unique event count
      const topRecordBreakers = Object.values(swimmerAchievements)
        .map(s => ({
          ...s,
          uniqueEventCount: s.uniqueEvents.size
        }))
        .sort((a, b) => b.totalRecords - a.totalRecords);

      // --- INSIGHT 3: Longest-held records ---
      const longestHeld = (currentRecords || []).map(record => {
        const recordDate = new Date(record.date);
        const now = new Date();
        const daysHeld = Math.floor((now - recordDate) / (1000 * 60 * 60 * 24));
        
        return {
          ...record,
          daysHeld,
          yearsHeld: (daysHeld / 365).toFixed(1)
        };
      }).sort((a, b) => b.daysHeld - a.daysHeld);

      // --- SUMMARY STATS ---
      const totalBreaks = (recordHistory || []).length;
      const uniqueSwimmers = new Set((recordHistory || []).map(r => r.swimmer_name)).size;
      const uniqueEvents = new Set((recordHistory || []).map(r => `${r.event}|${r.age_group}|${r.gender}`)).size;
      const totalImprovement = (recordHistory || []).reduce((sum, r) => sum + (parseFloat(r.improvement_seconds) || 0), 0);

      setRecordData({
        totalBreaks,
        uniqueSwimmers,
        uniqueEvents,
        totalImprovement,
        multiBreakEvents,
        mostCompetitiveEvent,
        topRecordBreakers,
        longestHeld,
        recordHistory: recordHistory || []
      });

    } catch (error) {
      console.error(error);
      alert('Error generating report: ' + error.message);
    } finally {
      setLoading(false);
      setProgressMsg('');
    }
  };

  // Auto-generate on mount
  useEffect(() => {
    if (dateRange.start && dateRange.end) {
      generateReport();
    }
  }, []); // Only run on mount

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-blue-600 font-bold text-sm hover:underline">
          <ArrowRight className="rotate-180" size={16}/> Back to Reports
        </button>
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Award className="text-amber-500" size={24} /> Team Records Report
        </h2>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Calendar size={18} className="text-slate-400" /> Date Range
        </h3>
        
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Start Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">End Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          <button
            onClick={generateReport}
            disabled={loading}
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
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

        {progressMsg && (
          <div className="mt-4 text-sm text-slate-500 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            {progressMsg}
          </div>
        )}
      </div>

      {/* Results */}
      {loading && !recordData && (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400">
          <Loader2 size={40} className="animate-spin mb-4 text-amber-500" />
          <p>{progressMsg || 'Processing...'}</p>
        </div>
      )}

      {!loading && recordData && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
              <div className="text-3xl font-black mb-1">{recordData.totalBreaks}</div>
              <div className="text-sm opacity-90">Record Breaks</div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-3xl font-black text-slate-800 mb-1">{recordData.uniqueSwimmers}</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Record Holders</div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-3xl font-black text-slate-800 mb-1">{recordData.uniqueEvents}</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Events Impacted</div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-emerald-200 shadow-sm bg-emerald-50">
              <div className="text-3xl font-black text-emerald-600 mb-1">{recordData.totalImprovement.toFixed(2)}s</div>
              <div className="text-xs text-emerald-600 uppercase tracking-wider">Total Improvement</div>
            </div>
          </div>

          {recordData.totalBreaks === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <Award size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="font-bold text-slate-700 text-lg mb-2">No Records Broken</h3>
              <p className="text-slate-500 text-sm mb-4">
                No team records were broken in the selected date range ({dateRange.start} to {dateRange.end}).
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left max-w-2xl mx-auto">
                <h4 className="font-bold text-blue-800 text-sm mb-2">ℹ️ How Record History Works:</h4>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• Record history is automatically logged when you upload meet results and confirm record breaks</li>
                  <li>• If you just set up the system, try uploading some recent meet results first</li>
                  <li>• The record_history table needs to be created using database/record_history_schema.sql</li>
                  <li>• Try expanding your date range to include more time</li>
                </ul>
              </div>
            </div>
          ) : (
            <>
              {/* Top Record Breakers */}
              {recordData.topRecordBreakers.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                      <Trophy className="text-amber-500" size={20} />
                      Top Record Breakers
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">Swimmers who broke the most team records</p>
                  </div>
                  
                  <div className="divide-y divide-slate-100">
                    {recordData.topRecordBreakers.slice(0, 10).map((swimmer, idx) => (
                      <div key={idx} className="p-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`
                              w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg
                              ${idx === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500' : 
                                idx === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400' :
                                idx === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700' :
                                'bg-gradient-to-br from-slate-400 to-slate-500'}
                            `}>
                              {idx + 1}
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-800">{swimmer.name}</h4>
                              <p className="text-sm text-slate-500">
                                {swimmer.totalRecords} record{swimmer.totalRecords !== 1 ? 's' : ''} across {swimmer.uniqueEventCount} event{swimmer.uniqueEventCount !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="text-2xl font-black text-amber-500">{swimmer.totalRecords}</div>
                            <div className="text-xs text-slate-400 uppercase">Records</div>
                          </div>
                        </div>
                        
                        {/* Sample Events */}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {[...swimmer.uniqueEvents].slice(0, 5).map((event, i) => (
                            <span key={i} className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-full border border-amber-200">
                              {event}
                            </span>
                          ))}
                          {swimmer.uniqueEventCount > 5 && (
                            <span className="text-xs text-slate-400">+{swimmer.uniqueEventCount - 5} more</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Most Competitive Events */}
              {recordData.multiBreakEvents.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                      <TrendingDown className="text-blue-500" size={20} />
                      Most Competitive Events
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">Records broken multiple times</p>
                  </div>
                  
                  <div className="divide-y divide-slate-100">
                    {recordData.multiBreakEvents.slice(0, 10).map((event, idx) => (
                      <div key={idx} className="p-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="font-bold text-slate-800">{event.event}</h4>
                              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                {event.age_group} • {(event.gender === 'M' || event.gender === 'Male') ? 'Boys' : 'Girls'}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                              <div>
                                <div className="text-lg font-bold text-blue-600">{event.breakCount}</div>
                                <div className="text-xs text-slate-400">Times Broken</div>
                              </div>
                              <div>
                                <div className="text-lg font-bold text-purple-600">{event.swimmerCount}</div>
                                <div className="text-xs text-slate-400">Different Swimmers</div>
                              </div>
                              <div>
                                <div className="text-lg font-bold text-emerald-600">{event.totalImprovement.toFixed(2)}s</div>
                                <div className="text-xs text-slate-400">Total Improvement</div>
                              </div>
                              <div>
                                <div className="text-lg font-bold text-amber-600">{(event.totalImprovement / event.breakCount).toFixed(2)}s</div>
                                <div className="text-xs text-slate-400">Avg Drop</div>
                              </div>
                            </div>
                            
                            <div className="text-sm text-slate-600">
                              <span className="font-semibold">Record holders:</span>{' '}
                              {event.swimmers.join(', ')}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Longest-Held Records */}
              {recordData.longestHeld.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                      <Clock className="text-purple-500" size={20} />
                      Longest-Held Records
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">Current records that have stood the test of time</p>
                  </div>
                  
                  <div className="divide-y divide-slate-100">
                    {recordData.longestHeld.slice(0, 15).map((record, idx) => (
                      <div key={idx} className="p-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <h4 className="font-bold text-slate-800">{record.event}</h4>
                              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                {record.age_group} • {(record.gender === 'M' || record.gender === 'Male') ? 'Boys' : 'Girls'}
                              </span>
                            </div>
                            <div className="text-sm text-slate-600">
                              <span className="font-semibold">{record.swimmer_name}</span> •{' '}
                              <span className="font-mono text-blue-600">{record.time_display}</span> •{' '}
                              <span className="text-slate-400">
                                {(() => {
                                  const [year, month, day] = record.date.split('T')[0].split('-');
                                  const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                                  return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                })()}
                              </span>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="text-xl font-bold text-purple-600">{record.daysHeld}</div>
                            <div className="text-xs text-slate-400">
                              {record.daysHeld === 1 ? 'day' : 'days'} ({record.yearsHeld} yrs)
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Insights Card */}
              {recordData.mostCompetitiveEvent && recordData.topRecordBreakers[0] && (
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
                  <h3 className="font-bold text-xl mb-4 flex items-center gap-2">
                    <Star size={24} />
                    Key Insights
                  </h3>
                  
                  <div className="space-y-3 text-white/90">
                    {recordData.mostCompetitiveEvent.breakCount > 1 && (
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">🔥</div>
                        <p className="flex-1">
                          The <span className="font-bold text-white">{recordData.mostCompetitiveEvent.age_group} {(recordData.mostCompetitiveEvent.gender === 'M' || recordData.mostCompetitiveEvent.gender === 'Male') ? 'Boys' : 'Girls'} {recordData.mostCompetitiveEvent.event}</span> record was broken{' '}
                          <span className="font-bold text-white">{recordData.mostCompetitiveEvent.breakCount} times this {dateRange.start.includes('-09-01') ? 'season' : 'period'}</span> by{' '}
                          <span className="font-bold text-white">{recordData.mostCompetitiveEvent.swimmerCount} different swimmer{recordData.mostCompetitiveEvent.swimmerCount !== 1 ? 's' : ''}</span> and improved by{' '}
                          <span className="font-bold text-white">{recordData.mostCompetitiveEvent.totalImprovement.toFixed(2)} seconds</span>!
                        </p>
                      </div>
                    )}
                    
                    {recordData.topRecordBreakers[0] && recordData.topRecordBreakers[0].totalRecords > 1 && (
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">⭐</div>
                        <p className="flex-1">
                          <span className="font-bold text-white">{recordData.topRecordBreakers[0].name}</span> broke{' '}
                          <span className="font-bold text-white">{recordData.topRecordBreakers[0].totalRecords} team records</span> this {dateRange.start.includes('-09-01') ? 'season' : 'period'} across{' '}
                          <span className="font-bold text-white">{recordData.topRecordBreakers[0].uniqueEventCount} different event{recordData.topRecordBreakers[0].uniqueEventCount !== 1 ? 's' : ''}</span>!
                        </p>
                      </div>
                    )}
                    
                    {recordData.longestHeld[0] && recordData.longestHeld[0].daysHeld > 365 && (
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">🏆</div>
                        <p className="flex-1">
                          Longest-held record: <span className="font-bold text-white">{recordData.longestHeld[0].event}</span> by{' '}
                          <span className="font-bold text-white">{recordData.longestHeld[0].swimmer_name}</span> ({' '}
                          <span className="font-bold text-white">{recordData.longestHeld[0].daysHeld} days</span> / {recordData.longestHeld[0].yearsHeld} years)
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Initial state */}
      {!loading && !recordData && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-12 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Award size={32} className="text-amber-500" />
          </div>
          <h3 className="font-bold text-slate-800 text-xl mb-2">Team Records Analysis</h3>
          <p className="text-slate-600 max-w-md mx-auto">
            Select a date range above to analyze team record breaks, see who broke the most records, 
            identify the most competitive events, and view the longest-held records.
          </p>
        </div>
      )}
    </div>
  );
};

// --- PLACEHOLDERS FOR OTHER REPORTS (Will Implement Next) ---
const BigMoversReport = ({ onBack }) => <div className="p-8"><button onClick={onBack}>Back</button><h3>Big Movers Coming Soon</h3></div>;
const FlawHeatmapReport = ({ onBack }) => <div className="p-8"><button onClick={onBack}>Back</button><h3>Heatmap Coming Soon</h3></div>;
const GroupProgressionReport = ({ onBack }) => <div className="p-8"><button onClick={onBack}>Back</button><h3>Group Progression Coming Soon</h3></div>;

// 5. TEAM FUNNEL REPORT
const TeamFunnelReport = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [progressMsg, setProgressMsg] = useState('');
  const [funnelData, setFunnelData] = useState([]);
  const [swimmersByLevel, setSwimmersByLevel] = useState({});
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [viewMode, setViewMode] = useState('all'); // 'all', 'boys', 'girls'
  const [ageGroup, setAgeGroup] = useState('all');

  // Standard hierarchy (from highest to lowest)
  const STANDARD_HIERARCHY = [
    { key: 'AAAA', label: 'AAAA', color: 'from-rose-500 to-rose-600', bg: 'bg-rose-500', text: 'text-rose-600', light: 'bg-rose-50' },
    { key: 'AAA', label: 'AAA', color: 'from-purple-500 to-purple-600', bg: 'bg-purple-500', text: 'text-purple-600', light: 'bg-purple-50' },
    { key: 'AA', label: 'AA', color: 'from-blue-500 to-blue-600', bg: 'bg-blue-500', text: 'text-blue-600', light: 'bg-blue-50' },
    { key: 'A', label: 'A', color: 'from-yellow-500 to-yellow-600', bg: 'bg-yellow-500', text: 'text-yellow-600', light: 'bg-yellow-50' },
    { key: 'BB', label: 'BB', color: 'from-slate-400 to-slate-500', bg: 'bg-slate-400', text: 'text-slate-600', light: 'bg-slate-100' },
    { key: 'B', label: 'B', color: 'from-amber-600 to-amber-700', bg: 'bg-amber-600', text: 'text-amber-700', light: 'bg-amber-50' },
  ];

  useEffect(() => {
    generateFunnel();
  }, [viewMode, ageGroup]);

  const generateFunnel = async () => {
    setLoading(true);
    setProgressMsg('Loading swimmers...');

    try {
      // 1. Fetch swimmers
      const { data: swimmers } = await supabase.from('swimmers').select('*');

      // 2. Fetch all motivational standards
      setProgressMsg('Loading time standards...');
      const { data: standards } = await supabase
        .from('time_standards')
        .select('*')
        .in('name', ['B', 'BB', 'A', 'AA', 'AAA', 'AAAA']);

      // 3. Fetch all results (paginated)
      let allResults = [];
      let page = 0;
      let keepFetching = true;

      while (keepFetching) {
        setProgressMsg(`Fetching results ${page * 1000 + 1} - ${(page + 1) * 1000}...`);
        const { data: batch, error } = await supabase
          .from('results')
          .select('swimmer_id, event, time')
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

      setProgressMsg('Analyzing team progression...');

      // 4. Filter swimmers by gender and age
      const filteredSwimmers = swimmers.filter(s => {
        if (viewMode === 'boys' && (s.gender || 'M').toUpperCase() !== 'M') return false;
        if (viewMode === 'girls' && (s.gender || 'M').toUpperCase() !== 'F') return false;
        
        const swimmerAge = parseInt(s.age) || 0;
        if (ageGroup === '10U' && swimmerAge > 10) return false;
        if (ageGroup === '11-12' && (swimmerAge < 11 || swimmerAge > 12)) return false;
        if (ageGroup === '13-14' && (swimmerAge < 13 || swimmerAge > 14)) return false;
        if (ageGroup === '15O' && swimmerAge < 15) return false;
        
        return true;
      });

      // 5. Determine highest standard achieved for each swimmer
      const swimmerLevels = {};
      const levelSwimmers = {
        'AAAA': [], 'AAA': [], 'AA': [], 'A': [], 'BB': [], 'B': [], 'None': []
      };

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
            if (!bestTimes[key] || sec < bestTimes[key]) {
              bestTimes[key] = sec;
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

        // Find highest achieved standard
        let highestLevel = 'None';
        let achievedEvents = [];

        // Check from highest to lowest
        for (const levelDef of STANDARD_HIERARCHY) {
          const levelStandards = relevantStandards.filter(s => s.name === levelDef.key);
          
          for (const std of levelStandards) {
            const { dist, stroke } = parseEvent(std.event);
            const key = `${dist} ${stroke}`;
            const myBest = bestTimes[key];

            if (myBest && myBest <= std.time_seconds) {
              if (highestLevel === 'None' || STANDARD_HIERARCHY.findIndex(h => h.key === levelDef.key) < STANDARD_HIERARCHY.findIndex(h => h.key === highestLevel)) {
                highestLevel = levelDef.key;
              }
              achievedEvents.push({
                event: std.event,
                time: secondsToTime(myBest),
                standard: levelDef.key
              });
            }
          }
        }

        swimmerLevels[swimmer.id] = {
          ...swimmer,
          highestLevel,
          achievedEvents: achievedEvents.filter(e => e.standard === highestLevel)
        };

        levelSwimmers[highestLevel].push(swimmerLevels[swimmer.id]);
      });

      // 6. Build funnel data
      const totalSwimmers = filteredSwimmers.length;
      const funnel = STANDARD_HIERARCHY.map(level => {
        const count = levelSwimmers[level.key].length;
        // Cumulative: swimmers at this level OR higher
        const cumulativeCount = STANDARD_HIERARCHY
          .slice(0, STANDARD_HIERARCHY.findIndex(h => h.key === level.key) + 1)
          .reduce((sum, l) => sum + levelSwimmers[l.key].length, 0);
        
        return {
          ...level,
          count,
          cumulativeCount,
          percentage: totalSwimmers > 0 ? ((count / totalSwimmers) * 100).toFixed(1) : 0,
          cumulativePercentage: totalSwimmers > 0 ? ((cumulativeCount / totalSwimmers) * 100).toFixed(1) : 0
        };
      });

      // Add "No Standard" level
      funnel.push({
        key: 'None',
        label: 'No Standard',
        color: 'from-slate-200 to-slate-300',
        bg: 'bg-slate-300',
        text: 'text-slate-500',
        light: 'bg-slate-50',
        count: levelSwimmers['None'].length,
        cumulativeCount: totalSwimmers,
        percentage: totalSwimmers > 0 ? ((levelSwimmers['None'].length / totalSwimmers) * 100).toFixed(1) : 0,
        cumulativePercentage: '100.0'
      });

      setFunnelData(funnel);
      setSwimmersByLevel(levelSwimmers);

    } catch (error) {
      console.error(error);
      alert('Error generating funnel: ' + error.message);
    } finally {
      setLoading(false);
      setProgressMsg('');
    }
  };

  // Calculate max count for scaling
  const maxCount = Math.max(...funnelData.map(d => d.count), 1);
  const totalSwimmers = funnelData.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-blue-600 font-bold text-sm hover:underline">
          <ArrowRight className="rotate-180" size={16}/> Back to Reports
        </button>
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Activity className="text-cyan-500" size={24} /> Team Funnel
        </h2>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-600">View:</span>
          <div className="flex bg-slate-100 rounded-lg p-1">
            {[
              { key: 'all', label: 'All' },
              { key: 'boys', label: 'Boys' },
              { key: 'girls', label: 'Girls' }
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setViewMode(opt.key)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === opt.key 
                    ? 'bg-white text-slate-800 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-600">Age:</span>
          <select
            value={ageGroup}
            onChange={e => setAgeGroup(e.target.value)}
            className="bg-slate-100 border-0 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Ages</option>
            <option value="10U">10 & Under</option>
            <option value="11-12">11-12</option>
            <option value="13-14">13-14</option>
            <option value="15O">15 & Over</option>
          </select>
        </div>

        <div className="ml-auto text-sm text-slate-500">
          <span className="font-bold text-slate-800">{totalSwimmers}</span> swimmers total
        </div>
      </div>

      {loading ? (
        <div className="h-96 flex flex-col items-center justify-center text-slate-400">
          <Loader2 size={40} className="animate-spin mb-4 text-cyan-500" />
          <p>{progressMsg || 'Processing...'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Funnel Visualization */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-800 mb-6 text-lg">Standards Progression</h3>
            
            <div className="space-y-3">
              {funnelData.map((level, idx) => {
                const widthPercentage = level.count > 0 ? Math.max(20, (level.count / maxCount) * 100) : 5;
                const isSelected = selectedLevel === level.key;
                
                return (
                  <div 
                    key={level.key}
                    onClick={() => setSelectedLevel(isSelected ? null : level.key)}
                    className={`relative cursor-pointer transition-all duration-300 ${isSelected ? 'scale-[1.02]' : 'hover:scale-[1.01]'}`}
                  >
                    {/* Funnel Bar */}
                    <div className="flex items-center gap-4">
                      {/* Label */}
                      <div className={`w-24 text-right font-bold ${level.text}`}>
                        {level.label}
                      </div>
                      
                      {/* Bar Container */}
                      <div className="flex-1 relative">
                        <div 
                          className={`
                            h-12 rounded-lg bg-gradient-to-r ${level.color} 
                            flex items-center justify-between px-4 
                            transition-all duration-500 ease-out
                            ${isSelected ? 'ring-2 ring-offset-2 ring-slate-400' : ''}
                          `}
                          style={{ 
                            width: `${widthPercentage}%`,
                            marginLeft: `${(100 - widthPercentage) / 2}%`
                          }}
                        >
                          <span className="text-white font-bold text-lg">
                            {level.count}
                          </span>
                          <span className="text-white/80 text-sm">
                            {level.percentage}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Connector Line (for funnel effect) */}
                    {idx < funnelData.length - 1 && (
                      <div className="flex justify-center py-1">
                        <div className="w-0.5 h-2 bg-slate-200"></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-8 pt-6 border-t border-slate-100">
              <div className="flex flex-wrap gap-4 justify-center text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-rose-500"></div>
                  <span className="text-slate-600">AAAA - Elite</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-purple-500"></div>
                  <span className="text-slate-600">AAA - Diamond</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-blue-500"></div>
                  <span className="text-slate-600">AA - Platinum</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-yellow-500"></div>
                  <span className="text-slate-600">A - Gold</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-slate-400"></div>
                  <span className="text-slate-600">BB - Silver</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-amber-600"></div>
                  <span className="text-slate-600">B - Bronze</span>
                </div>
              </div>
            </div>
          </div>

          {/* Side Panel - Stats or Swimmer List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            {selectedLevel ? (
              <>
                {/* Selected Level Header */}
                <div className={`p-4 ${funnelData.find(f => f.key === selectedLevel)?.light || 'bg-slate-50'} border-b`}>
                  <div className="flex items-center justify-between">
                    <h4 className={`font-bold text-lg ${funnelData.find(f => f.key === selectedLevel)?.text}`}>
                      {selectedLevel === 'None' ? 'No Standard Yet' : `${selectedLevel} Swimmers`}
                    </h4>
                    <button 
                      onClick={() => setSelectedLevel(null)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    {swimmersByLevel[selectedLevel]?.length || 0} swimmer{swimmersByLevel[selectedLevel]?.length !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* Swimmer List */}
                <div className="flex-1 overflow-y-auto max-h-[500px]">
                  {swimmersByLevel[selectedLevel]?.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <Users size={32} className="mx-auto mb-2 opacity-50" />
                      <p>No swimmers at this level</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {swimmersByLevel[selectedLevel]?.map(swimmer => (
                        <div key={swimmer.id} className="p-3 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full ${funnelData.find(f => f.key === selectedLevel)?.bg || 'bg-slate-300'} flex items-center justify-center text-white text-xs font-bold`}>
                              {swimmer.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-slate-800 truncate">{swimmer.name}</div>
                              <div className="text-xs text-slate-400">
                                {swimmer.age} yrs • {swimmer.group_name || 'Unassigned'}
                              </div>
                            </div>
                          </div>
                          {swimmer.achievedEvents?.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {swimmer.achievedEvents.slice(0, 3).map((evt, i) => (
                                <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                  {evt.event}
                                </span>
                              ))}
                              {swimmer.achievedEvents.length > 3 && (
                                <span className="text-[10px] text-slate-400">
                                  +{swimmer.achievedEvents.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Stats Overview */}
                <div className="p-4 border-b border-slate-100">
                  <h4 className="font-bold text-slate-800">Quick Stats</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Click a level to see swimmers</p>
                </div>

                <div className="p-4 space-y-4 flex-1">
                  {/* Conversion Rates */}
                  <div>
                    <h5 className="text-xs font-bold text-slate-400 uppercase mb-3">Conversion Rates</h5>
                    <div className="space-y-2">
                      {STANDARD_HIERARCHY.slice(0, -1).map((level, idx) => {
                        const currentCount = funnelData.find(f => f.key === level.key)?.count || 0;
                        const nextLevel = STANDARD_HIERARCHY[idx + 1];
                        const nextCount = funnelData.find(f => f.key === nextLevel.key)?.count || 0;
                        const conversionRate = nextCount > 0 ? ((currentCount / nextCount) * 100).toFixed(0) : 0;
                        
                        return (
                          <div key={level.key} className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">{nextLevel.label} → {level.label}</span>
                            <span className={`font-bold ${level.text}`}>{conversionRate}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Top Level Breakdown */}
                  <div className="pt-4 border-t border-slate-100">
                    <h5 className="text-xs font-bold text-slate-400 uppercase mb-3">Distribution</h5>
                    <div className="space-y-2">
                      {funnelData.filter(f => f.count > 0).map(level => (
                        <div key={level.key} className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${level.bg}`}></div>
                          <span className="text-sm text-slate-600 flex-1">{level.label}</span>
                          <span className="text-sm font-bold text-slate-800">{level.count}</span>
                          <span className="text-xs text-slate-400">({level.percentage}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Insight Box */}
                  {funnelData.length > 0 && (
                    <div className="pt-4 border-t border-slate-100">
                      <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4">
                        <h5 className="text-xs font-bold text-cyan-700 uppercase mb-2 flex items-center gap-1">
                          <Zap size={12} /> Insight
                        </h5>
                        <p className="text-sm text-cyan-800">
                          {(() => {
                            const withStandards = funnelData.filter(f => f.key !== 'None').reduce((sum, f) => sum + f.count, 0);
                            const percentage = totalSwimmers > 0 ? ((withStandards / totalSwimmers) * 100).toFixed(0) : 0;
                            const topLevel = funnelData.find(f => f.count > 0 && f.key !== 'None');
                            
                            if (percentage >= 80) return `Great progress! ${percentage}% of swimmers have achieved at least one time standard.`;
                            if (percentage >= 50) return `Solid foundation! ${percentage}% have standards. Focus on converting BB swimmers to A.`;
                            if (topLevel) return `${topLevel.count} swimmer${topLevel.count !== 1 ? 's have' : ' has'} reached ${topLevel.label} level. Keep pushing!`;
                            return 'Time to start chasing those standards!';
                          })()}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
