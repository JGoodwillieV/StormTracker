// src/MotivationalTimesChart.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from './supabase';
import { Timer, ChevronDown, ChevronUp, Target, TrendingUp } from 'lucide-react';

// Standard column definitions with colors - light theme
const STANDARD_COLS = [
  { key: 'B', label: 'B', color: '#d97706', bg: 'bg-amber-50', bgAchieved: 'bg-amber-500', text: 'text-amber-700', border: 'border-amber-300', achievedText: 'text-white' },
  { key: 'BB', label: 'BB', color: '#64748b', bg: 'bg-slate-50', bgAchieved: 'bg-slate-500', text: 'text-slate-600', border: 'border-slate-300', achievedText: 'text-white' },
  { key: 'A', label: 'A', color: '#ca8a04', bg: 'bg-yellow-50', bgAchieved: 'bg-yellow-500', text: 'text-yellow-700', border: 'border-yellow-300', achievedText: 'text-white' },
  { key: 'AA', label: 'AA', color: '#2563eb', bg: 'bg-blue-50', bgAchieved: 'bg-blue-500', text: 'text-blue-700', border: 'border-blue-300', achievedText: 'text-white' },
  { key: 'AAA', label: 'AAA', color: '#7c3aed', bg: 'bg-purple-50', bgAchieved: 'bg-purple-500', text: 'text-purple-700', border: 'border-purple-300', achievedText: 'text-white' },
  { key: 'AAAA', label: 'AAAA', color: '#dc2626', bg: 'bg-rose-50', bgAchieved: 'bg-rose-500', text: 'text-rose-700', border: 'border-rose-300', achievedText: 'text-white' },
];

// Time conversion helpers
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

// Normalize event names for comparison
const normalizeEvent = (evt) => {
  if (!evt) return '';
  const clean = evt.toLowerCase().replace(/\(.*?\)/g, '').trim();
  const match = clean.match(/(\d+)\s*(?:m|y)?\s*(freestyle|free|backstroke|back|breaststroke|breast|butterfly|fly|individual\s*medley|im)/i);
  if (match) {
    let dist = match[1];
    let stroke = match[2];
    if (stroke === 'free') stroke = 'freestyle';
    if (stroke === 'back') stroke = 'backstroke';
    if (stroke === 'breast') stroke = 'breaststroke';
    if (stroke === 'fly') stroke = 'butterfly';
    if (stroke === 'individual medley') stroke = 'im';
    return `${dist} ${stroke}`;
  }
  return clean;
};

// Format event name for display
const formatEventDisplay = (evt) => {
  const parts = evt.split(' ');
  if (parts.length >= 2) {
    const dist = parts[0];
    let stroke = parts.slice(1).join(' ');
    stroke = stroke.charAt(0).toUpperCase() + stroke.slice(1);
    if (stroke.toLowerCase() === 'im') stroke = 'IM';
    return `${dist} ${stroke}`;
  }
  return evt;
};

