import { createApp } from 'vue/dist/vue.esm-bundler.js';
import { marked } from 'marked';

import clean from 'semver/functions/clean';
import inc from 'semver/functions/inc';

const semver = { clean, inc };
const hashArgs = window.location.hash.slice(1).split('|');
const currentVersion = semver.clean(hashArgs[0]);

const versionOptions = ['patch', 'minor', 'major'].map((upgradeType) => {
  return semver.inc(currentVersion, upgradeType);
});
versionOptions.unshift(currentVersion);
versionOptions.push('other');

const app = createApp({
  data() {
    return {
      newVersion: currentVersion,
      versionOptions,
      customVersion: '',
      changes: [{}],
      error: '',
      isDone: false,
      markdown: this.getMarkdown(),
    };
  },
  computed: {
    computedVersion() {
      return this.newVersion === 'other'
        ? semver.clean(this.customVersion)
        : this.newVersion;
    },
    filteredChanges() {
      return this.changes.filter((change) => change.description?.trim());
    },
    preview() {
      return marked.parse(this.markdown || '');
    },
  },
  watch: {
    computedVersion() {
      this.getMarkdown();
    },
    filteredChanges: {
      handler() {
        this.getMarkdown();
      },
      deep: true,
    },
  },
  methods: {
    getMarkdown() {
      return fetch('/json2markdown', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          changes: this.filteredChanges,
          version: this.computedVersion,
        }),
      })
        .then((res) => res.text())
        .then((markdown) => {
          this.markdown = markdown;
        })
        .catch(console.error);
    },
    submit() {
      if (!this.computedVersion) {
        this.error = `Invalid version "${this.customVersion}"`;
        return;
      }
      if (!this.markdown.length) {
        this.error = 'No release notes written; aborting.';
        return;
      }

      this.error = '';

      fetch('/', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: this.markdown,
      })
        .then(() => {
          this.isDone = true;
        })
        .catch(console.error);
    },
  },
});

app.mount('#app');
