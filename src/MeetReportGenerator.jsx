// src/MeetReportGenerator.jsx
// Comprehensive Meet Report Generator for Coaches
// Generates detailed post-meet reports with stats, charts, and highlights

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabase';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  ChevronLeft, Calendar, Users, Trophy, TrendingUp, TrendingDown,
  Award, Target, Zap, Clock, Filter, Download, Share2, Loader2,
  CheckCircle, Star, Flame, Medal, ChevronDown, ChevronRight,
  Percent, Timer, Activity, BarChart3, FileText, Sparkles
} from 'lucide-react';

// ============================================
// SHARED HELPERS
// ============================================

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
  const clean = evt.toLowerCase().replace(/\(.*?\)/g, '').trim();
  const match = clean.match(/\b(25|50|100|200|400|500|800|1000|1500|1650)\s+(.*)/);
  if (match) {
    const dist = match[1];
    let stroke = match[2];
    if (stroke.includes('free')) stroke = 'Freestyle';
    else if (stroke.includes('back')) stroke = 'Backstroke';
    else if (stroke.includes('breast')) stroke = 'Breaststroke';
    else if (stroke.includes('fly') || stroke.includes('butter')) stroke = 'Butterfly';
    else if (stroke.includes('im') || stroke.includes('medley')) stroke = 'IM';
    else return { dist: '', stroke: '' };
    return { dist, stroke };
  }
  return { dist: '', stroke: '' };
};

const normalizeEvent = (evt) => {
  const { dist, stroke } = parseEvent(evt);
  if (!dist || !stroke) return null;
  return `${dist} ${stroke}`;
};

