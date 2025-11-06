// meta/main.js
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// ---------- Step 1.1: Read CSV with row conversion ----------
async function loadData() {
  const data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: +row.line,           // number
    depth: +row.depth,         // number
    length: +row.length,       // number (characters in the line)
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime), // precise timestamp
  }));
  return data;
}

// ---------- Step 1.2: Compute commit-level data ----------
function processCommits(data) {
  // Optional: allow commit URLs if user provides <meta name="github-repo" content="user/repo">
  const repoTag = document.querySelector('meta[name="github-repo"]');
  const repo = repoTag?.content?.trim();

  return d3.groups(data, (d) => d.commit).map(([commit, lines]) => {
    const first = lines[0];
    const { author, date, time, timezone, datetime } = first;

    const ret = {
      id: commit,
      author,
      date,
      time,
      timezone,
      datetime,
      hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
      totalLines: lines.length,
      url: repo ? `https://github.com/${repo}/commit/${commit}` : null,
    };

    // Hide the heavy lines array from console enumeration but keep access
    Object.defineProperty(ret, 'lines', {
      value: lines,
      enumerable: false,   // <-- won't appear in console when expanding the object
      writable: false,
      configurable: false,
    });

    return ret;
  });
}

// ---------- Step 1.3: Render summary stats (<dl class="stats">) ----------
function renderCommitInfo(data, commits) {
  const dl = d3.select('#stats').append('dl').attr('class', 'stats');

  // Helper: add one dt/dd pair
  const addStat = (title, value) => {
    dl.append('dt').html(title);
    dl.append('dd').text(value ?? '—');
  };

  // Required basics
  addStat('Total <abbr title="Lines of code">LOC</abbr>', d3.format(',')(data.length));
  addStat('Total commits', d3.format(',')(commits.length));

  // ---- Additional examples (pick 3–4, already computed below) ----
  const distinctFiles = d3.groups(data, (d) => d.file).length;

  // Longest file (by max line index seen in that file)
  const fileLengths = d3.rollups(
    data,
    (v) => d3.max(v, (r) => r.line),
    (d) => d.file
  );
  const longestFilePair = d3.greatest(fileLengths, (d) => d[1]); // [file, length]
  const averageFileLength = d3.mean(fileLengths, (d) => d[1]);

  // Depth stats
  const maxDepth = d3.max(data, (d) => d.depth);
  const deepestLine = d3.greatest(data, (d) => d.depth); // returns the row with max depth

  // Time-of-day bucket with most work (using locale dayPeriod)
  const workByPeriod = d3.rollups(
    data,
    (v) => v.length,
    (d) => new Date(d.datetime).toLocaleString('en', { dayPeriod: 'short' }) // 'am', 'pm', etc.
  );
  const peakPeriod = d3.greatest(workByPeriod, (d) => d[1])?.[0]; // name only

  // Render chosen stats
  addStat('Distinct files', distinctFiles);
  addStat('Average file length (lines)', Math.round(averageFileLength));
  addStat('Longest file (lines)', longestFilePair ? `${longestFilePair[0]} (${longestFilePair[1]})` : '—');
  addStat('Maximum depth', maxDepth);
  addStat('Peak work period', peakPeriod?.toUpperCase());

  // (Optional) Small commit preview for sanity
  // console.log(commits);
}
// ---------- Step 2: Scatterplot of commits (date vs time-of-day) ----------
function renderScatterPlot(data, commits) {
  // 2.1 dimensions
  const width = 1000;
  const height = 600;
  const margin = { top: 10, right: 10, bottom: 60, left: 40 };

  // svg
  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  // usable area (account for margins)
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  // 2.1 scales
  const xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  const yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([usableArea.bottom, usableArea.top]);

  // 2.3 gridlines (draw BEFORE axes so they sit behind)
  const gridlines = svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left},0)`);
  gridlines.call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width));

let [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
// safety (all same value / empty)
if (minLines == null || maxLines == null) { minLines = 1; maxLines = 1; }

// 4.2 area-correct size scale
const rScale = d3.scaleSqrt()
  .domain([minLines, maxLines])
  .range([3, 25])                 // ← tweak if you want bigger/smaller bubbles
  .clamp(true);

// 4.3 draw big → small so small ends up on top (easier to hover)
const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

// --- dots ---
const dots = svg.append('g').attr('class', 'dots');

dots
  .selectAll('circle')
  .data(sortedCommits)
  .join('circle')
  .attr('cx', (d) => xScale(d.datetime))
  .attr('cy', (d) => yScale(d.hourFrac))
  .attr('r', (d) => rScale(d.totalLines))
  .attr('fill', 'steelblue')
  .attr('fill-opacity', 0.7)
  .attr('tabindex', 0)
  .on('mouseenter', (event, commit) => {
    d3.select(event.currentTarget)
      .attr('fill-opacity', 1)
      .attr('stroke', 'currentColor')
      .attr('stroke-width', 1);
    renderTooltipContent(commit);
    updateTooltipVisibility(true);
    updateTooltipPosition(event);
  })
  .on('mousemove', (event) => updateTooltipPosition(event))
  .on('mouseleave', (event) => {
    d3.select(event.currentTarget)
      .attr('fill-opacity', 0.7)
      .attr('stroke', null)
      .attr('stroke-width', null);
    updateTooltipVisibility(false);
  })
  .on('focus', (event, commit) => {
    renderTooltipContent(commit);
    updateTooltipVisibility(true);
  })
  .on('blur', () => updateTooltipVisibility(false));

// ---------- Step 5.1: Brush (limit to plot area) ----------
const brush = d3.brush()
  .extent([[usableArea.left, usableArea.top], [usableArea.right, usableArea.bottom]])
  .on('start brush end', brushed);

// add the brush *before* raising dots so tooltips still work
const brushG = svg.append('g').attr('class', 'brush').call(brush);

// Step 5.2: overlay sits behind dots; raise dots afterwards
svg.selectAll('.dots, .overlay ~ *').raise();

// ---------- helpers used by brushed ----------
function isCommitSelected(selection, commit) {
  if (!selection) return false;
  const [[x0, y0], [x1, y1]] = selection;
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);
  return x0 <= x && x <= x1 && y0 <= y && y <= y1;
}

function renderSelectionCount(selection) {
  const selected = selection ? commits.filter((d) => isCommitSelected(selection, d)) : [];
  const el = document.querySelector('#selection-count');
  el.textContent = `${selected.length || 'No'} commit${selected.length === 1 ? '' : 's'} selected`;
  return selected;
}

function renderLanguageBreakdown(selection) {
  const selected = selection ? commits.filter((d) => isCommitSelected(selection, d)) : [];
  const container = document.getElementById('language-breakdown');
  if (selected.length === 0) { container.innerHTML = ''; return; }

  const lines = selected.flatMap((d) => d.lines);
  const breakdown = d3.rollup(lines, (v) => v.length, (d) => d.type);

  container.innerHTML = '';
  for (const [language, count] of breakdown) {
    const pct = d3.format('.1~%')(count / lines.length);
    container.innerHTML += `<dt>${language}</dt><dd>${count} lines (${pct})</dd>`;
  }
}

// ---------- Step 5.4–5.6: brush handler ----------
function brushed(event) {
  const selection = event.selection; // [[x0,y0],[x1,y1]] or null

  // toggle selected class on dots
  svg.selectAll('.dots circle')
    .classed('selected', (d) => isCommitSelected(selection, d));

  // update count + language stats
  renderSelectionCount(selection);
  renderLanguageBreakdown(selection);
}

// 4) rotate labels to avoid crowding
  const xAxis = d3.axisBottom(xScale).ticks(d3.timeDay.every(2)); // every 2 days


  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00');

  svg
    .append('g')
    .attr('transform', `translate(0,${usableArea.bottom})`)
    .call(xAxis);

  svg
    .append('g')
    .attr('transform', `translate(${usableArea.left},0)`)
    .call(yAxis);
}

function renderTooltipContent(commit) {
  if (!commit) return;

  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');
  const time = document.getElementById('commit-time');
  const author = document.getElementById('commit-author');
  const lines = document.getElementById('commit-lines');

  // id + URL (URL may be null if you didn't set the meta[name=github-repo])
  link.textContent = commit.id;
  link.href = commit.url || '#';

  // nice date
  date.textContent = commit.datetime?.toLocaleString('en', { dateStyle: 'full' }) ?? '';

  // nice time (hour:minute + timezone)
  time.textContent = commit.datetime?.toLocaleTimeString('en', {
    hour: '2-digit',
    minute: '2-digit',
  }) + (commit.timezone ? ` ${commit.timezone}` : '');

  // author + lines
  author.textContent = commit.author ?? '';
  lines.textContent = `${commit.totalLines} line${commit.totalLines === 1 ? '' : 's'}`;
}

function updateTooltipVisibility(isVisible) {
  const el = document.getElementById('commit-tooltip');
  el.hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const el = document.getElementById('commit-tooltip');
  const pad = 12; // offset from cursor
  let left = event.clientX + pad;
  let top = event.clientY + pad;

  // keep inside viewport
  const rect = el.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  if (left + rect.width > vw) left = vw - rect.width - pad;
  if (top + rect.height > vh) top = vh - rect.height - pad;

  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}



// ---------- Boot ----------
const data = await loadData();
const commits = processCommits(data);
renderCommitInfo(data, commits);
renderScatterPlot(data, commits); 
