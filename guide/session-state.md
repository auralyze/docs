# Session State & Schemas

The entire engine revolves around a strongly typed `EngineState`. Schemas live in `src/state.ts` and are exported for consumers.

## EngineState summary

```ts
export interface EngineState {
  sessionId: string;
  uploadUrl?: string;
  fileInfo?: FileInfo;
  analysis?: Analysis;
  userContext?: UserContext;
  feedbackText?: string;
  suggestions?: string[];
  error?: string;
}
```

### FileInfo

| Field         | Type     | Notes                             |
| ------------- | -------- | --------------------------------- |
| `durationSec` | `number` | Seconds.                          |
| `format`      | `string` | Codec/container (wav, flac, mp3). |
| `sampleRate`  | `number` | Hertz.                            |
| `channels`    | `number` | Channel count.                    |
| `bitrate?`    | `number` | Optional for lossy uploads.       |

### Analysis block

Each sub-object is optional to keep backward compatibility. Populate whichever metrics your DSP service emits.

- **Loudness** – `integratedLUFS`, `truePeak`, `loudnessRange`.
- **Dynamics** – `crestFactor`.
- **Spectrum** – `low`, `mids`, `highs` representing relative energy/imbalance.
- **Stereo** – `widthScore` normalized 0–1.

### User context

`daw`, `genre`, and `experienceLevel` (enum `beginner | intermediate | advanced`) give the feedback client situational clues. All optional.

## Validation helpers

The exported Zod schemas (`EngineStateSchema`, `FileInfoSchema`, `AnalysisSchema`, etc.) let you validate inbound state or persisted payloads:

```ts
import { EngineStateSchema } from '@auralyze/engine';

const parsed = EngineStateSchema.parse(payloadFromDb);
```

## Common extension points

1. **New analysis node** – add a property under `AnalysisSchema` (e.g., `transients`), update state type, expose TypeScript export, and extend the DSP client contract.
2. **User metadata** – append optional keys to `UserContextSchema` with defaults to avoid breaking older sessions.
3. **Derived fields** – compute them inside the `finalize` node so you never mutate state mid-run.

Treat the schema as the shared protocol between services; any change should be versioned and documented.