// Standard hierarchy
const STANDARD_HIERARCHY = ['AAAA', 'AAA', 'AA', 'A', 'BB', 'B'];
const STANDARD_COLORS = {
  'AAAA': { bg: 'bg-rose-500', light: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200' },
  'AAA': { bg: 'bg-purple-500', light: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
  'AA': { bg: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
  'A': { bg: 'bg-yellow-500', light: 'bg-yellow-50', text: 'text-yellow-600', border: 'border-yellow-200' },
  'BB': { bg: 'bg-slate-400', light: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
  'B': { bg: 'bg-amber-600', light: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
};

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// ============================================
// STAT CARD COMPONENT
// ============================================

const StatCard = ({ icon: Icon, label, value, subValue, color = 'blue', large = false }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    yellow: 'bg-amber-50 text-amber-600 border-amber-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
  };

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-4 ${large ? 'col-span-2' : ''}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClasses[color]}`}>
          <Icon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className={`font-bold text-slate-800 ${large ? 'text-3xl' : 'text-2xl'} mt-0.5`}>{value}</p>
          {subValue && <p className="text-sm text-slate-500 mt-0.5">{subValue}</p>}
        </div>
      </div>
    </div>
  );
};

// ============================================
// HIGHLIGHT CARD COMPONENT
// ============================================

const HighlightCard = ({ icon: Icon, title, subtitle, badge, badgeColor = 'blue' }) => {
  const badgeColors = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-emerald-100 text-emerald-700',
    yellow: 'bg-amber-100 text-amber-700',
    purple: 'bg-purple-100 text-purple-700',
    rose: 'bg-rose-100 text-rose-700',
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-slate-50 to-white rounded-xl border border-slate-100">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-200/50">
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-800 truncate">{title}</p>
        <p className="text-sm text-slate-500 truncate">{subtitle}</p>
      </div>
      {badge && (
        <span className={`px-2 py-1 rounded-full text-xs font-bold ${badgeColors[badgeColor]}`}>
          {badge}
        </span>
      )}
    </div>
  );
};

// ============================================
// EXPANDABLE SECTION COMPONENT
// ============================================

const ExpandableSection = ({ title, icon: Icon, children, defaultOpen = true, count }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <Icon size={20} />
          </div>
          <h3 className="font-bold text-slate-800 text-lg">{title}</h3>
          {count !== undefined && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
              {count}
            </span>
          )}
        </div>
        <ChevronDown
          size={20}
          className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && <div className="px-4 pb-4 border-t border-slate-100 pt-4">{children}</div>}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function MeetReportGenerator({ onBack }) {
  // Setup State
  const [step, setStep] = useState('select'); // 'select' | 'loading' | 'report'
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [availableGroups, setAvailableGroups] = useState([]);
  const [meetName, setMeetName] = useState('');

  // Loading State
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');

  // Report Data State
  const [reportData, setReportData] = useState(null);

  // Load available groups on mount
  useEffect(() => {
    const loadGroups = async () => {
      const { data } = await supabase.from('swimmers').select('group_name');
      if (data) {
        const unique = [...new Set(data.map(d => d.group_name).filter(Boolean))].sort();
        setAvailableGroups(unique);
      }
    };
    loadGroups();

    // Set default date range to last 7 days
    const today = new Date();
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    setDateRange({
      start: lastWeek.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    });
  }, []);

  // ============================================
  // GENERATE REPORT
  // ============================================

  const generateReport = async () => {
    if (!dateRange.start || !dateRange.end) {
      alert('Please select a date range');
      return;
    }

    setStep('loading');
    setLoadingProgress(0);

    try {
      // 1. Fetch Swimmers
      setLoadingMessage('Loading swimmers...');
      setLoadingProgress(10);
      const { data: swimmers } = await supabase.from('swimmers').select('*');
      
      // Filter by group if selected
      const filteredSwimmers = selectedGroups.length > 0
        ? swimmers.filter(s => selectedGroups.includes(s.group_name))
        : swimmers;
      
      const swimmerIds = filteredSwimmers.map(s => s.id);
      const swimmerMap = filteredSwimmers.reduce((acc, s) => { acc[s.id] = s; return acc; }, {});

      // 2. Fetch Meet Results (within date range)
      setLoadingMessage('Loading meet results...');
      setLoadingProgress(20);
      
      const { data: meetResults } = await supabase
        .from('results')
        .select('*')
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)
        .in('swimmer_id', swimmerIds);

      if (!meetResults || meetResults.length === 0) {
        alert('No results found for the selected date range and filters.');
        setStep('select');
        return;
      }

      // 3. Fetch Historical Results (before meet)
      setLoadingMessage('Loading historical times...');
      setLoadingProgress(40);
      
      let allHistoricalResults = [];
      let page = 0;
      let keepFetching = true;

      while (keepFetching) {
        const { data: batch, error } = await supabase
          .from('results')
          .select('swimmer_id, event, time, date')
          .lt('date', dateRange.start)
          .in('swimmer_id', swimmerIds)
          .order('id', { ascending: true })
          .range(page * 1000, (page + 1) * 1000 - 1);

        if (error || !batch || batch.length === 0) keepFetching = false;
        else {
          allHistoricalResults = [...allHistoricalResults, ...batch];
          page++;
          if (allHistoricalResults.length > 100000) keepFetching = false;
        }
      }

      // Build historical best times map
      setLoadingMessage('Analyzing personal bests...');
      setLoadingProgress(50);
      
      const historicalBests = {}; // { swimmerId: { "50 Freestyle": { time, seconds } } }
      allHistoricalResults.forEach(r => {
        const normalized = normalizeEvent(r.event);
        if (!normalized) return;
        const seconds = timeToSeconds(r.time);
        if (seconds >= 999999) return;

        if (!historicalBests[r.swimmer_id]) historicalBests[r.swimmer_id] = {};
        if (!historicalBests[r.swimmer_id][normalized] || seconds < historicalBests[r.swimmer_id][normalized].seconds) {
          historicalBests[r.swimmer_id][normalized] = { time: r.time, seconds };
        }
      });

      // 4. Fetch Time Standards
      setLoadingMessage('Loading time standards...');
      setLoadingProgress(60);
      
      const { data: standards } = await supabase
        .from('time_standards')
        .select('*');

      // 5. Analyze Meet Results
      setLoadingMessage('Analyzing meet performance...');
      setLoadingProgress(70);

      const analysis = analyzeMeetResults(meetResults, historicalBests, swimmerMap, standards);

      // 6. Build Report Data
      setLoadingMessage('Generating report...');
      setLoadingProgress(90);

      setReportData({
        meetName: meetName || `Meet Report`,
        dateRange,
        swimmers: filteredSwimmers,
        swimmerMap,
        ...analysis
      });

      setLoadingProgress(100);
      setTimeout(() => setStep('report'), 500);

    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error generating report: ' + error.message);
      setStep('select');
    }
  };

  // ============================================
  // ANALYSIS LOGIC
  // ============================================

  const analyzeMeetResults = (meetResults, historicalBests, swimmerMap, standards) => {
    const totalSwims = meetResults.length;
    let bestTimeCount = 0;
    let firstTimeCount = 0;
    const timeDrops = [];
    const newStandards = [];
    const strokeStats = {};
    const groupStats = {};
    const swimmerPerformance = {};

    // Track best times at this meet per swimmer/event
    const meetBests = {}; // { swimmerId: { event: { time, seconds } } }

    meetResults.forEach(result => {
      const swimmer = swimmerMap[result.swimmer_id];
      if (!swimmer) return;

      const normalized = normalizeEvent(result.event);
      if (!normalized) return;

      const currentSeconds = timeToSeconds(result.time);
      if (currentSeconds >= 999999) return;

      const { dist, stroke } = parseEvent(result.event);

      // Track meet best per swimmer/event
      if (!meetBests[result.swimmer_id]) meetBests[result.swimmer_id] = {};
      if (!meetBests[result.swimmer_id][normalized] || currentSeconds < meetBests[result.swimmer_id][normalized].seconds) {
        meetBests[result.swimmer_id][normalized] = { time: result.time, seconds: currentSeconds };
      }

      // Initialize swimmer performance tracking
      if (!swimmerPerformance[result.swimmer_id]) {
        swimmerPerformance[result.swimmer_id] = {
          swimmer,
          swims: 0,
          bestTimes: 0,
          totalDrop: 0,
          biggestDrop: 0,
          biggestDropEvent: '',
          newStandards: []
        };
      }
      swimmerPerformance[result.swimmer_id].swims++;

      // Check if this is a best time or first time
      const historicalBest = historicalBests[result.swimmer_id]?.[normalized];

      if (!historicalBest) {
        // First time in this event
        firstTimeCount++;
      } else if (currentSeconds < historicalBest.seconds) {
        // Best time!
        bestTimeCount++;
        swimmerPerformance[result.swimmer_id].bestTimes++;

        const drop = historicalBest.seconds - currentSeconds;
        swimmerPerformance[result.swimmer_id].totalDrop += drop;

        if (drop > swimmerPerformance[result.swimmer_id].biggestDrop) {
          swimmerPerformance[result.swimmer_id].biggestDrop = drop;
          swimmerPerformance[result.swimmer_id].biggestDropEvent = normalized;
        }

        timeDrops.push({
          swimmer,
          event: normalized,
          oldTime: historicalBest.time,
          oldSeconds: historicalBest.seconds,
          newTime: result.time,
          newSeconds: currentSeconds,
          drop,
          dropPercent: (drop / historicalBest.seconds) * 100
        });
      }

      // Stroke stats
      if (!strokeStats[stroke]) {
        strokeStats[stroke] = { swims: 0, bestTimes: 0, totalDrop: 0, drops: [] };
      }
      strokeStats[stroke].swims++;
      
      if (historicalBest && currentSeconds < historicalBest.seconds) {
        strokeStats[stroke].bestTimes++;
        strokeStats[stroke].totalDrop += (historicalBest.seconds - currentSeconds);
        strokeStats[stroke].drops.push(historicalBest.seconds - currentSeconds);
      }

      // Group stats
      const group = swimmer.group_name || 'Ungrouped';
      if (!groupStats[group]) {
        groupStats[group] = { swimmers: new Set(), swims: 0, bestTimes: 0, totalDrop: 0 };
      }
      groupStats[group].swimmers.add(result.swimmer_id);
      groupStats[group].swims++;
      
      if (historicalBest && currentSeconds < historicalBest.seconds) {
        groupStats[group].bestTimes++;
        groupStats[group].totalDrop += (historicalBest.seconds - currentSeconds);
      }

      // Check for new standards achieved
      if (standards && swimmer) {
        const swimmerAge = parseInt(swimmer.age) || 0;
        const swimmerGender = (swimmer.gender || 'M').trim().toUpperCase();

        const relevantStandards = standards.filter(std => {
          const stdGender = std.gender.trim().toUpperCase();
          const genderMatch = stdGender === swimmerGender;
          const ageMatch = (std.age_max === 99) || (swimmerAge >= std.age_min && swimmerAge <= std.age_max);
          
          // Match event
          const { dist: stdDist, stroke: stdStroke } = parseEvent(std.event);
          const eventMatch = dist === stdDist && stroke.toLowerCase() === stdStroke.toLowerCase();

          return genderMatch && ageMatch && eventMatch;
        });

        relevantStandards.forEach(std => {
          // Check if achieved now but not before
          const achievedNow = currentSeconds <= std.time_seconds;
          const achievedBefore = historicalBest && historicalBest.seconds <= std.time_seconds;

          if (achievedNow && !achievedBefore) {
            newStandards.push({
              swimmer,
              event: normalized,
              standard: std.name,
              time: result.time,
              cutTime: secondsToTime(std.time_seconds)
            });

            swimmerPerformance[result.swimmer_id].newStandards.push({
              event: normalized,
              standard: std.name
            });
          }
        });
      }
    });

    // Sort time drops by absolute drop
    timeDrops.sort((a, b) => b.drop - a.drop);

    // Calculate stroke averages
    Object.keys(strokeStats).forEach(stroke => {
      const stats = strokeStats[stroke];
      stats.btPercent = stats.swims > 0 ? Math.round((stats.bestTimes / stats.swims) * 100) : 0;
      stats.avgDrop = stats.drops.length > 0 
        ? stats.drops.reduce((a, b) => a + b, 0) / stats.drops.length 
        : 0;
    });

    // Convert group stats
    const groupStatsArray = Object.entries(groupStats).map(([name, stats]) => ({
      name,
      swimmerCount: stats.swimmers.size,
      swims: stats.swims,
      bestTimes: stats.bestTimes,
      btPercent: stats.swims > 0 ? Math.round((stats.bestTimes / stats.swims) * 100) : 0,
      avgDrop: stats.bestTimes > 0 ? stats.totalDrop / stats.bestTimes : 0
    }));

    // Group standards by level
    const standardsByLevel = {};
    newStandards.forEach(ns => {
      if (!standardsByLevel[ns.standard]) standardsByLevel[ns.standard] = [];
      standardsByLevel[ns.standard].push(ns);
    });

    // Find biggest movers
    const biggestMovers = Object.values(swimmerPerformance)
      .filter(p => p.totalDrop > 0)
      .sort((a, b) => b.totalDrop - a.totalDrop)
      .slice(0, 10);

    return {
      totalSwims,
      bestTimeCount,
      firstTimeCount,
      btPercent: totalSwims > 0 ? Math.round((bestTimeCount / totalSwims) * 100) : 0,
      timeDrops,
      newStandards,
      standardsByLevel,
      strokeStats,
      groupStats: groupStatsArray,
      swimmerPerformance,
      biggestMovers,
      topTimeDrops: timeDrops.slice(0, 5),
      topPercentDrops: [...timeDrops].sort((a, b) => b.dropPercent - a.dropPercent).slice(0, 5)
    };
  };

  // ============================================
  // RENDER: SELECTION SCREEN
  // ============================================

  if (step === 'select') {
    return (
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="text-indigo-600" /> Meet Report Generator
            </h2>
            <p className="text-slate-500">Generate a comprehensive post-meet report</p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl border shadow-sm p-6 space-y-6">
          {/* Meet Name (Optional) */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Meet Name (Optional)
            </label>
            <input
              type="text"
              value={meetName}
              onChange={(e) => setMeetName(e.target.value)}
              placeholder="e.g., WAC Startup Classic"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                <Calendar size={14} className="inline mr-1" /> Start Date
              </label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                <Calendar size={14} className="inline mr-1" /> End Date
              </label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Group Filter */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              <Users size={14} className="inline mr-1" /> Filter by Group (Optional)
            </label>
            <div className="flex flex-wrap gap-2">
              {availableGroups.map(group => (
                <button
                  key={group}
                  onClick={() => {
                    setSelectedGroups(prev =>
                      prev.includes(group)
                        ? prev.filter(g => g !== group)
                        : [...prev, group]
                    );
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedGroups.includes(group)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {group}
                </button>
              ))}
              {selectedGroups.length > 0 && (
                <button
                  onClick={() => setSelectedGroups([])}
                  className="px-3 py-1.5 rounded-full text-sm font-medium text-rose-600 hover:bg-rose-50"
                >
                  Clear All
                </button>
              )}
            </div>
            {availableGroups.length === 0 && (
              <p className="text-sm text-slate-400 mt-2">No groups found</p>
            )}
          </div>

          {/* Generate Button */}
          <button
            onClick={generateReport}
            disabled={!dateRange.start || !dateRange.end}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
          >
            <Sparkles size={20} />
            Generate Report
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: LOADING SCREEN
  // ============================================

  if (step === 'loading') {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <div className="w-20 h-20 mx-auto mb-6 relative">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
          <div
            className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"
          ></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-indigo-600">{loadingProgress}%</span>
          </div>
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">Generating Report</h3>
        <p className="text-slate-500">{loadingMessage}</p>
        
        {/* Progress bar */}
        <div className="mt-6 w-full bg-slate-200 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
            style={{ width: `${loadingProgress}%` }}
          ></div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: REPORT VIEW
  // ============================================

  if (step === 'report' && reportData) {
    const {
      meetName: reportMeetName,
      dateRange: reportDateRange,
      totalSwims,
      bestTimeCount,
      firstTimeCount,
      btPercent,
      topTimeDrops,
      newStandards,
      standardsByLevel,
      strokeStats,
      groupStats,
      biggestMovers
    } = reportData;

    // Prepare chart data
    const strokeChartData = Object.entries(strokeStats).map(([stroke, stats]) => ({
      name: stroke,
      'Best Time %': stats.btPercent,
      'Total Swims': stats.swims,
      'Avg Drop': parseFloat(stats.avgDrop.toFixed(2))
    }));

    const groupChartData = groupStats.map(g => ({
      name: g.name,
      'Best Time %': g.btPercent,
      'Swimmers': g.swimmerCount
    }));

    const standardsPieData = Object.entries(standardsByLevel).map(([level, items]) => ({
      name: level,
      value: items.length
    }));

    return (
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setStep('select')}
              className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{reportMeetName}</h2>
              <p className="text-slate-500">
                {new Date(reportDateRange.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {' - '}
                {new Date(reportDateRange.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors">
              <Share2 size={20} />
            </button>
            <button className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors">
              <Download size={20} />
            </button>
          </div>
        </div>

        {/* Executive Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Activity}
            label="Total Swims"
            value={totalSwims}
            color="blue"
          />
          <StatCard
            icon={TrendingUp}
            label="Best Times"
            value={bestTimeCount}
            subValue={`${btPercent}% of swims`}
            color="green"
          />
          <StatCard
            icon={Zap}
            label="First Times"
            value={firstTimeCount}
            subValue="New events"
            color="yellow"
          />
          <StatCard
            icon={Award}
            label="New Standards"
            value={newStandards.length}
            subValue="Achieved"
            color="purple"
          />
        </div>

        {/* Biggest Best Time Percentage - Hero Section */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-sm font-medium uppercase tracking-wide">Team Best Time Rate</p>
              <p className="text-5xl font-black mt-1">{btPercent}%</p>
              <p className="text-emerald-100 mt-2">{bestTimeCount} out of {totalSwims} swims were best times!</p>
            </div>
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center">
              <TrendingUp size={48} />
            </div>
          </div>
        </div>

        {/* Top Time Drops */}
        <ExpandableSection title="Biggest Time Drops" icon={Flame} count={topTimeDrops.length}>
          <div className="space-y-3">
            {topTimeDrops.map((drop, idx) => (
              <div key={idx} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                  idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-slate-400' : idx === 2 ? 'bg-amber-700' : 'bg-slate-300'
                }`}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800">{drop.swimmer.name}</p>
                  <p className="text-sm text-slate-500">{drop.event}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm text-slate-500">{drop.oldTime} → {drop.newTime}</p>
                  <p className="font-bold text-emerald-600">-{drop.drop.toFixed(2)}s</p>
                </div>
              </div>
            ))}
          </div>
        </ExpandableSection>

        {/* New Standards Achieved */}
        {newStandards.length > 0 && (
          <ExpandableSection title="New Time Standards Achieved" icon={Trophy} count={newStandards.length}>
            <div className="space-y-4">
              {STANDARD_HIERARCHY.filter(level => standardsByLevel[level]?.length > 0).map(level => (
                <div key={level}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold text-white ${STANDARD_COLORS[level]?.bg || 'bg-slate-400'}`}>
                      {level}
                    </span>
                    <span className="text-sm text-slate-500">{standardsByLevel[level].length} achieved</span>
                  </div>
                  <div className="grid gap-2">
                    {standardsByLevel[level].map((ns, idx) => (
                      <div key={idx} className={`p-3 rounded-xl border ${STANDARD_COLORS[level]?.light || 'bg-slate-50'} ${STANDARD_COLORS[level]?.border || 'border-slate-200'}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-slate-800">{ns.swimmer.name}</p>
                            <p className="text-sm text-slate-500">{ns.event}</p>
                          </div>
                          <p className="font-mono font-bold text-slate-700">{ns.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ExpandableSection>
        )}

        {/* Stroke Breakdown */}
        <ExpandableSection title="Performance by Stroke" icon={Activity}>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Chart */}
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={strokeChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip
                    formatter={(value, name) => [name === 'Best Time %' ? `${value}%` : value, name]}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="Best Time %" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Stats Table */}
            <div className="space-y-2">
              {Object.entries(strokeStats).map(([stroke, stats]) => (
                <div key={stroke} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div>
                    <p className="font-semibold text-slate-800">{stroke}</p>
                    <p className="text-sm text-slate-500">{stats.swims} swims</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-600">{stats.btPercent}% BT</p>
                    {stats.avgDrop > 0 && (
                      <p className="text-sm text-slate-500">Avg drop: -{stats.avgDrop.toFixed(2)}s</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ExpandableSection>

        {/* Group Performance */}
        {groupStats.length > 0 && (
          <ExpandableSection title="Performance by Group" icon={Users}>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Chart */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={groupChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      formatter={(value, name) => [name === 'Best Time %' ? `${value}%` : value, name]}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                    />
                    <Bar dataKey="Best Time %" radius={[4, 4, 0, 0]}>
                      {groupChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Stats Table */}
              <div className="space-y-2">
                {groupStats.map((group, idx) => (
                  <div key={group.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                      ></div>
                      <div>
                        <p className="font-semibold text-slate-800">{group.name}</p>
                        <p className="text-sm text-slate-500">{group.swimmerCount} swimmers • {group.swims} swims</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-blue-600">{group.btPercent}% BT</p>
                      {group.avgDrop > 0 && (
                        <p className="text-sm text-slate-500">Avg: -{group.avgDrop.toFixed(2)}s</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ExpandableSection>
        )}

        {/* Biggest Movers */}
        {biggestMovers.length > 0 && (
          <ExpandableSection title="Biggest Movers (Total Time Dropped)" icon={Medal} count={biggestMovers.length}>
            <div className="space-y-2">
              {biggestMovers.map((mover, idx) => (
                <div key={mover.swimmer.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                    idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-slate-400' : idx === 2 ? 'bg-amber-700' : 'bg-slate-300'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800">{mover.swimmer.name}</p>
                    <p className="text-sm text-slate-500">
                      {mover.bestTimes} best time{mover.bestTimes !== 1 ? 's' : ''} • 
                      Biggest: {mover.biggestDropEvent} (-{mover.biggestDrop.toFixed(2)}s)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-600">-{mover.totalDrop.toFixed(2)}s</p>
                    <p className="text-xs text-slate-500">total</p>
                  </div>
                </div>
              ))}
            </div>
          </ExpandableSection>
        )}

        {/* Standards Distribution Pie Chart */}
        {standardsPieData.length > 0 && (
          <ExpandableSection title="Standards Distribution" icon={Target}>
            <div className="flex items-center justify-center h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={standardsPieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {standardsPieData.map((entry, index) => {
                      const colors = {
                        'AAAA': '#f43f5e',
                        'AAA': '#a855f7',
                        'AA': '#3b82f6',
                        'A': '#eab308',
                        'BB': '#94a3b8',
                        'B': '#d97706'
                      };
                      return <Cell key={`cell-${index}`} fill={colors[entry.name] || CHART_COLORS[index]} />;
                    })}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ExpandableSection>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-slate-400 pt-8 border-t">
          <p>Generated by StormTracker • {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    );
  }

  return null;
}
