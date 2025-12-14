// GENERIC JSON to HTML - HTML AS-IS AT BOTTOM
// MakeCode Module for converting any JSON structure to styled HTML

// Input: json (any structure), language (hebrew/english)

// טיפול בקלט - תמיכה במערכים ובאובייקטים
let rawInput = input.json || input;

// אם הקלט הוא מערך עם איבר אחד, קח את האיבר הראשון
if (Array.isArray(rawInput) && rawInput.length === 1) {
  rawInput = rawInput[0];
}

// אם יש שדה TEMPLATE, קח אותו
const inputData = rawInput.TEMPLATE || rawInput;
const language = input.language || 'hebrew';

const langConfig = {
  'hebrew': { code: 'he', dir: 'rtl' },
  'english': { code: 'en', dir: 'ltr' }
};
const config = langConfig[language.toLowerCase()] || { code: 'he', dir: 'rtl' };

// צבעים לפי רמת עומק
const colors = ['#2C3E50', '#3498DB', '#16A085', '#8E44AD', '#E67E22'];

function getColor(level) {
  return colors[Math.min(level, colors.length - 1)];
}

// מערך לאיסוף HTML
const htmlFields = [];

// בדיקה אם זה HTML
function isHTML(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.startsWith('<') && trimmed.includes('>') && trimmed.length > 100;
}

// בדיקה אם בלוק "קצר" (עד 3 שדות פשוטים)
function isCompactBlock(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  if (entries.length === 0 || entries.length > 3) return false;
  return entries.every(([k, v]) => typeof v !== 'object' || v === null);
}

// רקורסיה - מציג כל ערך
function renderValue(value, level = 0, fieldName = '') {
  if (value === null || value === undefined) {
    return '<span style="color:#999;font-style:italic;">ריק</span>';
  }

  if (typeof value === 'boolean') {
    return `<span style="color:${value ? '#27AE60' : '#E74C3C'};font-weight:bold;">${value ? '✓' : '✗'}</span>`;
  }

  // אם זה HTML - שמור בצד ואל תציג כאן
  if (typeof value === 'string' && isHTML(value)) {
    htmlFields.push({ name: fieldName, content: value });
    return `<span style="color:#E67E22;font-weight:bold;">⚠ HTML מקורי - ראה בסוף הדף</span>`;
  }

  if (typeof value !== 'object') {
    return `<span>${String(value)}</span>`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '<span style="color:#999;font-style:italic;">[]</span>';

    // מערך של ערכים פשוטים
    if (value.every(v => typeof v !== 'object')) {
      return value.map(v => `<div class="arr-item">• ${renderValue(v, level)}</div>`).join('');
    }

    // מערך של אובייקטים - טבלה מצומצמת
    if (value.every(v => typeof v === 'object' && !Array.isArray(v) && v !== null)) {
      const keys = [...new Set(value.flatMap(obj => Object.keys(obj)))];
      let html = '<table><thead><tr><th>#</th>';
      keys.forEach(k => html += `<th>${k}</th>`);
      html += '</tr></thead><tbody>';

      value.forEach((item, idx) => {
        html += `<tr><td><b>${idx + 1}</b></td>`;
        keys.forEach(k => html += `<td>${renderValue(item[k], level + 1, k)}</td>`);
        html += '</tr>';
      });

      html += '</tbody></table>';
      return html;
    }

    // מערך מעורב
    return value.map((v, i) => `<div class="sub-block"><b>[${i}]</b> ${renderValue(v, level + 1)}</div>`).join('');
  }

  // אובייקט רגיל - הפוך את הסדר!
  const entries = Object.entries(value).reverse();
  if (entries.length === 0) return '<span style="color:#999;font-style:italic;">{}</span>';

  // הפרדה: בלוקים קצרים vs מלאים
  const compactBlocks = [];
  const fullBlocks = [];

  entries.forEach(([key, val]) => {
    const isComplex = typeof val === 'object' && val !== null;

    if (isComplex && isCompactBlock(val)) {
      compactBlocks.push([key, val]);
    } else if (isComplex) {
      fullBlocks.push([key, val]);
    } else {
      compactBlocks.push([key, val]);
    }
  });

  let html = '';

  // בלוקים קצרים - grid
  if (compactBlocks.length > 0) {
    const gridClass = compactBlocks.length >= 3 ? 'grid-3' : compactBlocks.length === 2 ? 'grid-2' : 'grid-1';
    html += `<div class="${gridClass}">`;

    compactBlocks.forEach(([key, val]) => {
      const isObj = typeof val === 'object' && val !== null && !Array.isArray(val);

      if (isObj) {
        html += `<div class="card">
          <div class="card-title" style="background:${getColor(level + 1)};">${key}</div>
          <div class="card-body">`;
        Object.entries(val).forEach(([k, v]) => {
          html += `<div class="mini-field"><b>${k}:</b> ${renderValue(v, level + 2, k)}</div>`;
        });
        html += `</div></div>`;
      } else {
        html += `<div class="card">
          <div class="card-body single">
            <b>${key}:</b> ${renderValue(val, level + 1, key)}
          </div>
        </div>`;
      }
    });

    html += `</div>`;
  }

  // בלוקים מלאים
  fullBlocks.forEach(([key, val]) => {
    html += `<div class="block">
      <div class="block-title" style="background:${getColor(level + 1)};">${key}</div>
      <div class="block-body">${renderValue(val, level + 1, key)}</div>
    </div>`;
  });

  return html;
}

