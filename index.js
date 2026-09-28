const express = require('express');
const fs = require('fs');
const csv = require('csv-parser');
const app = express();

let data = [];

fs.createReadStream('./404k-Telenor.csv')
  .pipe(csv())
  .on('data', (row) => data.push(row))
  .on('end', () => console.log(`✅ ${data.length} rows loaded`))
  .on('error', (err) => console.log('❌ Error:', err.message));

// ---------- HTML PAGE ----------
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Telenor Data Search</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #0f172a;
    color: #e2e8f0;
    padding: 20px;
    min-height: 100vh;
  }
  .container { max-width: 900px; margin: 0 auto; }
  h1 { font-size: 22px; margin-bottom: 20px; color: #38bdf8; }
  .search-box {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }
  input, select {
    padding: 12px;
    border-radius: 8px;
    border: 1px solid #334155;
    background: #1e293b;
    color: #e2e8f0;
    font-size: 15px;
    outline: none;
  }
  input { flex: 1; min-width: 200px; }
  select { min-width: 120px; }
  input:focus, select:focus { border-color: #38bdf8; }
  button {
    padding: 12px 20px;
    border-radius: 8px;
    border: none;
    background: #38bdf8;
    color: #0f172a;
    font-weight: 600;
    font-size: 15px;
    cursor: pointer;
  }
  button:active { background: #0ea5e9; }
  .status {
    font-size: 13px;
    color: #94a3b8;
    margin-bottom: 15px;
  }
  .status b { color: #38bdf8; }
  .result-card {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 10px;
    padding: 15px;
    margin-bottom: 10px;
  }
  .result-card .name {
    font-size: 17px;
    font-weight: 600;
    color: #38bdf8;
    margin-bottom: 8px;
  }
  .result-card .row {
    font-size: 13px;
    color: #cbd5e1;
    margin: 3px 0;
    display: flex;
    gap: 8px;
  }
  .result-card .row span:first-child {
    color: #64748b;
    min-width: 90px;
  }
  .empty { color: #64748b; text-align: center; padding: 30px; }
  .loading { color: #38bdf8; text-align: center; padding: 20px; }
</style>
</head>
<body>
<div class="container">
  <h1>🔍 Telenor Data Search</h1>

  <div class="search-box">
    <select id="field">
      <option value="all">All Fields</option>
      <option value="name">Name</option>
      <option value="number">Number</option>
      <option value="email">Email</option>
      <option value="city">City</option>
    </select>
    <input id="query" type="text" placeholder="Search karo..." autofocus>
    <button onclick="doSearch()">Search</button>
  </div>

  <div class="status" id="status">Total records: <b>...</b></div>
  <div id="results"></div>
</div>

<script>
  // Total load karo
  fetch('/api/status').then(r => r.json()).then(d => {
    document.getElementById('status').innerHTML = 
      'Total records: <b>' + d.total.toLocaleString() + '</b>';
  });

  document.getElementById('query').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch();
  });

  function doSearch() {
    const field = document.getElementById('field').value;
    const q = document.getElementById('query').value.trim();
    if (!q) return;

    const results = document.getElementById('results');
    results.innerHTML = '<div class="loading">Searching...</div>';

    let url = '/api/search?q=' + encodeURIComponent(q);
    if (field === 'name')   url = '/api/search/name?q=' + encodeURIComponent(q);
    if (field === 'number') url = '/api/search/number?q=' + encodeURIComponent(q);
    if (field === 'email')  url = '/api/search/email?q=' + encodeURIComponent(q);
    if (field === 'city')   url = '/api/search/city?q=' + encodeURIComponent(q);

    fetch(url)
      .then(r => r.json())
      .then(d => {
        if (!d.results || d.results.length === 0) {
          results.innerHTML = '<div class="empty">Kuch nahi mila bhai 😕</div>';
          return;
        }
        let html = '<div class="status">Found: <b>' + d.count + '</b> results</div>';
        d.results.forEach(row => {
          html += '<div class="result-card">';
          html += '<div class="name">' + (row.Name || 'Unknown') + '</div>';
          html += '<div class="row"><span>Number:</span><span>' + (row.Number || '-') + '</span></div>';
          html += '<div class="row"><span>Carrier:</span><span>' + (row.Carrier || '-') + '</span></div>';
          html += '<div class="row"><span>Gender:</span><span>' + (row.Gender || '-') + '</span></div>';
          html += '<div class="row"><span>Address:</span><span>' + (row.Address || '-') + '</span></div>';
          html += '<div class="row"><span>Job:</span><span>' + (row.JobTitle || '-') + '</span></div>';
          html += '<div class="row"><span>Company:</span><span>' + (row.CompanyName || '-') + '</span></div>';
          html += '<div class="row"><span>Email:</span><span>' + (row.Email || '-') + '</span></div>';
          html += '</div>';
        });
        results.innerHTML = html;
      })
      .catch(err => {
        results.innerHTML = '<div class="empty">Error: ' + err.message + '</div>';
      });
  }
</script>
</body>
</html>
  `);
});

// ---------- API ROUTES ----------
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', total: data.length });
});

app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  if (!q) return res.json({ count: 0, results: [] });
  const results = data.filter(row =>
    Object.values(row).some(v => String(v).toLowerCase().includes(q))
  ).slice(0, 200);
  res.json({ query: q, count: results.length, results });
});

app.get('/api/search/name', (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  if (!q) return res.json({ count: 0, results: [] });
  const results = data.filter(row =>
    String(row.Name || '').toLowerCase().includes(q)
  ).slice(0, 200);
  res.json({ query: q, count: results.length, results });
});

app.get('/api/search/number', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ count: 0, results: [] });
  const query = q.replace(/\D/g, '');
  const results = data.filter(row => {
    const num = String(row.Number || '').replace(/\D/g, '');
    return num.includes(query);
  }).slice(0, 200);
  res.json({ query: q, count: results.length, results });
});

app.get('/api/search/email', (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  if (!q) return res.json({ count: 0, results: [] });
  const results = data.filter(row =>
    String(row.Email || '').toLowerCase().includes(q)
  ).slice(0, 200);
  res.json({ query: q, count: results.length, results });
});

app.get('/api/search/city', (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  if (!q) return res.json({ count: 0, results: [] });
  const results = data.filter(row =>
    String(row.Address || '').toLowerCase().includes(q)
  ).slice(0, 200);
  res.json({ query: q, count: results.length, results });
});

app.listen(3000, () => console.log('🚀 http://localhost:3000'));