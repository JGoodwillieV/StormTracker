// src/utils/meetPdfParser.js
// Utilities for parsing swim meet PDFs (Meet Info, Timeline, Heat Sheets)
// Uses pdf.js for PDF text extraction

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Set worker source using Vite's ?url import
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// ============================================
// SHARED HELPERS
// ============================================

/**
 * Extract all text from a PDF file
 */
export async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  const pages = [];
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    pages.push(pageText);
    fullText += pageText + '\n';
  }
  
  return { fullText, pages, numPages: pdf.numPages };
}

/**
 * Parse a date string in various formats
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  // Try common formats
  const formats = [
    // "December 4-7, 2025" or "November 14-16, 2025"
    /(\w+)\s+(\d{1,2})(?:-\d{1,2})?,?\s+(\d{4})/i,
    // "12/4/2025" or "11/14/2025"
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
    // "2025-12-04"
    /(\d{4})-(\d{2})-(\d{2})/
  ];
  
  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      if (format === formats[0]) {
        // Month name format
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                          'july', 'august', 'september', 'october', 'november', 'december'];
        const monthIdx = monthNames.indexOf(match[1].toLowerCase());
        if (monthIdx >= 0) {
          return new Date(parseInt(match[3]), monthIdx, parseInt(match[2]));
        }
      } else if (format === formats[1]) {
        return new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]));
      } else if (format === formats[2]) {
        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
      }
    }
  }
  
  // Fallback to Date.parse
  const parsed = Date.parse(dateStr);
  return isNaN(parsed) ? null : new Date(parsed);
}

/**
 * Parse date range from text like "December 4-7, 2025"
 */
function parseDateRange(dateStr) {
  if (!dateStr) return { start: null, end: null };
  
  // Match "Month Day-Day, Year" format
  const rangeMatch = dateStr.match(/(\w+)\s+(\d{1,2})-(\d{1,2}),?\s+(\d{4})/i);
  if (rangeMatch) {
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                       'july', 'august', 'september', 'october', 'november', 'december'];
    const monthIdx = monthNames.indexOf(rangeMatch[1].toLowerCase());
    if (monthIdx >= 0) {
      const year = parseInt(rangeMatch[4]);
      const startDay = parseInt(rangeMatch[2]);
      const endDay = parseInt(rangeMatch[3]);
      return {
        start: new Date(year, monthIdx, startDay),
        end: new Date(year, monthIdx, endDay)
      };
    }
  }
  
  // Single date
  const singleDate = parseDate(dateStr);
  return { start: singleDate, end: singleDate };
}

/**
 * Parse time string to seconds
 */
function parseTimeToSeconds(timeStr) {
  if (!timeStr) return null;
  const clean = timeStr.replace(/[^\d:.]/g, '');
  
  // Format: "1:23.45" or "23.45"
  if (clean.includes(':')) {
    const [mins, secs] = clean.split(':');
    return parseInt(mins) * 60 + parseFloat(secs);
  }
  return parseFloat(clean);
}

/**
 * Parse a time string like "9:00 AM" or "09:00" to a time string
 */
function parseTimeString(timeStr) {
  if (!timeStr) return null;
  
  // Handle "9:00 AM" format
  const ampmMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1]);
    const mins = ampmMatch[2];
    const period = ampmMatch[3]?.toUpperCase();
    
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    return `${hours.toString().padStart(2, '0')}:${mins}:00`;
  }
  
  return null;
}

/**
 * Extract money amount from text
 */
function parseMoney(text) {
  const match = text.match(/\$?([\d,]+\.?\d*)/);
  if (match) {
    return parseFloat(match[1].replace(',', ''));
  }
  return null;
}

// ============================================
// MEET INFO PDF PARSER
// ============================================

/**
 * Parse a meet info/announcement PDF
 * Extracts: name, dates, location, fees, event limits, etc.
 */
