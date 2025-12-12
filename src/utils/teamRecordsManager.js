// Team Records Manager
// Handles automatic detection and updates of team records

import { supabase } from '../supabase';

/**
 * Converts time string to seconds for comparison
 */
export function timeToSeconds(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 999999;
  
  const clean = timeStr.trim().replace(/[^\d:.]/g, '');
  
  // Handle MM:SS.ss format
  if (clean.includes(':')) {
    const [mins, secs] = clean.split(':');
    return parseFloat(mins) * 60 + parseFloat(secs || 0);
  }
  
  // Handle SS.ss format
  return parseFloat(clean);
}

/**
 * Formats seconds into time display string
 */
export function secondsToTimeDisplay(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2);
  return mins > 0 ? `${mins}:${secs.padStart(5, '0')}` : secs;
}

/**
 * Extracts base event name from full event string
 * e.g., "Female (11/12) 50 Free (Prelim)" -> "50 Free"
 */
export function extractEventName(fullEvent) {
  if (!fullEvent) return '';
  
  // Remove prelim/finals markers and gender/age group info
  let clean = fullEvent.replace(/\s*\((Finals|Prelim)\)/i, '');
  clean = clean.replace(/^(Male|Female)\s*\([^)]+\)\s*/i, '');
  
  // Extract distance and stroke
  const match = clean.match(/(\d+)\s*(?:M|Y)?\s*(Free|Back|Breast|Fly|IM|Freestyle|Backstroke|Breaststroke|Butterfly|Ind\.?\s*Medley)/i);
  
  if (match) {
    const distance = match[1];
    let stroke = match[2];
    
    // Normalize stroke names
    if (stroke.toLowerCase().includes('free')) stroke = 'Free';
    else if (stroke.toLowerCase().includes('back')) stroke = 'Back';
    else if (stroke.toLowerCase().includes('breast')) stroke = 'Breast';
    else if (stroke.toLowerCase().includes('fly') || stroke.toLowerCase().includes('butter')) stroke = 'Fly';
    else if (stroke.toLowerCase().includes('im') || stroke.toLowerCase().includes('medley')) stroke = 'IM';
    
    return `${distance} ${stroke}`;
  }
  
  return clean.trim();
}

/**
 * Determines age group from age
 */
export function getAgeGroup(age) {
  if (age <= 8) return '8 & Under';
  if (age <= 10) return '9/10';
  if (age <= 12) return '11/12';
  if (age <= 14) return '13/14';
  return '15 & Over';
}

/**
 * Normalizes gender format (M/F -> Male/Female)
 */
export function normalizeGender(gender) {
  if (!gender) return null;
  const g = gender.toString().toUpperCase();
  if (g === 'M' || g === 'MALE') return 'Male';
  if (g === 'F' || g === 'FEMALE') return 'Female';
  return null;
}

/**
 * Checks if a result breaks a team record
 * @param {Object} result - The swim result to check
 * @param {string} result.swimmer_id - ID of the swimmer
 * @param {string} result.event - Event name
 * @param {string} result.time - Time string
 * @param {string} result.date - Date of the swim
 * @returns {Promise<Object|null>} Record break info or null if no record broken
 */
export async function checkForRecordBreak(result) {
  try {
    // 1. Get swimmer info
    const { data: swimmer, error: swimmerError } = await supabase
      .from('swimmers')
      .select('name, birthday, gender')
      .eq('id', result.swimmer_id)
      .single();
    
    if (swimmerError || !swimmer) {
      console.error('Error fetching swimmer:', swimmerError);
      return null;
    }
    
    // 2. Calculate swimmer's age on the date of the swim
    const swimDate = new Date(result.date);
    const birthDate = new Date(swimmer.birthday);
    let age = swimDate.getFullYear() - birthDate.getFullYear();
    const monthDiff = swimDate.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && swimDate.getDate() < birthDate.getDate())) {
      age--;
    }
    
    // 3. Extract event name and convert time to seconds
    const eventName = extractEventName(result.event);
    const timeSeconds = timeToSeconds(result.time);
    
    if (timeSeconds >= 999999 || !eventName) {
      return null; // Invalid time or event
    }
    
    // 4. Determine age group and normalize gender
    const ageGroup = getAgeGroup(age);
    const gender = normalizeGender(swimmer.gender);
    
    if (!gender) return null;
    
    // 5. Fetch current team record
    const { data: currentRecord, error: recordError } = await supabase
      .from('team_records')
      .select('*')
      .eq('event', eventName)
      .eq('age_group', ageGroup)
      .eq('gender', gender)
      .eq('course', 'SCY')
      .maybeSingle(); // Use maybeSingle to avoid error if no record exists
    
    if (recordError) {
      console.error('Error fetching team record:', recordError);
      return null;
    }
    
    // 6. Check if the new time is faster
    const isNewRecord = !currentRecord || timeSeconds < currentRecord.time_seconds;
    
    if (isNewRecord) {
      return {
        swimmer_id: result.swimmer_id,
        swimmer_name: swimmer.name,
        event: eventName,
        age_group: ageGroup,
        gender: gender,
        time_seconds: timeSeconds,
        time_display: secondsToTimeDisplay(timeSeconds),
        date: result.date,
        previous_record: currentRecord,
        improvement: currentRecord ? currentRecord.time_seconds - timeSeconds : null
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error checking for record break:', error);
    return null;
  }
}

/**
 * Checks multiple results for record breaks
 * @param {Array} results - Array of results to check
 * @returns {Promise<Array>} Array of record breaks found
 */
export async function checkMultipleResults(results) {
  const recordBreaks = [];
  
  for (const result of results) {
    const recordBreak = await checkForRecordBreak(result);
    if (recordBreak) {
      recordBreaks.push(recordBreak);
    }
  }
  
  return recordBreaks;
}

/**
 * Updates a team record in the database
 * @param {Object} recordBreak - The record break information
 * @returns {Promise<boolean>} Success status
 */
export async function updateTeamRecord(recordBreak) {
  try {
    const recordData = {
      event: recordBreak.event,
      age_group: recordBreak.age_group,
      gender: recordBreak.gender,
      swimmer_name: recordBreak.swimmer_name,
      time_seconds: recordBreak.time_seconds,
      time_display: recordBreak.time_display,
      date: recordBreak.date,
      course: 'SCY',
      updated_at: new Date().toISOString()
    };
    
    // Check if record exists
    const { data: existing } = await supabase
      .from('team_records')
      .select('id')
      .eq('event', recordBreak.event)
      .eq('age_group', recordBreak.age_group)
      .eq('gender', recordBreak.gender)
      .eq('course', 'SCY')
      .maybeSingle();
    
    if (existing) {
      // Update existing record
      const { error } = await supabase
        .from('team_records')
        .update(recordData)
        .eq('id', existing.id);
      
      if (error) {
        console.error('Error updating team record:', error);
        return false;
      }
    } else {
      // Insert new record (for new events)
      const { error } = await supabase
        .from('team_records')
        .insert([recordData]);
      
      if (error) {
        console.error('Error inserting team record:', error);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error updating team record:', error);
    return false;
  }
}

/**
 * Updates multiple team records
 * @param {Array} recordBreaks - Array of record breaks
 * @returns {Promise<Object>} Summary of updates
 */
export async function updateMultipleRecords(recordBreaks) {
  const results = {
    success: [],
    failed: []
  };
  
  for (const recordBreak of recordBreaks) {
    const success = await updateTeamRecord(recordBreak);
    if (success) {
      results.success.push(recordBreak);
    } else {
      results.failed.push(recordBreak);
    }
  }
  
  return results;
}

