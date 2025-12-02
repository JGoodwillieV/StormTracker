// src/TestSetTracker.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabase';
import {
  ChevronLeft, Play, Pause, RotateCcw, Save, Clock, Users,
  Plus, Minus, Check, X, Undo2, SkipForward, Vibrate, Volume2,
  VolumeX, GripVertical, Timer, TrendingUp, TrendingDown, Minus as MinusIcon,
  AlertCircle, CheckCircle2, Trash2, Settings, ChevronDown, Zap
} from 'lucide-react';

// Stroke options
const STROKES = ['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly', 'IM'];
const TYPES = ['Swim', 'Kick', 'Pull', 'Drill'];
const DISTANCES = [25, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500];

// Time formatting helpers
const formatTime = (ms) => {
  if (ms === null || ms === undefined) return '--:--.--';
  const totalSeconds = ms / 1000;
  const mins = Math.floor(totalSeconds / 60);
  const secs = (totalSeconds % 60).toFixed(2);
  return mins > 0 ? `${mins}:${secs.padStart(5, '0')}` : secs;
};

const formatTimeShort = (ms) => {
  if (ms === null || ms === undefined) return '--:--';
  const totalSeconds = ms / 1000;
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function TestSetTracker({ onBack, swimmers: allSwimmers, groups }) {
  const [step, setStep] = useState('setup'); // setup, timing, results
  
  // Setup state
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedSwimmers, setSelectedSwimmers] = useState([]);
  const [setName, setSetName] = useState('');
  const [reps, setReps] = useState(10);
  const [distance, setDistance] = useState(100);
  const [stroke, setStroke] = useState('Freestyle');
  const [setType, setType] = useState('Swim');
  const [targetInterval, setTargetInterval] = useState(90); // seconds
  const [useInterval, setUseInterval] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Timing state
  const [isRunning, setIsRunning] = useState(false);
  const [currentRep, setCurrentRep] = useState(1);
  const [masterClock, setMasterClock] = useState(0);
  const [repStartTime, setRepStartTime] = useState(0);
  const [results, setResults] = useState({}); // { swimmerId: { 1: timeMs, 2: timeMs, ... } }
  const [lastTap, setLastTap] = useState(null); // For undo functionality
  const [flashingCard, setFlashingCard] = useState(null);
  
  // Refs for timing
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const audioRef = useRef(null);
  
  // Get unique groups from swimmers
  const uniqueGroups = [...new Set(allSwimmers.map(s => s.group_name).filter(Boolean))];

  // Filter swimmers by selected group
  const groupSwimmers = selectedGroup 
    ? allSwimmers.filter(s => s.group_name === selectedGroup)
    : [];

  // Auto-generate set name
  useEffect(() => {
    const typeSuffix = setType !== 'Swim' ? ` ${setType}` : '';
    setSetName(`${reps}x${distance} ${stroke}${typeSuffix}`);
  }, [reps, distance, stroke, setType]);

  // Initialize results when swimmers are selected
  useEffect(() => {
    const initialResults = {};
    selectedSwimmers.forEach(s => {
      initialResults[s.id] = {};
    });
    setResults(initialResults);
  }, [selectedSwimmers]);

  // Master timer
  useEffect(() => {
    if (isRunning) {
      startTimeRef.current = Date.now() - masterClock;
      timerRef.current = setInterval(() => {
        setMasterClock(Date.now() - startTimeRef.current);
      }, 10);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning]);

  // Interval beep
  useEffect(() => {
    if (!useInterval || !isRunning || !soundEnabled) return;
    
    const repElapsed = masterClock - repStartTime;
    const intervalMs = targetInterval * 1000;
    
    // Beep at 5 seconds before interval
    if (repElapsed >= intervalMs - 5000 && repElapsed < intervalMs - 4900) {
      playBeep();
    }
    // Beep at interval
    if (repElapsed >= intervalMs && repElapsed < intervalMs + 100) {
      playBeep();
      // Auto-advance to next rep
      if (currentRep < reps) {
        advanceRep();
      }
    }
  }, [masterClock, useInterval, isRunning, targetInterval, repStartTime, currentRep, reps, soundEnabled]);

  const playBeep = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
    // Also vibrate if supported
    if (navigator.vibrate) {
      navigator.vibrate(200);
    }
  };

  // Handle swimmer card tap
  const handleSwimmerTap = useCallback((swimmerId) => {
    if (!isRunning) return;
    
    const currentTime = masterClock - repStartTime;
    
    // Check if already recorded for this rep
    if (results[swimmerId]?.[currentRep] !== undefined) return;
    
    // Record time
    setResults(prev => ({
      ...prev,
      [swimmerId]: {
        ...prev[swimmerId],
        [currentRep]: currentTime
      }
    }));
    
    // Store for undo
    setLastTap({ swimmerId, rep: currentRep, time: currentTime });
    
    // Flash animation
    setFlashingCard(swimmerId);
    setTimeout(() => setFlashingCard(null), 300);
    
  }, [isRunning, masterClock, repStartTime, currentRep, results]);

  // Handle missed rep (long press)
  const handleMissedRep = useCallback((swimmerId) => {
    if (!isRunning) return;
    
    setResults(prev => ({
      ...prev,
      [swimmerId]: {
        ...prev[swimmerId],
        [currentRep]: 'DNS'
      }
    }));
  }, [isRunning, currentRep]);

  // Undo last tap
  const handleUndo = () => {
    if (!lastTap) return;
    
    setResults(prev => {
      const updated = { ...prev };
      delete updated[lastTap.swimmerId][lastTap.rep];
      return updated;
    });
    setLastTap(null);
  };

  // Start the set
  const handleStart = () => {
    setIsRunning(true);
    setRepStartTime(masterClock);
    playBeep();
  };

  // Pause/resume
  const handlePauseResume = () => {
    setIsRunning(!isRunning);
  };

  // Advance to next rep
  const advanceRep = () => {
    if (currentRep >= reps) return;
    setCurrentRep(prev => prev + 1);
    setRepStartTime(masterClock);
    if (soundEnabled) playBeep();
  };

  // Restart current rep
  const restartRep = () => {
    // Clear all times for current rep
    setResults(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(id => {
        delete updated[id][currentRep];
      });
      return updated;
    });
    setRepStartTime(masterClock);
  };

  // Finish set
  const handleFinish = () => {
    setIsRunning(false);
    setStep('results');
  };

  // Save results to database
  const handleSave = async () => {
    try {
      // Create test set record
      const { data: testSet, error: testSetError } = await supabase
        .from('test_sets')
        .insert([{
          name: setName,
          group_name: selectedGroup,
          reps,
          distance,
          stroke,
          type: setType,
          interval_seconds: useInterval ? targetInterval : null
        }])
        .select()
        .single();

      if (testSetError) throw testSetError;

      // Create result records
      const resultRecords = [];
      Object.entries(results).forEach(([swimmerId, repTimes]) => {
        Object.entries(repTimes).forEach(([repNum, time]) => {
          if (time !== 'DNS') {
            resultRecords.push({
              test_set_id: testSet.id,
              swimmer_id: swimmerId,
              rep_number: parseInt(repNum),
              time_ms: time
            });
          }
        });
      });

      if (resultRecords.length > 0) {
        const { error: resultsError } = await supabase
          .from('test_set_results')
          .insert(resultRecords);

        if (resultsError) throw resultsError;
      }

      alert('Test set saved successfully!');
      onBack();
    } catch (error) {
      console.error('Save error:', error);
      alert('Error saving: ' + error.message);
    }
  };

  // Calculate stats for a swimmer
  const getSwimmerStats = (swimmerId) => {
    const times = Object.values(results[swimmerId] || {}).filter(t => t !== 'DNS' && t !== undefined);
    if (times.length === 0) return { avg: null, best: null, worst: null, count: 0 };
    
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const best = Math.min(...times);
    const worst = Math.max(...times);
    
    return { avg, best, worst, count: times.length };
  };

  // Toggle swimmer selection
  const toggleSwimmer = (swimmer) => {
    setSelectedSwimmers(prev => {
      const exists = prev.find(s => s.id === swimmer.id);
      if (exists) {
        return prev.filter(s => s.id !== swimmer.id);
      }
      return [...prev, swimmer];
    });
  };

  // Select all swimmers in group
  const selectAllSwimmers = () => {
    setSelectedSwimmers(groupSwimmers);
  };

  // Clear all swimmers
  const clearSwimmers = () => {
    setSelectedSwimmers([]);
  };

  // ==========================================
  // SETUP SCREEN
  // ==========================================
  if (step === 'setup') {
    return (
      <div className="min-h-full bg-slate-50 pb-8">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="px-4 py-4 flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
              <ChevronLeft size={24} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-800">New Test Set</h1>
              <p className="text-sm text-slate-500">Configure your practice set</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-6 max-w-2xl mx-auto">
          {/* Group Selection */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Users size={18} className="text-blue-500" />
              Select Group
            </h3>
            <select
              value={selectedGroup}
              onChange={(e) => {
                setSelectedGroup(e.target.value);
                setSelectedSwimmers([]);
              }}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a group...</option>
              {uniqueGroups.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>

            {/* Swimmer Selection */}
            {selectedGroup && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-600">
                    {selectedSwimmers.length} of {groupSwimmers.length} swimmers selected
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={selectAllSwimmers}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={clearSwimmers}
                      className="text-xs font-medium text-slate-500 hover:text-slate-700"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {groupSwimmers.map(swimmer => {
                    const isSelected = selectedSwimmers.find(s => s.id === swimmer.id);
                    return (
                      <button
                        key={swimmer.id}
                        onClick={() => toggleSwimmer(swimmer)}
                        className={`p-3 rounded-xl text-left transition-all ${
                          isSelected
                            ? 'bg-blue-500 text-white shadow-md'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        <div className="font-medium text-sm truncate">{swimmer.name}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Set Configuration */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Settings size={18} className="text-blue-500" />
              Set Configuration
            </h3>

            {/* Reps x Distance */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Reps</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setReps(Math.max(1, reps - 1))}
                    className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-600"
                  >
                    <Minus size={18} />
                  </button>
                  <input
                    type="number"
                    value={reps}
                    onChange={(e) => setReps(Math.max(1, parseInt(e.target.value) || 1))}
                    className="flex-1 text-center text-2xl font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-2"
                  />
                  <button
                    onClick={() => setReps(reps + 1)}
                    className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-600"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Distance</label>
                <select
                  value={distance}
                  onChange={(e) => setDistance(parseInt(e.target.value))}
                  className="w-full h-[52px] text-xl font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 focus:ring-2 focus:ring-blue-500"
                >
                  {DISTANCES.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Stroke and Type */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Stroke</label>
                <select
                  value={stroke}
                  onChange={(e) => setStroke(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                >
                  {STROKES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Type</label>
                <select
                  value={setType}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                >
                  {TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Set Name */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Set Name</label>
              <input
                type="text"
                value={setName}
                onChange={(e) => setSetName(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Interval Option */}
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Timer size={18} className="text-slate-500" />
                  <span className="font-medium text-slate-700">Target Interval</span>
                </div>
                <button
                  onClick={() => setUseInterval(!useInterval)}
                  className={`w-12 h-7 rounded-full transition-colors ${
                    useInterval ? 'bg-blue-500' : 'bg-slate-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${
                    useInterval ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              {useInterval && (
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={targetInterval}
                    onChange={(e) => setTargetInterval(Math.max(10, parseInt(e.target.value) || 60))}
                    className="w-24 p-2 bg-white border border-slate-200 rounded-lg text-center font-bold text-slate-800"
                  />
                  <span className="text-slate-500">seconds per rep</span>
                </div>
              )}
            </div>
          </div>

          {/* Sound Toggle */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              {soundEnabled ? <Volume2 size={20} className="text-blue-500" /> : <VolumeX size={20} className="text-slate-400" />}
              <span className="font-medium text-slate-700">Sound & Vibration Alerts</span>
            </div>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`w-12 h-7 rounded-full transition-colors ${
                soundEnabled ? 'bg-blue-500' : 'bg-slate-300'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${
                soundEnabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {/* Start Button */}
          <button
            onClick={() => setStep('timing')}
            disabled={selectedSwimmers.length === 0}
            className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold rounded-2xl text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
          >
            <Play size={24} />
            Start Test Set
          </button>
        </div>

        {/* Audio element for beeps */}
        <audio ref={audioRef} src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2telejtqP7PO1NKEPBs5la7Y5cxyFBktfaHa67JgEwo3eLbl7MdRCQYvXKDo7c9VBQQ0UZzq7NFPAgExS5jr7dVLAQEtRZXs7NpJAAErQI/u7N5HAAA=" />
      </div>
    );
  }

  // ==========================================
  // TIMING SCREEN
  // ==========================================
  if (step === 'timing') {
    const repTime = masterClock - repStartTime;
    const allRecordedThisRep = selectedSwimmers.every(s => results[s.id]?.[currentRep] !== undefined);

    return (
      <div className="h-full flex flex-col bg-slate-900 text-white">
        {/* Header */}
        <div className="bg-slate-800 px-4 py-3 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-lg">{setName}</h2>
            <p className="text-sm text-slate-400">{selectedGroup}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-mono font-bold text-blue-400">
              {formatTime(masterClock)}
            </div>
            <div className="text-xs text-slate-400">Total Time</div>
          </div>
        </div>

        {/* Rep Indicator */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="text-2xl font-bold">Rep {currentRep}/{reps}</div>
            <div className="text-xl font-mono bg-white/20 px-3 py-1 rounded-lg">
              {formatTime(repTime)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {currentRep < reps && (
              <button
                onClick={advanceRep}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl font-bold flex items-center gap-2 transition-colors"
              >
                <SkipForward size={18} />
                Next Rep
              </button>
            )}
            {currentRep === reps && allRecordedThisRep && (
              <button
                onClick={handleFinish}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-xl font-bold flex items-center gap-2 transition-colors"
              >
                <Check size={18} />
                Finish
              </button>
            )}
          </div>
        </div>

        {/* Swimmer Cards Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {selectedSwimmers.map(swimmer => {
              const thisRepTime = results[swimmer.id]?.[currentRep];
              const lastRepTime = currentRep > 1 ? results[swimmer.id]?.[currentRep - 1] : null;
              const isRecorded = thisRepTime !== undefined;
              const isDNS = thisRepTime === 'DNS';
              const isFlashing = flashingCard === swimmer.id;
              
              // Calculate diff from last rep
              let diff = null;
              if (isRecorded && !isDNS && lastRepTime && lastRepTime !== 'DNS') {
                diff = thisRepTime - lastRepTime;
              }

              return (
                <button
                  key={swimmer.id}
                  onClick={() => handleSwimmerTap(swimmer.id)}
                  onContextMenu={(e) => { e.preventDefault(); handleMissedRep(swimmer.id); }}
                  disabled={!isRunning || isRecorded}
                  className={`
                    relative p-4 rounded-2xl text-left transition-all transform
                    ${isFlashing ? 'scale-95 bg-emerald-500' : ''}
                    ${isRecorded && !isFlashing
                      ? isDNS 
                        ? 'bg-slate-700 opacity-50' 
                        : 'bg-slate-700 border-2 border-emerald-500'
                      : 'bg-slate-800 hover:bg-slate-700 active:scale-95'
                    }
                    ${!isRunning ? 'opacity-50' : ''}
                  `}
                >
                  {/* Swimmer Name */}
                  <div className="font-bold text-lg mb-2 truncate">{swimmer.name}</div>
                  
                  {/* Current Rep Time */}
                  <div className={`text-2xl font-mono font-bold ${
                    isRecorded 
                      ? isDNS ? 'text-slate-500' : 'text-emerald-400' 
                      : 'text-slate-400'
                  }`}>
                    {isDNS ? 'DNS' : isRecorded ? formatTime(thisRepTime) : formatTime(repTime)}
                  </div>

                  {/* Diff indicator */}
                  {diff !== null && (
                    <div className={`absolute top-2 right-2 text-xs font-bold px-1.5 py-0.5 rounded ${
                      diff < 0 ? 'bg-emerald-500/30 text-emerald-400' : 'bg-red-500/30 text-red-400'
                    }`}>
                      {diff < 0 ? '' : '+'}{(diff / 1000).toFixed(2)}
                    </div>
                  )}

                  {/* Last rep reference */}
                  {lastRepTime && lastRepTime !== 'DNS' && (
                    <div className="text-xs text-slate-500 mt-1">
                      Last: {formatTime(lastRepTime)}
                    </div>
                  )}

                  {/* Recorded checkmark */}
                  {isRecorded && !isDNS && !isFlashing && (
                    <div className="absolute bottom-2 right-2">
                      <CheckCircle2 size={20} className="text-emerald-400" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="bg-slate-800 px-4 py-3 flex items-center justify-between shrink-0 border-t border-slate-700">
          <div className="flex items-center gap-2">
            {!isRunning && masterClock === 0 ? (
              <button
                onClick={handleStart}
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 rounded-xl font-bold flex items-center gap-2 text-lg"
              >
                <Play size={24} />
                START
              </button>
            ) : (
              <button
                onClick={handlePauseResume}
                className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 text-lg ${
                  isRunning 
                    ? 'bg-amber-500 hover:bg-amber-600' 
                    : 'bg-emerald-500 hover:bg-emerald-600'
                }`}
              >
                {isRunning ? <Pause size={24} /> : <Play size={24} />}
                {isRunning ? 'PAUSE' : 'RESUME'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleUndo}
              disabled={!lastTap}
              className="px-4 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium flex items-center gap-2"
            >
              <Undo2 size={18} />
              Undo
            </button>
            <button
              onClick={restartRep}
              className="px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium flex items-center gap-2"
            >
              <RotateCcw size={18} />
              Restart Rep
            </button>
            <button
              onClick={handleFinish}
              className="px-4 py-3 bg-rose-500 hover:bg-rose-600 rounded-xl font-medium flex items-center gap-2"
            >
              <X size={18} />
              End Set
            </button>
          </div>
        </div>

        {/* Audio element */}
        <audio ref={audioRef} src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2telejtqP7PO1NKEPBs5la7Y5cxyFBktfaHa67JgEwo3eLbl7MdRCQYvXKDo7c9VBQQ0UZzq7NFPAgExS5jr7dVLAQEtRZXs7NpJAAErQI/u7N5HAAA=" />
      </div>
    );
  }

  // ==========================================
  // RESULTS SCREEN
  // ==========================================
  if (step === 'results') {
    // Sort swimmers by average time
    const sortedSwimmers = [...selectedSwimmers].sort((a, b) => {
      const aStats = getSwimmerStats(a.id);
      const bStats = getSwimmerStats(b.id);
      if (!aStats.avg) return 1;
      if (!bStats.avg) return -1;
      return aStats.avg - bStats.avg;
    });

    return (
      <div className="min-h-full bg-slate-50 pb-8">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => setStep('timing')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                <ChevronLeft size={24} />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-800">{setName}</h1>
                <p className="text-sm text-slate-500">{selectedGroup} • {formatTimeShort(masterClock)} total</p>
              </div>
            </div>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl flex items-center gap-2"
            >
              <Save size={18} />
              Save Results
            </button>
          </div>
        </div>

        <div className="p-4 max-w-4xl mx-auto">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <div className="text-3xl font-bold text-slate-800">{selectedSwimmers.length}</div>
              <div className="text-xs text-slate-500 uppercase font-medium">Swimmers</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <div className="text-3xl font-bold text-slate-800">{reps}</div>
              <div className="text-xs text-slate-500 uppercase font-medium">Reps Completed</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <div className="text-3xl font-bold text-emerald-600">
                {formatTime(Math.min(...sortedSwimmers.map(s => getSwimmerStats(s.id).best).filter(Boolean)))}
              </div>
              <div className="text-xs text-slate-500 uppercase font-medium">Fastest Split</div>
            </div>
          </div>

          {/* Results Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-bold text-slate-600">#</th>
                    <th className="text-left px-4 py-3 font-bold text-slate-600">Swimmer</th>
                    <th className="text-center px-3 py-3 font-bold text-emerald-600">Avg</th>
                    <th className="text-center px-3 py-3 font-bold text-blue-600">Best</th>
                    <th className="text-center px-3 py-3 font-bold text-rose-600">Worst</th>
                    {Array.from({ length: reps }, (_, i) => (
                      <th key={i} className="text-center px-2 py-3 font-medium text-slate-500 text-xs">
                        R{i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedSwimmers.map((swimmer, idx) => {
                    const stats = getSwimmerStats(swimmer.id);
                    return (
                      <tr key={swimmer.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            idx === 0 ? 'bg-amber-100 text-amber-700' :
                            idx === 1 ? 'bg-slate-200 text-slate-600' :
                            idx === 2 ? 'bg-orange-100 text-orange-700' :
                            'bg-slate-100 text-slate-500'
                          }`}>
                            {idx + 1}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800">{swimmer.name}</td>
                        <td className="px-3 py-3 text-center">
                          <span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                            {formatTime(stats.avg)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center font-mono text-blue-600">{formatTime(stats.best)}</td>
                        <td className="px-3 py-3 text-center font-mono text-rose-600">{formatTime(stats.worst)}</td>
                        {Array.from({ length: reps }, (_, i) => {
                          const time = results[swimmer.id]?.[i + 1];
                          const isBest = time === stats.best;
                          const isWorst = time === stats.worst && stats.count > 1;
                          return (
                            <td key={i} className="px-2 py-3 text-center">
                              <span className={`font-mono text-xs ${
                                time === 'DNS' ? 'text-slate-400' :
                                isBest ? 'text-blue-600 font-bold' :
                                isWorst ? 'text-rose-500' :
                                'text-slate-600'
                              }`}>
                                {time === 'DNS' ? 'DNS' : formatTime(time)}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mt-6">
            <button
              onClick={onBack}
              className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl"
            >
              Discard & Exit
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl flex items-center justify-center gap-2"
            >
              <Save size={18} />
              Save to Profiles
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