export async function parseMeetInfoPDF(file) {
  const { fullText, pages } = await extractTextFromPDF(file);
  const text = fullText;
  
  const result = {
    name: null,
    startDate: null,
    endDate: null,
    sanctionNumber: null,
    locationName: null,
    locationAddress: null,
    hostTeam: null,
    meetDirector: {
      name: null,
      email: null,
      phone: null
    },
    entryDeadline: null,
    eventsPerDayLimit: 3,
    maxEventsTotal: null,
    fees: {
      individual: null,
      relay: null,
      surcharge: null
    },
    meetType: 'timed_finals',
    course: 'SCY',
    ageUpDate: null,
    warmupTimes: {},
    events: [],
    rawText: text
  };
  
  // ---- Extract Meet Name ----
  // Usually in the first few lines, often has specific keywords
  const namePatterns = [
    // Match "The Something Something" at start of text
    /^(The\s+[\w\s]+?)(?=\n|November|December|January|February|March|April|May|June|July|August|September|October|\d{4})/im,
    // Match ALL CAPS with meet keywords
    /^([A-Z][A-Z\s]+(?:CLASSIC|INVITATIONAL|MEET|CHAMPIONSHIP|OPEN|GAUNTLET|SPLASH|SPRINT|SHOWDOWN))/m,
    // Match year + name pattern
    /^(\d{4}\s+[\w\s]+(?:Classic|Invitational|Meet|Gauntlet))/im,
    // Match "Name" followed by date line
    /^([\w\s]+?(?:Classic|Invitational|Meet|Gauntlet|Championship|Open))\s*\n/im
  ];
  
  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match && match[1].trim().length > 3) {
      result.name = match[1].trim();
      break;
    }
  }
  
  // ---- Extract Sanction Number ----
  const sanctionMatch = text.match(/SANCTION\s*(?:NO\.?|NUMBER)?:?\s*([A-Z]{2}-\d{2}-\d{3})/i);
  if (sanctionMatch) {
    result.sanctionNumber = sanctionMatch[1];
  }
  
  // ---- Extract Dates ----
  const datePatterns = [
    /(\w+\s+\d{1,2}-\d{1,2},?\s+\d{4})/i,
    /(\w+\s+\d{1,2},?\s+\d{4})\s*[-–to]+\s*(\w+\s+\d{1,2},?\s+\d{4})/i
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      const dates = parseDateRange(match[0]);
      result.startDate = dates.start;
      result.endDate = dates.end;
      break;
    }
  }
  
  // ---- Extract Location ----
  const locationMatch = text.match(/LOCATION:?\s*[•\-]?\s*(.+?)(?=\n|FACILITY|MEET)/is);
  if (locationMatch) {
    const locText = locationMatch[1].trim();
    // Try to split name and address
    const addressMatch = locText.match(/(.+?),\s*(\d+.+)/);
    if (addressMatch) {
      result.locationName = addressMatch[1].trim();
      result.locationAddress = addressMatch[2].trim();
    } else {
      result.locationName = locText;
    }
  }
  
  // ---- Extract Meet Director ----
  const directorSection = text.match(/MEET\s*DIRECTOR:?\s*(.+?)(?=ELIGIBILITY|DISABILITY|FORMAT)/is);
  if (directorSection) {
    const dirText = directorSection[1];
    
    const nameMatch = dirText.match(/Name:?\s*(.+?)(?=\n|Email|Phone)/i);
    if (nameMatch) result.meetDirector.name = nameMatch[1].trim();
    
    const emailMatch = dirText.match(/Email:?\s*([\w.+-]+@[\w.-]+\.\w+)/i);
    if (emailMatch) result.meetDirector.email = emailMatch[1];
    
    const phoneMatch = dirText.match(/Phone:?\s*([\d\-().]+)/i);
    if (phoneMatch) result.meetDirector.phone = phoneMatch[1];
  }
  
  // ---- Extract Entry Deadline ----
  // Multiple patterns for deadline extraction
  const deadlinePatterns = [
    // "DEADLINE FOR THE RECEIPT OF ENTRIES IS Tuesday, November 4, 2025"
    /DEADLINE\s*(?:FOR\s*(?:THE\s*)?RECEIPT\s*OF\s*ENTRIES\s*IS)\s*(\w+day,?\s+\w+\s+\d{1,2},?\s+\d{4})/i,
    /DEADLINE\s*(?:FOR\s*(?:THE\s*)?RECEIPT\s*OF\s*ENTRIES\s*IS)\s*(\w+\s+\d{1,2},?\s+\d{4})/i,
    // "Entry Deadline: November 4, 2025"
    /Entry\s*Deadline:?\s*(\w+\s+\d{1,2},?\s+\d{4})/i,
    // "Entries due by November 4, 2025"
    /Entries?\s*(?:due|must\s*be\s*received)\s*(?:by|before)\s*(\w+\s+\d{1,2},?\s+\d{4})/i
  ];
  
  for (const pattern of deadlinePatterns) {
    const deadlineMatch = text.match(pattern);
    if (deadlineMatch) {
      // Remove day of week if present for cleaner parsing
      const dateStr = deadlineMatch[1].replace(/^\w+day,?\s*/i, '');
      result.entryDeadline = parseDate(dateStr) || parseDate(deadlineMatch[1]);
      break;
    }
  }
  
  // ---- Extract Event Limits ----
  const eventLimitMatch = text.match(/maximum\s*(?:of\s*)?(\d+)\s*individual\s*events?\s*per\s*day/i);
  if (eventLimitMatch) {
    result.eventsPerDayLimit = parseInt(eventLimitMatch[1]);
  }
  
  const totalLimitMatch = text.match(/no\s*more\s*than\s*(\d+)\s*events?\s*(?:for\s*the\s*meet|total)/i);
  if (totalLimitMatch) {
    result.maxEventsTotal = parseInt(totalLimitMatch[1]);
  }
  
  // ---- Extract Fees ----
  // Look for FEES section first, then extract individual fees
  const feesSection = text.match(/FEES:?\s*([\s\S]*?)(?=SEEDING|AWARDS|PENALTIES|MEET\s*RULES)/i);
  const feesText = feesSection ? feesSection[1] : text;
  
  // Individual event fee: "$12.00" or "Individual events: $12.00"
  const individualFeeMatch = feesText.match(/Individual\s*events?:?\s*\$?([\d.]+)/i);
  if (individualFeeMatch) {
    result.fees.individual = parseFloat(individualFeeMatch[1]);
  }
  
  // Relay event fee
  const relayFeeMatch = feesText.match(/Relay\s*events?:?\s*\$?([\d.]+)/i);
  if (relayFeeMatch) {
    result.fees.relay = parseFloat(relayFeeMatch[1]);
  }
  
  // Surcharge - multiple patterns
  const surchargePatterns = [
    /Swimmer\s*surcharge:?\s*\$?([\d.]+)/i,
    /surcharge:?\s*\$?([\d.]+)\s*per\s*(?:person|swimmer|athlete)/i,
    /\$?([\d.]+)\s*per\s*(?:person|swimmer|athlete).*surcharge/i
  ];
  
  for (const pattern of surchargePatterns) {
    const surchargeMatch = feesText.match(pattern);
    if (surchargeMatch) {
      result.fees.surcharge = parseFloat(surchargeMatch[1]);
      break;
    }
  }
  
  // ---- Determine Meet Type ----
  if (/prelims?\s*\/?\s*finals/i.test(text)) {
    result.meetType = 'prelims_finals';
  } else if (/timed\s*finals/i.test(text)) {
    result.meetType = 'timed_finals';
  }
  
  // ---- Determine Course ----
  if (/25\s*(?:yard|yd)/i.test(text) || /SCY/i.test(text)) {
    result.course = 'SCY';
  } else if (/25\s*(?:meter|m)/i.test(text) || /SCM/i.test(text)) {
    result.course = 'SCM';
  } else if (/50\s*(?:meter|m)/i.test(text) || /LCM/i.test(text)) {
    result.course = 'LCM';
  }
  
  // ---- Extract Age-Up Date ----
  const ageUpMatch = text.match(/Age\s*(?:on|as\s*of)\s*(\w+\s+\d{1,2},?\s+\d{4})/i);
  if (ageUpMatch) {
    result.ageUpDate = parseDate(ageUpMatch[1]);
  }
  
  // ---- Extract Events from Order of Events Table ----
  result.events = parseEventsFromText(text);
  
  return result;
}

