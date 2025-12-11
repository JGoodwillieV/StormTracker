// src/reportPDFGenerators.js
// PDF HTML generators for each report section

// Helper to abbreviate event names for PDF
const abbreviateEvent = (event) => {
  if (!event) return '';
  return event
    .replace('Freestyle', 'Free')
    .replace('Backstroke', 'Back')
    .replace('Breaststroke', 'Breast')
    .replace('Butterfly', 'Fly');
};

// Section: Overview Stats
export const generateOverviewStatsHTML = (data) => `
  <div class="stats-grid">
    <div class="stat-card">
      <div class="label">Total Swims</div>
      <div class="value">${data.totalSwims}</div>
    </div>
    <div class="stat-card">
      <div class="label">Best Times</div>
      <div class="value">${data.bestTimeCount}</div>
      <div class="sub">${data.btPercent}% of swims</div>
    </div>
    <div class="stat-card">
      <div class="label">First Times</div>
      <div class="value">${data.firstTimeCount}</div>
    </div>
    <div class="stat-card">
      <div class="label">New Standards</div>
      <div class="value">${data.newStandards?.length || 0}</div>
    </div>
  </div>
`;

// Section: BT Percentage Hero
export const generateBTPercentageHTML = (data) => `
  <div class="hero">
    <div>
      <div style="font-size:12px;opacity:0.9;text-transform:uppercase">Team Best Time Rate</div>
      <div class="big-number">${data.btPercent}%</div>
      <div style="opacity:0.9">${data.bestTimeCount} out of ${data.totalSwims} swims</div>
    </div>
  </div>
`;

// Section: Time Drops
export const generateTimeDropsHTML = (data, config) => {
  const limit = config?.limit || 5;
  const drops = data.topTimeDrops?.slice(0, limit) || [];
  
  if (drops.length === 0) return '';
  
  return `
  <div class="section">
    <div class="section-header">🔥 Biggest Time Drops</div>
    <div class="section-content">
      ${drops.map((drop, idx) => `
        <div class="item">
          <div>
            <span class="rank ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : ''}">${idx + 1}</span>
            <span class="name">${drop.swimmer.name}</span>
            <span class="event">- ${drop.event}</span>
          </div>
          <span class="drop">-${drop.drop.toFixed(2)}s</span>
        </div>
        <div class="details">${drop.oldTime} → ${drop.newTime}</div>
      `).join('')}
    </div>
  </div>
  `;
};

// Section: Percent Drops
export const generatePercentDropsHTML = (data, config) => {
  const limit = config?.limit || 5;
  const drops = data.topPercentDrops?.slice(0, limit) || [];
  
  if (drops.length === 0) return '';
  
  return `
  <div class="section">
    <div class="section-header">📊 Biggest Percentage Drops</div>
    <div class="section-content">
      ${drops.map((drop, idx) => `
        <div class="item">
          <div>
            <span class="rank ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : ''}">${idx + 1}</span>
            <span class="name">${drop.swimmer.name}</span>
            <span class="event">- ${drop.event}</span>
          </div>
          <span class="drop">${drop.dropPercent.toFixed(1)}%</span>
        </div>
      `).join('')}
    </div>
  </div>
  `;
};

