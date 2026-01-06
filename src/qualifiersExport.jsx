// qualifiersExport.jsx
// Export utilities for Qualifiers Report - PDF and Excel grid exports
import * as XLSX from 'xlsx';

// Standard event order for columns
const EVENT_ORDER = [
  '50 free', '100 free', '200 free', '500 free',
  '50 back', '100 back', '200 back',
  '50 breast', '100 breast', '200 breast',
  '50 fly', '100 fly', '200 fly',
  '100 IM', '200 IM', '400 IM'
];

// Display names for events (column headers)
const EVENT_DISPLAY_NAMES = {
  '50 free': '50 Free',
  '100 free': '100 Free',
  '200 free': '200 Free',
  '500 free': '500 Free',
  '50 back': '50 Back',
  '100 back': '100 Back',
  '200 back': '200 Back',
  '50 breast': '50 Breast',
  '100 breast': '100 Breast',
  '200 breast': '200 Breast',
  '50 fly': '50 Fly',
  '100 fly': '100 Fly',
  '200 fly': '200 Fly',
  '100 IM': '100 IM',
  '200 IM': '200 IM',
  '400 IM': '400 IM'
};

// Age group order for sorting
const AGE_GROUP_ORDER = [
  '8 & Under',
  '9-10',
  '11-12',
  '13-14',
  '15-18',
  '15 & Over',
  'Open'
];

/**
 * Get the age group for a swimmer based on their age
 */
const getAgeGroup = (age) => {
  const swimmerAge = parseInt(age) || 0;
  if (swimmerAge <= 8) return '8 & Under';
  if (swimmerAge <= 10) return '9-10';
  if (swimmerAge <= 12) return '11-12';
  if (swimmerAge <= 14) return '13-14';
  return '15 & Over';
};

/**
 * Normalize event name to match EVENT_ORDER keys
 */
const normalizeEventKey = (eventName) => {
  if (!eventName) return null;
  
  let cleaned = eventName.toLowerCase()
    .replace(/freestyle/gi, 'free')
    .replace(/backstroke/gi, 'back')
    .replace(/breaststroke/gi, 'breast')
    .replace(/butterfly/gi, 'fly')
    .replace(/individual medley/gi, 'IM')
    .trim();
  
  // Extract distance and stroke
  const match = cleaned.match(/(\d+)\s*(free|back|breast|fly|im)/i);
  if (match) {
    return `${match[1]} ${match[2].toLowerCase()}`;
  }
  return null;
};

/**
 * Transform qualifier data into grid format grouped by age/gender
 */
export const transformToGridData = (swimmers) => {
  const groups = {};
  
  swimmers.forEach(swimmer => {
    if (!swimmer.events || swimmer.events.length === 0) return;
    
    const ageGroup = getAgeGroup(swimmer.age);
    const gender = (swimmer.gender || 'M').toUpperCase() === 'F' ? 'Female' : 'Male';
    const groupKey = `${gender} ${ageGroup}`;
    
    if (!groups[groupKey]) {
      groups[groupKey] = {
        gender,
        ageGroup,
        swimmers: []
      };
    }
    
    // Build event times map for this swimmer
    const eventTimes = {};
    swimmer.events.forEach(evt => {
      const eventKey = normalizeEventKey(evt.event);
      if (eventKey) {
        eventTimes[eventKey] = evt.time;
      }
    });
    
    groups[groupKey].swimmers.push({
      name: swimmer.name,
      eventTimes
    });
  });
  
  // Sort groups by gender (Female first) then by age group
  const sortedGroups = Object.entries(groups)
    .sort(([keyA, groupA], [keyB, groupB]) => {
      // Female before Male
      if (groupA.gender !== groupB.gender) {
        return groupA.gender === 'Female' ? -1 : 1;
      }
      // Then by age group order
      const ageOrderA = AGE_GROUP_ORDER.indexOf(groupA.ageGroup);
      const ageOrderB = AGE_GROUP_ORDER.indexOf(groupB.ageGroup);
      return ageOrderA - ageOrderB;
    })
    .map(([key, group]) => ({
      ...group,
      key,
      swimmers: group.swimmers.sort((a, b) => {
        // Sort swimmers by last name
        const lastNameA = a.name.split(' ').pop().toLowerCase();
        const lastNameB = b.name.split(' ').pop().toLowerCase();
        return lastNameA.localeCompare(lastNameB);
      })
    }));
  
  return sortedGroups;
};

