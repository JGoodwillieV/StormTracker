// src/VersatilityChart.jsx
import React, { useEffect, useState } from 'react';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip 
} from 'recharts';
import { supabase } from './supabase';
import { Activity } from 'lucide-react';

// Standard "Power Levels" for the chart
const STANDARD_SCORES = {
  'B': 20,
  'BB': 40,
  'A': 60,
  'AA': 80,
  'AAA': 100,
  'AAAA': 120,
  'VSI AG': 130,
  'Sectionals': 140,
  'Futures': 150,
  'Winter JR': 160,
  'US JR': 170,
  'Nationals': 180
};

export default function VersatilityChart({ swimmerId, age, gender }) {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Determine the "Representative Event" for each stroke based on age
  // 12 & Under: 50s + 100 IM
  // 13 & Over: 100s + 200 IM
  const isYounger = age <= 12;
  const strokeDist = isYounger ? '50' : '100';
  const imDist = isYounger ? '100' : '200';

  // Define targets with keywords for fuzzy matching
  const strokes = [
    { label: 'Free', dist: isYounger ? '50' : '100', type: 'Free' },
    { label: 'Back', dist: strokeDist, type: 'Back' },
    { label: 'Breast', dist: strokeDist, type: 'Breast' },
    { label: 'Fly', dist: strokeDist, type: 'Fly' }, // 'Fly' matches 'Butterfly' too
    { label: 'IM', dist: imDist, type: 'IM' },
  ];

  const timeToSeconds = (t) => {
    if (!t) return 999999;
    const parts = t.replace(/[A-Z]/g, '').trim().split(':');
    return parts.length === 2 
      ? parseInt(parts[0]) * 60 + parseFloat(parts[1]) 
      : parseFloat(parts[0]);
  };

  useEffect(() => {
    const calculateStrengths = async () => {
      if (!swimmerId) return;

      // 1. Fetch ALL results for this swimmer
      const { data: myResults } = await supabase
        .from('results')
        .select('event, time')
        .eq('swimmer_id', swimmerId);

      // 2. Fetch ALL standards for this age/gender
      // We fetch everything so we can find the highest match locally
      const { data: standards } = await supabase
        .from('time_standards')
        .select('*')
        .eq('gender', gender)
        .lte('age_min', age)
        .gte('age_max', age);

      if (!myResults || !standards) {
        setLoading(false);
        return;
      }

      // 3. Calculate Score for each Stroke
      const scores = strokes.map(stroke => {
        // A. Find swimmer's best time for this stroke/distance
        // Matches "50 Free", "50 Freestyle", "50 FR"
        const matchingTimes = myResults
          .filter(r => {
            const e = r.event.toLowerCase();
            return e.includes(stroke.dist) && (e.includes(stroke.type.toLowerCase()) || (stroke.type === 'Fly' && e.includes('butter'))); 
          })
          .map(r => timeToSeconds(r.time));
        
        const bestTime = matchingTimes.length > 0 ? Math.min(...matchingTimes) : null;

        if (!bestTime) {
            return { subject: stroke.label, score: 0, standard: 'N/A', fullMark: 150 };
        }

        // B. Find the Highest Standard Achieved
        // Filter standards to just this event
        const eventStandards = standards
            .filter(s => s.event.toLowerCase().includes(stroke.type.toLowerCase()) || (stroke.type === 'Fly' && s.event.toLowerCase().includes('butter')))
            .filter(s => s.event.includes(stroke.dist))
            .sort((a, b) => a.time_seconds - b.time_seconds); // Fastest (Hardest) first

        let highestStd = 'Unranked';
        let score = 10; // Base score for having a time at all

        for (let std of eventStandards) {
            if (bestTime <= std.time_seconds) {
                highestStd = std.name;
                score = STANDARD_SCORES[std.name] || 50; // Fallback score
                break; // Stop at the hardest one we beat
            }
        }

        return {
          subject: stroke.label,
          score: score,
          standard: highestStd,
          fullMark: 180, // Max scale (Nationals)
        };
      });

      setChartData(scores);
      setLoading(false);
    };

    calculateStrengths();
  }, [swimmerId, age, gender]);

  if (loading) return <div className="h-64 w-full flex items-center justify-center text-slate-500">Loading Chart...</div>;
  
  // If no data at all, show a placeholder
  if (chartData.every(d => d.score === 0)) {
      return (
        <div className="h-64 w-full bg-slate-900 rounded-xl border border-slate-700 p-4 flex flex-col items-center justify-center text-slate-500 text-sm">
            <Activity size={24} className="mb-2 opacity-50"/>
            <p>Not enough data for chart.</p>
            <p className="text-xs">Need 50/100 stroke times.</p>
        </div>
      );
  }

  return (
    <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 shadow-lg">
      <div className="flex justify-between items-start mb-2">
        <h4 className="text-slate-400 text-xs font-bold uppercase flex items-center gap-2">
            <Activity size={14} className="text-blue-400"/> Stroke Strengths
        </h4>
      </div>
      
      <div className="h-64 w-full 

[Image of radar chart for swimming strokes]
">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 'bold' }} />
            <PolarRadiusAxis angle={30} domain={[0, 180]} tick={false} axisLine={false} />
            <Radar
              name="Strength"
              dataKey="score"
              stroke="#3b82f6"
              strokeWidth={3}
              fill="#3b82f6"
              fillOpacity={0.5}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
              itemStyle={{ color: '#60a5fa' }}
              formatter={(value, name, props) => [props.payload.standard, "Level"]}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="text-center mt-1">
          <span className="text-[10px] text-slate-500 bg-slate-800/50 px-2 py-1 rounded-full">
              Based on Highest Cut Achieved
          </span>
      </div>
    </div>
  );
}
