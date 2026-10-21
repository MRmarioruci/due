// The whole film: the scenes back to back over the soundtrack.
import { Audio } from "@remotion/media";
import { AbsoluteFill, interpolate, Series, staticFile, useVideoConfig } from "remotion";
import { SCENE_COMPONENTS } from "./scenes";
import { BEAT, C, FPS, MUSIC_START, SCENES } from "./theme";

/** `music: false` renders the film with its sound effects only. */
export const Film: React.FC<{ music?: boolean }> = ({ music = true }) => {
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Series>
        {SCENES.map(({ id, beats }) => {
          const Scene = SCENE_COMPONENTS[id];
          return (
            <Series.Sequence key={id} name={id} durationInFrames={beats * BEAT}>
              <Scene />
            </Series.Sequence>
          );
        })}
      </Series>
      {music && (
        <Audio
          src={staticFile("music.mp3")}
          trimBefore={Math.round(MUSIC_START * FPS)}
          volume={(f) => interpolate(f, [0, 3, durationInFrames - 30, durationInFrames], [0, 0.9, 0.9, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
        />
      )}
    </AbsoluteFill>
  );
};
