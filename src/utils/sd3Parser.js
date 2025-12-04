// src/utils/sd3Parser.js
// SD3 File Parser for USA Swimming Meet Entries
// Parses fixed-width SD3 format files

/**
 * Stroke codes used in SD3 format
 */
const STROKE_CODES = {
  '1': 'Freestyle',
  '2': 'Backstroke',
  '3': 'Breaststroke',
  '4': 'Butterfly',
  '5': 'IM',
  '6': 'Freestyle Relay',
  '7': 'Medley Relay'
};

/**
 * Parse event code into human-readable format
 * Event codes are: {distance}{stroke_code}
 * Examples: 501 = 50 Free, 1002 = 100 Back, 2005 = 200 IM, 4005 = 400 IM
 */
function parseEventCode(eventCode) {
  const code = eventCode.trim();
  
  // Handle cases like "16501" (1650 Free) - distance can be 2-4 digits
  // The last digit is always the stroke code
  const strokeCode = code.slice(-1);
  const distance = code.slice(0, -1);
  
  const stroke = STROKE_CODES[strokeCode] || 'Unknown';
  
  return {
    distance: parseInt(distance, 10),
    stroke,
    strokeCode,
    displayName: `${distance} ${stroke}`
  };
}

/**
 * Parse seed time from SD3 format
 * Times are in format like "21.60Y" or "1:45.55Y"
 */
function parseSeedTime(timeStr) {
  if (!timeStr || timeStr.trim() === '') return null;
  
  const cleaned = timeStr.trim().replace(/[YLX]/g, ''); // Remove course indicator
  
  if (cleaned.includes(':')) {
    // Format: M:SS.ss or MM:SS.ss
    const parts = cleaned.split(':');
    const minutes = parseInt(parts[0], 10);
    const seconds = parseFloat(parts[1]);
    return {
      totalSeconds: minutes * 60 + seconds,
      display: cleaned
    };
  } else {
    // Format: SS.ss
    return {
      totalSeconds: parseFloat(cleaned),
      display: cleaned
    };
  }
}

/**
 * Parse a D01 record (individual entry)
 * Fixed-width format - positions based on actual SD3 file analysis
 * 
 * Example line:
 * "D01VA      Eliason, Colin A            E39804EAD8B6AUSA0303200817MM  502 24 15OV           23.89Y"
 * Positions (1-indexed):
 * 1-3: Record type "D01"
 * 4-5: LSC code "VA"
 * 12-39: Swimmer name "Eliason, Colin A"
 * 40-51: USA Swimming ID (12 chars) "E39804EAD8B6"
 * 52-54: Country "USA"
 * 55-62: Birth date MMDDYYYY "03032008"
 * 63-64: Age "17"
 * 65: Gender "M"
 * 66: Attached "M"
 * 68-72: Event code (right-aligned) " 502" or "2001" or "1002"
 * 73-75: Event number " 24"
 * 76-80: Age group "15OV" or "1314"
 * 81-96: Seed time (right-aligned) "23.89Y" or "1:45.55Y"
 */
function parseD01Record(line) {
  try {
    // Use 0-indexed positions (subtract 1 from the 1-indexed positions above)
    const swimmerName = line.substring(11, 39).trim();
    const usaSwimmingId = line.substring(39, 51).trim();
    const birthDate = line.substring(54, 62).trim();
    const ageStr = line.substring(62, 64).trim();
    const age = parseInt(ageStr, 10);
    const gender = line.substring(64, 65).trim();
    
    // Event section - need to parse more carefully
    // The format varies slightly, so let's extract the whole section and parse it
    const eventSection = line.substring(66, 100).trim();
    
    // Event section format: "502 24 15OV           23.89Y" or "2001 12 15OV         1:45.55Y"
    // Split by whitespace and parse
    const parts = eventSection.split(/\s+/).filter(p => p.length > 0);
    
    if (parts.length < 4) {
      console.warn('Could not parse event section:', eventSection, 'parts:', parts);
      return null;
    }
    
    const eventCode = parts[0]; // "502" or "2001" or "1002"
    const eventNumber = parseInt(parts[1], 10); // "24" -> 24
    const ageGroup = parts[2]; // "15OV" or "1314" or "1314B"
    const seedTimeStr = parts[3]; // "23.89Y" or "1:45.55Y"
    
    // Parse event code - last digit is stroke, rest is distance
    const strokeCode = eventCode.slice(-1);
    const distance = eventCode.slice(0, -1);
    const stroke = STROKE_CODES[strokeCode] || 'Unknown';
    const eventName = `${distance} ${stroke}`;
    
    // Parse seed time
    let seedTimeSeconds = null;
    let seedTimeDisplay = null;
    
    if (seedTimeStr) {
      const cleaned = seedTimeStr.replace(/[YLX]/g, '').trim();
      seedTimeDisplay = cleaned;
      
      if (cleaned.includes(':')) {
        const timeParts = cleaned.split(':');
        const minutes = parseInt(timeParts[0], 10);
        const seconds = parseFloat(timeParts[1]);
        seedTimeSeconds = minutes * 60 + seconds;
      } else if (cleaned && !isNaN(parseFloat(cleaned))) {
        seedTimeSeconds = parseFloat(cleaned);
      }
    }
    
    // Check for bonus indicator (B in age group)
    const isBonus = ageGroup.includes('B');
    const cleanAgeGroup = ageGroup.replace('B', '');
    
    return {
      swimmerName,
      usaSwimmingId,
      birthDate,
      age: isNaN(age) ? null : age,
      gender: gender === 'M' ? 'Male' : gender === 'F' ? 'Female' : null,
      eventCode,
      eventNumber: isNaN(eventNumber) ? null : eventNumber,
      eventName,
      distance: parseInt(distance, 10),
      stroke,
      ageGroup: cleanAgeGroup,
      isBonus,
      seedTimeSeconds,
      seedTimeDisplay
    };
  } catch (error) {
    console.error('Error parsing D01 record:', error, line);
    return null;
  }
}

