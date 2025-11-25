import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Trophy, TrendingUp, Star } from 'lucide-react';

export default function Standards({ eventName, bestTime, gender, age }) {
  const [standards, setStandards] = useState([]);
  const [nextCut, setNextCut] = useState(null);
  const [currentLevel, setCurrentLevel] = useState(null);

  useEffect(() => {
    const fetchStandards = async () => {
      if (!eventName || !gender || !age) return;

      // 1. Fetch all standards for this event/age/gender
      const { data } = await supabase
        .from('time_standards')
        .select('*')
        .ilike('event', `%${eventName.split(' ')[1]}%`) // Fuzzy match "Freestyle" -> "Free"
        .eq('gender', gender)
        .lte('age_min', age)
        .gte('age_max', age)
        .order('time_seconds', { ascending: true }); // Fastest first

      if (data && data.length > 0) {
        setStandards(data);
        calculateStanding(data, bestTime);
      }
    };
    fetchStandards();
  }, [eventName, bestTime]);

  const calculateStanding = (stds, time) => {
    if (!time) return;
    
    // Find the hardest cut I have achieved
    // (Since we sorted ascending, the first one I am faster than is the hardest)
    let achieved = null;
    let chasing = null;

    for (let std of stds) {
      if (time <= std.time_seconds) {
        achieved = std; // I am faster than this standard
      } else {
        chasing = std; // I am slower than this, so it's my next goal
      }
    }
    
    setCurrentLevel(achieved);
    setNextCut(chasing);
  };

  if (!nextCut && !currentLevel) return null;

  return (
    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 mt-4">
      <h4 className="text-slate-400 text-xs font-bold uppercase mb-3 flex items-center gap-2">
        <Trophy size={14} className="text-yellow-500"/> Standards & Goals
      </h4>
      
      <div className="flex items-center justify-between">
        {/* Current Level */}
        <div className="text-center">
          <div className="text-xs text-slate-500 mb-1">Current Level</div>
          <div className="text-xl font-bold text-white">
            {currentLevel ? currentLevel.name : "Unranked"}
          </div>
        </div>

        {/* Progress Bar / Arrow */}
        <div className="flex-1 mx-4 flex flex-col items-center">
          {nextCut && (
            <>
              <div className="text-xs font-bold text-blue-400 mb-1">
                -{ (bestTime - nextCut.time_seconds).toFixed(2) }s to go
              </div>
              <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 w-2/3 rounded-full animate-pulse"></div>
              </div>
            </>
          )}
        </div>

        {/* Next Goal */}
        <div className="text-center">
          <div className="text-xs text-slate-500 mb-1">Next Goal</div>
          <div className="text-xl font-bold text-blue-400">
            {nextCut ? nextCut.name : "Top Tier!"}
          </div>
          <div className="text-xs text-slate-400">{nextCut?.time_string}</div>
        </div>
      </div>
    </div>
  );
}