/**
 * Parse events from the Order of Events section
 */
function parseEventsFromText(text) {
  const events = [];
  const seenEvents = new Set();
  
  // First, try to find the ORDER OF EVENTS section
  const orderSection = text.match(/ORDER\s*OF\s*EVENTS[\s\S]*$/i);
  const searchText = orderSection ? orderSection[0] : text;
  
  // Pattern for table format: "1 11-12 50 Breast 2" or "3 10&U 50 Breast 4"
  // Girls event# on left, Boys event# on right
  // Age group can be: 10&U, 11-12, 10&Under, etc.
  const tablePattern = /(\d+)\s+((?:10|11|12|13|14|15|16|17|18|8)\s*&?\s*(?:U|O|Under|Over)?|\d+-\d+|Open)\s+(\d+)\s+(Free(?:style)?|Back(?:stroke)?|Breast(?:stroke)?|Fly|Butterfly|IM|Individual\s*Medley|(?:Free|Medley)\s*Relay)\s*(?:\*|#)?\s*(\d+)?/gi;
  
  let match;
  
  while ((match = tablePattern.exec(searchText)) !== null) {
    const girlsEventNum = parseInt(match[1]);
    const ageGroup = normalizeAgeGroup(match[2]);
    const distance = parseInt(match[3]);
    const stroke = normalizeStroke(match[4]);
    const boysEventNum = match[5] ? parseInt(match[5]) : girlsEventNum + 1;
    const isRelay = /relay/i.test(match[4]);
    
    // Add girls event
    const girlsKey = `${girlsEventNum}-${ageGroup}-${distance}-${stroke}-Girls`;
    if (!seenEvents.has(girlsKey) && ageGroup && distance && stroke) {
      seenEvents.add(girlsKey);
      events.push({
        eventNumber: girlsEventNum,
        ageGroup: ageGroup,
        distance: distance,
        stroke: stroke,
        gender: 'Girls',
        isRelay: isRelay,
        eventName: `Girls ${ageGroup} ${distance} ${stroke}`
      });
    }
    
    // Add boys event (if different event number)
    const boysKey = `${boysEventNum}-${ageGroup}-${distance}-${stroke}-Boys`;
    if (!seenEvents.has(boysKey) && boysEventNum !== girlsEventNum && ageGroup && distance && stroke) {
      seenEvents.add(boysKey);
      events.push({
        eventNumber: boysEventNum,
        ageGroup: ageGroup,
        distance: distance,
        stroke: stroke,
        gender: 'Boys',
        isRelay: isRelay,
        eventName: `Boys ${ageGroup} ${distance} ${stroke}`
      });
    }
  }
  
  // If table pattern didn't find events, try alternate patterns
  if (events.length < 5) {
    // Pattern: "Girls 11-12 200 Free" or "Boys 10&U 50 Back"
    const altPattern = /(Girls?|Boys?|Mixed)\s+((?:10|11|12|13|14|15|16|17|18|8)\s*&?\s*(?:U|O|Under|Over)?|\d+-\d+|Open)\s+(\d+)\s+(Free(?:style)?|Back(?:stroke)?|Breast(?:stroke)?|Fly|Butterfly|IM|Individual\s*Medley|(?:Free|Medley)\s*Relay)/gi;
    
    while ((match = altPattern.exec(searchText)) !== null) {
      const gender = match[1].toLowerCase().includes('girl') ? 'Girls' : 
                     match[1].toLowerCase().includes('boy') ? 'Boys' : 'Mixed';
      const ageGroup = normalizeAgeGroup(match[2]);
      const distance = parseInt(match[3]);
      const stroke = normalizeStroke(match[4]);
      const isRelay = /relay/i.test(match[4]);
      const eventNumber = events.length + 1;
      
      const key = `${eventNumber}-${ageGroup}-${distance}-${stroke}-${gender}`;
      if (!seenEvents.has(key) && ageGroup && distance && stroke) {
        seenEvents.add(key);
        events.push({
          eventNumber: eventNumber,
          ageGroup: ageGroup,
          distance: distance,
          stroke: stroke,
          gender: gender,
          isRelay: isRelay,
          eventName: `${gender} ${ageGroup} ${distance} ${stroke}`
        });
      }
    }
  }
  
  return events.sort((a, b) => a.eventNumber - b.eventNumber);
}

/**
 * Normalize age group string
 */
function normalizeAgeGroup(ageGroup) {
  if (!ageGroup) return null;
  
  const ag = ageGroup.toLowerCase().replace(/\s+/g, ' ').trim();
  
  // Handle various "10 & Under" formats
  if (/10\s*&?\s*u(nder)?/.test(ag)) return '10 & Under';
  if (/8\s*&?\s*u(nder)?/.test(ag)) return '8 & Under';
  
  // Handle specific age groups
  if (/11-12/.test(ag) || /11\s*-\s*12/.test(ag)) return '11-12';
  if (/13-14/.test(ag)) return '13-14';
  if (/15-16/.test(ag)) return '15-16';
  if (/17-18/.test(ag)) return '17-18';
  
  // Handle "& Over" formats  
  if (/15\s*&?\s*o(ver)?/.test(ag) || /senior/.test(ag)) return '15 & Over';
  if (/13\s*&?\s*o(ver)?/.test(ag)) return '13 & Over';
  if (/open/i.test(ag)) return 'Open';
  if (/13\s*&?\s*over/.test(ag)) return '13 & Over';
  if (/12\s*&?\s*under/.test(ag)) return '12 & Under';
  if (/8\s*&?\s*under/.test(ag)) return '8 & Under';
  if (/9-10/.test(ag)) return '9-10';
  
  return ageGroup;
}

/**
 * Normalize stroke name
 */
function normalizeStroke(stroke) {
  if (!stroke) return null;
  
  const s = stroke.toLowerCase();
  
  if (/free(?:style)?/.test(s) && !/relay/.test(s)) return 'Freestyle';
  if (/back(?:stroke)?/.test(s)) return 'Backstroke';
  if (/breast(?:stroke)?/.test(s)) return 'Breaststroke';
  if (/fly|butterfly/.test(s)) return 'Butterfly';
  if (/im|individual\s*medley/.test(s)) return 'IM';
  if (/medley\s*relay/.test(s)) return 'Medley Relay';
  if (/free\s*relay/.test(s)) return 'Free Relay';
  
  return stroke;
}

// ============================================
// TIMELINE PDF PARSER (Hy-Tek Session Report)
// ============================================

/**
 * Parse a Hy-Tek timeline/session report PDF
 * Extracts: events with estimated start times, entry counts, heat counts
 */
export async function parseTimelinePDF(file) {
  const { fullText, pages } = await extractTextFromPDF(file);
  
  const result = {
    sessions: [],
    events: []
  };
  
  // Split by sessions
  const sessionBlocks = fullText.split(/Session:\s*(\d+)\s+/i);
  
  for (let i = 1; i < sessionBlocks.length; i += 2) {
    const sessionNum = parseInt(sessionBlocks[i]);
    const sessionText = sessionBlocks[i + 1] || '';
    
    // Parse session header
    const sessionInfo = {
      sessionNumber: sessionNum,
      name: null,
      dayOfMeet: null,
      startTime: null,
      heatInterval: 30
    };
    
    // Extract session name
    const nameMatch = sessionText.match(/^([^\n]+)/);
    if (nameMatch) {
      sessionInfo.name = nameMatch[1].trim();
    }
    
    // Extract day of meet
    const dayMatch = sessionText.match(/Day\s*of\s*Meet:\s*(\d+)/i);
    if (dayMatch) {
      sessionInfo.dayOfMeet = parseInt(dayMatch[1]);
    }
    
    // Extract start time
    const startMatch = sessionText.match(/Starts\s*at\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
    if (startMatch) {
      sessionInfo.startTime = parseTimeString(startMatch[1]);
    }
    
    // Extract heat interval
    const intervalMatch = sessionText.match(/Heat\s*Interval:\s*(\d+)\s*Seconds/i);
    if (intervalMatch) {
      sessionInfo.heatInterval = parseInt(intervalMatch[1]);
    }
    
    result.sessions.push(sessionInfo);
    
    // Parse events in this session
    // Pattern: "Prelims 1 Girls 11-12 50 Breaststroke 14 2 09:00 AM"
    const eventPattern = /(Prelims?|Finals?(?:-\d)?|Finals-S)\s+(\d+)\s+(.+?)\s+(\d+)\s+(\d+)\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)/gi;
    
    let match;
    while ((match = eventPattern.exec(sessionText)) !== null) {
      const eventType = match[1].toLowerCase();
      const eventNumber = parseInt(match[2]);
      const eventName = match[3].trim();
      const entryCount = parseInt(match[4]);
      const heatCount = parseInt(match[5]);
      const startTime = match[6];
      
      // Parse event name to extract details
      const eventDetails = parseEventName(eventName);
      
      result.events.push({
        sessionNumber: sessionNum,
        eventNumber,
        eventName,
        ...eventDetails,
        roundType: eventType.includes('final') ? 'finals' : 'prelims',
        entryCount,
        heatCount,
        estimatedStartTime: startTime,
        estimatedStartTimeString: parseTimeString(startTime)
      });
    }
  }
  
  // If no sessions found, try parsing as a flat list
  if (result.events.length === 0) {
    const flatPattern = /(\d+)\s+(Girls?|Boys?)\s+((?:\d+\s*&?\s*Under|\d+-\d+|\d+\s*&?\s*Over))\s+(\d+)\s+(?:Yard\s+)?(Free(?:style)?|Back(?:stroke)?|Breast(?:stroke)?|Fly|Butterfly|IM|(?:Free|Medley)\s*Relay)/gi;
    
    let match;
    while ((match = flatPattern.exec(fullText)) !== null) {
      result.events.push({
        eventNumber: parseInt(match[1]),
        gender: match[2].includes('irl') ? 'Girls' : 'Boys',
        ageGroup: normalizeAgeGroup(match[3]),
        distance: parseInt(match[4]),
        stroke: normalizeStroke(match[5]),
        isRelay: /relay/i.test(match[5])
      });
    }
  }
  
  return result;
}

/**
 * Parse event name string into components
 */
function parseEventName(name) {
  const result = {
    gender: null,
    ageGroup: null,
    distance: null,
    stroke: null,
    isRelay: false
  };
  
  // Gender
  if (/girl/i.test(name)) result.gender = 'Girls';
  else if (/boy/i.test(name)) result.gender = 'Boys';
  else if (/mixed/i.test(name)) result.gender = 'Mixed';
  
  // Age group
  const ageMatch = name.match(/(\d+\s*&?\s*Under|\d+-\d+|\d+\s*&?\s*Over)/i);
  if (ageMatch) result.ageGroup = normalizeAgeGroup(ageMatch[1]);
  
  // Distance
  const distMatch = name.match(/(\d+)\s*(?:Yard|Meter)?/i);
  if (distMatch) result.distance = parseInt(distMatch[1]);
  
  // Stroke
  const strokeMatch = name.match(/(Free(?:style)?|Back(?:stroke)?|Breast(?:stroke)?|Fly|Butterfly|IM|(?:Free|Medley)\s*Relay)/i);
  if (strokeMatch) {
    result.stroke = normalizeStroke(strokeMatch[1]);
    result.isRelay = /relay/i.test(strokeMatch[1]);
  }
  
  return result;
}

// ============================================
// HEAT SHEET PDF PARSER (Hy-Tek Meet Program)
// ============================================

/**
 * Parse a Hy-Tek heat sheet/meet program PDF
 * Extracts: swimmer entries with heat, lane, seed time
 */
export async function parseHeatSheetPDF(file) {
  const { fullText, pages } = await extractTextFromPDF(file);
  
  const result = {
    meetName: null,
    meetDates: null,
    sessionName: null,
    entries: []
  };
  
  // Extract meet info from header
  const meetMatch = fullText.match(/^(.+?)\s*[-–]\s*(\d{1,2}\/\d{1,2}\/\d{4})/m);
  if (meetMatch) {
    result.meetName = meetMatch[1].trim();
    result.meetDates = meetMatch[2];
  }
  
  // Extract session name
  const sessionMatch = fullText.match(/Meet\s*Program\s*[-–]\s*(.+?)$/m);
  if (sessionMatch) {
    result.sessionName = sessionMatch[1].trim();
  }
  
  // Parse events and entries
  // Pattern for event header: "#1 Girls 11-12 50 Yard Breaststroke"
  const eventHeaderPattern = /#(\d+)\s+(Girls?|Boys?|Mixed)\s+((?:\d+\s*&?\s*Under|\d+-\d+|\d+\s*&?\s*Over))\s+(\d+)\s+(?:Yard|Meter)\s+(Free(?:style)?|Back(?:stroke)?|Breast(?:stroke)?|Fly|Butterfly|IM|(?:Free|Medley)\s*Relay)/gi;
  
  // Pattern for heat header: "Heat 1 of 2 Prelims Starts at 09:00 AM"
  const heatHeaderPattern = /Heat\s+(\d+)\s+of\s+(\d+)\s+(Prelims?|Finals?)\s+Starts\s+at\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)/gi;
  
  // Pattern for swimmer entry: "1 Traner, Sadie M 12 RAYS-VA NT"
  // Lane, Name, Age, Team, Seed Time
  const swimmerPattern = /^(\d+)\s+([A-Za-z]+,\s*[A-Za-z]+(?:\s+[A-Z])?)\s+(\d{1,2})\s+([A-Z]{3,5}-[A-Z]{2})\s+([\d:.]+|NT)/gm;
  
  let currentEvent = null;
  let currentHeat = null;
  let currentHeatStart = null;
  
  // Process line by line for better context
  const lines = fullText.split('\n');
  
  for (const line of lines) {
    // Check for event header
    const eventMatch = line.match(/#(\d+)\s+(Girls?|Boys?|Mixed)\s+(.+)/i);
    if (eventMatch) {
      currentEvent = {
        eventNumber: parseInt(eventMatch[1]),
        gender: eventMatch[2].includes('irl') ? 'Girls' : 'Boys',
        eventName: eventMatch[3].trim()
      };
      continue;
    }
    
    // Check for heat header
    const heatMatch = line.match(/Heat\s+(\d+)\s+of\s+(\d+).*?Starts\s+at\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
    if (heatMatch) {
      currentHeat = parseInt(heatMatch[1]);
      currentHeatStart = heatMatch[3];
      continue;
    }
    
    // Check for swimmer entry
    const swimmerMatch = line.match(/^(\d+)\s+([A-Za-z'-]+,\s*[A-Za-z'-]+(?:\s+[A-Z])?)\s+(\d{1,2})\s+([A-Z0-9]{2,6}-[A-Z]{2})\s+([\d:.]+|NT)/i);
    if (swimmerMatch && currentEvent) {
      const entry = {
        eventNumber: currentEvent.eventNumber,
        eventName: currentEvent.eventName,
        gender: currentEvent.gender,
        lane: parseInt(swimmerMatch[1]),
        swimmerName: swimmerMatch[2].trim(),
        age: parseInt(swimmerMatch[3]),
        teamCode: swimmerMatch[4],
        seedTime: swimmerMatch[5],
        seedTimeSeconds: parseTimeToSeconds(swimmerMatch[5]),
        heat: currentHeat,
        heatStartTime: currentHeatStart
      };
      
      result.entries.push(entry);
    }
  }
  
  return result;
}

/**
 * Match heat sheet entries to swimmers in database
 * Returns entries with matched swimmer_id where found
 */
export function matchHeatSheetEntries(entries, dbSwimmers, teamCode) {
  return entries.map(entry => {
    // Skip entries that don't match our team code
    if (teamCode && !entry.teamCode.startsWith(teamCode)) {
      return { ...entry, matched: false, matchReason: 'different_team' };
    }
    
    // Try to match by name
    const entryNameParts = entry.swimmerName.split(',').map(p => p.trim());
    const lastName = entryNameParts[0]?.toLowerCase();
    const firstName = entryNameParts[1]?.split(' ')[0]?.toLowerCase();
    
    const match = dbSwimmers.find(swimmer => {
      const swimmerName = swimmer.name.toLowerCase();
      const swimmerParts = swimmerName.split(' ');
      const swimmerFirst = swimmerParts[0];
      const swimmerLast = swimmerParts[swimmerParts.length - 1];
      
      // Match if first and last names match
      return swimmerFirst === firstName && swimmerLast === lastName;
    });
    
    if (match) {
      return {
        ...entry,
        matched: true,
        swimmer_id: match.id,
        matchedSwimmerName: match.name
      };
    }
    
    return { ...entry, matched: false, matchReason: 'no_match' };
  });
}

// ============================================
// EXPORTS
// ============================================

export default {
  extractTextFromPDF,
  parseMeetInfoPDF,
  parseTimelinePDF,
  parseHeatSheetPDF,
  matchHeatSheetEntries
};
