// src/MeetReportGenerator.jsx
// Comprehensive Meet Report Generator for Coaches
// V3: Added age group filtering + Classic format option

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './supabase';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  ChevronLeft, Calendar, Users, Trophy, TrendingUp, TrendingDown,
  Award, Target, Zap, Clock, Filter, Download, Share2, Loader2,
  CheckCircle, Star, Flame, Medal, ChevronDown, ChevronRight,
  Percent, Timer, Activity, BarChart3, FileText, Sparkles, Printer,
  LayoutTemplate, Plus, Edit2, Trash2
} from 'lucide-react';
import ReportLayoutEditor from './ReportLayoutEditor';
import { getDefaultLayout } from './reportSections';
import DynamicMeetReport from './DynamicMeetReport';

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

const getAgeGroup = (age) => {
  if (!age) return null;
  const numAge = parseInt(age);
  if (numAge <= 8) return '8 & Under';
  if (numAge >= 9 && numAge <= 10) return '9-10';
  if (numAge >= 11 && numAge <= 12) return '11-12';
  if (numAge >= 13 && numAge <= 14) return '13-14';
  if (numAge >= 15 && numAge <= 18) return '15-18';
  if (numAge >= 19) return '19 & Over';
  return null;
};

const abbreviateEvent = (event) => {
  if (!event) return '';
  return event
    .replace('Freestyle', 'Free')
    .replace('Backstroke', 'Back')
    .replace('Breaststroke', 'Breast')
    .replace('Butterfly', 'Fly')
    .replace(' IM', ' IM'); // Keep IM as is
};

const normalizeEvent = (evt) => {
  const { dist, stroke } = parseEvent(evt);
  if (!dist || !stroke) return null;
  return `${dist} ${stroke}`;
};

