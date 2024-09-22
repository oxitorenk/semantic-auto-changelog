import fs from 'fs';
import path from 'path';
import { readPackageUpSync } from 'read-pkg-up';
import githubUrlFromGit from 'github-url-from-git';
import open from 'open';
import startServer from './server/index.js';
import gitCommitCount from "git-commit-count";
import gitLog from "gitlog";

const gitHistoryConfig = {
  repo: ".git",
  number: gitCommitCount(),
  fields: ["subject", "tag", "authorDate"]
};
let commits = [];

const packageData = readPackageUpSync();
const githubURL = githubUrlFromGit(packageData.packageJson.repository.url);
if (githubURL === false)
{
  console.error('Error: Must have GitHub repository in package.json');
  process.exit(1);
}
else
{
  const port = startServer({ handleData, json2markdown });
  const url = `http://localhost:${port}/#${packageData.packageJson.version}`;
  open(url).then(() => {
    console.log(`Server running on ${url}`);
    console.log(
      "Your browser should open shortly; if it doesn't, click on the link above (to cancel process, you can use 'control + c' shortcut)",
    );
    fetchCommitHistory();
  });
}

const changelogPath = path.join(packageData.path, '../CHANGELOG.md');
let changelogContents = '';
try
{
  changelogContents = fs.readFileSync(changelogPath, 'utf8');
}
catch (err)
{
  if (err.code !== 'ENOENT')
  {
    console.error(err);
    process.exit(1);
  }
}

function handleData(data)
{
  if (changelogContents === false)
    console.log(`Creating new file: ${changelogPath}`);
  else
    console.log(`Prepending to ${changelogPath}`);

  console.log(ensureTrailingNewline(data));

  fs.writeFile(
    changelogPath,
    ensureTrailingNewline(data + changelogContents),
    (err) => err && console.error(err),
  );
}

async function fetchCommitHistory()
{
  await gitLog(gitHistoryConfig).then(filteredCommits =>
  {
    commits = filteredCommits;
  });
}

function json2markdown()
{
  let currentTag = "Unreleased";
  const commitContainer = [{tag: currentTag, date: commits[0].authorDate.split(' ')[0], content: {added: [], fixed: [], changed: [], removed: []}}];
  for (let i = 0; i < commits.length; i++)
  {
    const commitTag = getTag(commits[i].tag);
    if (commitTag !== "" && !commitContainer.some(container => container.tag === commitTag))
    {
      const newContainer = {
        tag: getTag(commits[i].tag),
        date: commits[i].authorDate.split(' ')[0],
        content: {added: [], fixed: [], changed: [], removed: []}
      }

      if (commits[i].subject.includes("Added: "))
      {
        newContainer.content.added.push(commits[i].subject.replace("Added: ", ""));
      }
      else if (commits[i].subject.includes("Fixed: "))
      {
        newContainer.content.fixed.push(commits[i].subject.replace("Fixed: ", ""));
      }
      else if (commits[i].subject.includes("Changed: "))
      {
        newContainer.content.changed.push(commits[i].subject.replace("Changed: ", ""));
      }
      else if (commits[i].subject.includes("Removed: "))
      {
        newContainer.content.removed.push(commits[i].subject.replace("Removed: ", ""));
      }

      commitContainer.push(newContainer);
      currentTag = newContainer.tag;
      continue;
    }

    // eslint-disable-next-line no-loop-func
    const validContainers = commitContainer.filter(container => container.tag === currentTag);
    if (commits[i].subject.includes("Added: "))
    {
      validContainers[0].content.added.push(commits[i].subject.replace("Added: ", ""));
    }
    else if (commits[i].subject.includes("Fixed: "))
    {
      validContainers[0].content.fixed.push(commits[i].subject.replace("Fixed: ", ""));
    }
    else if (commits[i].subject.includes("Changed: "))
    {
      validContainers[0].content.changed.push(commits[i].subject.replace("Changed: ", ""));
    }
    else if (commits[i].subject.includes("Removed: "))
    {
      validContainers[0].content.removed.push(commits[i].subject.replace("Removed: ", ""));
    }
  }

  let mdFile = "# Changelog\n\n";
  mdFile += "All notable changes to this project will be documented in this file.\n\n";
  mdFile += "The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), ";
  mdFile += "and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\n\n";

  for (let i = 0; i < commitContainer.length; i++)
  {
    if (commitContainer[i].content.added.length === 0 && commitContainer[i].content.changed.length === 0 && commitContainer[i].content.fixed.length === 0 && commitContainer[i].content.removed.length === 0) continue;

    const container = commitContainer[i];
    const {content} = container;
    mdFile += `## [${container.tag}] - ${container.date}\n\n`;

    if (content.added.length > 0)
    {
      mdFile += "### Added\n\n";

      for (let i = 0; i < content.added.length; i++)
      {
        mdFile += `- ${content.added[i]}\n`;
      }

      mdFile += "\n";
    }

    if (content.fixed.length > 0)
    {
      mdFile += "### Fixed\n\n";

      for (let i = 0; i < content.fixed.length; i++)
      {
        mdFile += `- ${content.fixed[i]}\n`;
      }

      mdFile += "\n";
    }

    if (content.changed.length > 0)
    {
      mdFile += "### Changed\n\n";

      for (let i = 0; i < content.changed.length; i++)
      {
        mdFile += `- ${content.changed[i]}\n`;
      }

      mdFile += "\n";
    }

    if (content.removed.length > 0)
    {
      mdFile += "### Removed\n\n";

      for (let i = 0; i < content.removed.length; i++)
      {
        mdFile += `- ${content.removed[i]}\n`;
      }

      mdFile += "\n";
    }
  }

  return mdFile;
}

function getTag(gitTag)
{
  if (gitTag === "" || !gitTag.includes("tag"))
  {
    return "";
  }

  const result = gitTag.split(',');
  const validTagResults = result.filter(tag => tag.includes("tag"));
  const tagIndex = validTagResults.length - 1;
  validTagResults[tagIndex] = validTagResults[tagIndex].replace("tag: ", '');
  validTagResults[tagIndex] = validTagResults[tagIndex].replace(' ', '');

  return validTagResults[tagIndex];
}

function ensureTrailingNewline(text) {
  return `${text.trim()}\n`;
}
