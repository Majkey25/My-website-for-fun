(function () {
  const list = document.getElementById('projects-list');
  const status = document.getElementById('projects-status');

  if (!list || !status) return;

  status.textContent = 'Loading public repositories…';

  const apiUrl = new URL('https://api.github.com/users/Majkey25/repos');
  apiUrl.search = new URLSearchParams({
    type: 'owner',
    sort: 'full_name',
    direction: 'asc',
    per_page: '100'
  });

  function getNextPage(linkHeader) {
    const nextLink = linkHeader
      ?.split(',')
      .find((link) => link.includes('rel="next"'));
    return nextLink?.match(/<([^>]+)>/)?.[1] || null;
  }

  async function fetchRepositories() {
    const repositories = [];
    let nextPage = apiUrl.href;

    while (nextPage) {
      const response = await fetch(nextPage, {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2026-03-10'
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}`);
      }

      const page = await response.json();
      if (!Array.isArray(page)) {
        throw new TypeError('GitHub API returned an invalid response');
      }

      repositories.push(...page);
      nextPage = getNextPage(response.headers.get('link'));
    }

    return repositories;
  }

  function createProject(repository, index) {
    if (
      typeof repository?.name !== 'string'
      || typeof repository.html_url !== 'string'
      || !repository.html_url.startsWith('https://github.com/')
    ) {
      return null;
    }

    const item = document.createElement('li');
    const link = document.createElement('a');
    const number = document.createElement('span');
    const copy = document.createElement('span');
    const name = document.createElement('h3');
    const metadata = document.createElement('span');
    const arrow = document.createElement('span');

    item.className = 'project-item';
    link.className = 'project-link';
    link.href = repository.html_url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    number.className = 'project-number';
    number.textContent = String(index + 1).padStart(2, '0');
    copy.className = 'project-copy';
    name.className = 'project-name';
    name.textContent = repository.name;
    metadata.className = 'project-metadata';
    metadata.textContent = [
      typeof repository.language === 'string' ? repository.language : null,
      repository.fork === true ? 'Fork' : null,
      repository.archived === true ? 'Archived' : null
    ].filter(Boolean).join(' · ');
    arrow.className = 'project-arrow';
    arrow.textContent = '↗';
    arrow.setAttribute('aria-hidden', 'true');

    copy.append(name);
    if (typeof repository.description === 'string' && repository.description) {
      const description = document.createElement('span');
      description.className = 'project-description';
      description.textContent = repository.description;
      copy.append(description);
    }

    link.append(number, copy, metadata, arrow);
    item.append(link);
    return item;
  }

  function showError() {
    const fallback = document.createElement('a');
    fallback.href = 'https://github.com/Majkey25?tab=repositories';
    fallback.target = '_blank';
    fallback.rel = 'noopener noreferrer';
    fallback.textContent = 'View them on GitHub.';
    status.textContent = 'Projects could not load right now. ';
    status.append(fallback);
  }

  fetchRepositories()
    .then((repositories) => {
      const projects = repositories
        .map((repository, index) => createProject(repository, index))
        .filter(Boolean);

      list.replaceChildren(...projects);
      status.textContent = projects.length === 0
        ? 'No public repositories yet.'
        : `${projects.length} public repositories`;
    })
    .catch(showError)
    .finally(() => list.setAttribute('aria-busy', 'false'));
})();