// Standard hierarchy
const STANDARD_HIERARCHY = ['AAAA', 'AAA', 'AA', 'A', 'BB', 'B'];
const STANDARD_COLORS = {
  'AAAA': { bg: 'bg-rose-500', light: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200', hex: '#f43f5e' },
  'AAA': { bg: 'bg-purple-500', light: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', hex: '#a855f7' },
  'AA': { bg: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', hex: '#3b82f6' },
  'A': { bg: 'bg-yellow-500', light: 'bg-yellow-50', text: 'text-yellow-600', border: 'border-yellow-200', hex: '#eab308' },
  'BB': { bg: 'bg-slate-400', light: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', hex: '#94a3b8' },
  'B': { bg: 'bg-amber-600', light: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', hex: '#d97706' },
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
// PDF EXPORT FUNCTION
// ============================================

const generatePDFContent = (data) => {
  // Get layout configuration
  const layout = data.layout || getDefaultLayout('modern');
  const enabledSections = (layout.sections || [])
    .filter(s => s.enabled)
    .sort((a, b) => a.order - b.order);
  
  // Helper to check if section is enabled
  const isSectionEnabled = (sectionId) => enabledSections.some(s => s.id === sectionId);
  
  return `
<!DOCTYPE html>
<html>
<head>
  <title>${data.meetName || 'Meet Report'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1e293b; line-height: 1.5; padding: 20px; max-width: 800px; margin: 0 auto;
    }
    .header {
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      color: white; padding: 30px; border-radius: 16px; margin-bottom: 24px;
    }
    .header h1 { font-size: 28px; margin-bottom: 8px; }
    .header p { opacity: 0.9; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .stat-card {
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; text-align: center;
    }
    .stat-card .label { font-size: 11px; color: #64748b; text-transform: uppercase; }
    .stat-card .value { font-size: 24px; font-weight: 700; color: #1e293b; }
    .stat-card .sub { font-size: 11px; color: #64748b; }
    .hero {
      background: linear-gradient(135deg, #10b981, #14b8a6);
      color: white; padding: 24px; border-radius: 16px; margin-bottom: 24px;
    }
    .hero .big-number { font-size: 48px; font-weight: 900; }
    .section {
      background: white; border: 1px solid #e2e8f0; border-radius: 12px;
      margin-bottom: 16px; overflow: hidden; page-break-inside: avoid;
    }
    .section-header {
      background: #f8fafc; padding: 12px 16px; font-weight: 700; font-size: 16px; border-bottom: 1px solid #e2e8f0;
    }
    .section-content { padding: 16px; }
    .item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
    .item:last-child { border-bottom: none; }
    .item .rank {
      width: 24px; height: 24px; border-radius: 50%; background: #e2e8f0;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; margin-right: 12px; color: #64748b;
    }
    .item .rank.gold { background: #fbbf24; color: white; }
    .item .rank.silver { background: #94a3b8; color: white; }
    .item .rank.bronze { background: #b45309; color: white; }
    .item .name { font-weight: 600; }
    .item .event { color: #64748b; font-size: 14px; }
    .item .drop { color: #10b981; font-weight: 700; }
    .item .details { font-size: 12px; color: #94a3b8; margin-left: 36px; }
    .badge {
      display: inline-block; padding: 2px 8px; border-radius: 12px;
      font-size: 12px; font-weight: 700; color: white; margin-right: 8px;
    }
    .badge-AAAA { background: #f43f5e; }
    .badge-AAA { background: #a855f7; }
    .badge-AA { background: #3b82f6; }
    .badge-A { background: #eab308; }
    .badge-BB { background: #94a3b8; }
    .badge-B { background: #d97706; }
    .standard-group { margin-bottom: 16px; }
    .standard-item { padding: 8px 12px; background: #f8fafc; border-radius: 8px; margin-bottom: 6px; display: flex; justify-content: space-between; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #f1f5f9; }
    th { background: #f8fafc; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; }
    .footer { text-align: center; padding: 24px; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; margin-top: 24px; }
    @media print { body { padding: 0; } .section { break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${data.meetName || 'Meet Report'}</h1>
    <p>${new Date(data.dateRange.start).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${new Date(data.dateRange.end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
  </div>

  ${isSectionEnabled('overview-stats') ? `
  <div class="stats-grid">
    <div class="stat-card"><div class="label">Total Swims</div><div class="value">${data.totalSwims}</div></div>
    <div class="stat-card"><div class="label">Best Times</div><div class="value">${data.bestTimeCount}</div><div class="sub">${data.btPercent}% of swims</div></div>
    <div class="stat-card"><div class="label">First Times</div><div class="value">${data.firstTimeCount}</div></div>
    <div class="stat-card"><div class="label">New Standards</div><div class="value">${data.newStandards.length}</div></div>
  </div>
  ` : ''}

  ${isSectionEnabled('bt-percentage') ? `
  <div class="hero">
    <div><div style="font-size:12px;opacity:0.9;text-transform:uppercase">Team Best Time Rate</div><div class="big-number">${data.btPercent}%</div><div style="opacity:0.9">${data.bestTimeCount} out of ${data.totalSwims} swims</div></div>
  </div>
  ` : ''}

  ${isSectionEnabled('time-drops') && data.topTimeDrops && data.topTimeDrops.length > 0 ? `
  <div class="section">
    <div class="section-header">🔥 Biggest Time Drops</div>
    <div class="section-content">
      ${data.topTimeDrops.map((drop, idx) => `
        <div class="item">
          <div><span class="rank ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : ''}">${idx + 1}</span><span class="name">${drop.swimmer.name}</span> <span class="event">- ${drop.event}</span></div>
          <span class="drop">-${drop.drop.toFixed(2)}s</span>
        </div>
        <div class="details">${drop.oldTime} → ${drop.newTime}</div>
      `).join('')}
    </div>
  </div>
  ` : ''}

  ${isSectionEnabled('new-standards') && data.newStandards && data.newStandards.length > 0 ? `
  <div class="section">
    <div class="section-header">🏆 New Time Standards Achieved</div>
    <div class="section-content">
      ${['AAAA', 'AAA', 'AA', 'A', 'BB', 'B'].filter(level => data.standardsByLevel[level]?.length > 0).map(level => `
        <div class="standard-group">
          <div style="margin-bottom:8px"><span class="badge badge-${level}">${level}</span><span style="color:#64748b;font-size:14px">${data.standardsByLevel[level].length} achieved</span></div>
          ${data.standardsByLevel[level].map(ns => `
            <div class="standard-item"><div><strong>${ns.swimmer.name}</strong> <span style="color:#64748b">- ${ns.event}</span></div><span style="font-family:monospace">${ns.time}</span></div>
          `).join('')}
        </div>
      `).join('')}
    </div>
  </div>
  ` : ''}

  ${isSectionEnabled('stroke-performance') && data.strokeStats && Object.keys(data.strokeStats).length > 0 ? `
  <div class="section">
    <div class="section-header">🏊 Performance by Stroke</div>
    <div class="section-content">
      <table>
        <thead><tr><th>Stroke</th><th>Swims</th><th>Best Time %</th><th>Avg Drop</th></tr></thead>
        <tbody>
          ${Object.entries(data.strokeStats).map(([stroke, stats]) => `
            <tr><td><strong>${stroke}</strong></td><td>${stats.swims}</td><td>${stats.btPercent}%</td><td>${stats.avgDrop > 0 ? '-' + stats.avgDrop.toFixed(2) + 's' : '-'}</td></tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
  ` : ''}

  ${isSectionEnabled('group-performance') && data.groupStats && data.groupStats.length > 0 ? `
  <div class="section">
    <div class="section-header">👥 Performance by Group</div>
    <div class="section-content">
      <table>
        <thead><tr><th>Group</th><th>Swimmers</th><th>Swims</th><th>Best Time %</th></tr></thead>
        <tbody>
          ${data.groupStats.map(group => `
            <tr><td><strong>${group.name}</strong></td><td>${group.swimmerCount}</td><td>${group.swims}</td><td>${group.btPercent}%</td></tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
  ` : ''}

  ${isSectionEnabled('biggest-movers') && data.biggestMovers && data.biggestMovers.length > 0 ? `
  <div class="section">
    <div class="section-header">🥇 Biggest Movers (Total Time Dropped)</div>
    <div class="section-content">
      ${data.biggestMovers.slice(0, 10).map((mover, idx) => `
        <div class="item">
          <div><span class="rank ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : ''}">${idx + 1}</span><span class="name">${mover.swimmer.name}</span></div>
          <span class="drop">-${mover.totalDrop.toFixed(2)}s</span>
        </div>
        <div class="details">${mover.bestTimes} BT • Best: ${mover.biggestDropEvent} (-${mover.biggestDrop.toFixed(2)}s)</div>
      `).join('')}
    </div>
  </div>
  ` : ''}

  <div class="footer">Generated by StormTracker • ${new Date().toLocaleDateString()}</div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
};

// ============================================
// OLD FORMAT PDF EXPORT FUNCTION
// ============================================

const generateClassicPDFContent = (data) => {
  console.log('Classic PDF - newStandards:', data.newStandards);
  
  // Get layout configuration
  const layout = data.layout || getDefaultLayout('classic');
  const enabledSections = (layout.sections || [])
    .filter(s => s.enabled)
    .sort((a, b) => a.order - b.order);
  
  // Helper to check if section is enabled
  const isSectionEnabled = (sectionId) => enabledSections.some(s => s.id === sectionId);
  
  // Helper function to abbreviate event names
  const abbrevEvent = (event) => {
    if (!event) return '';
    return event
      .replace('Freestyle', 'Free')
      .replace('Backstroke', 'Back')
      .replace('Breaststroke', 'Breast')
      .replace('Butterfly', 'Fly');
  };
  
  // Group new standards by swimmer
  const standardsBySwimmer = {};
  data.newStandards.forEach(ns => {
    const swimmerId = ns.swimmer.id;
    if (!standardsBySwimmer[swimmerId]) {
      standardsBySwimmer[swimmerId] = {
        name: ns.swimmer.name,
        standards: []
      };
    }
    
    // Extract level from standard name (e.g., "Boys 11-12 50 Freestyle BB" -> "BB")
    const standardParts = ns.standard.split(' ');
    const level = standardParts[standardParts.length - 1]; // Last part is the level
    
    standardsBySwimmer[swimmerId].standards.push({
      level: level,
      event: abbrevEvent(ns.event)
    });
  });

  // Sort swimmers by name
  const swimmersList = Object.values(standardsBySwimmer).sort((a, b) => 
    a.name.localeCompare(b.name)
  );
  
  console.log('Classic PDF - swimmersList:', swimmersList);
  
  // Process meet cuts data
  const meetCutsProcessed = {};
  if (data.meetCutsByMeet) {
    Object.entries(data.meetCutsByMeet).forEach(([meetName, cuts]) => {
      const cutsBySwimmer = {};
      cuts.forEach(cut => {
        const swimmerId = cut.swimmer.id;
        if (!cutsBySwimmer[swimmerId]) {
          cutsBySwimmer[swimmerId] = {
            name: cut.swimmer.name,
            events: []
          };
        }
        cutsBySwimmer[swimmerId].events.push(abbrevEvent(cut.event));
      });
      
      meetCutsProcessed[meetName] = Object.values(cutsBySwimmer).sort((a, b) => 
        a.name.localeCompare(b.name)
      );
    });
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <title>${data.meetName || 'Meet Report'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #000; line-height: 1.8; padding: 40px; max-width: 900px; margin: 0 auto;
      font-size: 14px;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid #000;
    }
    .header h1 { 
      font-size: 32px; 
      font-weight: 900; 
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .header .subtitle { 
      font-size: 18px; 
      font-weight: 600;
      color: #333;
    }
    .section {
      margin-bottom: 40px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #333;
    }
    .highlight-stat {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 12px;
      line-height: 1.6;
    }
    .swimmer-entry {
      margin-bottom: 8px;
      line-height: 1.6;
    }
    .swimmer-name {
      font-weight: 700;
    }
    .standards-list {
      display: inline;
    }
    .standard-badge {
      font-weight: 700;
      margin-right: 4px;
    }
    .info-section {
      background: #f5f5f5;
      padding: 20px;
      border-radius: 8px;
      margin-top: 30px;
      font-size: 13px;
      line-height: 1.7;
    }
    .info-section h3 {
      font-size: 16px;
      margin-bottom: 12px;
      font-weight: 700;
    }
    .info-section ul {
      margin-left: 20px;
      margin-top: 8px;
    }
    .info-section li {
      margin-bottom: 4px;
    }
    @media print { 
      body { padding: 20px; font-size: 12px; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>MEET REPORT</h1>
    <div class="subtitle">${data.meetName || 'Team Performance Report'}</div>
    <div class="subtitle">${new Date(data.dateRange.start).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${new Date(data.dateRange.end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
  </div>

  ${isSectionEnabled('overview-stats') || isSectionEnabled('bt-percentage') ? `
  <div class="section">
    <div class="highlight-stat">
      Team Performance <strong>${data.btPercent}%</strong> Best times! (${data.bestTimeCount} out of ${data.totalSwims})
    </div>
    ${data.firstTimeCount > 0 ? `<div class="highlight-stat"><strong>${data.firstTimeCount}</strong> Established First Times!</div>` : ''}
  </div>
  ` : ''}

  ${isSectionEnabled('new-standards') && swimmersList.length > 0 ? `
  <div class="section">
    <div class="section-title">New Motivational Time Standards:</div>
    ${swimmersList.map(swimmer => {
      // Group standards by level for this swimmer
      const byLevel = {};
      swimmer.standards.forEach(std => {
        if (!byLevel[std.level]) byLevel[std.level] = [];
        byLevel[std.level].push(abbreviateEvent(std.event));
      });
      
      // Build the standards text
      const standardsText = ['AAAA', 'AAA', 'AA', 'A', 'BB', 'B']
        .filter(level => byLevel[level])
        .map(level => `<span class="standard-badge">${level}</span> ${byLevel[level].join(' ')}`)
        .join(' ');
      
      return `
        <div class="swimmer-entry">
          <span class="swimmer-name">${swimmer.name}:</span> ${standardsText || ''}
        </div>
      `;
    }).join('')}
  </div>
  ` : `
  <div class="section">
    <div class="section-title">New Motivational Time Standards:</div>
    <div class="swimmer-entry" style="font-style: italic; color: #666;">No new motivational time standards achieved during this meet.</div>
  </div>
  `}

  ${isSectionEnabled('meet-cuts') && Object.keys(meetCutsProcessed).length > 0 ? `
  <div class="section">
    <div class="section-title">New Meet Cuts</div>
    ${Object.entries(meetCutsProcessed).map(([meetName, swimmersList]) => `
      <div style="margin-bottom: 24px;">
        <div style="font-weight: 700; font-size: 16px; margin-bottom: 12px; text-decoration: underline;">
          ${meetName}
        </div>
        ${swimmersList.map(s => `
          <div class="swimmer-entry">
            <span class="swimmer-name">${s.name}:</span> ${s.events.join(' ')}
          </div>
        `).join('')}
      </div>
    `).join('')}
  </div>
  ` : ''}

  <div class="info-section">
    <h3>Motivational Times:</h3>
    <p>
      USA Swimming uses what is known as time standards or motivational times. This is done to motivate and create goals for swimmers as well as being able to qualify meets. Some meets, for example, may only be for swimmers who have A and above times and conversely some meets may only be for C/B/BB swimmers. Most meets will be open to all but the meet invite will indicate if there are any restrictions on who can attend.
    </p>
    <p style="margin-top:12px;">
      The time standards are determined by USA swimming based on percentages and you can determine where your swimmer stands compared to other swimmers based on the time standard achieved:
    </p>
    <ul>
      <li><strong>C</strong> - All swimmers below a B standard</li>
      <li><strong>B</strong> - Top 55% of swimmers</li>
      <li><strong>BB</strong> - Top 35% of swimmers</li>
      <li><strong>A</strong> - Top 15% of swimmers</li>
      <li><strong>AA</strong> - Top 8% of swimmers</li>
      <li><strong>AAA</strong> - Top 6% of swimmers</li>
      <li><strong>AAAA</strong> - Top 2% of swimmers</li>
    </ul>
  </div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function MeetReportGenerator({ onBack }) {
  const [step, setStep] = useState('select');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [availableGroups, setAvailableGroups] = useState([]);
  const [selectedAgeGroups, setSelectedAgeGroups] = useState([]);
  const [reportFormat, setReportFormat] = useState('modern'); // 'modern' or 'classic'
  const [meetName, setMeetName] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [reportData, setReportData] = useState(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  
  // Layout management
  const [layouts, setLayouts] = useState([]);
  const [selectedLayout, setSelectedLayout] = useState(null);
  const [showLayoutManager, setShowLayoutManager] = useState(false);
  const [editingLayout, setEditingLayout] = useState(null);

  // Available age groups for filtering
  const AGE_GROUPS = [
    '8 & Under',
    '9-10',
    '11-12',
    '13-14',
    '15-18',
    '19 & Over'
  ];

  useEffect(() => {
    const loadGroups = async () => {
      const { data } = await supabase.from('swimmers').select('group_name');
      if (data) {
        const unique = [...new Set(data.map(d => d.group_name).filter(Boolean))].sort();
        setAvailableGroups(unique);
      }
    };
    loadGroups();
    loadLayouts();

    const today = new Date();
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    setDateRange({
      start: lastWeek.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    });
  }, []);

  const loadLayouts = async () => {
    try {
      const { data, error } = await supabase
        .from('report_layouts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setLayouts(data || []);
      
      // Select default layout if none selected
      if (!selectedLayout && data && data.length > 0) {
        const defaultLayout = data.find(l => l.is_default) || data[0];
        setSelectedLayout(defaultLayout);
      }
    } catch (error) {
      console.error('Error loading layouts:', error);
    }
  };

  const handleDeleteLayout = async (layoutId) => {
    if (!confirm('Are you sure you want to delete this layout?')) return;
    
    try {
      const { error } = await supabase
        .from('report_layouts')
        .delete()
        .eq('id', layoutId);
      
      if (error) throw error;
      
      // Reload layouts
      await loadLayouts();
      
      // Clear selection if deleted layout was selected
      if (selectedLayout?.id === layoutId) {
        setSelectedLayout(null);
      }
    } catch (error) {
      console.error('Error deleting layout:', error);
      alert('Failed to delete layout: ' + error.message);
    }
  };

  const handleEditLayout = (layout) => {
    setEditingLayout(layout);
    setShowLayoutManager(false);
  };

  const handleCreateNewLayout = () => {
    setEditingLayout({ 
      name: '', 
      description: '', 
      layout_config: getDefaultLayout(reportFormat) 
    });
    setShowLayoutManager(false);
  };

  const handleExportPDF = async () => {
    if (!reportData) return;
    setIsExportingPDF(true);
    try {
      const printWindow = window.open('', '_blank');
      const content = reportFormat === 'classic' 
        ? generateClassicPDFContent(reportData)
        : generatePDFContent(reportData);
      printWindow.document.write(content);
      printWindow.document.close();
    } catch (error) {
      console.error('PDF export error:', error);
      alert('Error exporting PDF. Please try again.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  // ============================================
  // ANALYSIS LOGIC (FIXED: Deduplication)
  // ============================================

  const analyzeMeetResults = (meetResults, historicalBests, swimmerMap, allStandards) => {
    // Separate motivational standards from meet cuts
    const motivationalLevels = ['B', 'BB', 'A', 'AA', 'AAA', 'AAAA'];
    const standards = allStandards.filter(s => motivationalLevels.includes(s.name));
    const meetCutStandards = allStandards.filter(s => !motivationalLevels.includes(s.name));
    const totalSwims = meetResults.length;
    let bestTimeCount = 0;
    let firstTimeCount = 0;
    const timeDrops = [];
    const strokeStats = {};
    const groupStats = {};
    const swimmerPerformance = {};

    // STEP 1: Build meet bests per swimmer/event (ONLY fastest time)
    const meetBests = {};
    meetResults.forEach(result => {
      const swimmer = swimmerMap[result.swimmer_id];
      if (!swimmer) return;
      const normalized = normalizeEvent(result.event);
      if (!normalized) return;
      const currentSeconds = timeToSeconds(result.time);
      if (currentSeconds >= 999999) return;

      if (!meetBests[result.swimmer_id]) meetBests[result.swimmer_id] = {};
      if (!meetBests[result.swimmer_id][normalized] || currentSeconds < meetBests[result.swimmer_id][normalized].seconds) {
        meetBests[result.swimmer_id][normalized] = { time: result.time, seconds: currentSeconds, result };
      }
    });

    // Count all swims for stroke/group stats
    meetResults.forEach(result => {
      const swimmer = swimmerMap[result.swimmer_id];
      if (!swimmer) return;
      const normalized = normalizeEvent(result.event);
      if (!normalized) return;
      const currentSeconds = timeToSeconds(result.time);
      if (currentSeconds >= 999999) return;
      const { stroke } = parseEvent(result.event);

      if (!strokeStats[stroke]) strokeStats[stroke] = { swims: 0, bestTimes: 0, totalDrop: 0, drops: [] };
      strokeStats[stroke].swims++;

      const group = swimmer.group_name || 'Ungrouped';
      if (!groupStats[group]) groupStats[group] = { swimmers: new Set(), swims: 0, bestTimes: 0, totalDrop: 0 };
      groupStats[group].swimmers.add(result.swimmer_id);
      groupStats[group].swims++;
    });

    // STEP 2: Process using ONLY meet bests (deduped)
    const newStandards = [];
    const processedStandards = new Set();

    Object.entries(meetBests).forEach(([swimmerId, events]) => {
      const swimmer = swimmerMap[swimmerId];
      if (!swimmer) return;

      if (!swimmerPerformance[swimmerId]) {
        swimmerPerformance[swimmerId] = {
          swimmer, swims: 0, bestTimes: 0, totalDrop: 0, biggestDrop: 0, biggestDropEvent: '', newStandards: []
        };
      }

      Object.entries(events).forEach(([normalized, meetBest]) => {
        const { dist, stroke } = parseEvent(normalized);
        const currentSeconds = meetBest.seconds;
        const historicalBest = historicalBests[swimmerId]?.[normalized];

        swimmerPerformance[swimmerId].swims++;

        if (!historicalBest) {
          firstTimeCount++;
        } else if (currentSeconds < historicalBest.seconds) {
          bestTimeCount++;
          swimmerPerformance[swimmerId].bestTimes++;
          const drop = historicalBest.seconds - currentSeconds;
          swimmerPerformance[swimmerId].totalDrop += drop;

          if (drop > swimmerPerformance[swimmerId].biggestDrop) {
            swimmerPerformance[swimmerId].biggestDrop = drop;
            swimmerPerformance[swimmerId].biggestDropEvent = normalized;
          }

          timeDrops.push({
            swimmer, event: normalized, oldTime: historicalBest.time, oldSeconds: historicalBest.seconds,
            newTime: meetBest.time, newSeconds: currentSeconds, drop, dropPercent: (drop / historicalBest.seconds) * 100
          });

          if (strokeStats[stroke]) {
            strokeStats[stroke].bestTimes++;
            strokeStats[stroke].totalDrop += drop;
            strokeStats[stroke].drops.push(drop);
          }
          const group = swimmer.group_name || 'Ungrouped';
          if (groupStats[group]) {
            groupStats[group].bestTimes++;
            groupStats[group].totalDrop += drop;
          }
        }

        // Check standards (ONLY ONCE per swimmer/event/standard)
        if (standards && swimmer) {
          const swimmerAge = parseInt(swimmer.age) || 0;
          const swimmerGender = (swimmer.gender || 'M').trim().toUpperCase();

          const relevantStandards = standards.filter(std => {
            const stdGender = std.gender.trim().toUpperCase();
            const genderMatch = stdGender === swimmerGender;
            const ageMatch = (std.age_max === 99) || (swimmerAge >= std.age_min && swimmerAge <= std.age_max);
            const { dist: stdDist, stroke: stdStroke } = parseEvent(std.event);
            const eventMatch = dist === stdDist && stroke.toLowerCase() === stdStroke.toLowerCase();
            return genderMatch && ageMatch && eventMatch;
          });

          relevantStandards.forEach(std => {
            const standardKey = `${swimmerId}-${normalized}-${std.name}`;
            if (processedStandards.has(standardKey)) return;

            const achievedNow = currentSeconds <= std.time_seconds;
            const achievedBefore = historicalBest && historicalBest.seconds <= std.time_seconds;

            if (achievedNow && !achievedBefore) {
              processedStandards.add(standardKey);
              newStandards.push({
                swimmer, event: normalized, standard: std.name, time: meetBest.time,
                seconds: currentSeconds, cutTime: secondsToTime(std.time_seconds)
              });
              swimmerPerformance[swimmerId].newStandards.push({ event: normalized, standard: std.name });
            }
          });
        }
      });
    });

    timeDrops.sort((a, b) => b.drop - a.drop);

    Object.keys(strokeStats).forEach(stroke => {
      const stats = strokeStats[stroke];
      stats.btPercent = stats.swims > 0 ? Math.round((stats.bestTimes / stats.swims) * 100) : 0;
      stats.avgDrop = stats.drops.length > 0 ? stats.drops.reduce((a, b) => a + b, 0) / stats.drops.length : 0;
    });

    const groupStatsArray = Object.entries(groupStats).map(([name, stats]) => ({
      name, swimmerCount: stats.swimmers.size, swims: stats.swims, bestTimes: stats.bestTimes,
      btPercent: stats.swims > 0 ? Math.round((stats.bestTimes / stats.swims) * 100) : 0,
      avgDrop: stats.bestTimes > 0 ? stats.totalDrop / stats.bestTimes : 0
    }));

    const standardsByLevel = {};
    newStandards.forEach(ns => {
      if (!standardsByLevel[ns.standard]) standardsByLevel[ns.standard] = [];
      standardsByLevel[ns.standard].push(ns);
    });

    const biggestMovers = Object.values(swimmerPerformance)
      .filter(p => p.totalDrop > 0)
      .sort((a, b) => b.totalDrop - a.totalDrop)
      .slice(0, 10);

    // Track new meet cuts (championship qualifying times)
    const newMeetCuts = [];
    const processedMeetCuts = new Set();
    
    Object.entries(meetBests).forEach(([swimmerId, events]) => {
      const swimmer = swimmerMap[swimmerId];
      if (!swimmer) return;
      
      Object.entries(events).forEach(([normalized, meetBest]) => {
        const currentSeconds = meetBest.seconds;
        const historicalBest = historicalBests[swimmerId]?.[normalized];
        
        // Find relevant meet cut standards
        const swimmerAge = parseInt(swimmer.age) || 0;
        const swimmerGender = (swimmer.gender || 'M').trim().toUpperCase();
        
        const relevantCuts = meetCutStandards.filter(std => {
          const stdGender = (std.gender || 'M').trim().toUpperCase();
          const genderMatch = stdGender === swimmerGender;
          const ageMatch = swimmerAge >= std.age_min && swimmerAge <= std.age_max;
          const eventMatch = normalizeEvent(std.event) === normalized;
          return genderMatch && ageMatch && eventMatch;
        });
        
        relevantCuts.forEach(cut => {
          const cutKey = `${swimmerId}-${normalized}-${cut.name}`;
          if (processedMeetCuts.has(cutKey)) return;
          
          const achievedNow = currentSeconds <= cut.time_seconds;
          const achievedBefore = historicalBest && historicalBest.seconds <= cut.time_seconds;
          
          if (achievedNow && !achievedBefore) {
            processedMeetCuts.add(cutKey);
            newMeetCuts.push({
              swimmer,
              event: normalized,
              meetName: cut.name,
              time: meetBest.time,
              cutTime: secondsToTime(cut.time_seconds)
            });
          }
        });
      });
    });
    
    // Group meet cuts by meet name
    const meetCutsByMeet = {};
    newMeetCuts.forEach(cut => {
      if (!meetCutsByMeet[cut.meetName]) {
        meetCutsByMeet[cut.meetName] = [];
      }
      meetCutsByMeet[cut.meetName].push(cut);
    });

    return {
      totalSwims, bestTimeCount, firstTimeCount,
      btPercent: totalSwims > 0 ? Math.round((bestTimeCount / totalSwims) * 100) : 0,
      timeDrops, newStandards, standardsByLevel, strokeStats, groupStats: groupStatsArray,
      swimmerPerformance, biggestMovers, topTimeDrops: timeDrops.slice(0, 5),
      topPercentDrops: [...timeDrops].sort((a, b) => b.dropPercent - a.dropPercent).slice(0, 5),
      newMeetCuts, meetCutsByMeet
    };
  };

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
      setLoadingMessage('Loading swimmers...');
      setLoadingProgress(10);
      const { data: swimmers } = await supabase.from('swimmers').select('*');
      
      // Filter by group if specified
      let filteredSwimmers = selectedGroups.length > 0
        ? swimmers.filter(s => selectedGroups.includes(s.group_name))
        : swimmers;
      
      // Filter by age group if specified
      if (selectedAgeGroups.length > 0) {
        filteredSwimmers = filteredSwimmers.filter(s => {
          const ageGroup = getAgeGroup(s.age);
          return selectedAgeGroups.includes(ageGroup);
        });
      }
      
      const swimmerIds = filteredSwimmers.map(s => s.id);
      const swimmerMap = filteredSwimmers.reduce((acc, s) => { acc[s.id] = s; return acc; }, {});

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

      setLoadingMessage('Analyzing personal bests...');
      setLoadingProgress(50);
      
      const historicalBests = {};
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

      setLoadingMessage('Loading time standards...');
      setLoadingProgress(60);
      
      const { data: standards } = await supabase.from('time_standards').select('*');

      setLoadingMessage('Analyzing meet performance...');
      setLoadingProgress(70);

      const analysis = analyzeMeetResults(meetResults, historicalBests, swimmerMap, standards);

      setLoadingMessage('Generating report...');
      setLoadingProgress(90);

      // Get active layout or default
      const activeLayout = selectedLayout?.layout_config || getDefaultLayout(reportFormat);
      
      setReportData({
        meetName: meetName || `Meet Report`,
        dateRange,
        swimmers: filteredSwimmers,
        swimmerMap,
        layout: activeLayout,
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
  // RENDER: LAYOUT EDITOR
  // ============================================

  if (editingLayout !== null) {
    return (
      <ReportLayoutEditor
        initialLayout={editingLayout.id ? editingLayout : null}
        reportFormat={reportFormat}
        onBack={() => {
          setEditingLayout(null);
          loadLayouts();
        }}
      />
    );
  }

  // ============================================
  // RENDER: SELECTION SCREEN
  // ============================================

  if (step === 'select') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="text-indigo-600" /> Meet Report Generator
            </h2>
            <p className="text-slate-500">Generate a comprehensive post-meet report</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border shadow-sm p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Meet Name (Optional)</label>
            <input
              type="text"
              value={meetName}
              onChange={(e) => setMeetName(e.target.value)}
              placeholder="e.g., WAC Startup Classic"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

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

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              <Users size={14} className="inline mr-1" /> Filter by Group (Optional)
            </label>
            <div className="flex flex-wrap gap-2">
              {availableGroups.map(group => (
                <button
                  key={group}
                  onClick={() => setSelectedGroups(prev => prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group])}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedGroups.includes(group) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {group}
                </button>
              ))}
              {selectedGroups.length > 0 && (
                <button onClick={() => setSelectedGroups([])} className="px-3 py-1.5 rounded-full text-sm font-medium text-rose-600 hover:bg-rose-50">
                  Clear All
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              <Users size={14} className="inline mr-1" /> Filter by Age Group (Optional)
            </label>
            <div className="flex flex-wrap gap-2">
              {AGE_GROUPS.map(ageGroup => (
                <button
                  key={ageGroup}
                  onClick={() => setSelectedAgeGroups(prev => prev.includes(ageGroup) ? prev.filter(g => g !== ageGroup) : [...prev, ageGroup])}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedAgeGroups.includes(ageGroup) ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {ageGroup}
                </button>
              ))}
              {selectedAgeGroups.length > 0 && (
                <button onClick={() => setSelectedAgeGroups([])} className="px-3 py-1.5 rounded-full text-sm font-medium text-rose-600 hover:bg-rose-50">
                  Clear All
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              <FileText size={14} className="inline mr-1" /> Report Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setReportFormat('modern')}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  reportFormat === 'modern' 
                    ? 'border-indigo-600 bg-indigo-50' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="font-semibold text-slate-800 mb-1">Modern Format</div>
                <div className="text-xs text-slate-500">Styled report with charts and detailed analytics</div>
              </button>
              <button
                onClick={() => setReportFormat('classic')}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  reportFormat === 'classic' 
                    ? 'border-indigo-600 bg-indigo-50' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="font-semibold text-slate-800 mb-1">Classic Format</div>
                <div className="text-xs text-slate-500">Simple text format with new standards by swimmer</div>
              </button>
            </div>
          </div>

          {/* Layout Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-slate-700">
                <LayoutTemplate size={14} className="inline mr-1" /> Report Layout
              </label>
              <button
                onClick={handleCreateNewLayout}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
              >
                <Plus size={14} />
                New Layout
              </button>
            </div>
            
            {layouts.length === 0 ? (
              <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl text-center">
                <LayoutTemplate size={24} className="mx-auto text-slate-400 mb-2" />
                <p className="text-sm text-slate-500 mb-2">No custom layouts yet</p>
                <button
                  onClick={handleCreateNewLayout}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Create your first layout
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedLayout(null)}
                  className={`w-full p-3 rounded-xl border-2 transition-all text-left ${
                    !selectedLayout 
                      ? 'border-indigo-600 bg-indigo-50' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-semibold text-slate-800 text-sm">Default Layout</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Standard report with all sections
                  </div>
                </button>
                
                {layouts.map(layout => (
                  <div key={layout.id} className="relative group">
                    <button
                      onClick={() => setSelectedLayout(layout)}
                      className={`w-full p-3 rounded-xl border-2 transition-all text-left ${
                        selectedLayout?.id === layout.id
                          ? 'border-indigo-600 bg-indigo-50' 
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-semibold text-slate-800 text-sm">{layout.name}</div>
                      {layout.description && (
                        <div className="text-xs text-slate-500 mt-1">{layout.description}</div>
                      )}
                      <div className="text-xs text-slate-400 mt-1">
                        {layout.layout_config?.sections?.length || 0} sections
                      </div>
                    </button>
                    
                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditLayout(layout);
                        }}
                        className="p-1.5 bg-white hover:bg-indigo-50 border border-slate-200 rounded-lg text-indigo-600"
                        title="Edit layout"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteLayout(layout.id);
                        }}
                        className="p-1.5 bg-white hover:bg-red-50 border border-slate-200 rounded-lg text-red-600"
                        title="Delete layout"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

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
          <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-indigo-600">{loadingProgress}%</span>
          </div>
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">Generating Report</h3>
        <p className="text-slate-500">{loadingMessage}</p>
        <div className="mt-6 w-full bg-slate-200 rounded-full h-2 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500" style={{ width: `${loadingProgress}%` }}></div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: REPORT VIEW
  // ============================================

  if (step === 'report' && reportData) {
    return (
      <DynamicMeetReport 
        reportData={reportData}
        onBack={() => setStep('select')}
        onExportPDF={handleExportPDF}
        isExportingPDF={isExportingPDF}
      />
    );
  }

  // ============================================
  // DEFAULT: No matching step
  // ============================================

  return null;
}

// Removed old hardcoded report JSX - the following comment marks where old code was
/* OLD REPORT CODE REMOVED - Now using DynamicMeetReport component
function oldReportCode() {
  // This function is never called, just preserves the old code structure for reference
  const removed = () => (
          <ExpandableSection title="Biggest Time Drops" icon={Flame} count={null}>
            <div className="space-y-3">
              {topTimeDrops.map((drop, idx) => (
                <div key={idx} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-slate-400' : idx === 2 ? 'bg-amber-700' : 'bg-slate-300'}`}>
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
        )}

        {newStandards.length > 0 && (
          <ExpandableSection title="New Time Standards Achieved" icon={Trophy} count={newStandards.length}>
            <div className="space-y-4">
              {STANDARD_HIERARCHY.filter(level => standardsByLevel[level]?.length > 0).map(level => (
                <div key={level}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold text-white ${STANDARD_COLORS[level]?.bg || 'bg-slate-400'}`}>{level}</span>
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

        <ExpandableSection title="Performance by Stroke" icon={Activity}>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={strokeChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip formatter={(value, name) => [name === 'Best Time %' ? `${value}%` : value, name]} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                  <Bar dataKey="Best Time %" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {Object.entries(strokeStats).map(([stroke, stats]) => (
                <div key={stroke} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div>
                    <p className="font-semibold text-slate-800">{stroke}</p>
                    <p className="text-sm text-slate-500">{stats.swims} swims</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-600">{stats.btPercent}% BT</p>
                    {stats.avgDrop > 0 && <p className="text-sm text-slate-500">Avg: -{stats.avgDrop.toFixed(2)}s</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ExpandableSection>

        {groupStats.length > 0 && (
          <ExpandableSection title="Performance by Group" icon={Users}>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={groupChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(value, name) => [name === 'Best Time %' ? `${value}%` : value, name]} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                    <Bar dataKey="Best Time %" radius={[4, 4, 0, 0]}>
                      {groupChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {groupStats.map((group, idx) => (
                  <div key={group.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}></div>
                      <div>
                        <p className="font-semibold text-slate-800">{group.name}</p>
                        <p className="text-sm text-slate-500">{group.swimmerCount} swimmers • {group.swims} swims</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-blue-600">{group.btPercent}% BT</p>
                      {group.avgDrop > 0 && <p className="text-sm text-slate-500">Avg: -{group.avgDrop.toFixed(2)}s</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ExpandableSection>
        )}

        {biggestMovers.length > 0 && (
          <ExpandableSection title="Biggest Movers (Total Time Dropped)" icon={Medal} count={biggestMovers.length}>
            <div className="space-y-2">
              {biggestMovers.map((mover, idx) => (
                <div key={mover.swimmer.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-slate-400' : idx === 2 ? 'bg-amber-700' : 'bg-slate-300'}`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800">{mover.swimmer.name}</p>
                    <p className="text-sm text-slate-500">{mover.bestTimes} best time{mover.bestTimes !== 1 ? 's' : ''} • Biggest: {mover.biggestDropEvent} (-{mover.biggestDrop.toFixed(2)}s)</p>
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

        {standardsPieData.length > 0 && (
          <ExpandableSection title="Standards Distribution" icon={Target}>
            <div className="flex items-center justify-center h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={standardsPieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {standardsPieData.map((entry, index) => {
                      const colors = { 'AAAA': '#f43f5e', 'AAA': '#a855f7', 'AA': '#3b82f6', 'A': '#eab308', 'BB': '#94a3b8', 'B': '#d97706' };
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

        <div className="text-center text-sm text-slate-400 pt-8 border-t">
          <p>Generated by StormTracker • {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    );
  );
} // End of oldReportCode function
*/ // End of removed old code comment
