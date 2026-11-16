# CWSimulator

Multiplatform browser-based CW simulator. Initial milestone: USB paddle diagnostics and experimental iambic keyer.

## Run

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Open the localhost URL shown by Vite in Chrome or Edge on Windows 11 or Linux. Run `npm run build` for a production build.

## Current features

- React + TypeScript + Vite.
- Virtual transceiver controls, adjustable WPM, pitch and sidetone volume.
- Keyboard paddle emulation: Z = dit, X = dah (also left/right Control).
- On-screen dit/dah controls, event log and experimental CW decoding.
- Web Serial and WebHID device selection and USB VID/PID inspection.
- QSB/QRN sliders as **placeholders only**; not yet connected to DSP.

## Important hardware limitations

Selecting a serial or HID device does **not** yet decode its reports or activate the paddle. The adapter protocol must first be identified. Do not assume a generic USB-C-to-jack adapter is a keyboard, serial keyer or WinKeyer.

The keyer is experimental: iambic mode A/B behavior, memory, release timing, sidetone latency and decoding need further development and physical testing. No real QSOs or propagation audio are implemented yet.

Browser hardware APIs require user permission, supported browsers and secure contexts (localhost or HTTPS). Linux may additionally require device permissions. Some USB devices require a local bridge application; adapter-specific drivers should be implemented behind a common interface.

## Roadmap

1. Identify USB adapter VID/PID and actual event protocol.
2. Implement adapter drivers and keyer timing tests.
3. Build receiver DSP with QRN/QSB/QRM.
4. Add deterministic virtual-station QSO engine and logging.
5. Add optional free-form AI operator and contests.

No RF transmission is performed.


## Hardware-independent input architecture (design requirement)

CWSimulator MUST NOT hardcode vendor IDs, product IDs, key mappings or serial protocols in the CW engine.

- `InputAdapter` interface emits normalized `dit-down`, `dit-up`, `dah-down`, `dah-up` events with monotonic timestamps.
- Pluggable adapters: configurable keyboard event mapping, WebHID report/bit mapping, Web Serial protocol parsers, and optional WinKeyer protocol adapter.
- Device profiles store transport, mapping, polarity, paddle swap, iambic mode, timing, and optional VID/PID for identification (not a requirement to connect).
- Profile management: create, rename, import/export JSON, persist in localStorage or IndexedDB; do not persist device permissions as though they were guaranteed.
- Calibration wizard: press each lever and capture reports; for arbitrary HID/serial protocols, manual mapping or protocol-specific plugins may still be required.
- All adapters feed the same keyer and decoder; audio and QSO logic never import a specific device driver.
- Browser limitations: HID and Serial require permission and browser support; Linux device access may need OS permissions. A local bridge is a fallback for unsupported devices.
- Hardware timestamps and keyer buffering should be used where available to minimize browser scheduling jitter.

This is a design requirement, **not yet implemented** in v0.1. The current keyboard mapping remains hardcoded and USB selection is identification-only.

## Next milestone: receive a virtual station (prototype)

The decoder now recognizes word spaces after seven dot units of silence, while letters are finalized after three units. The new virtual-station panel plays an editable CQ message as scheduled CW audio. This is a listening exercise, **not yet an interactive QSO**: the station does not decode your answer or react to it. HF noise/fading sliders are still placeholders.

## CW Academy (early prototype)

The Academy offers Koch-style progressive character sets, five-character listening drills, paddle transmission drills, and independently adjustable character and effective speeds (Farnsworth spacing). Listening drills deliberately hide Morse dot/dash patterns. Answers are checked by character position, with simple session counters. Lesson progression is manual for now; persistent progress, adaptive review, timed performance analytics, and rigorous iambic timing feedback are future work. The training module has not yet been hardware-tested or build-verified.

## Academy charts, tone and appearance

The Academy has an independent listening pitch slider (350–1000 Hz), a tone preview, a line chart for the latest 24 scored exercises, and a bar view of characters receiving extra adaptive practice. The app now offers three locally persisted color schemes: Paper (default), Slate and Sand. Training pitch is separate from the station sidetone. These features have been committed but are awaiting local build and browser validation.
