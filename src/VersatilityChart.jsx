// src/VersatilityChart.jsx
import React, { useEffect, useState } from 'react';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip 
} from 'recharts';
import { supabase } from './supabase';
import { Activity } from 'lucide-react';

export default function VersatilityChart({ swimmerId, age, gender }) {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Define the "Representative Events" based on age
  // 12 & Under: 50s of strokes + 100 IM
  // 13 & Over: 100s of strokes + 200 IM
  const isYounger = age <= 12;
  const strokeDist = isYounger ? '50' : '100';
  const imDist = isYounger ? '100' : '200';

  const targets = [
    { stroke: 'Free', event: `${isYounger ? '50' : '100'} Freestyle` },
    { stroke: 'Back', event: `${strokeDist} Backstroke` },
    { stroke: 'Breast', event: `${strokeDist} Breaststroke` },
    { stroke: 'Fly', event: `${strokeDist} Butterfly` },
    { stroke: 'IM', event: `${imDist} IM` },
  ];

  // Helper to convert "1:02.59" -> 62.59
  const timeToSeconds = (t) => {
    if (!t) return 999999;
    const parts = t.split(':');
    return parts.length === 2 
      ? parseInt(parts[0]) * 60 + parseFloat(parts[1]) 
      : parseFloat(parts[0]);
  };

  useEffect(() => {
    const calculateScores = async () => {
      if (!swimmerId) return;

      // 1. Fetch Swimmer's Best Times for these 5 events
      const { data: myResults } = await supabase
        .from('results')
        .select('event, time')
        .eq('swimmer_id', swimmerId);

      // 2. Fetch "A" Standards for these 5 events
      // We use the 'ilike' trick to find matching events in the standards table
      const { data: standards } = await supabase
        .from('time_standards')
        .select('*')
        .eq('name', 'A') // We compare against the "A" cut
        .eq('gender', gender)
        .lte('age_min', age)
        .gte('age_max', age);

      if (!myResults || !standards) {
        setLoading(false);
        return;
      }

      // 3. Build the Data Points
      const scores = targets.map(target => {
        // A. Find my best time
        const myTimes = myResults
          .filter(r => r.event.includes(target.event)) // Simple string match
          .map(r => timeToSeconds(r.time));
        
        const myBest = myTimes.length > 0 ? Math.min(...myTimes) : null;

        // B. Find the Standard time
        // We try to find the standard that matches our target event name
        // e.g. target "50 Freestyle" vs standard "50 Freestyle"
        const stdEntry = standards.find(s => 
            s.event.toLowerCase().includes(target.event.toLowerCase())
        );
        const stdTime = stdEntry ? stdEntry.time_seconds : null;

        // C. Calculate Score (Percentage of Standard)
        // Formula: (Standard / MyTime) * 100
        // If I am faster (lower time), score goes UP (>100)
        // If I am slower (higher time), score goes DOWN (<100)
        let score = 0;
        if (myBest && stdTime) {
           score = Math.round((stdTime / myBest) * 100);
        }

        return {
          subject: target.stroke,
          A: score,
          fullMark: 150, // Max chart scale
          myTime: myBest ? myBest.toFixed(2) : 'N/A',
          stdTime: stdTime || 'N/A'
        };
      });

      setChartData(scores);
      setLoading(false);
    };

    calculateScores();
  }, [swimmerId, age, gender]);

  if (loading) return <div className="h-64 w-full flex items-center justify-center text-slate-500">Loading Chart...</div>;

  // Don't show empty charts if they have no results
  if (chartData.every(d => d.A === 0)) return null;

  return (
    <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 shadow-lg">
      <h4 className="text-slate-400 text-xs font-bold uppercase mb-2 flex items-center gap-2">
        <Activity size={14} className="text-blue-400"/> Stroke Versatility (vs 'A' Cut)
      </h4>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 'bold' }} />
            <PolarRadiusAxis angle={30} domain={[0, 140]} tick={false} axisLine={false} />
            <Radar
              name="Performance Score"
              dataKey="A"
              stroke="#3b82f6"
              strokeWidth={3}
              fill="#3b82f6"
              fillOpacity={0.4}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff', borderRadius: '8px' }}
              itemStyle={{ color: '#60a5fa' }}
              formatter={(value) => [value, "Score (100 = 'A' Cut)"]}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="text-center mt-2">
          <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-1 rounded-full">
              100% = 'A' Time Standard
          </span>
      </div>
    </div>
  );
}
