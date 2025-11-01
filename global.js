console.log("IT’S ALIVE!");

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

// ---- Step 3: Automatic navigation menu ----

// 3.1.a Pages list
let pages = [
  { url: "", title: "Main" },
  { url: "projects/", title: "Projects" },
  { url: "contact/", title: "Contact" },
  { url: "cv/", title: "CV/Resume" },
  { url: "https://github.com/ArtienVoskanian", title: "Github" },
];

// 3.1.b BASE_PATH for local vs GitHub Pages
const BASE_PATH =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "/"
    : "/portfolio/";

// 3.1.c Insert <nav> at top of <body>
let nav = document.createElement("nav");
nav.style.display = "flex";
nav.style.gap = "12px";
nav.style.flexWrap = "wrap";
document.body.prepend(nav);


// 3.1.d + 3.2: build links as elements, mark current, and handle externals
for (let p of pages) {
  // 1) Build URL (prefix internal pages with BASE_PATH)
  const isExternal = /^https?:\/\//i.test(p.url);
  const url = isExternal ? p.url : BASE_PATH + p.url;

  // 2) Create <a> and set basic props
  const a = document.createElement("a");
  a.href = url;
  a.textContent = p.title;

  // 3) CURRENT-PAGE HIGHLIGHT (robust to /index.html vs /)
  const normalize = (path) => {
    if (path.endsWith("/index.html")) return path.slice(0, -"/index.html".length) + "/";
    return path.endsWith("/") ? path : path + "/";
  };
  const sameHost = a.host === location.host;
  const samePath = normalize(a.pathname) === normalize(location.pathname);
  a.classList.toggle("current", sameHost && samePath);

  // 4) EXTERNAL LINKS → open in new tab (and secure it)
  if (!sameHost) {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  }

  // 5) Append to <nav>
  nav.append(a);
}

// ---- Step 4: Dark/Light/Auto color-scheme ----
const THEME_KEY = "color-scheme-preference";

// 1) Build the UI
const themeWrap = document.createElement("span");
themeWrap.className = "theme-ctl";

const themeLabel = document.createElement("label");
themeLabel.htmlFor = "theme-select";
themeLabel.textContent = "Theme:";

const themeSelect = document.createElement("select");
themeSelect.id = "theme-select";
[
  { value: "auto",  label: "Automatic" },
  { value: "light", label: "Light" },
  { value: "dark",  label: "Dark" },
].forEach(opt => {
  const o = document.createElement("option");
  o.value = opt.value;
  o.textContent = opt.label;
  themeSelect.append(o);
});

themeWrap.append(themeLabel, themeSelect);
nav.append(themeWrap); // put it at the end/right of the nav

// 2) Apply helper
function applyColorScheme(mode) {
  const root = document.documentElement;
  if (mode === "auto") {
    root.removeAttribute("data-theme"); // fall back to :root { color-scheme: light dark; }
  } else {
    root.setAttribute("data-theme", mode); // "light" or "dark"
  }
}

// 3) Load saved preference (default = auto), apply, and sync the UI
const saved = localStorage.getItem(THEME_KEY) || "auto";
applyColorScheme(saved);
themeSelect.value = saved;

// 4) Listen for changes; persist + apply
themeSelect.addEventListener("change", (e) => {
  const mode = e.target.value; // "auto" | "light" | "dark"
  localStorage.setItem(THEME_KEY, mode);
  applyColorScheme(mode);
});

export async function fetchJSON(url) {
  try {
    // Fetch the JSON file from the given URL
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }
    const data = await response.json();
    return data;

  } catch (error) {
    console.error('Error fetching or parsing JSON data:', error);
  }
}

export function renderProjects(projects, containerElement, headingLevel = 'h2') {
  if (!containerElement) return;
  containerElement.innerHTML = '';

  const validHeadings = new Set(['h1','h2','h3','h4','h5','h6']);
  const tag = validHeadings.has(headingLevel) ? headingLevel : 'h2';

  const list = Array.isArray(projects) ? projects : (projects ? [projects] : []);
  if (list.length === 0) {
    containerElement.innerHTML = '<p>No projects to show.</p>';
    return;
  }

  for (const project of list) {
    const article = document.createElement('article');

    const title = project?.title ?? 'Untitled project';
    const year = project?.year ? String(project.year) : ''; // Step 0.1 addition
    const imageHTML = project?.image
      ? `<img src="${project.image}" alt="${title}">`
      : '';
    const desc = project?.description ?? '';

    // If we have a year, show "Title (Year)". Otherwise just Title.
    const headingHTML = year
      ? `${title} <span class="meta">(${year})</span>`
      : title;

    article.innerHTML = `
      <${tag}>${headingHTML}</${tag}>
      ${imageHTML}
      <p>${desc}</p>
    `;

    containerElement.appendChild(article);
  }
}


// global.js
export async function fetchGitHubData(username) {
  return fetchJSON(`https://api.github.com/users/${username}`);
}
