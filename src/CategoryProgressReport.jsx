// src/CategoryProgressReport.jsx
// Shows progress over time for each stroke category (Free, Back, Breast, Fly, IM) - MEET RESULTS
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabase';
import { 
  ChevronLeft, TrendingDown, TrendingUp, Activity, Trophy, 
  Info, Zap, ChevronDown, ChevronUp, Calendar, Users
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { timeToSecondsForSort as timeToSeconds } from './utils/timeUtils';
import { parseEventName } from './utils/eventUtils';

// Stroke display configuration
const STROKE_CONFIG = {
  free: { label: 'Freestyle', color: '#3b82f6', bgColor: 'bg-blue-100', textColor: 'text-blue-600' },
  back: { label: 'Backstroke', color: '#8b5cf6', bgColor: 'bg-purple-100', textColor: 'text-purple-600' },
  breast: { label: 'Breaststroke', color: '#10b981', bgColor: 'bg-emerald-100', textColor: 'text-emerald-600' },
  fly: { label: 'Butterfly', color: '#f59e0b', bgColor: 'bg-amber-100', textColor: 'text-amber-600' },
  IM: { label: 'Individual Medley', color: '#ec4899', bgColor: 'bg-pink-100', textColor: 'text-pink-600' }
};

const STROKE_ORDER = ['free', 'back', 'breast', 'fly', 'IM'];

// Map full stroke names to short codes
const mapStroke = (stroke) => {
  if (!stroke) return null;
  const lower = stroke.toLowerCase();
  if (lower.includes('free')) return 'free';
  if (lower.includes('back')) return 'back';
  if (lower.includes('breast')) return 'breast';
  if (lower.includes('fly') || lower.includes('butter')) return 'fly';
  if (lower === 'im' || lower.includes('medley')) return 'IM';
  return null;
};

// Format date for display
const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric'
  });
};

// Calculate average pace (time per 100 yards/meters) for comparison across distances
const calculatePacePer100 = (timeSeconds, distance) => {
  if (!timeSeconds || !distance || distance === 0) return null;
  return (timeSeconds / distance) * 100;
};

