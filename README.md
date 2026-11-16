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
