// GENERIC JSON to HTML - HTML AS-IS AT BOTTOM
// MakeCode Module for converting any JSON structure to styled HTML
// Version: 2.1.0 | Date: 2025-12-14

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

// פלטת צבעים מקצועית
const colors = {
  primary: '#1a56db',
  secondary: '#6366f1',
  success: '#059669',
  warning: '#d97706',
  danger: '#dc2626',
  dark: '#1f2937',
  gray: '#6b7280',
  light: '#f3f4f6',
  white: '#ffffff',
  border: '#e5e7eb'
};

// צבעי כותרות לפי רמה
const headerColors = ['#1e40af', '#7c3aed', '#0891b2', '#059669', '#d97706'];

function getHeaderColor(level) {
  return headerColors[Math.min(level, headerColors.length - 1)];
}

// מערך לאיסוף HTML
const htmlFields = [];

// בדיקה אם זה HTML
function isHTML(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.startsWith('<') && trimmed.includes('>') && trimmed.length > 100;
}

// בדיקה אם בלוק "קצר" (עד 4 שדות פשוטים)
function isCompactBlock(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  if (entries.length === 0 || entries.length > 4) return false;
  return entries.every(([k, v]) => typeof v !== 'object' || v === null);
}

// פורמט שם שדה יפה
function formatFieldName(name) {
  return name
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim();
}

