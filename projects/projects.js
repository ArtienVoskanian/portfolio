import { fetchJSON, renderProjects } from '../global.js';
const projects = await fetchJSON('../lib/projects.json');


// 1) Update the page title with the live count
const titleEl = document.querySelector('.projects-title');
if (titleEl) {
  // keep whatever your H1 already says and append the count nicely
  const base = titleEl.textContent.trim() || 'Projects';
  const count = Array.isArray(projects) ? projects.length : 0;
  titleEl.textContent = `${count} ${base}`;
}

// 2) Render the projects as before
const projectsContainer = document.querySelector('.projects');
renderProjects(projects, projectsContainer, 'h2');

