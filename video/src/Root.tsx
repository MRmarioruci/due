import { Composition, Folder } from "remotion";
import { Film } from "./Film";
import { SCENE_COMPONENTS } from "./scenes";
import { BEAT, DURATION, FPS, SCENES } from "./theme";

const FORMATS = [
  { id: "16x9", width: 1920, height: 1080 },
  { id: "9x16", width: 1080, height: 1920 },
] as const;

export const RemotionRoot: React.FC = () => (
  <>
    {FORMATS.map((f) => (
      <Composition key={f.id} id={`Film${f.id}`} component={Film} width={f.width} height={f.height} fps={FPS} durationInFrames={DURATION} />
    ))}
    {FORMATS.map((f) => (
      <Folder key={f.id} name={`Scenes-${f.id}`}>
        {SCENES.map(({ id, beats }) => (
          <Composition key={id} id={`${id}-${f.id}`} component={SCENE_COMPONENTS[id]} width={f.width} height={f.height} fps={FPS} durationInFrames={beats * BEAT} />
        ))}
      </Folder>
    ))}
  </>
);
