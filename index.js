import fs from 'fs';
import path from 'path';
import { readPackageUpSync } from 'read-pkg-up';
import githubUrlFromGit from 'github-url-from-git';
import open from 'open';
import startServer from './server/index.js';
import gitCommitCount from 'git-commit-count';
import gitLog from 'gitlog';

let commits = [];
const packageData = readPackageUpSync();
const githubURL = getGithubUrl(packageData);

if (!githubURL) {
  exitWithError('Error: Must have GitHub repository in package.json');
}

const gitHistoryConfig = {
  repo: packageData.path.replace("package.json", '.git'),
  number: gitCommitCount(githubURL),
  fields: ['subject', 'tag', 'authorDate'],
};

startAppServer();

// Fetches commit history asynchronously
async function fetchCommitHistory() {
  try {
    commits = await gitLog(gitHistoryConfig);
  } catch (error) {
    console.error('Failed to fetch git log:', error);
  }
}

function startAppServer() {
  const port = startServer({ handleData, json2markdown });
  const url = `http://localhost:${port}/#${packageData.packageJson.version}`;

  open(url).then(() => {
    console.log(`Server running on ${url}`);
    console.log("Your browser should open shortly; if not, click the link above.");
    fetchCommitHistory();
  });
}

// Handle incoming data and write to the changelog
function handleData(data) {
  const changelogPath = getChangelogPath(packageData);
  const updatedContent = ensureTrailingNewline(data);

  writeToFile(changelogPath, updatedContent);
}

// Generate Markdown formatted changelog based on commits
function json2markdown() {
  let currentTag = "Unreleased"; // Default tag for unreleased changes
  const commitContainer = initializeCommitContainer(currentTag);

  commits.forEach((commit) => {
    const newTag = convertTagToValidForm(commit.tag);

    // If a new tag is encountered, update the current tag
    if (newTag)
      currentTag = newTag;

    let container = commitContainer.find(c => c.tag === currentTag);

    // If no container exists for the current tag, create a new one
    if (!container) {
      container = createNewCommitContainer(currentTag, commit.authorDate.split(' ')[0]);
      commitContainer.push(container);
    }

    // Categorize the commit into added, fixed, changed, or removed
    categorizeCommit(commit.subject, container.content);
  });

  // Generate the markdown string based on the categorized commits
  return generateMarkdown(commitContainer);
}

// Categorize commits into added, fixed, changed, or removed
function categorizeCommit(subject, content) {
  if (subject.startsWith('Added: ')) {
    content.added.push(subject.replace('Added: ', ''));
  } else if (subject.startsWith('Fixed: ')) {
    content.fixed.push(subject.replace('Fixed: ', ''));
  } else if (subject.startsWith('Changed: ')) {
    content.changed.push(subject.replace('Changed: ', ''));
  } else if (subject.startsWith('Removed: ')) {
    content.removed.push(subject.replace('Removed: ', ''));
  }
}

// Fetch GitHub URL from package data
function getGithubUrl(packageData) {
  return githubUrlFromGit(packageData?.packageJson?.repository?.url);
}

// Get path for changelog file
function getChangelogPath(packageData) {
  return path.join(packageData.path, '../CHANGELOG.md');
}

function writeToFile(filePath, data) {
  fs.writeFile(filePath, data, (err) => {
    if (err) console.error('Error writing to file:', err);
  });
}

function convertTagToValidForm(gitTag) {
  if (!gitTag || !gitTag.includes('tag')) return '';
  return gitTag.split(',').find(tag => tag.includes('tag')).replace('tag: ', '').trim();
}

// Initializes the first commit container with "Unreleased" tag
function initializeCommitContainer(initialTag) {
  return [
    {
      tag: initialTag,
      date: commits[0].authorDate.split(' ')[0],
      content: { added: [], fixed: [], changed: [], removed: [] },
    },
  ];
}

// Creates a new commit container for a specific tag and date
function createNewCommitContainer(tag, date) {
  return {
    tag,
    date,
    content: { added: [], fixed: [], changed: [], removed: [] },
  };
}

// Generates Markdown formatted changelog from commit data
function generateMarkdown(commitContainer) {
  let mdFile = `# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n`;
  mdFile += `The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),\n`;
  mdFile += `and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\n\n`;

  // Iterate through each tag and its categorized changes
  commitContainer.forEach((container) => {
    const { added, fixed, changed, removed } = container.content;
    if (added.length || fixed.length || changed.length || removed.length) {
      mdFile += `## [${container.tag}] - ${container.date}\n\n`;
      if (added.length) mdFile += `### Added\n\n${added.map(item => `- ${item}\n`).join('')}\n`;
      if (fixed.length) mdFile += `### Fixed\n\n${fixed.map(item => `- ${item}\n`).join('')}\n`;
      if (changed.length) mdFile += `### Changed\n\n${changed.map(item => `- ${item}\n`).join('')}\n`;
      if (removed.length) mdFile += `### Removed\n\n${removed.map(item => `- ${item}\n`).join('')}\n`;
    }
  });

  return mdFile;
}

function ensureTrailingNewline(text) {
  return `${text.trim()}\n`;
}

function exitWithError(message) {
  console.error(message);
  process.exit(1);
}