// Section: New Standards
export const generateNewStandardsHTML = (data, config) => {
  const groupByLevel = config?.groupByLevel ?? true;
  const showTimes = config?.showTimes ?? true;
  
  if (!data.newStandards || data.newStandards.length === 0) return '';
  
  if (groupByLevel) {
    return `
    <div class="section">
      <div class="section-header">🏆 New Time Standards Achieved</div>
      <div class="section-content">
        ${['AAAA', 'AAA', 'AA', 'A', 'BB', 'B'].filter(level => data.standardsByLevel?.[level]?.length > 0).map(level => `
          <div class="standard-group">
            <div style="margin-bottom:8px">
              <span class="badge badge-${level}">${level}</span>
              <span style="color:#64748b;font-size:14px">${data.standardsByLevel[level].length} achieved</span>
            </div>
            ${data.standardsByLevel[level].map(ns => `
              <div class="standard-item">
                <div>
                  <strong>${ns.swimmer.name}</strong>
                  <span style="color:#64748b">- ${ns.event}</span>
                </div>
                ${showTimes ? `<span style="font-family:monospace">${ns.time}</span>` : ''}
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
    </div>
    `;
  } else {
    return `
    <div class="section">
      <div class="section-header">🏆 New Time Standards Achieved</div>
      <div class="section-content">
        ${data.newStandards.map(ns => {
          const level = ns.standard.split(' ').pop();
          return `
            <div class="standard-item">
              <div>
                <strong>${ns.swimmer.name}</strong>
                <span style="color:#64748b">- ${ns.event}</span>
                <span class="badge badge-${level}">${level}</span>
              </div>
              ${showTimes ? `<span style="font-family:monospace">${ns.time}</span>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>
    `;
  }
};

// Section: Meet Cuts
export const generateMeetCutsHTML = (data, config) => {
  const groupByMeet = config?.groupByMeet ?? true;
  
  if (!data.meetCutsByMeet || Object.keys(data.meetCutsByMeet).length === 0) return '';
  
  if (groupByMeet) {
    return `
    <div class="section">
      <div class="section-header">🎯 New Meet Cuts</div>
      <div class="section-content">
        ${Object.entries(data.meetCutsByMeet).map(([meetName, cuts]) => {
          const cutsBySwimmer = {};
          cuts.forEach(cut => {
            const swimmerId = cut.swimmer.id;
            if (!cutsBySwimmer[swimmerId]) {
              cutsBySwimmer[swimmerId] = {
                name: cut.swimmer.name,
                events: []
              };
            }
            cutsBySwimmer[swimmerId].events.push(abbreviateEvent(cut.event));
          });
          
          const swimmersList = Object.values(cutsBySwimmer).sort((a, b) => a.name.localeCompare(b.name));
          
          return `
            <div style="margin-bottom: 24px;">
              <div style="font-weight: 700; font-size: 16px; margin-bottom: 12px; text-decoration: underline;">
                ${meetName}
              </div>
              ${swimmersList.map(s => `
                <div class="standard-item">
                  <strong>${s.name}:</strong> ${s.events.join(' ')}
                </div>
              `).join('')}
            </div>
          `;
        }).join('')}
      </div>
    </div>
    `;
  } else {
    return `
    <div class="section">
      <div class="section-header">🎯 New Meet Cuts</div>
      <div class="section-content">
        ${data.newMeetCuts.map(cut => `
          <div class="standard-item">
            <div>
              <strong>${cut.swimmer.name}</strong>
              <span style="color:#64748b">- ${cut.event}</span>
              <span style="color:#3b82f6;font-size:12px">(${cut.meetName})</span>
            </div>
            <span style="font-family:monospace;color:#3b82f6">${cut.time}</span>
          </div>
        `).join('')}
      </div>
    </div>
    `;
  }
};

// Section: Stroke Performance
export const generateStrokePerformanceHTML = (data, config) => {
  const showTable = config?.showTable ?? true;
  
  if (!data.strokeStats || Object.keys(data.strokeStats).length === 0) return '';
  
  return `
  <div class="section">
    <div class="section-header">🏊 Performance by Stroke</div>
    <div class="section-content">
      ${showTable ? `
        <table>
          <thead>
            <tr>
              <th>Stroke</th>
              <th>Swims</th>
              <th>Best Time %</th>
              <th>Avg Drop</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(data.strokeStats).map(([stroke, stats]) => `
              <tr>
                <td><strong>${stroke}</strong></td>
                <td>${stats.swims}</td>
                <td>${stats.btPercent}%</td>
                <td>${stats.avgDrop > 0 ? '-' + stats.avgDrop.toFixed(2) + 's' : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}
    </div>
  </div>
  `;
};

// Section: Group Performance
export const generateGroupPerformanceHTML = (data, config) => {
  if (!data.groupStats || data.groupStats.length === 0) return '';
  
  return `
  <div class="section">
    <div class="section-header">👥 Performance by Group</div>
    <div class="section-content">
      <table>
        <thead>
          <tr>
            <th>Group</th>
            <th>Swimmers</th>
            <th>Swims</th>
            <th>Best Time %</th>
          </tr>
        </thead>
        <tbody>
          ${data.groupStats.map(group => `
            <tr>
              <td><strong>${group.name}</strong></td>
              <td>${group.swimmerCount}</td>
              <td>${group.swims}</td>
              <td>${group.btPercent}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
  `;
};

// Section: Biggest Movers
export const generateBiggestMoversHTML = (data, config) => {
  const limit = config?.limit || 10;
  const movers = data.biggestMovers?.slice(0, limit) || [];
  
  if (movers.length === 0) return '';
  
  return `
  <div class="section">
    <div class="section-header">🔥 Biggest Movers (Total Time Dropped)</div>
    <div class="section-content">
      ${movers.map((mover, idx) => `
        <div class="item">
          <div>
            <span class="rank ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : ''}">${idx + 1}</span>
            <span class="name">${mover.swimmer.name}</span>
          </div>
          <span class="drop">-${mover.totalDrop.toFixed(2)}s</span>
        </div>
        <div class="details">${mover.bestTimes} BT • Best: ${mover.biggestDropEvent} (-${mover.biggestDrop.toFixed(2)}s)</div>
      `).join('')}
    </div>
  </div>
  `;
};

// Mapping of section IDs to HTML generators
export const SECTION_HTML_GENERATORS = {
  'overview-stats': generateOverviewStatsHTML,
  'bt-percentage': generateBTPercentageHTML,
  'time-drops': generateTimeDropsHTML,
  'percent-drops': generatePercentDropsHTML,
  'new-standards': generateNewStandardsHTML,
  'meet-cuts': generateMeetCutsHTML,
  'stroke-performance': generateStrokePerformanceHTML,
  'group-performance': generateGroupPerformanceHTML,
  'biggest-movers': generateBiggestMoversHTML,
};

