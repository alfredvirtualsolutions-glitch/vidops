# Beat-synced wildlife reel

- [x] Repair `ANIM.wav` (raw AAC in WAV) and ship as `public/audio/anim.flac`
- [x] Derive bar-aligned cut list -> `public/audio/anim.beats.json` (`scripts/beat_sync_audio.py`)
- [x] Add five clips under `public/clips/wildlife/`, new `wildlife` reel type
- [x] `buildBeatSyncedClips` + `startFromInSeconds` / `zoom` / `fadeOutSeconds` on the composition
- [x] "Beat-sync to ANIM track" button on Screen 5
- [x] Fix `npm run render`: `@/` alias in `remotion.config.ts`, `staticFile()` for `/public` paths
- [x] Verify: `tsc --noEmit`; two Remotion slices rendered; cuts land on the beat map (60.87 s, 63.3 s);
      audio aligned to 60.000 s in a lossless render; end fade reaches black/silence
- [ ] Full 141 s Remotion render not run (slice checks only)

## Notes
- `npm ci` fails on master: `package-lock.json` (next 15.5.27) is out of sync with `package.json` (next 15.1.6). Not touched here.
- Beat strength at cuts is only slightly above random (0.64 vs 0.53): the track has a soft pulse, so sync follows the bar grid, not sharp hits.