/**
 * Get list of events that have at least one qualifying time
 */
export const getActiveEvents = (gridData) => {
  const activeEvents = new Set();
  
  gridData.forEach(group => {
    group.swimmers.forEach(swimmer => {
      Object.keys(swimmer.eventTimes).forEach(eventKey => {
        activeEvents.add(eventKey);
      });
    });
  });
  
  // Return events in standard order, filtering to only active ones
  return EVENT_ORDER.filter(evt => activeEvents.has(evt));
};

/**
 * Generate PDF HTML content for the qualifiers grid
 */
export const generateQualifiersPDFHTML = (gridData, standardName, showQualifiersOnly) => {
  const activeEvents = getActiveEvents(gridData);
  
  if (activeEvents.length === 0) {
    return `
      <!DOCTYPE html>
      <html>
      <head><title>Qualifiers Report</title></head>
      <body style="font-family: Arial, sans-serif; padding: 40px;">
        <h1>Qualifiers Report - ${standardName}</h1>
        <p>No qualifying times found.</p>
      </body>
      </html>
    `;
  }
  
  const generateGroupTable = (group) => {
    const rows = group.swimmers.map(swimmer => {
      const cells = activeEvents.map(eventKey => {
        const time = swimmer.eventTimes[eventKey];
        return `<td style="padding: 8px 12px; border: 1px solid #e2e8f0; text-align: center; font-family: monospace; font-size: 13px;">
          ${time || ''}
        </td>`;
      }).join('');
      
      return `
        <tr>
          <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: 600; white-space: nowrap;">
            ${swimmer.name}
          </td>
          ${cells}
        </tr>
      `;
    }).join('');
    
    const headers = activeEvents.map(eventKey => 
      `<th style="padding: 10px 8px; border: 1px solid #cbd5e1; background: #f1f5f9; font-size: 12px; font-weight: 700; text-align: center;">
        ${EVENT_DISPLAY_NAMES[eventKey] || eventKey}
      </th>`
    ).join('');
    
    return `
      <div style="margin-bottom: 32px; page-break-inside: avoid;">
        <h3 style="margin: 0 0 12px 0; padding: 10px 16px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; border-radius: 8px 8px 0 0; font-size: 16px;">
          ${group.key}
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <thead>
            <tr>
              <th style="padding: 10px 12px; border: 1px solid #cbd5e1; background: #f1f5f9; text-align: left; font-weight: 700; min-width: 150px;">
                Swimmer
              </th>
              ${headers}
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  };
  
  const groupTables = gridData.map(generateGroupTable).join('');
  const totalQualifiers = gridData.reduce((sum, g) => sum + g.swimmers.length, 0);
  const totalQualifyingTimes = gridData.reduce((sum, g) => 
    sum + g.swimmers.reduce((s, sw) => s + Object.keys(sw.eventTimes).length, 0), 0
  );
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Qualifiers Report - ${standardName}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #1e293b; 
          line-height: 1.5; 
          padding: 24px;
          max-width: 100%;
        }
        @media print {
          body { padding: 12px; }
          .no-print { display: none; }
          .page-break { page-break-before: always; }
        }
        .header {
          text-align: center;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 3px solid #3b82f6;
        }
        .header h1 {
          font-size: 28px;
          font-weight: 800;
          color: #1e293b;
          margin-bottom: 4px;
        }
        .header .subtitle {
          font-size: 18px;
          color: #3b82f6;
          font-weight: 600;
        }
        .header .date {
          font-size: 14px;
          color: #64748b;
          margin-top: 8px;
        }
        .stats {
          display: flex;
          justify-content: center;
          gap: 32px;
          margin-bottom: 24px;
          padding: 16px;
          background: #f8fafc;
          border-radius: 8px;
        }
        .stat {
          text-align: center;
        }
        .stat-value {
          font-size: 28px;
          font-weight: 800;
          color: #3b82f6;
        }
        .stat-label {
          font-size: 12px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>QUALIFIERS REPORT</h1>
        <div class="subtitle">${standardName} Standard</div>
        <div class="date">Generated ${new Date().toLocaleDateString('en-US', { 
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        })}</div>
      </div>
      
      <div class="stats">
        <div class="stat">
          <div class="stat-value">${totalQualifiers}</div>
          <div class="stat-label">Qualifiers</div>
        </div>
        <div class="stat">
          <div class="stat-value">${totalQualifyingTimes}</div>
          <div class="stat-label">Qualifying Times</div>
        </div>
        <div class="stat">
          <div class="stat-value">${gridData.length}</div>
          <div class="stat-label">Age Groups</div>
        </div>
      </div>
      
      ${groupTables}
      
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center;">
        Generated by StormTracker • ${new Date().toLocaleString()}
      </div>
    </body>
    </html>
  `;
};

/**
 * Export qualifiers data to PDF (opens print dialog)
 */
export const exportQualifiersPDF = (swimmers, standardName, showQualifiersOnly) => {
  const filteredSwimmers = showQualifiersOnly 
    ? swimmers.filter(s => s.isQualified)
    : swimmers;
  
  const gridData = transformToGridData(filteredSwimmers);
  const html = generateQualifiersPDFHTML(gridData, standardName, showQualifiersOnly);
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(html);
  printWindow.document.close();
  
  // Wait for content to load then trigger print
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
};

/**
 * Export qualifiers data to Excel
 */
export const exportQualifiersExcel = (swimmers, standardName, showQualifiersOnly) => {
  const filteredSwimmers = showQualifiersOnly 
    ? swimmers.filter(s => s.isQualified)
    : swimmers;
  
  const gridData = transformToGridData(filteredSwimmers);
  const activeEvents = getActiveEvents(gridData);
  
  if (activeEvents.length === 0) {
    alert('No qualifying times to export.');
    return;
  }
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Build worksheet data
  const wsData = [];
  
  // Title row
  wsData.push([`Qualifiers Report - ${standardName} Standard`]);
  wsData.push([`Generated: ${new Date().toLocaleString()}`]);
  wsData.push([]); // Empty row
  
  gridData.forEach((group, groupIndex) => {
    if (groupIndex > 0) {
      wsData.push([]); // Empty row between groups
    }
    
    // Group header
    wsData.push([group.key]);
    
    // Column headers
    const headerRow = ['Swimmer', ...activeEvents.map(e => EVENT_DISPLAY_NAMES[e] || e)];
    wsData.push(headerRow);
    
    // Swimmer rows
    group.swimmers.forEach(swimmer => {
      const row = [swimmer.name];
      activeEvents.forEach(eventKey => {
        row.push(swimmer.eventTimes[eventKey] || '');
      });
      wsData.push(row);
    });
  });
  
  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Set column widths
  const colWidths = [{ wch: 25 }]; // Swimmer name column
  activeEvents.forEach(() => colWidths.push({ wch: 10 })); // Event columns
  ws['!cols'] = colWidths;
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Qualifiers');
  
  // Generate filename
  const fileName = `Qualifiers_${standardName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
  
  // Download
  XLSX.writeFile(wb, fileName);
};

/**
 * QualifiersExportButtons Component - Add to QualifiersReport UI
 */
export const QualifiersExportButtons = ({ rows, selectedStandard, showQualifiersOnly }) => {
  const handlePDFExport = () => {
    exportQualifiersPDF(rows, selectedStandard, showQualifiersOnly);
  };
  
  const handleExcelExport = () => {
    exportQualifiersExcel(rows, selectedStandard, showQualifiersOnly);
  };
  
  const hasData = rows.some(r => r.isQualified);
  
  if (!hasData) return null;
  
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handlePDFExport}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm transition-colors"
        title="Export as PDF"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        PDF
      </button>
      <button
        onClick={handleExcelExport}
        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm transition-colors"
        title="Export as Excel"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
        Excel
      </button>
    </div>
  );
};

export default {
  exportQualifiersPDF,
  exportQualifiersExcel,
  QualifiersExportButtons,
  transformToGridData,
  getActiveEvents
};
