// src/ParentDashboard.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import {
  User, Clock, Trophy, TrendingUp, Camera, Calendar,
  ChevronRight, Star, Award, Zap, Target, Medal,
  Waves, Timer, ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react';

// Helper function to format time from seconds to MM:SS.ms
const formatTime = (seconds) => {
  if (!seconds) return '--:--.--';
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2);
  if (mins > 0) {
    return `${mins}:${secs.padStart(5, '0')}`;
  }
  return secs;
};

// Helper to calculate age from DOB
const calculateAge = (dob) => {
  if (!dob) return null;
  const today = new Date();
  const birthDate = new Date(dob);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// Swimmer Card Component
function SwimmerCard({ swimmer, stats, onClick }) {
  const age = calculateAge(swimmer.date_of_birth);
  
  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-blue-300 transition-all text-left group"
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shrink-0">
          {swimmer.name?.charAt(0) || 'S'}
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-lg text-slate-800 truncate">{swimmer.name}</h3>
            <ChevronRight size={18} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
          </div>
          <p className="text-slate-500 text-sm">
            {swimmer.group_name}
            {age && ` • ${age} years old`}
          </p>
          
          {/* Quick Stats */}
          <div className="flex gap-4 mt-3">
            {stats?.recentPB && (
              <div className="flex items-center gap-1 text-emerald-600 text-sm">
                <TrendingUp size={14} />
                <span className="font-medium">Recent PB!</span>
              </div>
            )}
            {stats?.totalSwims > 0 && (
              <div className="flex items-center gap-1 text-slate-500 text-sm">
                <Waves size={14} />
                <span>{stats.totalSwims} swims</span>
              </div>
            )}
            {stats?.standardsCount > 0 && (
              <div className="flex items-center gap-1 text-amber-600 text-sm">
                <Star size={14} />
                <span>{stats.standardsCount} cuts</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// Recent Activity Item
function ActivityItem({ activity }) {
  const getIcon = () => {
    switch (activity.type) {
      case 'pb': return <Trophy className="text-amber-500" size={18} />;
      case 'video': return <Camera className="text-blue-500" size={18} />;
      case 'meet': return <Calendar className="text-indigo-500" size={18} />;
      case 'practice': return <Timer className="text-emerald-500" size={18} />;
      default: return <Zap className="text-slate-400" size={18} />;
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
      <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm">
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-800 font-medium truncate">{activity.title}</p>
        <p className="text-xs text-slate-500">{activity.subtitle}</p>
      </div>
      <span className="text-xs text-slate-400 shrink-0">{activity.time}</span>
    </div>
  );
}

// Main Parent Dashboard Component
export default function ParentDashboard({ user, onSelectSwimmer }) {
  const [swimmers, setSwimmers] = useState([]);
  const [swimmerStats, setSwimmerStats] = useState({});
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [parentName, setParentName] = useState('');

  useEffect(() => {
    loadParentData();
  }, [user]);

  const loadParentData = async () => {
    try {
      setLoading(true);

      // Get parent info
      const { data: parentData, error: parentError } = await supabase
        .from('parents')
        .select('*')
        .eq('user_id', user.id)
        .single();

      console.log('Parent data:', parentData, 'Error:', parentError);

      if (parentData) {
        setParentName(parentData.account_name);
      } else {
        console.error('No parent record found for user:', user.id);
        setLoading(false);
        return;
      }

      // Get parent's swimmers
      const { data: swimmerLinks, error: swimmerError } = await supabase
        .from('swimmer_parents')
        .select(`
          swimmer_id,
          swimmers (
            id,
            name,
            group_name,
            date_of_birth
          )
        `)
        .eq('parent_id', parentData.id);

      console.log('Swimmer links:', swimmerLinks, 'Error:', swimmerError);

      if (swimmerLinks) {
        const swimmerList = swimmerLinks
          .map(link => link.swimmers)
          .filter(Boolean);
        console.log('Swimmer list:', swimmerList);
        setSwimmers(swimmerList);

        // Load stats for each swimmer
        const stats = {};
        const activities = [];

        for (const swimmer of swimmerList) {
          // Get results for this swimmer (changed from swim_times to results)
          const { data: times } = await supabase
            .from('results')
            .select('*')
            .eq('swimmer_id', swimmer.id)
            .order('date', { ascending: false })
            .limit(20);

          if (times && times.length > 0) {
            // Check for recent PBs (within last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const recentPB = times.some(t => 
              t.is_best_time && new Date(t.date) >= thirtyDaysAgo
            );

            // Count time standards achieved
            const standardsCount = times.filter(t => t.time_standard).length;

            stats[swimmer.id] = {
              totalSwims: times.length,
              recentPB,
              standardsCount
            };

            // Add recent activities
            times.slice(0, 3).forEach(time => {
              activities.push({
                type: time.is_best_time ? 'pb' : 'meet',
                title: time.is_best_time 
                  ? `${swimmer.name} - New PB!` 
                  : `${swimmer.name} - ${time.event}`,
                subtitle: `${formatTime(time.time)} at ${time.meet_name || 'Meet'}`,
                time: new Date(time.date).toLocaleDateString(),
                date: new Date(time.date)
              });
            });
          } else {
            stats[swimmer.id] = {
              totalSwims: 0,
              recentPB: false,
              standardsCount: 0
            };
          }
        }

        setSwimmerStats(stats);
        
        // Sort activities by date and take most recent
        activities.sort((a, b) => b.date - a.date);
        setRecentActivity(activities.slice(0, 5));
      }
    } catch (error) {
      console.error('Error loading parent data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-1">
          Welcome back{parentName ? `, ${parentName.split(',')[1]?.trim() || parentName}` : ''}!
        </h1>
        <p className="text-blue-100">
          {swimmers.length === 1 
            ? `Tracking ${swimmers[0].name}'s swimming journey`
            : `Tracking ${swimmers.length} swimmers`
          }
        </p>
      </div>

      {/* My Swimmers */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <User size={20} className="text-blue-500" />
          My Swimmers
        </h2>
        <div className="space-y-3">
          {swimmers.map(swimmer => (
            <SwimmerCard
              key={swimmer.id}
              swimmer={swimmer}
              stats={swimmerStats[swimmer.id]}
              onClick={() => onSelectSwimmer(swimmer)}
            />
          ))}
          {swimmers.length === 0 && (
            <div className="bg-slate-50 rounded-2xl p-8 text-center">
              <User size={48} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">No swimmers linked to your account yet.</p>
              <p className="text-sm text-slate-400 mt-1">Contact your coach if this seems incorrect.</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Clock size={20} className="text-blue-500" />
            Recent Activity
          </h2>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
            {recentActivity.map((activity, index) => (
              <ActivityItem key={index} activity={activity} />
            ))}
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-blue-300 hover:shadow-sm transition-all">
          <Camera size={24} className="text-blue-500 mb-2" />
          <p className="font-semibold text-slate-800">Upload Video</p>
          <p className="text-xs text-slate-500">Share race footage</p>
        </button>
        <button className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-blue-300 hover:shadow-sm transition-all">
          <Target size={24} className="text-emerald-500 mb-2" />
          <p className="font-semibold text-slate-800">Time Standards</p>
          <p className="text-xs text-slate-500">View progress</p>
        </button>
      </div>

      {/* Upcoming (Placeholder) */}
      <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
        <h3 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
          <Calendar size={18} className="text-slate-500" />
          Coming Soon
        </h3>
        <p className="text-sm text-slate-500">
          Upcoming meets, coach announcements, and more features will appear here!
        </p>
      </div>
    </div>
  );
}