/**
 * Parse meet info from B1 record
 */
function parseB1Record(line) {
  try {
    // B11 record contains meet info
    // Pos 5+: Meet name
    // Date info near end
    const meetName = line.substring(5, 50).trim();
    
    // Try to find dates (format: MMDDYYYY)
    const dateMatches = line.match(/(\d{8})/g);
    let startDate = null;
    let endDate = null;
    
    if (dateMatches && dateMatches.length >= 1) {
      const d1 = dateMatches[0];
      startDate = `${d1.substring(4, 8)}-${d1.substring(0, 2)}-${d1.substring(2, 4)}`;
      
      if (dateMatches.length >= 2) {
        const d2 = dateMatches[1];
        endDate = `${d2.substring(4, 8)}-${d2.substring(0, 2)}-${d2.substring(2, 4)}`;
      }
    }
    
    return {
      name: meetName,
      startDate,
      endDate
    };
  } catch (error) {
    console.error('Error parsing B1 record:', error);
    return null;
  }
}

/**
 * Parse team info from C1 record
 */
function parseC1Record(line) {
  try {
    const teamCode = line.substring(5, 11).trim();
    const teamName = line.substring(11, 45).trim();
    
    return {
      teamCode,
      teamName
    };
  } catch (error) {
    console.error('Error parsing C1 record:', error);
    return null;
  }
}

/**
 * Main parser function - parses entire SD3 file
 */
export function parseSD3File(fileContent) {
  const lines = fileContent.split('\n');
  
  const result = {
    meet: null,
    team: null,
    entries: [],
    swimmers: new Map(), // Unique swimmers
    errors: []
  };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.length < 3) continue;
    
    const recordType = line.substring(0, 3);
    
    try {
      switch (recordType) {
        case 'B11':
        case 'B12':
          const meetInfo = parseB1Record(line);
          if (meetInfo) result.meet = meetInfo;
          break;
          
        case 'C11':
        case 'C12':
          const teamInfo = parseC1Record(line);
          if (teamInfo) result.team = teamInfo;
          break;
          
        case 'D01':
          const entry = parseD01Record(line);
          if (entry) {
            result.entries.push(entry);
            
            // Track unique swimmers
            if (!result.swimmers.has(entry.usaSwimmingId)) {
              result.swimmers.set(entry.usaSwimmingId, {
                name: entry.swimmerName,
                usaSwimmingId: entry.usaSwimmingId,
                age: entry.age,
                gender: entry.gender,
                entries: []
              });
            }
            result.swimmers.get(entry.usaSwimmingId).entries.push(entry);
          }
          break;
          
        // Skip D3 (additional swimmer info), E01 (relay entries), Z01 (file summary), A01 (file header)
        default:
          break;
      }
    } catch (error) {
      result.errors.push({ line: i + 1, error: error.message });
    }
  }
  
  // Convert swimmers Map to array
  result.swimmerList = Array.from(result.swimmers.values());
  
  return result;
}

/**
 * Format time for display (seconds to MM:SS.ss or SS.ss)
 */
export function formatTime(seconds) {
  if (!seconds) return '--';
  
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2).padStart(5, '0');
    return `${mins}:${secs}`;
  }
  
  return seconds.toFixed(2);
}

/**
 * Group entries by swimmer for display
 */
export function groupEntriesBySwimmer(entries) {
  const grouped = {};
  
  entries.forEach(entry => {
    const key = entry.usaSwimmingId || entry.swimmerName;
    if (!grouped[key]) {
      grouped[key] = {
        swimmerName: entry.swimmerName,
        usaSwimmingId: entry.usaSwimmingId,
        age: entry.age,
        gender: entry.gender,
        entries: []
      };
    }
    grouped[key].entries.push(entry);
  });
  
  return Object.values(grouped);
}

export default {
  parseSD3File,
  parseEventCode,
  formatTime,
  groupEntriesBySwimmer
};