export default function MotivationalTimesChart({ swimmerId, age, gender }) {
  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'event', direction: 'asc' });
  const [showAllEvents, setShowAllEvents] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!swimmerId || !age || !gender) return;

      // Fetch swimmer's results
      const { data: results } = await supabase
        .from('results')
        .select('event, time, date')
        .eq('swimmer_id', swimmerId);

      // Fetch motivational standards for this age/gender
      const { data: standards } = await supabase
        .from('time_standards')
        .select('*')
        .eq('gender', gender)
        .in('name', ['B', 'BB', 'A', 'AA', 'AAA', 'AAAA'])
        .lte('age_min', age)
        .gte('age_max', age);

      if (!results || !standards) {
        setLoading(false);
        return;
      }

      // Group results by normalized event, find best time
      const bestTimes = {};
      results.forEach(r => {
        const normEvent = normalizeEvent(r.event);
        if (!normEvent || normEvent.startsWith('25 ')) return; // Skip 25s
        
        const seconds = timeToSeconds(r.time);
        if (seconds > 0 && seconds < 999999) {
          if (!bestTimes[normEvent] || seconds < bestTimes[normEvent].seconds) {
            bestTimes[normEvent] = {
              seconds,
              timeStr: r.time,
              date: r.date
            };
          }
        }
      });

      // Build rows for each event the swimmer has swum
      const rows = [];
      
      Object.keys(bestTimes).forEach(normEvent => {
        const pb = bestTimes[normEvent];
        
        // Find standards for this event
        const eventStandards = standards.filter(s => {
          const stdNorm = normalizeEvent(s.event);
          return stdNorm === normEvent;
        });

        // Build standards map for this row
        const stdMap = {};
        let highestAchieved = null;
        let nextCut = null;
        let nextCutDiff = null;

        // Sort standards from easiest (B) to hardest (AAAA) for determining next cut
        const orderedStds = ['B', 'BB', 'A', 'AA', 'AAA', 'AAAA'];
        
        orderedStds.forEach(stdName => {
          const std = eventStandards.find(s => s.name === stdName);
          if (std) {
            const achieved = pb.seconds <= std.time_seconds;
            stdMap[stdName] = {
              time: std.time_string || secondsToTime(std.time_seconds),
              seconds: std.time_seconds,
              achieved
            };
            
            if (achieved) {
              highestAchieved = stdName;
            } else if (!nextCut) {
              nextCut = stdName;
              nextCutDiff = pb.seconds - std.time_seconds;
            }
          }
        });

        rows.push({
          event: normEvent,
          displayEvent: formatEventDisplay(normEvent),
          pb: pb.timeStr,
          pbSeconds: pb.seconds,
          date: pb.date,
          standards: stdMap,
          highestAchieved,
          nextCut,
          nextCutDiff
        });
      });

      setEventData(rows);
      setLoading(false);
    };

    fetchData();
  }, [swimmerId, age, gender]);

  // Stroke order for sorting (freestyle first, then back, breast, fly, IM)
  const STROKE_ORDER = {
    'freestyle': 1,
    'free': 1,
    'backstroke': 2,
    'back': 2,
    'breaststroke': 3,
    'breast': 3,
    'butterfly': 4,
    'fly': 4,
    'im': 5,
    'individual medley': 5
  };

  // Helper to extract stroke and distance from event name
  const parseEventForSort = (eventName) => {
    const parts = eventName.toLowerCase().split(' ');
    const distance = parseInt(parts[0]) || 0;
    const stroke = parts.slice(1).join(' ');
    const strokeOrder = STROKE_ORDER[stroke] || 99;
    return { distance, strokeOrder };
  };

  // Sorting logic
  const sortedData = useMemo(() => {
    const data = [...eventData];
    
    // Default sort: stroke order, then distance
    if (sortConfig.key === 'event' || !sortConfig.key) {
      data.sort((a, b) => {
        const aSort = parseEventForSort(a.event);
        const bSort = parseEventForSort(b.event);
        
        // First by stroke
        if (aSort.strokeOrder !== bSort.strokeOrder) {
          return sortConfig.direction === 'asc' 
            ? aSort.strokeOrder - bSort.strokeOrder 
            : bSort.strokeOrder - aSort.strokeOrder;
        }
        // Then by distance
        return sortConfig.direction === 'asc'
          ? aSort.distance - bSort.distance
          : bSort.distance - aSort.distance;
      });
    } else if (sortConfig.key === 'pb') {
      data.sort((a, b) => {
        return sortConfig.direction === 'asc' 
          ? a.pbSeconds - b.pbSeconds 
          : b.pbSeconds - a.pbSeconds;
      });
    } else if (sortConfig.key === 'nextCut') {
      data.sort((a, b) => {
        const aVal = a.nextCutDiff ?? 999;
        const bVal = b.nextCutDiff ?? 999;
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      });
    } else if (STANDARD_COLS.some(c => c.key === sortConfig.key)) {
      data.sort((a, b) => {
        const aStd = a.standards[sortConfig.key];
        const bStd = b.standards[sortConfig.key];
        const aVal = aStd?.seconds ?? 999999;
        const bVal = bStd?.seconds ?? 999999;
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }
    
    return data;
  }, [eventData, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return null;
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  const displayedData = showAllEvents ? sortedData : sortedData.slice(0, 5);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto mb-3" />
        <p className="text-slate-500">Loading motivational times...</p>
      </div>
    );
  }

  if (eventData.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
        <Target size={40} className="mx-auto text-slate-300 mb-3" />
        <p className="text-slate-600 font-medium">No event times recorded yet</p>
        <p className="text-slate-400 text-sm mt-1">Import meet results to see progress</p>
      </div>
    );
  }

  // Calculate summary stats
  const totalEvents = eventData.length;
  const qualifiedEvents = eventData.filter(e => e.highestAchieved).length;
  const closestCut = eventData
    .filter(e => e.nextCutDiff !== null)
    .sort((a, b) => a.nextCutDiff - b.nextCutDiff)[0];

  // Count achievements per level
  const achievementCounts = {};
  STANDARD_COLS.forEach(col => {
    achievementCounts[col.key] = eventData.filter(e => e.highestAchieved === col.key).length;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Target size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-slate-800 font-bold text-lg">Motivational Times</h3>
              <p className="text-slate-400 text-xs">Personal bests vs. time standards</p>
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="flex gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-slate-800">{qualifiedEvents}<span className="text-slate-300">/{totalEvents}</span></div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Qualified Events</div>
            </div>
            {closestCut && (
              <div className="text-right border-l border-slate-200 pl-4">
                <div className="text-lg font-bold text-emerald-600">-{closestCut.nextCutDiff.toFixed(2)}s</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">To {closestCut.nextCut}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Achievement Summary Bar */}
      <div className="px-5 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2">
        <span className="text-xs text-slate-400 font-medium mr-2">Highest Achieved:</span>
        {STANDARD_COLS.map(col => {
          const count = achievementCounts[col.key];
          if (count === 0) return null;
          return (
            <div 
              key={col.key}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${col.bgAchieved} ${col.achievedText}`}
            >
              {col.label}: {count}
            </div>
          );
        })}
        {qualifiedEvents === 0 && (
          <span className="text-xs text-slate-400 italic">No standards achieved yet</span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th 
                onClick={() => handleSort('event')}
                className="text-left px-4 py-3 text-slate-500 font-semibold text-xs uppercase tracking-wider cursor-pointer hover:text-slate-800 transition-colors"
              >
                Event{SortIcon({ columnKey: 'event' })}
              </th>
              <th 
                onClick={() => handleSort('pb')}
                className="text-center px-3 py-3 text-slate-500 font-semibold text-xs uppercase tracking-wider cursor-pointer hover:text-slate-800 transition-colors"
              >
                PB{SortIcon({ columnKey: 'pb' })}
              </th>
              {STANDARD_COLS.map(col => (
                <th 
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="text-center px-2 py-3 font-semibold text-xs uppercase tracking-wider cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ color: col.color }}
                >
                  {col.label}{SortIcon({ columnKey: col.key })}
                </th>
              ))}
              <th 
                onClick={() => handleSort('nextCut')}
                className="text-right px-4 py-3 text-slate-500 font-semibold text-xs uppercase tracking-wider cursor-pointer hover:text-slate-800 transition-colors"
              >
                To Next{SortIcon({ columnKey: 'nextCut' })}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayedData.map((row, idx) => (
              <tr 
                key={row.event} 
                className="hover:bg-blue-50/50 transition-colors group"
              >
                {/* Event Name */}
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                    {row.displayEvent}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {row.date ? new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : ''}
                  </div>
                </td>

                {/* Personal Best */}
                <td className="px-3 py-3 text-center">
                  <div className="inline-flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg">
                    <Timer size={12} className="text-blue-500" />
                    <span className="font-mono font-bold text-slate-800">{row.pb}</span>
                  </div>
                </td>

                {/* Standard Columns */}
                {STANDARD_COLS.map(col => {
                  const std = row.standards[col.key];
                  if (!std) {
                    return (
                      <td key={col.key} className="px-2 py-3 text-center">
                        <span className="text-slate-300 text-xs">—</span>
                      </td>
                    );
                  }

                  const isAchieved = std.achieved;
                  const isHighest = row.highestAchieved === col.key;
                  const isNext = row.nextCut === col.key;

                  return (
                    <td key={col.key} className="px-2 py-3 text-center">
                      <div 
                        className={`
                          relative inline-flex flex-col items-center justify-center min-w-[58px] px-2 py-1.5 rounded-lg text-xs font-mono transition-all
                          ${isAchieved 
                            ? `${col.bgAchieved} ${col.achievedText} shadow-sm` 
                            : `${col.bg} ${col.text} border ${col.border}`
                          }
                          ${isHighest ? 'ring-2 ring-offset-1 ring-yellow-400 scale-105' : ''}
                          ${isNext && !isAchieved ? 'ring-1 ring-emerald-400 ring-offset-1' : ''}
                        `}
                      >
                        <span className="font-semibold">{std.time}</span>
                      </div>
                    </td>
                  );
                })}

                {/* Time to Next Cut */}
                <td className="px-4 py-3 text-right">
                  {row.nextCutDiff !== null ? (
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                      row.nextCutDiff < 0.5 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : row.nextCutDiff < 1 
                          ? 'bg-emerald-50 text-emerald-600'
                          : row.nextCutDiff < 3 
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-slate-100 text-slate-500'
                    }`}>
                      {row.nextCutDiff < 1 && <TrendingUp size={10} />}
                      -{row.nextCutDiff.toFixed(2)}s
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700">
                      ★ MAX
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Show More / Less */}
      {sortedData.length > 5 && (
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 text-center">
          <button
            onClick={() => setShowAllEvents(!showAllEvents)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg text-sm font-medium transition-all shadow-sm"
          >
            {showAllEvents ? (
              <>
                <ChevronUp size={16} />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown size={16} />
                Show All {sortedData.length} Events
              </>
            )}
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/30 flex flex-wrap gap-x-4 gap-y-2 items-center justify-center">
        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Standards:</span>
        {STANDARD_COLS.map(col => (
          <div key={col.key} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${col.bgAchieved}`} />
            <span className="text-[10px] text-slate-500 font-medium">{col.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-2 pl-3 border-l border-slate-200">
          <div className="w-3 h-3 rounded ring-2 ring-yellow-400 ring-offset-1 bg-slate-200" />
          <span className="text-[10px] text-slate-500 font-medium">Highest</span>
        </div>
      </div>
    </div>
  );
}
