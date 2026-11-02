import { getCollection } from 'astro:content';

/** Every project has a detail page; featured projects lead the next-project sequence. */
export const getCases = async () => {
  const projects = (await getCollection('projects')).map((e) => e.data);
  const pinned = projects
    .filter((p) => p.featured)
    .sort((a, b) => (a.featured?.order ?? 0) - (b.featured?.order ?? 0));
  return [...pinned, ...projects.filter((p) => !p.featured)];
};
