// src/ParentDashboard.jsx
// Updated Parent Dashboard with Daily Brief integration
import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import DailyBrief from './DailyBrief';
import {
  User, Clock, Trophy, TrendingUp, Camera, Calendar,
  ChevronRight, Star, Award, Zap, Target, Medal,
  Waves, Timer, ArrowUpRight, ArrowDownRight, Minus,
  Megaphone, Bell, ChevronDown, Filter
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
  const age = calculateAge(swimmer.date_of_birth) || swimmer.age;
  
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

// Tab selector for dashboard sections
function DashboardTabs({ activeTab, onChange, unreadCount }) {
  const tabs = [
    { id: 'updates', label: 'Updates', icon: Megaphone, badge: unreadCount },
    { id: 'swimmers', label: 'My Swimmers', icon: User, badge: 0 },
    { id: 'activity', label: 'Activity', icon: Clock, badge: 0 }
  ];

  return (
    <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl">
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-medium text-sm transition-all ${
              isActive 
                ? 'bg-white text-slate-800 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={16} />
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.badge > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Main Parent Dashboard Component
export default function ParentDashboard({ user, onSelectSwimmer, simpleView = false }) {
  const [swimmers, setSwimmers] = useState([]);
  const [swimmerStats, setSwimmerStats] = useState({});
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [parentName, setParentName] = useState('');
  const [activeTab, setActiveTab] = useState('updates');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadParentData();
    loadUnreadCount();
  }, [user]);

  const loadUnreadCount = async () => {
    try {
      const { data: announcements } = await supabase
        .from('announcements')
        .select('id')
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

      const { data: reads } = await supabase
        .from('announcement_reads')
        .select('announcement_id')
        .eq('user_id', user.id);

      const readIds = new Set((reads || []).map(r => r.announcement_id));
      const unread = (announcements || []).filter(a => !readIds.has(a.id));
      setUnreadCount(unread.length);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const loadParentData = async () => {
    try {
      setLoading(true);

      const { data: parentData } = await supabase
        .from('parents')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!parentData) {
        setLoading(false);
        return;
      }

      setParentName(parentData.account_name);

      // Get parent's swimmers
      // Note: Removed date_of_birth here to match your schema fix
      const { data: swimmerLinks } = await supabase
        .from('swimmer_parents')
        .select(`
          swimmer_id,
          swimmers (
            id,
            name,
            group_name,
            age,
            gender
          )
        `)
        .eq('parent_id', parentData.id);

      if (swimmerLinks) {
        const swimmerList = swimmerLinks
          .map(link => link.swimmers)
          .filter(Boolean);
        setSwimmers(swimmerList);

        // Load stats logic (unchanged)
        const stats = {};
        const activities = [];

        for (const swimmer of swimmerList) {
          const { data: times } = await supabase
            .from('results')
            .select('*')
            .eq('swimmer_id', swimmer.id)
            .order('date', { ascending: false })
            .limit(20);

          if (times && times.length > 0) {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const recentPB = times.some(t => 
              t.is_best_time && new Date(t.date) >= thirtyDaysAgo
            );

            const standardsCount = times.filter(t => t.time_standard).length;

            stats[swimmer.id] = {
              totalSwims: times.length,
              recentPB,
              standardsCount
            };

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
            stats[swimmer.id] = { totalSwims: 0, recentPB: false, standardsCount: 0 };
          }
        }

        setSwimmerStats(stats);
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

  const swimmerGroupIds = swimmers.map(s => s.group_id).filter(Boolean);

  return (
    <div className="space-y-6">
      
      {/* 1. Welcome Header (Only shown in standard dashboard view) */}
      {!simpleView && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative">
            <h1 className="text-2xl font-bold mb-1">
              Welcome back{parentName ? `, ${parentName.split(',')[1]?.trim() || parentName}` : ''}!
            </h1>
            <p className="text-blue-100">
              {swimmers.length === 1 
                ? `Tracking ${swimmers[0].name}'s swimming journey`
                : `Tracking ${swimmers.length} swimmers`
              }
            </p>
            <div className="flex gap-2 mt-4">
              <button 
                onClick={() => setActiveTab('updates')}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
              >
                <Bell size={14} />
                {unreadCount > 0 ? `${unreadCount} updates` : 'All caught up'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Tabs (Hidden in simpleView) */}
      {!simpleView && (
        <DashboardTabs 
          activeTab={activeTab} 
          onChange={setActiveTab}
          unreadCount={unreadCount}
        />
      )}

      {/* 3. Daily Brief (Hidden in simpleView) */}
      {!simpleView && activeTab === 'updates' && (
        <DailyBrief 
          userId={user.id} 
          swimmerGroups={swimmerGroupIds}
        />
      )}

      {/* 4. Swimmers List (Shown if tab is active OR if in simpleView) */}
      {(simpleView || activeTab === 'swimmers') && (
        <div className="space-y-3">
          {/* Optional header for simple view to separate sections */}
          {simpleView && <h3 className="font-bold text-slate-700 text-lg">Swimmers</h3>}
          
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
            </div>
          )}
        </div>
      )}

      {/* 5. Activity Feed (Shown if tab is active OR if in simpleView) */}
      {(simpleView || activeTab === 'activity') && (
        <div className="space-y-4">
          {simpleView && <h3 className="font-bold text-slate-700 text-lg pt-4">Recent Activity</h3>}
          
          {recentActivity.length > 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
              {recentActivity.map((activity, index) => (
                <ActivityItem key={index} activity={activity} />
              ))}
            </div>
          ) : (
            <div className="bg-slate-50 rounded-2xl p-8 text-center">
              <Clock size={48} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">No recent activity</p>
            </div>
          )}
        </div>
      )}

      {/* 6. Quick Links (Hidden in simpleView to reduce clutter) */}
      {!simpleView && (
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => onSelectSwimmer && swimmers[0] && onSelectSwimmer(swimmers[0])}
            className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-blue-300 hover:shadow-sm transition-all"
          >
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
      )}
    </div>
  );
}
