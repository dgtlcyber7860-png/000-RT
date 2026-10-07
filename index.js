const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());

// ============ 1 SE 5 TAK CHUNKS LOAD KARO ============
console.log('⏳ Loading data...');

let data = [];
const CHUNKS = [
  'data_part1.json',
  'data_part2.json',
  'data_part3.json',
  'data_part4.json',
  'data_part5.json'
];

CHUNKS.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    const chunk = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    chunk.forEach(item => data.push(item));
    console.log('✅ ' + file + ' → ' + chunk.length + ' records');
  } else {
    console.log('❌ ' + file + ' not found');
  }
});

console.log('📊 Total records:', data.length);
console.log('📋 Columns:', Object.keys(data[0]).join(', '));

// ============ INDEXES BANAO ============
console.log('⏳ Building indexes...');

const indexByNumber = {};
const indexByName = {};

data.forEach((row, i) => {
  if (row.Number) {
    indexByNumber[String(row.Number).trim()] = i;
  }
  if (row.Name) {
    const k = String(row.Name).toLowerCase().trim();
    if (!indexByName[k]) indexByName[k] = [];
    indexByName[k].push(i);
  }
});

console.log('✅ Numbers:', Object.keys(indexByNumber).length);
console.log('✅ Names:', Object.keys(indexByName).length);

// ============ SEARCH FUNCTIONS ============

function searchByNumber(q) {
  const digits = String(q).replace(/\D/g, '');
  if (digits.length < 3) return [];

  const results = [];
  const seen = new Set();

  if (indexByNumber[digits] !== undefined) {
    const i = indexByNumber[digits];
    results.push(data[i]);
    seen.add(i);
  }

  if (digits.length === 10) {
    const with91 = '91' + digits;
    if (indexByNumber[with91] !== undefined && !seen.has(indexByNumber[with91])) {
      const i = indexByNumber[with91];
      results.push(data[i]);
      seen.add(i);
    }
  }

  if (digits.length >= 10 && results.length === 0) {
    const last10 = digits.slice(-10);
    for (const num in indexByNumber) {
      if (num.endsWith(last10) && !seen.has(indexByNumber[num])) {
        results.push(data[indexByNumber[num]]);
        seen.add(indexByNumber[num]);
        if (results.length >= 20) break;
      }
    }
  }

  if (results.length === 0) {
    for (const num in indexByNumber) {
      if (num.includes(digits) && !seen.has(indexByNumber[num])) {
        results.push(data[indexByNumber[num]]);
        seen.add(indexByNumber[num]);
        if (results.length >= 20) break;
      }
    }
  }

  return results;
}

function searchByName(q) {
  const key = q.toLowerCase().trim();
  if (key.length < 2) return [];

  const words = key.split(/\s+/).filter(w => w.length > 0);
  const results = [];
  const seen = new Set();

  if (indexByName[key]) {
    indexByName[key].forEach(i => {
      if (!seen.has(i)) { seen.add(i); results.push(data[i]); }
    });
  }

  for (const name in indexByName) {
    if (results.length >= 30) break;
    if (words.every(w => name.includes(w))) {
      indexByName[name].forEach(i => {
        if (!seen.has(i) && results.length < 30) {
          seen.add(i);
          results.push(data[i]);
        }
      });
    }
  }

  if (results.length === 0) {
    for (const name in indexByName) {
      if (results.length >= 30) break;
      if (words.some(w => name.includes(w))) {
        indexByName[name].forEach(i => {
          if (!seen.has(i) && results.length < 30) {
            seen.add(i);
            results.push(data[i]);
          }
        });
      }
    }
  }

  return results;
}

// ============ ROUTES ============

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    total: data.length,
    columns: Object.keys(data[0]),
    usage: {
      search: '/search?q=TERA_NUMBER_YA_NAAM',
      number: '/number/TERA_NUMBER',
      name: '/name/TERA_NAAM',
      filter: '/filter/COLUMN/VALUE'
    }
  });
});

app.get('/search', (req, res) => {
  const q = (req.query.q || '').trim();

  if (!q) {
    return res.json({ error: 'q do. Example: /search?q=9060000064' });
  }

  const digits = q.replace(/\D/g, '');
  const isNumber = digits.length >= 6 && digits.length / q.length > 0.7;

  const results = isNumber ? searchByNumber(q) : searchByName(q);

  if (results.length === 0) {
    return res.json({
      query: q,
      found: false,
      count: 0,
      message: 'Ye data me nahi hai'
    });
  }

  res.json({
    query: q,
    type: isNumber ? 'number' : 'name',
    found: true,
    count: results.length,
    data: results
  });
});

app.get('/number/:num', (req, res) => {
  const results = searchByNumber(req.params.num);
  res.json({ query: req.params.num, count: results.length, data: results });
});

app.get('/name/:name', (req, res) => {
  const results = searchByName(req.params.name);
  res.json({ query: req.params.name, count: results.length, data: results });
});

app.get('/filter/:field/:value', (req, res) => {
  const field = req.params.field;
  const value = req.params.value.toLowerCase().trim();

  if (!(field in data[0])) {
    return res.json({ error: 'Column nahi mila', available: Object.keys(data[0]) });
  }

  const results = data.filter(row =>
    String(row[field] || '').toLowerCase().includes(value)
  ).slice(0, 50);

  res.json({ field, value: req.params.value, count: results.length, data: results });
});

app.get('/health', (req, res) => {
  const m = process.memoryUsage();
  res.json({
    rss_mb: Math.round(m.rss / 1024 / 1024),
    heap_mb: Math.round(m.heapUsed / 1024 / 1024),
    records: data.length
  });
});

// ============ LISTEN — SIRF EK BAAR ============

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Server running on port ' + PORT);
});
