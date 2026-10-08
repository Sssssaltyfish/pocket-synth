# Pocket Synth 3

A layered browser instrument and ChatGPT MCP app. The standalone `/` frontend and the in-chat `create_sound` resource use the **same bundled interface and audio engine**. ChatGPT supplies validated synthesis definitions; audio starts only with a user gesture.

## Actual Strudel runtime

Pinned official `@strudel/core` + `@strudel/mini` 1.2.6, `@strudel/webaudio` + SuperDough 1.3.0. Mini-notation produces live Strudel Patterns; the official **Cyclist** scheduler queries those patterns and sends haps to official **webaudioOutput / SuperDough**. The former custom oscillator renderer is removed. SuperDough implements oscillator synthesis, FM, envelopes, filters, panning, echo and AudioWorklet distortion/LFO. The application adds only validation, control mapping, master attenuation/compression, analyser, and lifecycle management.

This is a web instrument/plugin, not a VST/AU binary. Arbitrary JavaScript evaluation, remote samples, microphone access and external AI services are not enabled. Worklets ship inside the local bundle as data URLs; no external CDN is needed. The app probes data: AudioWorklet support on Play and automatically falls back to native Web Audio oscillators, filters, FM, shapers, delay, and Strudel Cyclist scheduling when an embedding host blocks data: worklets. The status indicates compatible mode. Modern secure-context browsers with Web Audio support are required. The fallback is an approximation of SuperDough, not timbrally identical.

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

The private Site, plugin, `open_synth`, `create_sound`, `get_sound_examples`, and `ui://pocket-synth/sound-designer-v2.html` resource identity remain stable. The versioned resource URI intentionally stays unchanged so older chat references continue working. The legacy `open_synth` tool retains its original limited pad interface; `create_sound` opens the new instrument. Existing v2 definitions/imports validate unchanged.

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

## Embedded-host AudioWorklet fallback (2026-10-09)

ChatGPT iframe policies may block embedded `data:` worklet module scripts. The first Play probes worklet support and selects either original SuperDough or a worklet-free Web Audio synthesizer. Both use the official Cyclist pattern scheduler. The fallback supports envelopes, FM, low-pass/resonance, drive, LFO, stereo panning, tempo echo and capped polyphony; it cleans up voices on Stop/Panic. `npm test` includes the three-layer Reactor Breach stress-patch fallback test. Audio-worklet playback and speaker output in the actual ChatGPT host still require manual end-to-end QA after deploying this source.
