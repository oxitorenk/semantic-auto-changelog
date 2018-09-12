'use strict';
const fs = require('fs');
const path = require('path');
const readPkgUp = require('read-pkg-up');
const githubUrlFromGit = require('github-url-from-git');
const opn = require('opn');
const timestamp = require('time-stamp');
const startServer = require('./server');

const { pkg, path: pkgPath } = readPkgUp.sync();
const github = githubUrlFromGit(pkg.repository.url);

if (!github) {
  console.error('Error: Must have GitHub repository in package.json');
  process.exit(1);
}

const port = startServer({ handleData, json2markdown });

const url = `http://localhost:${port}/#${pkg.version}`;

console.log(`Server running on ${url}`);
console.log(
  "Your browser should open shortly; if it doesn't, click on the link above"
);

opn(url);

function handleData(data) {
  console.log();
  // TODO: Allow HISTORY.md, etc.
  const changelogPath = path.join(pkgPath, '../CHANGELOG.md');

  fs.readFile(changelogPath, 'utf8', (err, oldMarkdown = '') => {
    if (err && err.code === 'ENOENT') {
      console.log(`Creating new file: ${changelogPath}`);
    } else if (err) return console.error(err);
    else console.log(`Prepending to ${changelogPath}`);

    console.log();
    console.log(ensureTrailingNewline(data));

    fs.writeFile(
      changelogPath,
      ensureTrailingNewline(data + oldMarkdown),
      (err) => err && console.error(err)
    );
  });
}

function json2markdown(data) {
  const { changes, version } = data;
  const list = !changes.length
    ? ''
    : `- ${changes.map(changeToString).join('\n- ')}\n`;

  return `# ${version} / ${timestamp()}\n\n${list}\n`;
}

function changeToString(change) {
  let str = change.description.trim();
  const issue = issuePrToLink(change.issue, 'issue');
  const pr = issuePrToLink(change.pr, 'pr');
  if (issue || pr) str += ' (';
  if (issue) str += issue;
  if (issue && pr) str += ', ';
  if (pr) str += pr;
  if (issue || pr) str += ')';

  return str;
}

function issuePrToLink(item, type) {
  const typeMap = {
    issue: 'issues',
    pr: 'pull',
  };

  if (!item) return;
  if (item.startsWith('#')) item = item.slice(1);
  return `[#${item}](${github}/${typeMap[type]}/${item})`;
}

function ensureTrailingNewline(text) {
  return `${text.trim()}\n`;
}