// רקורסיה - מציג כל ערך
function renderValue(value, level = 0, fieldName = '') {
  if (value === null || value === undefined) {
    return '<span class="empty-value">ריק</span>';
  }

  if (typeof value === 'boolean') {
    return value
      ? '<span class="bool-true">✓ כן</span>'
      : '<span class="bool-false">✗ לא</span>';
  }

  // אם זה HTML - שמור בצד ואל תציג כאן
  if (typeof value === 'string' && isHTML(value)) {
    htmlFields.push({ name: fieldName, content: value });
    return '<span class="html-ref">📄 תוכן HTML - ראה בסוף המסמך</span>';
  }

  if (typeof value !== 'object') {
    const strVal = String(value);
    // אם יש ירידות שורה, הצג כבלוק
    if (strVal.includes('\n')) {
      return `<div class="text-block">${strVal.replace(/\n/g, '<br>')}</div>`;
    }
    return `<span class="value">${strVal}</span>`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '<span class="empty-value">רשימה ריקה</span>';

    // מערך של ערכים פשוטים
    if (value.every(v => typeof v !== 'object')) {
      return `<ul class="simple-list">${value.map(v => `<li>${renderValue(v, level)}</li>`).join('')}</ul>`;
    }

    // מערך של אובייקטים - טבלה
    if (value.every(v => typeof v === 'object' && !Array.isArray(v) && v !== null)) {
      const keys = [...new Set(value.flatMap(obj => Object.keys(obj)))];
      let html = '<div class="table-wrapper"><table><thead><tr>';
      keys.forEach(k => html += `<th>${formatFieldName(k)}</th>`);
      html += '</tr></thead><tbody>';

      value.forEach((item, idx) => {
        html += '<tr>';
        keys.forEach(k => html += `<td>${renderValue(item[k], level + 1, k)}</td>`);
        html += '</tr>';
      });

      html += '</tbody></table></div>';
      return html;
    }

    // מערך מעורב
    return value.map((v, i) =>
      `<div class="array-item">
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

  // שדות פשוטים בטבלת מידע
  if (simpleFields.length > 0) {
    html += '<div class="info-grid">';
    simpleFields.forEach(([key, val]) => {
      html += `
        <div class="info-item">
          <div class="info-label">${formatFieldName(key)}</div>
          <div class="info-value">${renderValue(val, level + 1, key)}</div>
        </div>`;
    });
    html += '</div>';
  }

  // שדות מורכבים - עם אפשרות הרחבה/סגירה
  complexFields.forEach(([key, val]) => {
    const isSmall = isCompactBlock(val);
    const sectionId = `section_${Math.random().toString(36).substr(2, 9)}`;
    html += `
      <div class="section ${isSmall ? 'section-compact' : ''}">
        <div class="section-header" style="background: ${getHeaderColor(level + 1)}" onclick="toggleSection('${sectionId}')">
          <span class="toggle-icon" id="icon_${sectionId}">▼</span>
          ${formatFieldName(key)}
        </div>
        <div class="section-body" id="${sectionId}">
          ${renderValue(val, level + 1, key)}
        </div>
      </div>`;
  });

  return html;
}

// בניית תוכן ראשי
const mainContent = renderValue(inputData);

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
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      direction: ${config.dir};
      padding: 20px;
      background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
      font-size: 14px;
      line-height: 1.6;
      color: #374151;
      min-height: 100vh;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      background: #ffffff;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
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
      background: #f3f4f6;
      border: 1px solid #d1d5db;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      color: #374151;
      transition: all 0.2s;
      font-family: inherit;
    }

    .toolbar-btn:hover {
      background: #e5e7eb;
      border-color: #9ca3af;
    }

    /* Info Grid - שדות פשוטים */
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
      padding: 20px;
      background: #f9fafb;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }

    .info-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .info-label {
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .info-value {
      font-size: 15px;
      color: #1f2937;
      font-weight: 500;
    }

    /* Sections - בלוקים מורכבים */
    .section {
      margin-bottom: 20px;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #e5e7eb;
      background: #ffffff;
    }

    .section-header {
      padding: 12px 20px;
      color: #ffffff;
      font-weight: 600;
      font-size: 14px;
      letter-spacing: 0.3px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      user-select: none;
      transition: opacity 0.2s;
    }

    .section-header:hover {
      opacity: 0.9;
    }

    .toggle-icon {
      font-size: 12px;
      transition: transform 0.3s ease;
    }

    .toggle-icon.collapsed {
      transform: rotate(-90deg);
    }

    .section-body.collapsed {
      display: none;
    }

    .section-body {
      padding: 20px;
      background: #ffffff;
    }

    .section-compact .section-body {
      padding: 16px;
    }

    /* Values */
    .value {
      color: #1f2937;
    }

    .empty-value {
      color: #9ca3af;
      font-style: italic;
    }

    .bool-true {
      color: #059669;
      font-weight: 600;
      background: #d1fae5;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 13px;
    }

    .bool-false {
      color: #dc2626;
      font-weight: 600;
      background: #fee2e2;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 13px;
    }

    .html-ref {
      color: #d97706;
      font-weight: 500;
      background: #fef3c7;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 13px;
    }

    .text-block {
      background: #f9fafb;
      padding: 12px;
      border-radius: 6px;
      border-${config.dir === 'rtl' ? 'right' : 'left'}: 3px solid #6366f1;
      margin: 8px 0;
      line-height: 1.7;
    }

    /* Simple List */
    .simple-list {
      list-style: none;
      padding: 0;
      margin: 8px 0;
    }

    .simple-list li {
      padding: 8px 12px;
      background: #f9fafb;
      margin-bottom: 6px;
      border-radius: 6px;
      border-${config.dir === 'rtl' ? 'right' : 'left'}: 3px solid #6366f1;
    }

    .simple-list li:last-child {
      margin-bottom: 0;
    }

    /* Array Items */
    .array-item {
      display: flex;
      gap: 12px;
      padding: 16px;
      background: #f9fafb;
      margin-bottom: 12px;
      border-radius: 8px;
      align-items: flex-start;
    }

    .array-index {
      background: #6366f1;
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 13px;
      flex-shrink: 0;
    }

    .array-content {
      flex: 1;
    }

    /* Tables */
    .table-wrapper {
      overflow-x: auto;
      margin: 12px 0;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    th {
      background: #1f2937;
      color: #ffffff;
      padding: 12px 16px;
      font-weight: 600;
      text-align: ${config.dir === 'rtl' ? 'right' : 'left'};
      white-space: nowrap;
    }

    td {
      padding: 12px 16px;
      border-bottom: 1px solid #e5e7eb;
      background: #ffffff;
      text-align: ${config.dir === 'rtl' ? 'right' : 'left'};
    }

    tr:nth-child(even) td {
      background: #f9fafb;
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:hover td {
      background: #f3f4f6;
    }

    /* HTML Section */
    .html-section {
      margin-top: 40px;
      padding-top: 30px;
      border-top: 2px solid #e5e7eb;
    }

    .html-section-title {
      font-size: 18px;
      color: #1f2937;
      margin-bottom: 20px;
      font-weight: 600;
    }

    .html-block {
      margin-bottom: 24px;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #e5e7eb;
    }

    .html-block-header {
      background: #d97706;
      color: white;
      padding: 12px 20px;
      font-weight: 600;
    }

    .html-block-content {
      padding: 20px;
      background: #fffbeb;
    }

    /* Print Styles */
    @media print {
      body {
        padding: 0;
        background: white;
      }
      .container {
        box-shadow: none;
        padding: 20px;
        max-width: 100%;
      }
    }

    /* Responsive */
    @media (max-width: 600px) {
      body { padding: 10px; }
      .container { padding: 16px; }
      .info-grid { grid-template-columns: 1fr; }
      .section-header, .section-body { padding: 12px; }
      table { font-size: 12px; }
      th, td { padding: 8px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="toolbar">
      <button onclick="expandAll()" class="toolbar-btn">▼ הרחב הכל</button>
      <button onclick="collapseAll()" class="toolbar-btn">▶ סגור הכל</button>
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
