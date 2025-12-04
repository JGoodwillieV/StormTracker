// src/ParentDashboard.jsx
// Updated Parent Dashboard with Daily Brief integration
import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import DailyBrief from './DailyBrief';
import ActionRequiredBanner from './ActionRequiredBanner';
import ActionCenter from './ActionCenter';
import {
  User, Clock, Trophy, TrendingUp, Camera, Calendar,
  ChevronRight, Star, Award, Zap, Target, Medal,
  Waves, Timer, ArrowUpRight, ArrowDownRight, Minus,
  Megaphone, Bell, ChevronDown, Filter, FolderOpen,
  FileText, Link, MapPin, Users, ExternalLink
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

// Calendar Placeholder Component
function CalendarPlaceholder() {
  const upcomingEvents = [
    { type: 'meet', title: 'Nutcracker Classic', date: 'Dec 4-7', location: 'Jeff Rouse Swim Center' },
    { type: 'practice', title: 'Taper Schedule Begins', date: 'Dec 4', location: '' },
    { type: 'social', title: 'Holiday Party (HS)', date: 'Dec 27', location: 'Timberlake House' },
    { type: 'meet', title: 'Duck Bowl', date: 'Jan 17-18', location: 'Jeff Rouse Swim Center' },
  ];

  const getEventIcon = (type) => {
    switch (type) {
      case 'meet': return <Trophy size={16} className="text-blue-500" />;
      case 'practice': return <Waves size={16} className="text-amber-500" />;
      case 'social': return <Users size={16} className="text-purple-500" />;
      default: return <Calendar size={16} className="text-slate-400" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Coming Soon Banner */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Calendar size={24} />
          <h3 className="font-bold text-lg">Team Calendar</h3>
        </div>
        <p className="text-indigo-100 text-sm">
          Full calendar coming soon! You'll see meets, practice schedules for your swimmer's group, office hours, and team events all in one place.
        </p>
      </div>

      {/* Preview of upcoming events */}
      <div>
        <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Coming Up</h4>
        <div className="space-y-2">
          {upcomingEvents.map((event, index) => (
            <div 
              key={index}
              className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4"
            >
              <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center">
                {getEventIcon(event.type)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-slate-800">{event.title}</h4>
                <p className="text-sm text-slate-500">
                  {event.date}
                  {event.location && ` • ${event.location}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* What's Coming */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
        <h4 className="font-semibold text-slate-700 mb-2">What to expect:</h4>
        <ul className="space-y-2 text-sm text-slate-600">
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
            Meet schedules with warmup times & locations
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
            Practice times filtered to your swimmer's group
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            Office hours & coach availability
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
            Team social events & parties
          </li>
        </ul>
      </div>
    </div>
  );
}

// Resources Placeholder Component
function ResourcesPlaceholder() {
  const sampleResources = [
    { type: 'link', title: 'Team Website', description: 'Official Hanover Aquatics site', icon: ExternalLink },
    { type: 'doc', title: 'Parent Handbook', description: 'Team policies & information', icon: FileText },
    { type: 'link', title: 'Spirit Wear Store', description: 'Order team gear', icon: ExternalLink },
    { type: 'doc', title: 'Meet Day Guide', description: 'What to expect at meets', icon: FileText },
  ];

  return (
    <div className="space-y-4">
      {/* Coming Soon Banner */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3 mb-2">
          <FolderOpen size={24} />
          <h3 className="font-bold text-lg">Team Resources</h3>
        </div>
        <p className="text-emerald-100 text-sm">
          Resource library coming soon! Quick access to important links, documents, and information that doesn't change often.
        </p>
      </div>

      {/* Preview resources */}
      <div>
        <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Quick Links</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sampleResources.map((resource, index) => {
            const Icon = resource.icon;
            return (
              <div 
                key={index}
                className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 opacity-60"
              >
                <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center">
                  <Icon size={18} className="text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-slate-800">{resource.title}</h4>
                  <p className="text-xs text-slate-500">{resource.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* What's Coming */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
        <h4 className="font-semibold text-slate-700 mb-2">What to expect:</h4>
        <ul className="space-y-2 text-sm text-slate-600">
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
            Important links (website, spirit wear, forms)
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            Team documents & handbooks
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
            Pool locations & directions
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
            Contact information for coaches & staff
          </li>
        </ul>
      </div>
    </div>
  );
}

// Tab selector for dashboard sections
function DashboardTabs({ activeTab, onChange, unreadCount, actionCount }) {
  const tabs = [
    { id: 'updates', label: 'Updates', icon: Megaphone, badge: unreadCount },
    { id: 'actions', label: 'Actions', icon: Bell, badge: actionCount },
    { id: 'calendar', label: 'Calendar', icon: Calendar, badge: 0 },
    { id: 'resources', label: 'Resources', icon: FolderOpen, badge: 0 }
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
  const [parentId, setParentId] = useState(null);
  const [activeTab, setActiveTab] = useState('updates');
  const [unreadCount, setUnreadCount] = useState(0);
  const [actionCount, setActionCount] = useState(0);

  useEffect(() => {
    loadParentData();
    loadUnreadCount();
    loadActionCount();
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

  const loadActionCount = async () => {
  try {
    const { data } = await supabase
      .rpc('get_parent_pending_actions', { parent_user_uuid: user.id });
    setActionCount(data?.length || 0);
  } catch (error) {
    console.error('Error loading action count:', error);
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
      setParentId(parentData.id);

      // Get parent's swimmers
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

        // Load stats logic
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
                subtitle: `${time.time} at ${time.meet_name || 'Meet'}`,
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

  // ============================================
  // SIMPLE VIEW - Just swimmers and activity
  // Used when navigating to "My Swimmers" tab
  // ============================================
  if (simpleView) {
    return (
      <div className="space-y-6">
        {/* Swimmers List */}
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
            </div>
          )}
        </div>

        {/* Recent Activity */}
        {recentActivity.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-bold text-slate-700 text-lg">Recent Activity</h3>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
              {recentActivity.map((activity, index) => (
                <ActivityItem key={index} activity={activity} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================
  // FULL DASHBOARD VIEW - With tabs
  // Used for the "Home" view
  // ============================================
  return (
    <div className="space-y-6">
      {/* Welcome Header */}
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

{/* ACTION REQUIRED BANNER  */}
    <ActionRequiredBanner 
      userId={user.id}
      onActionClick={() => setActiveTab('actions')}
    />
      
      {/* Tab Navigation */}
      <DashboardTabs 
        activeTab={activeTab} 
        onChange={setActiveTab}
        unreadCount={unreadCount}
        actionCount={actionCount}
      />

      {/* Tab Content */}
      {activeTab === 'updates' && (
        <DailyBrief 
          userId={user.id} 
          swimmerGroups={swimmerGroupIds}
        />
      )}

      {activeTab === 'actions' && (
        <ActionCenter userId={user.id} parentId={parentId} />
      )}

      {activeTab === 'calendar' && (
        <CalendarPlaceholder />
      )}

      {activeTab === 'resources' && (
        <ResourcesPlaceholder />
      )}
    </div>
  );
}