// בניית תוכן ראשי
const mainContent = renderValue(inputData);

// בניית חלק HTML בסוף
let htmlSection = '';
if (htmlFields.length > 0) {
  htmlSection = '<hr style="margin: 20px 0; border: 2px solid #E67E22;">';
  htmlFields.forEach((field, idx) => {
    htmlSection += `
      <div style="margin-bottom: 30px;">
        <h3 style="background: #E67E22; color: white; padding: 8px; margin-bottom: 0;">
          ${field.name || `HTML #${idx + 1}`}
        </h3>
        ${field.content}
      </div>`;
  });
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
      font-family: 'Segoe UI', Arial, sans-serif;
      direction: ${config.dir};
      padding: 10px;
      background: #ecf0f1;
      font-size: 10px;
      line-height: 1.3;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
      background: white;
      padding: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    /* Grid layouts */
    .grid-1 { display: grid; grid-template-columns: 1fr; gap: 6px; margin-bottom: 6px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px; }
    .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 6px; margin-bottom: 6px; }

    /* Cards - בלוקים קטנים */
    .card {
      border: 1px solid #ddd;
      border-radius: 3px;
      overflow: hidden;
      background: #fafafa;
    }
    .card-title {
      padding: 4px 8px;
      color: white;
      font-weight: bold;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .card-body {
      padding: 6px 8px;
      background: white;
    }
    .card-body.single {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .mini-field {
      padding: 2px 0;
      font-size: 9px;
    }
    .mini-field b {
      color: #34495e;
      margin-${config.dir === 'rtl' ? 'left' : 'right'}: 4px;
    }

    /* Blocks - בלוקים גדולים */
    .block {
      margin-bottom: 8px;
      border: 1px solid #ddd;
      border-radius: 3px;
      overflow: hidden;
    }
    .block-title {
      padding: 5px 10px;
      color: white;
      font-weight: bold;
      font-size: 10px;
    }
    .block-body {
      padding: 8px 10px;
      background: #fafafa;
    }

    .sub-block {
      margin: 4px 0;
      padding: 4px 6px;
      background: white;
      border-${config.dir === 'rtl' ? 'right' : 'left'}: 2px solid #3498DB;
      font-size: 9px;
    }

    .arr-item {
      padding: 1px 0;
      padding-${config.dir === 'rtl' ? 'right' : 'left'}: 10px;
      font-size: 9px;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
      font-size: 8px;
    }
    th {
      background: #34495e;
      color: white;
      padding: 4px 3px;
      border: 1px solid #2c3e50;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    td {
      padding: 3px;
      border: 1px solid #ddd;
      background: white;
      text-align: center;
    }
    tr:nth-child(even) td { background: #f8f9fa; }

    @media print {
      body { padding: 5px; font-size: 9px; }
      .container { box-shadow: none; padding: 8px; }
      .grid-3 { grid-template-columns: repeat(3, 1fr); }
    }
  </style>
</head>
<body>
  <div class="container">
    ${mainContent}
    ${htmlSection}
  </div>
</body>
</html>`;

// Make.com - החזר ישירות את ה-HTML
return html;
