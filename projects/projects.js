import { fetchJSON, renderProjects } from '../global.js';

// ------------------ 1. Load data ------------------
const projects = await fetchJSON('../lib/projects.json');
const totalCount = Array.isArray(projects) ? projects.length : 0;

// ------------------ 2. DOM refs ------------------
const titleEl = document.querySelector('.projects-title');
const projectsContainer = document.querySelector('.projects');
const searchInput = document.getElementById('project-search');
const svg = d3.select('#projects-pie-plot');
const legendEl = document.getElementById('projects-legend');

// ------------------ 3. Title text ------------------
if (titleEl) {
  const base = titleEl.textContent.trim() || 'Projects';
  titleEl.textContent = `${totalCount} ${base}`;
}

// ------------------ 4. State ------------------
let activeYear = null;   // null = "All years"
let searchQuery = "";    // live text in search box

// ------------------ 5. Colors ------------------
// blue, pale green, teal
const baseColors = ["#3b82f6", "#4db3e9ff", "#0c25c3ff"];
const activeColor = "#ef4444"; // red highlight

function colorForYearIndex(i, isActive) {
  if (isActive) return activeColor;
  return baseColors[i % baseColors.length];
}

// ------------------ 6. Helpers ------------------

// Return all projects after applying BOTH filters:
// 1. activeYear (if any)
// 2. searchQuery text
function getVisibleProjects() {
  // filter by activeYear first
  let subset = activeYear == null
    ? projects.slice()
    : projects.filter(p => p.year === activeYear);

  // then filter by text
  const q = searchQuery.trim().toLowerCase();
  if (q) {
    subset = subset.filter(p => {
      const title = (p.title || "").toLowerCase();
      const desc  = (p.description || "").toLowerCase();
      return title.includes(q) || desc.includes(q);
    });
  }

  return subset;
}

