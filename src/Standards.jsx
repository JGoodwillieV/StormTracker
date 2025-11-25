// src/Standards.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Trophy, List } from 'lucide-react'; // Added List icon
import StandardsModal from './StandardsModal'; // Import the new modal

export default function Standards({ eventName, bestTime, gender, age }) {
  const [standards, setStandards] = useState([]);
  const [nextCut, setNextCut] = useState(null);
  const [currentLevel, setCurrentLevel] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false); // State for modal

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
        .order('time_seconds', { ascending: true }); 

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

    for (let std of stds) {
      if (time <= std.time_seconds) {
        achieved = std;
        break; 
      } else {
        chasing = std;
      }
    }

    setCurrentLevel(achieved);
    setNextCut(chasing);
  };

  if (!nextCut && !currentLevel) return null;

  return (
    <>
      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 mt-4 relative group">
        {/* Header Row */}
        <div className="flex justify-between items-start mb-3">
           <h4 className="text-slate-400 text-xs font-bold uppercase flex items-center gap-2">
             <Trophy size={14} className="text-yellow-500"/> Standards & Goals
           </h4>
           
           {/* Trigger Button */}
           <button 
             onClick={() => setIsModalOpen(true)}
             className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
           >
             <List size={14} /> View Ladder
           </button>
        </div>
        
        <div className="flex items-center justify-between">
          {/* LEFT */}
          <div className="text-center w-1/4">
            <div className="text-xs text-slate-500 mb-1">Current Level</div>
            <div className="text-xl font-bold text-white">
              {currentLevel ? currentLevel.name : "Unranked"}
            </div>
          </div>

          {/* CENTER */}
          <div className="flex-1 mx-4 flex flex-col items-center">
            {nextCut ? (
              <>
                <div className="text-xs font-bold text-blue-400 mb-1">
                  Drop { (bestTime - nextCut.time_seconds).toFixed(2) }s
                </div>
                <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden relative">
                   <div className="h-full bg-blue-500 w-1/2 rounded-full animate-pulse absolute left-0"></div>
                </div>
              </>
            ) : (
              <div className="text-xs font-bold text-emerald-400">Top Standard!</div>
            )}
          </div>

          {/* RIGHT */}
          <div className="text-center w-1/4">
            <div className="text-xs text-slate-500 mb-1">Next Goal</div>
            <div className="text-xl font-bold text-blue-400">
              {nextCut ? nextCut.name : "Max"}
            </div>
            <div className="text-xs text-slate-400">{nextCut?.time_string || "-"}</div>
          </div>
        </div>
      </div>

      {/* The Modal Popup */}
      <StandardsModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        standards={standards}
        bestTime={bestTime}
        eventName={eventName}
      />
    </>
  );
}
