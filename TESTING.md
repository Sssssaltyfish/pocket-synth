# Pocket Synth 3 verification

2026-10-05. Automated checks pass against the real Strudel/SuperDough packages (see README for exact boundaries).

- Pattern safety and real controls: pass
- Four actual SuperDough voice/FM/envelope/filter/echo renders at 48 kHz: pass (finite, non-silent, conservative peaks below 0.03 before the additional master compressor)
- FM waveform difference: pass
- Exact published distortion and filter LFO worklet processor DSP: pass
- Actual Cyclist repeated Play, live pattern replacement, tempo, Stop, replay and cancelled startup: pass in isolated lifecycle harness
- MCP tool compatibility, identity check, source route and identical standalone/in-chat HTML: pass

## Normal frontend browser QA

Passed on 2026-10-05 in the cloud Chromium browser, against the authenticated private production Site. The owner signed in through normal OpenAI login and authenticator verification; Site access controls were unchanged.

- Normal instrument page loads under the owner identity
- Play initializes official SuperDough AudioWorklets and Cyclist; the live analyser visibly shows nonzero waveform output, with an advancing bar/beat counter
- Repeated Play does not restart or duplicate the transport
- Warm pad, FM bell, driven bass and evolving arpeggio presets load; live preset/timbre/note edits retain running transport
- Invalid note syntax shows a useful error while preserving the playing patch; valid replacement clears the error
- Stop and Panic halt the transport; immediate restart works
- Device-local Save, browser reload and saved-patch recall preserve edited notes and cutoff; reload never autoplays
- JSON Export and Import round-trip restores the edited patch after loading a different factory preset
- Responsive layout checked at 200% zoom and 388 CSS-pixel width (300% zoom); document scrollWidth equals clientWidth, with no horizontal overflow
- No instrument runtime errors found in captured browser console; unrelated extension/auth telemetry messages are excluded

Browser testing verifies UI behavior, worklet initialization and visible audio-analysis output. It does not constitute subjective audible listening or confirmation on the user's audio hardware, mobile Safari, Android, or the in-chat host's separate CSP.

A minor QA finding (5 ms attack and 350 ms release rounding inconsistently in sliders/readouts) was corrected. Attack/release sliders retain millisecond precision, and subsecond labels use milliseconds.

Earlier portable preview was inaccessible from the cloud browser. Testing ultimately used the deployed private Site with normal user authentication, not an access bypass.