// Count projects per year for a given subset
function yearCountsForProjects(list) {
  const countsByYear = new Map();
  for (const proj of list) {
    const y = proj.year;
    if (y === undefined || y === null) continue;
    countsByYear.set(y, (countsByYear.get(y) || 0) + 1);
  }
  // sort by ascending year (can flip to descending if lab screenshot wants latest first)
  return Array.from(countsByYear, ([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year);
}

// ------------------ 7. Static geometry ------------------

// D3 pie generator
const pie = d3.pie().value(d => d.count);

// Arcs: base vs emphasized (hover/active)
const arcBase = d3.arc()
  .innerRadius(0)
  .outerRadius(50);

const arcEmphasis = d3.arc()
  .innerRadius(0)
  .outerRadius(53);

// We'll hold refs to our slices + labels selections so we can rebind data
let slices = svg.selectAll('path');
let labels = svg.selectAll('text');

// ------------------ 8. Core render/update ------------------

function updateView() {
  // 1. Figure out visible projects (after activeYear + searchQuery)
  const visibleProjects = getVisibleProjects();

  // 2. Build yearDataVisible from that subset
  const yearDataVisible = yearCountsForProjects(visibleProjects);
  const pieData = pie(yearDataVisible); // each {data:{year,count}, startAngle, endAngle,...}

  // 3. Re-render the project list below
  renderProjects(visibleProjects, projectsContainer, 'h2');

  // 4. Rebuild/refresh LEGEND to match current visible years
  //    (still include "All years" reset at top)
  if (legendEl) {
    legendEl.innerHTML = '';

    // "All years" row
    const allRow = document.createElement('div');
    allRow.className = 'projects-legend-item';
    allRow.dataset.year = '';
    const allSwatch = document.createElement('span');
    allSwatch.className = 'projects-legend-swatch';
    allSwatch.style.backgroundColor = 'transparent';
    allSwatch.style.borderStyle = 'dashed';
    const allLabel = document.createElement('span');
    allLabel.textContent = `All years (${visibleProjects.length})`;
    allRow.append(allSwatch, allLabel);
    legendEl.append(allRow);

    // One row per visible year
    yearDataVisible.forEach((item, i) => {
      const row = document.createElement('div');
      row.className = 'projects-legend-item';
      row.dataset.year = String(item.year);

      const swatch = document.createElement('span');
      swatch.className = 'projects-legend-swatch';

      // Is this year active?
      const isActive = activeYear !== null && item.year === activeYear;
      swatch.style.backgroundColor = colorForYearIndex(i, isActive);
      swatch.style.borderStyle = 'solid';

      const label = document.createElement('span');
      label.textContent = `${item.year} (${item.count})`;

      row.append(swatch, label);
      legendEl.append(row);

      // If this row is currently activeYear, mark it visually
      if (isActive) {
        row.classList.add('is-active');
      }
    });

    // Legend click handler (reset + pick year)
    legendEl.onclick = (e) => {
      const row = e.target.closest('.projects-legend-item');
      if (!row) return;
      const yrStr = row.dataset.year;
      const yrVal = yrStr === '' ? null : Number(yrStr);

      // toggle: if clicking the same active year, clear it
      activeYear = (activeYear === yrVal) ? null : yrVal;

      // After changing activeYear, rerun updateView() so everything (list, pie, legend) syncs
      updateView();
    };
  }

  // 5. Update the PIE SLICES using join()

  // bind data
  slices = svg.selectAll('path')
    .data(pieData, d => d.data.year); // key by year so D3 tracks slices

  // exit old slices
  slices.exit().remove();

  // enter new slices
  const slicesEnter = slices.enter().append('path')
    .attr('data-year', d => d.data.year)
    .attr('d', arcBase);

  // merge enter+update for styling/interaction
  slices = slicesEnter.merge(slices)
    .each(function(d, i) {
      const isActive = activeYear !== null && d.data.year === activeYear;

      // apply classes first (clear old hover/dim each render)
      d3.select(this)
        .classed('slice-hovered', false)
        .classed('slice-dimmed', false)
        .classed('slice-active', isActive);

      // set fill color based on active or not
      d3.select(this)
        .attr('fill', colorForYearIndex(i, isActive));

      // set geometry: active = emphasized radius, others = base
      d3.select(this)
        .attr('d', isActive ? arcEmphasis(d) : arcBase(d));
    });

  // After draw, if there is an activeYear, dim all non-active slices
  if (activeYear !== null) {
    slices.classed('slice-dimmed', d => d.data.year !== activeYear);
  }

  // 6. Update LABELS (year: count) in the same join style

  labels = svg.selectAll('text')
    .data(pieData, d => d.data.year);

  labels.exit().remove();

  const labelsEnter = labels.enter().append('text')
    .attr('text-anchor', 'middle')
    .attr('font-size', '6px')
    .attr('font-weight', 600)
    .attr('fill', 'black')
    .attr('stroke', 'white')
    .attr('stroke-width', 0.5)
    .attr('paint-order', 'stroke')
    .attr('pointer-events', 'none');

  labels = labelsEnter.merge(labels)
    .text(d => `${d.data.year}: ${d.data.count}`)
    .attr('transform', d => {
      // use arcBase centroid even if active, so labels stay readable
      const [x, y] = arcBase.centroid(d);
      return `translate(${x}, ${y})`;
    });

  // 7. Rebind/refresh interactions on slices:
  //    - hover (only works when no activeYear is locked)
  //    - click (toggle activeYear, then updateView)

  slices
    .on('mouseenter', function (event, d) {
      if (activeYear !== null) return; // when locked, ignore hover pop

      const hovered = d3.select(this);

      // pop hovered slice
      hovered
        .classed('slice-hovered', true)
        .attr('d', arcEmphasis(d));

      // dim others
      slices.classed('slice-dimmed', function (otherD, i, group) {
        return group[i] !== hovered.node();
      });
    })
    .on('mouseleave', function () {
      if (activeYear !== null) return; // leave locked visuals alone

      // reset hover visuals back to base
      slices
        .classed('slice-hovered', false)
        .classed('slice-dimmed', false)
        .attr('d', function (d) {
          // with no activeYear, nobody's "active", so all go base
          return arcBase(d);
        });
    })
    .on('click', function (event, d) {
      const clickedYear = d.data.year;
      // toggle: clicking same year clears filter
      activeYear = (activeYear === clickedYear) ? null : clickedYear;

      // Whenever activeYear changes, re-run updateView()
      // This will also clear any transient hover classes and
      // redraw all slices/legend/list based on the new state.
      updateView();
    });
}

// ------------------ 9. Search box hookup ------------------

if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value || "";
    updateView();
  });
}

// ------------------ 10. Initial render ------------------
updateView();
