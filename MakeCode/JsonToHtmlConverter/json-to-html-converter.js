// GENERIC JSON to HTML - HTML AS-IS AT BOTTOM
// MakeCode Module for converting any JSON structure to styled HTML
// Version: 3.3.0 | Date: 2025-12-14

// Input: json (any structure), language (hebrew/english)

// קלט גנרי - תומך במספר פורמטים של Make.com
let inputData;

// אם הקלט הוא מחרוזת JSON - פרסר אותה
if (typeof input === 'string') {
  try {
    inputData = JSON.parse(input);
  } catch (e) {
    inputData = input;
  }
} else if (input && typeof input.json === 'string') {
  try {
    inputData = JSON.parse(input.json);
  } catch (e) {
    inputData = input.json;
  }
} else {
  inputData = input.json || input;
}

const language = (input && input.language) || 'hebrew';

const langConfig = {
  'hebrew': { code: 'he', dir: 'rtl' },
  'english': { code: 'en', dir: 'ltr' }
};
const config = langConfig[language.toLowerCase()] || { code: 'he', dir: 'rtl' };

// צבעי כותרות לפי רמה
const headerColors = ['#1e40af', '#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626'];

function getHeaderColor(level) {
  return headerColors[Math.min(level, headerColors.length - 1)];
}

// מערך לאיסוף HTML
const htmlFields = [];
let sectionCounter = 0;

// בדיקה אם זה HTML
function isHTML(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.startsWith('<') && trimmed.includes('>') && trimmed.length > 100;
}

// פורמט שם שדה יפה
function formatFieldName(name) {
  return name
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim();
}

// חישוב גודל פונט לפי רמה
function getFontSize(level) {
  const sizes = [14, 13, 12, 11, 11, 10];
  return sizes[Math.min(level, sizes.length - 1)];
}

// רקורסיה - מציג כל ערך
function renderValue(value, level = 0, fieldName = '') {
  const fontSize = getFontSize(level);

  if (value === null || value === undefined) {
    return '<span class="empty-value">ריק</span>';
  }

  if (typeof value === 'boolean') {
    return value
      ? '<span class="bool-true">✓ כן</span>'
      : '<span class="bool-false">✗ לא</span>';
  }

  // אם זה HTML - שמור בצד
  if (typeof value === 'string' && isHTML(value)) {
    htmlFields.push({ name: fieldName, content: value });
    return '<span class="html-ref">📄 תוכן HTML - ראה בסוף המסמך</span>';
  }

  if (typeof value !== 'object') {
    const strVal = String(value);
    if (strVal.includes('\n')) {
      return `<div class="text-block" style="font-size:${fontSize}px">${strVal.replace(/\n/g, '<br>')}</div>`;
    }
    return `<span class="value">${strVal}</span>`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '<span class="empty-value">רשימה ריקה</span>';

    // מערך של ערכים פשוטים
    if (value.every(v => typeof v !== 'object')) {
      return `<ul class="simple-list" style="font-size:${fontSize}px">${value.map(v => `<li>${renderValue(v, level)}</li>`).join('')}</ul>`;
    }

    // מערך של אובייקטים - רשימה אנכית
    return value.map((v, i) =>
      `<div class="array-item" style="font-size:${fontSize}px">
        <span class="array-index">${i + 1}</span>
        <div class="array-content">${renderValue(v, level + 1)}</div>
      </div>`
    ).join('');
  }

  // אובייקט רגיל
  const entries = Object.entries(value);
  if (entries.length === 0) return '<span class="empty-value">אובייקט ריק</span>';

  // הפרדה: שדות פשוטים vs מורכבים
  const simpleFields = [];
  const complexFields = [];

  entries.forEach(([key, val]) => {
    const isComplex = typeof val === 'object' && val !== null;
    if (isComplex) {
      complexFields.push([key, val]);
    } else {
      simpleFields.push([key, val]);
    }
  });

  let html = '';

  // שדות פשוטים - רשימה אנכית
  if (simpleFields.length > 0) {
    html += `<div class="info-list" style="font-size:${fontSize}px">`;
    simpleFields.forEach(([key, val]) => {
      html += `
        <div class="info-row">
          <span class="info-label">${formatFieldName(key)}:</span>
          <span class="info-value">${renderValue(val, level + 1, key)}</span>
        </div>`;
    });
    html += '</div>';
  }

  // שדות מורכבים
  complexFields.forEach(([key, val]) => {
    sectionCounter++;
    const sectionId = `section_${sectionCounter}`;

    html += `
      <div class="section level-${Math.min(level, 5)}" id="${sectionId}">
        <div class="section-header" style="background:${getHeaderColor(level)};font-size:${Math.max(fontSize, 12)}px" onclick="toggleSection('${sectionId}_body')">
          <span class="toggle-icon" id="icon_${sectionId}_body">▼</span>
          ${formatFieldName(key)}
        </div>
        <div class="section-body" id="${sectionId}_body" style="font-size:${fontSize}px">
          ${renderValue(val, level + 1, key)}
        </div>
      </div>`;
  });

  return html;
}

// בניית תוכן ראשי
const mainContent = renderValue(inputData, 0, '');