// Full Category Progress Report Component
export function CategoryProgressReport({ onBack }) {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState([]);
  const [selectedStrokes, setSelectedStrokes] = useState(STROKE_ORDER);
  const [expandedStroke, setExpandedStroke] = useState(null);
  const [normalizeByDistance, setNormalizeByDistance] = useState(true);
  const [timeRange, setTimeRange] = useState('season'); // 'season', '3months', '6months', 'year'

  useEffect(() => {
    fetchCategoryData();
  }, [timeRange]);

  const fetchCategoryData = async () => {
    try {
      setLoading(true);
      
      // Calculate date range
      let startDate = null;
      const now = new Date();
      
      switch (timeRange) {
        case '3months':
          startDate = new Date(now);
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case '6months':
          startDate = new Date(now);
          startDate.setMonth(startDate.getMonth() - 6);
          break;
        case 'year':
          startDate = new Date(now);
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default: // 'season' - current swim season (Sept to August)
          const currentMonth = now.getMonth(); // 0-11
          if (currentMonth >= 8) { // Sept or later
            startDate = new Date(now.getFullYear(), 8, 1); // Sept 1 this year
          } else {
            startDate = new Date(now.getFullYear() - 1, 8, 1); // Sept 1 last year
          }
      }

      // Fetch all results
      let query = supabase
        .from('results')
        .select('swimmer_id, event, time, date, swimmers(id, name, group_name)')
        .order('date', { ascending: true });

      if (startDate) {
        query = query.gte('date', startDate.toISOString().split('T')[0]);
      }

      const { data: resultsData, error } = await query;

      if (error) throw error;

      // Parse and filter results
      const parsedResults = [];
      
      (resultsData || []).forEach(result => {
        const { distance, stroke } = parseEventName(result.event);
        const mappedStroke = mapStroke(stroke);
        
        // Only include main competitive strokes
        if (!mappedStroke || !STROKE_ORDER.includes(mappedStroke)) return;
        
        // Parse time to seconds
        const timeSeconds = timeToSeconds(result.time);
        if (!timeSeconds || timeSeconds >= 999999) return;
        
        parsedResults.push({
          ...result,
          distance,
          stroke: mappedStroke,
          timeSeconds,
          swimmerName: result.swimmers?.name || 'Unknown'
        });
      });

      setResults(parsedResults);
    } catch (err) {
      console.error('Error fetching category data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Process data for chart - Group by stroke and calculate monthly/weekly averages
  const chartData = useMemo(() => {
    if (!results.length) return [];

    // Group results by stroke and date
    const strokeGroups = {};
    
    results.forEach(result => {
      const stroke = result.stroke;
      if (!strokeGroups[stroke]) {
        strokeGroups[stroke] = [];
      }
      
      const pace = normalizeByDistance 
        ? calculatePacePer100(result.timeSeconds, result.distance)
        : result.timeSeconds;
      
      if (pace) {
        strokeGroups[stroke].push({
          date: result.date,
          pace,
          timeSeconds: result.timeSeconds,
          distance: result.distance,
          event: result.event,
          swimmer: result.swimmerName
        });
      }
    });

    // Create timeline data by grouping into weekly buckets
    const dateMap = {};
    
    Object.entries(strokeGroups).forEach(([stroke, swims]) => {
      // Group swims by week
      const weekBuckets = {};
      
      swims.forEach(swim => {
        const date = new Date(swim.date);
        // Get the start of the week (Sunday)
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];
        
        if (!weekBuckets[weekKey]) {
          weekBuckets[weekKey] = [];
        }
        weekBuckets[weekKey].push(swim);
      });

      // Calculate average for each week
      Object.entries(weekBuckets).forEach(([weekKey, swims]) => {
        const avgPace = swims.reduce((sum, s) => sum + s.pace, 0) / swims.length;
        
        if (!dateMap[weekKey]) {
          dateMap[weekKey] = { 
            date: formatDate(weekKey), 
            timestamp: weekKey,
            swimCount: {}
          };
        }
        
        dateMap[weekKey][stroke] = avgPace;
        dateMap[weekKey][`${stroke}_count`] = swims.length;
        dateMap[weekKey].swimCount[stroke] = swims.length;
      });
    });

    // Convert to array and sort by date
    return Object.values(dateMap).sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );
  }, [results, normalizeByDistance]);

  // Calculate statistics for each stroke
  const strokeStats = useMemo(() => {
    const stats = {};
    
    STROKE_ORDER.forEach(stroke => {
      const strokeSwims = results.filter(r => r.stroke === stroke);
      
      if (strokeSwims.length === 0) {
        stats[stroke] = { count: 0, improvement: null, avgPace: null };
        return;
      }

      // Group by week and calculate averages
      const weeklyAverages = {};
      strokeSwims.forEach(swim => {
        const date = new Date(swim.date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];
        
        const pace = normalizeByDistance 
          ? calculatePacePer100(swim.timeSeconds, swim.distance)
          : swim.timeSeconds;
        
        if (!weeklyAverages[weekKey]) {
          weeklyAverages[weekKey] = [];
        }
        weeklyAverages[weekKey].push(pace);
      });

      const avgPaces = Object.values(weeklyAverages).map(paces => 
        paces.reduce((a, b) => a + b, 0) / paces.length
      );

      if (avgPaces.length === 0) {
        stats[stroke] = { count: strokeSwims.length, improvement: null, avgPace: null };
        return;
      }

      const avgPace = avgPaces.reduce((a, b) => a + b, 0) / avgPaces.length;
      
      // Calculate improvement (first week vs last week)
      const weeks = Object.keys(weeklyAverages).sort();
      if (weeks.length >= 2) {
        const firstWeek = weeklyAverages[weeks[0]];
        const lastWeek = weeklyAverages[weeks[weeks.length - 1]];
        const firstAvg = firstWeek.reduce((a, b) => a + b, 0) / firstWeek.length;
        const lastAvg = lastWeek.reduce((a, b) => a + b, 0) / lastWeek.length;
        const improvement = ((firstAvg - lastAvg) / firstAvg) * 100;
        
        stats[stroke] = {
          count: strokeSwims.length,
          avgPace,
          improvement,
          firstPace: firstAvg,
          lastPace: lastAvg
        };
      } else {
        stats[stroke] = {
          count: strokeSwims.length,
          avgPace,
          improvement: 0
        };
      }
    });
    
    return stats;
  }, [results, normalizeByDistance]);

  // Custom tooltip for chart
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
        <div className="font-bold text-slate-700 mb-2">{label}</div>
        {payload.map((entry, idx) => {
          const count = entry.payload[`${entry.dataKey}_count`];
          if (!count) return null;
          
          return (
            <div key={idx} className="mb-1">
              <div className="flex items-center gap-2 mb-0.5">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="font-medium text-slate-700">
                  {STROKE_CONFIG[entry.dataKey]?.label}
                </span>
              </div>
              <div className="ml-5 text-slate-600 space-y-0.5">
                <div className="font-mono text-sm">
                  {normalizeByDistance 
                    ? `${entry.value.toFixed(2)}s per 100` 
                    : `${entry.value.toFixed(2)}s avg`}
                </div>
                <div className="text-xs text-slate-500">
                  {count} swim{count !== 1 ? 's' : ''} this week
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-1/3" />
          <div className="h-96 bg-slate-100 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center gap-4 mb-3">
            <button 
              onClick={onBack} 
              className="p-2 hover:bg-slate-100 rounded-full text-slate-500"
            >
              <ChevronLeft size={24} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Category Progress Report</h1>
              <p className="text-sm text-slate-500">Track meet performance improvement by stroke category</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setNormalizeByDistance(!normalizeByDistance)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                normalizeByDistance 
                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' 
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Zap size={14} />
                {normalizeByDistance ? 'Pace per 100' : 'Raw Average'}
              </div>
            </button>

            {/* Time Range Selector */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200 bg-white text-slate-700"
            >
              <option value="season">Current Season</option>
              <option value="3months">Last 3 Months</option>
              <option value="6months">Last 6 Months</option>
              <option value="year">Last Year</option>
            </select>
            
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Info size={14} />
              <span>
                {normalizeByDistance 
                  ? 'Normalized to compare different distances' 
                  : 'Shows actual average times'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-7xl mx-auto space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {STROKE_ORDER.map(stroke => {
            const config = STROKE_CONFIG[stroke];
            const stats = strokeStats[stroke];
            
            return (
              <button
                key={stroke}
                onClick={() => setExpandedStroke(expandedStroke === stroke ? null : stroke)}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  selectedStrokes.includes(stroke)
                    ? `${config.bgColor} border-current ${config.textColor}`
                    : 'bg-white border-slate-200 text-slate-400'
                }`}
              >
                <div className="text-xs font-medium mb-1">{config.label}</div>
                <div className="text-2xl font-bold mb-1">
                  {stats.count}
                </div>
                <div className="text-xs opacity-75">swims</div>
                {stats.improvement !== null && stats.improvement !== 0 && (
                  <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${
                    stats.improvement > 0 ? 'text-emerald-600' : 'text-rose-500'
                  }`}>
                    {stats.improvement > 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                    {Math.abs(stats.improvement).toFixed(1)}%
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Main Chart */}
        {chartData.length > 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="mb-4">
              <h3 className="font-bold text-slate-800">Progress Over Time</h3>
              <p className="text-sm text-slate-500">
                Lower is better • {normalizeByDistance ? 'Pace per 100 yards' : 'Average time in seconds'} • Weekly averages
              </p>
            </div>
            
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={{ stroke: '#cbd5e1' }}
                  label={{ 
                    value: normalizeByDistance ? 'Pace (seconds per 100)' : 'Time (seconds)', 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { fontSize: 12, fill: '#64748b' }
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  wrapperStyle={{ fontSize: '12px' }}
                  formatter={(value) => STROKE_CONFIG[value]?.label || value}
                />
                
                {STROKE_ORDER.map(stroke => (
                  selectedStrokes.includes(stroke) && (
                    <Line
                      key={stroke}
                      type="monotone"
                      dataKey={stroke}
                      stroke={STROKE_CONFIG[stroke].color}
                      strokeWidth={2}
                      dot={{ r: 4, fill: STROKE_CONFIG[stroke].color }}
                      activeDot={{ r: 6 }}
                      name={stroke}
                      connectNulls
                    />
                  )
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <Trophy size={48} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-600 mb-2">No Meet Results Yet</h3>
            <p className="text-slate-400">
              Record meet results to see category progress over time
            </p>
          </div>
        )}

        {/* Detailed Breakdown by Stroke */}
        <div className="space-y-3">
          {STROKE_ORDER.map(stroke => {
            const config = STROKE_CONFIG[stroke];
            const stats = strokeStats[stroke];
            const strokeSwims = results.filter(r => r.stroke === stroke);
            const isExpanded = expandedStroke === stroke;

            if (stats.count === 0) return null;

            // Group swims by event (distance)
            const eventGroups = {};
            strokeSwims.forEach(swim => {
              const key = `${swim.distance} ${config.label}`;
              if (!eventGroups[key]) {
                eventGroups[key] = [];
              }
              eventGroups[key].push(swim);
            });

            return (
              <div key={stroke} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setExpandedStroke(isExpanded ? null : stroke)}
                  className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 ${config.bgColor} ${config.textColor} rounded-xl flex items-center justify-center font-bold`}>
                      {stroke.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="text-left">
                      <h4 className="font-bold text-slate-800">{config.label}</h4>
                      <p className="text-sm text-slate-500">{stats.count} swims recorded</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    {stats.improvement !== null && stats.improvement !== 0 && (
                      <div className={`text-right ${
                        stats.improvement > 0 ? 'text-emerald-600' : 'text-rose-500'
                      }`}>
                        <div className="flex items-center gap-1 font-bold">
                          {stats.improvement > 0 ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                          {Math.abs(stats.improvement).toFixed(1)}%
                        </div>
                        <div className="text-xs">improvement</div>
                      </div>
                    )}
                    {isExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 p-4 bg-slate-50">
                    <div className="space-y-3">
                      {Object.entries(eventGroups).map(([eventName, swims]) => {
                        // Show most recent 10 swims for this event
                        const recentSwims = swims
                          .sort((a, b) => new Date(b.date) - new Date(a.date))
                          .slice(0, 10);

                        return (
                          <div key={eventName} className="bg-white rounded-lg p-3">
                            <div className="font-medium text-slate-800 mb-2 flex items-center justify-between">
                              <span>{eventName}</span>
                              <span className="text-xs text-slate-500">{swims.length} total swims</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {recentSwims.map((swim, idx) => (
                                <div key={idx} className="flex items-center justify-between text-sm p-2 bg-slate-50 rounded">
                                  <div>
                                    <div className="font-medium text-slate-700">{swim.swimmerName}</div>
                                    <div className="text-xs text-slate-500">{formatDate(swim.date)}</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-mono font-bold text-indigo-600">{swim.time}</div>
                                    {normalizeByDistance && (
                                      <div className="text-xs text-slate-500">
                                        {calculatePacePer100(swim.timeSeconds, swim.distance).toFixed(2)}s/100
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// DASHBOARD WIDGET: Category Progress Preview
// ==========================================
export function CategoryProgressWidget({ onViewFull }) {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);
  const [strokeStats, setStrokeStats] = useState({});

  useEffect(() => {
    fetchWidgetData();
  }, []);

  const fetchWidgetData = async () => {
    try {
      setLoading(true);
      
      // Fetch recent results (last 60 days)
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      
      const { data: resultsData, error } = await supabase
        .from('results')
        .select('event, time, date')
        .gte('date', sixtyDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (error) throw error;

      // Parse and filter results
      const parsedResults = [];
      
      (resultsData || []).forEach(result => {
        const { distance, stroke } = parseEventName(result.event);
        const mappedStroke = mapStroke(stroke);
        
        if (!mappedStroke || !STROKE_ORDER.includes(mappedStroke)) return;
        
        const timeSeconds = timeToSeconds(result.time);
        if (!timeSeconds || timeSeconds >= 999999) return;
        
        parsedResults.push({
          date: result.date,
          stroke: mappedStroke,
          distance,
          timeSeconds
        });
      });

      // Group by stroke and calculate weekly averages
      const strokeGroups = {};
      const stats = {};
      
      parsedResults.forEach(result => {
        const stroke = result.stroke;
        if (!strokeGroups[stroke]) {
          strokeGroups[stroke] = {};
        }
        
        const date = new Date(result.date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];
        
        const pace = calculatePacePer100(result.timeSeconds, result.distance);
        
        if (!strokeGroups[stroke][weekKey]) {
          strokeGroups[stroke][weekKey] = [];
        }
        strokeGroups[stroke][weekKey].push(pace);
      });

      // Calculate stats and create chart data
      STROKE_ORDER.forEach(stroke => {
        const weeks = strokeGroups[stroke] || {};
        const weekKeys = Object.keys(weeks).sort();
        
        if (weekKeys.length > 0) {
          const avgPaces = weekKeys.map(key => {
            const paces = weeks[key];
            return paces.reduce((a, b) => a + b, 0) / paces.length;
          });
          
          const firstAvg = avgPaces[0];
          const lastAvg = avgPaces[avgPaces.length - 1];
          const improvement = ((firstAvg - lastAvg) / firstAvg) * 100;
          
          stats[stroke] = {
            count: weekKeys.length,
            improvement
          };
        }
      });

      // Create simplified chart data (last 5 weeks)
      const dateMap = {};
      Object.entries(strokeGroups).forEach(([stroke, weeks]) => {
        const weekKeys = Object.keys(weeks).sort().slice(-5);
        weekKeys.forEach(weekKey => {
          const paces = weeks[weekKey];
          const avgPace = paces.reduce((a, b) => a + b, 0) / paces.length;
          
          if (!dateMap[weekKey]) {
            dateMap[weekKey] = { date: formatDate(weekKey), timestamp: weekKey };
          }
          dateMap[weekKey][stroke] = avgPace;
        });
      });

      const chart = Object.values(dateMap).sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );

      setChartData(chart);
      setStrokeStats(stats);
    } catch (err) {
      console.error('Error fetching widget data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/3" />
          <div className="h-32 bg-slate-100 rounded" />
        </div>
      </div>
    );
  }

  const hasData = chartData.length > 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Activity size={20} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Category Progress</h3>
            <p className="text-xs text-slate-400">Meet performance by stroke</p>
          </div>
        </div>
        {hasData && (
          <button
            onClick={onViewFull}
            className="px-3 py-1.5 text-sm font-medium text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
          >
            View Report
          </button>
        )}
      </div>

      {/* Content */}
      {!hasData ? (
        <div className="p-8 text-center">
          <Trophy size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-600 font-medium">No meet data yet</p>
          <p className="text-slate-400 text-sm mt-1">Record meet results to track stroke progress</p>
        </div>
      ) : (
        <>
          {/* Mini Chart */}
          <div className="p-4">
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData}>
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  label={{ 
                    value: 'Pace/100', 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { fontSize: 10, fill: '#94a3b8' }
                  }}
                />
                <Tooltip 
                  contentStyle={{ 
                    background: 'white', 
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '11px'
                  }}
                  formatter={(value) => [`${value.toFixed(2)}s`, '']}
                />
                
                {STROKE_ORDER.map(stroke => (
                  strokeStats[stroke] && (
                    <Line
                      key={stroke}
                      type="monotone"
                      dataKey={stroke}
                      stroke={STROKE_CONFIG[stroke].color}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  )
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Stats Summary */}
          <div className="px-4 pb-4 grid grid-cols-5 gap-2">
            {STROKE_ORDER.map(stroke => {
              const stats = strokeStats[stroke];
              if (!stats) return null;
              
              const config = STROKE_CONFIG[stroke];
              
              return (
                <div key={stroke} className="text-center">
                  <div className={`text-xs font-medium ${config.textColor} mb-1`}>
                    {config.label.split(' ')[0]}
                  </div>
                  {stats.improvement !== null && stats.improvement !== 0 && (
                    <div className={`text-xs font-bold flex items-center justify-center gap-0.5 ${
                      stats.improvement > 0 ? 'text-emerald-600' : 'text-rose-500'
                    }`}>
                      {stats.improvement > 0 ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
                      {Math.abs(stats.improvement).toFixed(0)}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
