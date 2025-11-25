// src/Standards.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Trophy } from 'lucide-react';

export default function Standards({ eventName, bestTime, gender, age }) {
  const [standards, setStandards] = useState([]);
  const [nextCut, setNextCut] = useState(null);
  const [currentLevel, setCurrentLevel] = useState(null);

  useEffect(() => {
    const fetchStandards = async () => {
      if (!eventName || !gender || !age) return;

      const parts = eventName.split(' ');
      const distance = parts[0];
      const stroke = parts[1] || ''; 

      const { data } = await supabase
        .from('time_standards')
        .select('*')
        .eq('gender', gender)
        .ilike('event', `${distance}%${stroke}%`) 
        .lte('age_min', age)
        .gte('age_max', age)
        .order('time_seconds', { ascending: true }); // Sorted Fastest (AAAA) -> Slowest (B)

      if (data && data.length > 0) {
        setStandards(data);
        calculateStanding(data, bestTime);
      }
    };
    fetchStandards();
  }, [eventName, bestTime, gender, age]);

  const calculateStanding = (stds, time) => {
    if (!time) return;
    
    let achieved = null;
    let chasing = null;

    // Loop from Hardest (AAAA) to Easiest (B)
    for (let std of stds) {
      if (time <= std.time_seconds) {
        // We beat this time!
        achieved = std;
        // Since the list is sorted fastest first, the FIRST one we match is our Best Level.
        // We break the loop immediately so we don't overwrite it with easier standards (like B).
        break; 
      } else {
        // We are slower than this standard.
        // This becomes the new "Goal" we are chasing.
        // As the loop continues to easier times, this variable updates until we find a match.
        chasing = std;
      }
    }

    setCurrentLevel(achieved);
    setNextCut(chasing);
  };

  // Only render if we have data
  if (!nextCut && !currentLevel) return null;

  return (
    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 mt-4">
      <h4 className="text-slate-400 text-xs font-bold uppercase mb-3 flex items-center gap-2">
        <Trophy size={14} className="text-yellow-500"/> Standards & Goals
      </h4>
      
      <div className="flex items-center justify-between">
        {/* LEFT: Current Level */}
        <div className="text-center w-1/4">
          <div className="text-xs text-slate-500 mb-1">Current Level</div>
          <div className="text-xl font-bold text-white">
            {currentLevel ? currentLevel.name : "Unranked"}
          </div>
        </div>

        {/* CENTER: Progress Bar */}
        <div className="flex-1 mx-4 flex flex-col items-center">
          {nextCut ? (
            <>
              <div className="text-xs font-bold text-blue-400 mb-1">
                Drop { (bestTime - nextCut.time_seconds).toFixed(2) }s
              </div>
              {/* Visual Bar representing gap between current time and goal */}
              <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden relative">
                 <div className="h-full bg-blue-500 w-1/2 rounded-full animate-pulse absolute left-0"></div>
              </div>
            </>
          ) : (
            <div className="text-xs font-bold text-emerald-400">Top Standard!</div>
          )}
        </div>

        {/* RIGHT: Next Goal */}
        <div className="text-center w-1/4">
          <div className="text-xs text-slate-500 mb-1">Next Goal</div>
          <div className="text-xl font-bold text-blue-400">
            {nextCut ? nextCut.name : "Max"}
          </div>
          <div className="text-xs text-slate-400">{nextCut?.time_string || "-"}</div>
        </div>
      </div>
    </div>
  );
}
