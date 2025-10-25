// // index.js
// import { fetchJSON, renderProjects, fetchGithubData } from './global.js';

// const projects = await fetchJSON('./lib/projects.json');   // load all
// const latestProjects = projects.slice(0, 3);                // take first 3

// const projectsContainer = document.querySelector('.projects');
// renderProjects(latestProjects, projectsContainer, 'h2');    // reuse your renderer
// index.js
import { fetchJSON, renderProjects, fetchGitHubData } from './global.js';

async function main() {
  try {
    const projects = await fetchJSON('./lib/projects.json');
    if (!Array.isArray(projects)) {
      console.error('projects.json did not return an array:', projects);
      return;
    }

    // take the first 3 entries (assuming projects.json is already newest-first)
    const latest = projects.slice(0, 3);

    const container = document.querySelector('.projects');
    if (!container) {
      console.error('Missing <div class="projects"> on index.html');
      return;
    }

    renderProjects(latest, container, 'h2');
    console.log(`Rendered ${latest.length} project(s) on the home page.`);
  } catch (err) {
    console.error('Failed to render latest projects:', err);
  }
}

main();


const githubData = await fetchGitHubData('ArtienVoskanian'); // <- your username
const profileStats = document.querySelector('#profile-stats');

if (profileStats && githubData) {
  profileStats.innerHTML = `
    <h2>GitHub Profile</h2>
    <dl>
      <dt>Public Repos:</dt><dd>${githubData.public_repos}</dd>
      <dt>Public Gists:</dt><dd>${githubData.public_gists}</dd>
      <dt>Followers:</dt><dd>${githubData.followers}</dd>
      <dt>Following:</dt><dd>${githubData.following}</dd>
    </dl>
  `;
}