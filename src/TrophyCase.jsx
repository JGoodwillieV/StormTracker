// src/TrophyCase.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Award, Lock } from 'lucide-react';

// Badge Definitions (Colors & Labels)
const BADGES = [
  { key: 'B', label: 'B', color: 'bg-amber-700 border-amber-600 text-amber-100', title: 'Bronze Standard' },
  { key: 'BB', label: 'BB', color: 'bg-slate-400 border-slate-300 text-slate-50', title: 'Silver Standard' },
  { key: 'A', label: 'A', color: 'bg-yellow-500 border-yellow-400 text-yellow-50', title: 'Gold Standard' },
  { key: 'AA', label: 'AA', color: 'bg-blue-500 border-blue-400 text-blue-50', title: 'Platinum Standard' },
  { key: 'AAA', label: 'AAA', color: 'bg-purple-600 border-purple-500 text-purple-50', title: 'Diamond Standard' },
  { key: 'AAAA', label: 'AAAA', color: 'bg-rose-600 border-rose-500 text-rose-50', title: 'Elite Standard' }
];

export default function TrophyCase({ swimmerId, age, gender }) {
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);

  // Helper: Convert time string to seconds
  const timeToSeconds = (t) => {
    if (!t) return 999999;
    if (['DQ', 'NS', 'DFS'].some(s => t.toUpperCase().includes(s))) return 999999;
    const parts = t.replace(/[A-Z]/g, '').trim().split(':');
    return parts.length === 2 
      ? parseInt(parts[0]) * 60 + parseFloat(parts[1]) 
      : parseFloat(parts[0]);
  };

  // Helper: Clean Event Names safely
  const normalizeEventName = (evt) => {
    let name = evt.replace(/\s*\((Finals|Prelim)\)/i, '').trim();
    
    // Use Word Boundaries (\b) to avoid replacing "Freestyle" with "Freestystyle"
    name = name.replace(/\bFree\b/i, 'Freestyle')
               .replace(/\bBack\b/i, 'Backstroke')
               .replace(/\bBreast\b/i, 'Breaststroke')
               .replace(/\bFly\b/i, 'Butterfly');
               
    return name.toLowerCase(); // Normalize case for comparison
  };

  useEffect(() => {
    const calculateBadges = async () => {
      if (!swimmerId) return;

      // 1. Fetch ALL results
      const { data: results } = await supabase
        .from('results')
        .select('event, time')
        .eq('swimmer_id', swimmerId);

      // 2. Fetch ALL Motivational Standards for this age/gender
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

      // 3. Group Results by Event (Find best time per event)
      const bestTimes = {};
      results.forEach(r => {
        const normName = normalizeEventName(r.event);
        const seconds = timeToSeconds(r.time);
        
        if (!bestTimes[normName] || seconds < bestTimes[normName]) {
          bestTimes[normName] = seconds;
        }
      });

      // 4. Calculate Highest Badge per Event
      const badgeCounts = { B: 0, BB: 0, A: 0, AA: 0, AAA: 0, AAAA: 0 };

      // Iterate through every event the swimmer has swum
      Object.keys(bestTimes).forEach(swamEvent => {
        const time = bestTimes[swamEvent];
        
        // Find matching standards for this specific event
        // We compare normalized names (e.g. "100 freestyle" === "100 freestyle")
        const eventStds = standards
            .filter(s => s.event.toLowerCase() === swamEvent) 
            .sort((a, b) => a.time_seconds - b.time_seconds); // Fastest (AAAA) first

        // Check from hardest to easiest. Stop at the first one we beat.
        for (let std of eventStds) {
          if (time <= std.time_seconds) {
            if (badgeCounts[std.name] !== undefined) {
              badgeCounts[std.name]++;
            }
            break; // Found highest badge for this event, move to next event
          }
        }
      });

      setCounts(badgeCounts);
      setLoading(false);
    };

    calculateBadges();
  }, [swimmerId, age, gender]);

  if (loading) return <div className="p-4 text-center text-slate-400 text-xs">Loading Trophies...</div>;

  return (
    <div className="bg-slate-900 p-5 rounded-2xl border border-slate-700 shadow-lg">
      <h3 className="font-bold text-slate-300 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
        <Award size={16} className="text-yellow-500" /> Trophy Case
      </h3>
      
      <div className="grid grid-cols-3 gap-3">
        {BADGES.map((badge) => {
          const count = counts[badge.key] || 0;
          const isUnlocked = count > 0;

          return (
            <div 
              key={badge.key} 
              className={`
                relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all
                ${isUnlocked ? badge.color : 'bg-slate-800 border-slate-700 opacity-40 grayscale'}
              `}
              title={isUnlocked ? `${count} Events achieved ${badge.key}` : `Achieve a ${badge.key} time to unlock`}
            >
              {/* Badge Content */}
              <div className="text-xl font-black tracking-tighter">{badge.label}</div>
              <div className="text-[9px] font-medium uppercase mt-1 opacity-80">{isUnlocked ? 'Unlocked' : 'Locked'}</div>

              {/* Counter Badge (Bottom Right) */}
              {count > 0 && (
                <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-white text-slate-900 border-2 border-slate-900 rounded-full flex items-center justify-center text-xs font-bold shadow-sm z-10">
                  {count}
                </div>
              )}

              {/* Lock Icon if locked */}
              {!isUnlocked && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/20 backdrop-blur-[1px] rounded-xl">
                  <Lock size={16} className="text-slate-500" />
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      <div className="mt-4 text-center">
        <p className="text-[10px] text-slate-500">
          Badges awarded based on highest standard achieved per event.
        </p>
      </div>
    </div>
  );
}
