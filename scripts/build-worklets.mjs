// Keep the pinned upstream processor bytes; change their transport, not their DSP.
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';

const require = createRequire(import.meta.url);

export function prepareWorklets() {
  const modules = new Map();
  const sources = {};
  const manifest = [];
  mkdirSync('public/worklets', {recursive: true});

  for (const name of ['superdough', 'supradough']) {
    const entry = require.resolve(name);
    const source = readFileSync(entry, 'utf8');
    const embedded = /(["'])data:text\/javascript;base64,([A-Za-z0-9+/=]+)\1/g;
    const matches = [...source.matchAll(embedded)];
    // Fail at build time if an upstream package changes its distribution format.
    if (matches.length !== 1) {
      throw new Error(`Expected one embedded ${name} worklet; found ${matches.length}`);
    }
    const bytes = Buffer.from(matches[0][2], 'base64');
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
    const path = `/worklets/${name}-${hash}.js`;
    writeFileSync(`public${path}`, bytes);
    sources[path] = bytes.toString('utf8');
    manifest.push({name, path});
    // Avoid retaining duplicate data: payloads in the browser bundle. No package
    // files are modified, and all synthesis/effect implementations stay upstream.
    modules.set(entry, source.replace(embedded, () => JSON.stringify(path)));
  }

  writeFileSync('generated/worklet-manifest.js',
    `export const officialWorklets = ${JSON.stringify(manifest)};\n`);
  return {
    sources,
    plugin: {
      name: 'pocket-synth-hosted-worklets',
      setup(build) {
        build.onLoad({filter: /[\\/]dist[\\/]index\.mjs$/}, ({path}) => {
          if (modules.has(path)) return {contents: modules.get(path), loader: 'js'};
        });
      },
    },
  };
}
