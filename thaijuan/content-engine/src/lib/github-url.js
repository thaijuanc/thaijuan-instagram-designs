const path = require('path');

const DEFAULT_REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'thaijuanc';
const DEFAULT_REPO_NAME = process.env.GITHUB_REPO_NAME || 'thaijuan-instagram-designs';
const DEFAULT_BRANCH = process.env.GITHUB_BRANCH || 'master';

function normalizeRepoPath(filePath) {
  return String(filePath || '')
    .replace(/^\.\//, '')
    .replace(/^\/Users\/[^/]+\/\.openclaw\/workspace\/thaijuan-instagram-designs\//, '')
    .replace(/\\/g, '/');
}

function toRawGithubUrl(filePath, options = {}) {
  const repoPath = normalizeRepoPath(filePath);
  if (!repoPath) throw new Error('Missing file path for GitHub URL.');

  const owner = options.owner || DEFAULT_REPO_OWNER;
  const repo = options.repo || DEFAULT_REPO_NAME;
  const branch = options.branch || DEFAULT_BRANCH;

  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${repoPath}`;
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ''));
}

module.exports = { normalizeRepoPath, toRawGithubUrl, isHttpUrl };