// בניית חלק HTML בסוף
let htmlSection = '';
if (htmlFields.length > 0) {
  htmlSection = '<div class="html-section"><h2 class="html-section-title">תוכן HTML מקורי</h2>';
  htmlFields.forEach((field, idx) => {
    htmlSection += `
      <div class="html-block">
        <div class="html-block-header">${field.name || `תוכן #${idx + 1}`}</div>
        <div class="html-block-content">${field.content}</div>
      </div>`;
  });
  htmlSection += '</div>';
}

// בניית HTML
const html = `<!DOCTYPE html>
<html dir="${config.dir}" lang="${config.code}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      direction: ${config.dir};
      background: #f0f2f5;
      font-size: 14px;
      line-height: 1.5;
      color: #1f2937;
      padding: 20px;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      padding: 25px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    /* Toolbar */
    .toolbar {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 1px solid #e5e7eb;
    }

    .toolbar-btn {
      padding: 8px 16px;
      background: #f3f4f6;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      color: #374151;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.2s;
    }

    .toolbar-btn:hover {
      background: #e5e7eb;
    }

    /* Info List */
    .info-list {
      background: #f9fafb;
      border-radius: 6px;
      padding: 12px 15px;
      margin-bottom: 15px;
      border: 1px solid #e5e7eb;
    }

    .info-row {
      display: flex;
      padding: 6px 0;
      border-bottom: 1px solid #e5e7eb;
      flex-wrap: wrap;
      gap: 8px;
    }

    .info-row:last-child {
      border-bottom: none;
    }

    .info-label {
      font-weight: 600;
      color: #6b7280;
      min-width: 120px;
      flex-shrink: 0;
    }

    .info-value {
      color: #1f2937;
      flex: 1;
      word-break: break-word;
    }

    /* Sections */
    .section {
      margin-bottom: 15px;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid #e5e7eb;
    }

    .section-header {
      padding: 10px 15px;
      color: white;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      user-select: none;
    }

    .section-header:hover {
      opacity: 0.95;
    }

    .toggle-icon {
      font-size: 10px;
      transition: transform 0.2s;
    }

    .toggle-icon.collapsed {
      transform: rotate(-90deg);
    }

    .section-body {
      padding: 15px;
      background: white;
    }

    .section-body.collapsed {
      display: none;
    }

    .section .section {
      margin-bottom: 10px;
    }

    .section .section .section-body {
      padding: 12px;
    }

    /* Values */
    .value { color: #1f2937; }

    .empty-value {
      color: #9ca3af;
      font-style: italic;
    }

    .bool-true {
      color: #059669;
      font-weight: 600;
      background: #d1fae5;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 12px;
    }

    .bool-false {
      color: #dc2626;
      font-weight: 600;
      background: #fee2e2;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 12px;
    }

    .html-ref {
      color: #d97706;
      background: #fef3c7;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 12px;
    }

    .text-block {
      background: #f9fafb;
      padding: 10px;
      border-radius: 4px;
      border-${config.dir === 'rtl' ? 'right' : 'left'}: 3px solid #6366f1;
      margin: 5px 0;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
    }

    /* Simple List */
    .simple-list {
      list-style: none;
      padding: 0;
      margin: 5px 0;
    }

    .simple-list li {
      padding: 6px 10px;
      background: #f9fafb;
      margin-bottom: 4px;
      border-radius: 4px;
      border-${config.dir === 'rtl' ? 'right' : 'left'}: 3px solid #6366f1;
    }

    /* Array Items */
    .array-item {
      display: flex;
      gap: 10px;
      padding: 12px;
      background: #f9fafb;
      margin-bottom: 10px;
      border-radius: 6px;
      align-items: flex-start;
    }

    .array-index {
      background: #6366f1;
      color: white;
      min-width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 11px;
      flex-shrink: 0;
    }

    .array-content {
      flex: 1;
      min-width: 0;
    }

    /* HTML Section */
    .html-section {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
    }

    .html-section-title {
      font-size: 16px;
      color: #1f2937;
      margin-bottom: 15px;
      font-weight: 600;
    }

    .html-block {
      margin-bottom: 20px;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid #e5e7eb;
    }

    .html-block-header {
      background: #d97706;
      color: white;
      padding: 10px 15px;
      font-weight: 600;
      font-size: 13px;
    }

    .html-block-content {
      padding: 15px;
      background: #fffbeb;
    }

    /* Print */
    @media print {
      body { padding: 10px; background: white; }
      .container { box-shadow: none; }
      .section-body { display: block !important; }
      .toolbar { display: none; }
    }

    /* Mobile */
    @media (max-width: 600px) {
      body { padding: 10px; }
      .container { padding: 15px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="toolbar">
      <button class="toolbar-btn" onclick="expandAll()">▼ הרחב הכל</button>
      <button class="toolbar-btn" onclick="collapseAll()">▶ סגור הכל</button>
    </div>
    ${mainContent}
    ${htmlSection}
  </div>

  <script>
    function toggleSection(id) {
      const body = document.getElementById(id);
      const icon = document.getElementById('icon_' + id);
      if (body && icon) {
        body.classList.toggle('collapsed');
        icon.classList.toggle('collapsed');
      }
    }

    function expandAll() {
      document.querySelectorAll('.section-body').forEach(el => el.classList.remove('collapsed'));
      document.querySelectorAll('.toggle-icon').forEach(el => el.classList.remove('collapsed'));
    }

    function collapseAll() {
      document.querySelectorAll('.section-body').forEach(el => el.classList.add('collapsed'));
      document.querySelectorAll('.toggle-icon').forEach(el => el.classList.add('collapsed'));
    }
  </script>
</body>
</html>`;

// Make.com - החזר ישירות את ה-HTML
return html;
