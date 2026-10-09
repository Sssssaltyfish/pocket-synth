// Pocket Synth · AGPL-3.0-or-later. Only the loading path is application-owned.
import {officialWorklets} from '../generated/worklet-manifest.js';

const registrations = new WeakMap();

export async function loadOfficialWorklets(context) {
  if (!context.audioWorklet?.addModule) {
    throw new Error('AudioWorklet is unavailable. This instrument requires a secure context with AudioWorklet support.');
  }
  // In chat, location belongs to the host sandbox, not the MCP server. The
  // server supplies the asset origin separately from all user-editable patches.
  const origin = globalThis.document?.querySelector?.('meta[name="pocket-synth-asset-origin"]')?.content;
  const base = origin || globalThis.location?.href;
  let loaded = registrations.get(context);
  if (!loaded) registrations.set(context, loaded = new Map());

  await Promise.all(officialWorklets.map(({name, path}) => {
    const url = base ? new URL(path, base).href : path;
    if (!loaded.has(url)) {
      const registration = Promise.resolve()
        .then(() => context.audioWorklet.addModule(url, {credentials: 'omit'}))
        .catch(cause => {
          // Retry failed modules on the next Play; retain successful/in-flight
          // modules so partial failures never require duplicate registrations.
          loaded.delete(url);
          console.error(`[Pocket Synth] ${name} worklet failed`, url, cause);
          throw new Error(`Could not load the original ${name} worklet from ${url}. Check this asset's HTTP status, JavaScript MIME type, CORS and widget CSP, then press Play again.`, {cause});
        });
      loaded.set(url, registration);
    }
    return loaded.get(url);
  }));
}
