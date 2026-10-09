# Pocket Synth 3

A layered browser instrument and ChatGPT MCP app. The standalone `/` frontend and the in-chat `create_sound` resource use the **same bundled interface and audio engine**. ChatGPT supplies validated synthesis definitions; audio starts only with a user gesture.

## Actual Strudel runtime

Pinned official `@strudel/core` + `@strudel/mini` 1.2.6, `@strudel/webaudio` + SuperDough 1.3.0. Mini-notation produces live Strudel Patterns; the official **Cyclist** scheduler queries those patterns and sends haps to official **webaudioOutput / SuperDough**. The former custom oscillator renderer is removed. SuperDough implements oscillator synthesis, FM, envelopes, filters, panning, echo and AudioWorklet distortion/LFO. The application adds only validation, control mapping, master attenuation/compression, analyser, and lifecycle management.

This is a web instrument/plugin, not a VST/AU binary. Arbitrary JavaScript evaluation, remote samples, microphone access and external AI services are not enabled. The build extracts the exact worklet bytes from the pinned SuperDough and Supradough distributions into content-hashed `/worklets/*.js` assets; no external CDN is needed. Modern secure-context browsers with Web Audio and AudioWorklet support are required. The widget loads these scripts from the MCP server over HTTPS with credential-free CORS. If loading still fails, startup reports the failed module and URL instead of switching to an approximate synthesizer.

## Features

- Play/Stop, loop or finite phrase, 30–200 BPM, panic disconnect, conservative master gain
- 1–3 layers, four waveforms, paired unison detune, ADSR, resonant low-pass, actual FM, LFO filter motion, distortion, tempo-derived echo, pan and layer gain
- Live changes affect newly scheduled notes; changing a patch preserves the transport phase
- Editable restricted Strudel note patterns and complete JSON definitions
- Four meaningful factory patches, device-local patch bank/current patch, JSON export/import
- Keyboard Space transport and Escape panic, responsive instrument layout
- Stops automatically when the document is hidden or torn down

Patch storage is browser/device-local, not a cloud sync service. Export is the portable backup. In-chat storage can be isolated by the host, so export important patches. No automatic playback after reload or tool invocation.

## Compatibility and migration from v2

The private Site, plugin and `open_synth`, `create_sound`, `get_sound_examples` tool identities remain stable. New widgets use `ui://pocket-synth/sound-designer-v3-worklets.html` so hosts can load the updated resource metadata; `resources/read` still accepts the old `ui://pocket-synth/sound-designer-v2.html` URI. The legacy `open_synth` tool retains its original limited pad interface; `create_sound` opens the new instrument. Existing v2 definitions/imports validate unchanged.

Timbral differences are intentional because v3 uses the actual Strudel engine rather than v2's approximation:
- `fm` maps to SuperDough FM index and `fmRatio` to harmonicity; modulation index is relative to modulator frequency
- `drive` uses official distortion, not the old custom tanh shaper
- `filterMotion`/`filterRate` use official filter LFO
- `delay` uses official feedback echo at an eighth-note interval
- `pan` translates −1…1 to SuperDough's 0…1
- `detune` creates two official synth voices offset in cents; 48 voices means up to 24 simultaneous paired notes
- `gate` scales hap duration before the official audio output call; held notes are capped at 10 seconds plus release
- Playback loops by default; disable Loop to stop at the `cycles` phrase length

No claim of bit-identical v2 sound is made. Each parameter remains inspectable in the patch definition.

## Original-backend worklet loading

`create_sound` uses only the official Strudel/SuperDough output path. There is no automatic native-oscillator fallback. The upstream FM, envelopes, gain staging, filter/distortion order, LFO and echo implementations and the application's master output chain are unchanged.

The application calls `initAudio({disableWorklets:true, maxPolyphony:48})` to skip **only the upstream data-URL loader**, then awaits both packaged official worklets with its own loader before starting Cyclist. `disableWorklets` does not disable effects: the same processors are registered from the static files. Registrations are cached per AudioContext and URL; failures are evicted so the next Play can retry without re-registering successful modules. No synthesizer/processor DSP is rewritten.

The server supplies the asset origin in the in-chat HTML rather than resolving against the sandbox's origin. Both `_meta.ui.csp` and the ChatGPT compatibility `_meta["openai/widgetCSP"]` allow only that asset origin. Worklet routes return JavaScript MIME, credential-free CORS, immutable hashed URLs, and actual 404s for missing modules. Only code assets are public; data-tool authentication is unchanged. The standalone preview uses the same Worker router.

By default the asset origin is the MCP request's origin. For a reverse proxy that exposes a different public origin, set the server environment binding `POCKET_SYNTH_ASSET_ORIGIN` to that HTTPS origin (HTTP loopback is accepted for local development). It must serve the same `/worklets/` files without login redirects or cookies. This is server configuration, never a patch parameter. Updating source alone does not update an installed plugin: deploy the rebuilt `dist` and load a new widget to use the new resource and CSP metadata.

## Build and verification

Node 22+: `npm ci`, `npm run build`, `npm test`. `npm run dev` serves the standalone instrument on port 4173. Worker output is `dist/server/index.js`. Hosted publication uses the existing Sites project manifest. Generated files are build artifacts, not editable source.

Tests use the actual bundled Strudel and SuperDough libraries:
1. Pattern/schema safety, MCP tools, auth requirement and same frontend resource
2. Four preset voice/FM/envelope/filter/echo renders using `web-audio-engine` at 48 kHz; worklet FX are excluded from these offline renders because this test engine lacks browser AudioWorklet support
3. Exact shipped distortion and LFO worklet DSP is evaluated separately in a processor harness
4. Actual Cyclist transport/repeated clicks/live updates/cancelled startup, with worklet-registration stubbed solely for lifecycle isolation

These checks do not replace real browser/audio-device tests. Browser QA status and limitations are recorded in `TESTING.md`.

## License and corresponding source

AGPL-3.0-or-later. See COPYING. Integration modified October 5, 2026. Strudel/SuperDough copyright belongs to their contributors; notices remain in bundled code and dependency sources. `/source.tar.gz` supplies this application, build/test scripts, lockfile, and runtime dependency sources/licenses. Rebuild using the pinned lockfile with `npm ci`. No credentials, account state or saved patches are included.

Official references: https://strudel.cc/technical-manual/project-start/ and https://strudel.cc/learn/synths/
