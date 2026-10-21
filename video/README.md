# due product film

A 43-second product film for due, rendered from code with
[Remotion](https://www.remotion.dev), in 16:9 and 9:16. The app's dark theme,
its type (Archivo, JetBrains Mono) and accent, cut to the beat.

```bash
npm install              # once
npm run dev              # preview and scrub in Remotion Studio
npm run render           # out/due-16x9.mp4
npm run render:vertical  # out/due-9x16.mp4
npm run render:all       # both
```

## Layout

- `src/theme.ts`: colours (the app's `DARK` palette), fonts and the beat grid.
  The track is 100 BPM and the film runs at 25 fps, so one beat is 15 frames;
  `SCENES` gives each scene's length in beats, and the cuts land on the beat.
  `MUSIC_START` is where the film starts in the track, so its drop lands on
  the logo.
- `src/kit.tsx`: the scene shell and its cuts (whip pan, zoom punch, flash),
  camera shake, grain and vignette, the grid, kinetic type (`Slam`, `Words`,
  `Typed`), the logo, the phone, the payment QR, and sound cues.
- `src/scenes.tsx`: the nine scenes. Each is also its own composition
  (`Scan-16x9`, `Scan-9x16`, …) for previewing alone.

## Sound

- `public/music.mp3` is not in git. It is "Product Launch" by lnplusmusic,
  from Pixabay (pixabay.com/music/product-product-launch-611921), used under
  the Pixabay Content License: download it and save it there before rendering.
  A different track means new values for the beat and `MUSIC_START` in
  `src/theme.ts`.
- `public/sfx/` is the set the Sekkei films use: Kenney's Interface Sounds
  (CC0, see `KENNEY-LICENSE.txt`), Remotion's sample effects, and Sekkei's
  synthesized risers, impacts and subs.
