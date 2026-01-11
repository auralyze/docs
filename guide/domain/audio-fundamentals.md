# Audio Fundamentals

This guide covers the essential audio engineering concepts that power MixtapeLabs's analysis and feedback capabilities.

## Loudness Metering (EBU R128 Standard)

### Integrated LUFS (Loudness Units Full Scale)

LUFS is the perceived loudness measurement standard used across broadcast and streaming platforms. Unlike peak-based measurements, LUFS accounts for how humans actually perceive loudness.

**Platform Targets:**
- **Broadcast (TV/Radio):** -23 LUFS
- **Spotify/Apple Music:** -14 LUFS
- **YouTube:** -13 to -15 LUFS
- **Soundcloud:** -8 to -13 LUFS

**Technical Implementation:**
- Uses K-weighting frequency filter (mimics human hearing sensitivity)
- Temporal integration over the entire audio file
- Based on ITU-R BS.1770-4 specification
- Implemented via `pyloudnorm` Python library in the analysis service

::: tip Why LUFS Matters
Streaming platforms normalize audio to their target loudness. If your mix is too loud (e.g., -6 LUFS when target is -14 LUFS), it will be turned down by 8 dB, making all that hard limiting effort pointless. Understanding LUFS helps engineers optimize for the final delivery format.
:::

### True Peak (dBTP)

True peak measures the absolute maximum sample value, accounting for **inter-sample peaks** that occur between digital samples during analog reconstruction.

**Key Characteristics:**
- Measured in dBTP (decibels True Peak)
- Recommended maximum: **-1 dBTP** to prevent clipping on DACs
- Calculated after 4x oversampling to detect peaks between samples
- Critical for preventing distortion in lossy encoding (MP3, AAC)

::: warning Inter-Sample Peaks
Digital audio can have peaks between samples that exceed the 0 dBFS limit when converted back to analog. These inter-sample peaks can cause distortion in downstream converters. Always check true peak, not just sample peak!
:::

### Loudness Range (LU)

Loudness Range quantifies the dynamic range of audio content in Loudness Units.

**Typical Ranges:**
- **Classical music:** 15-25 LU (high dynamics, minimal compression)
- **Rock/Pop:** 6-12 LU (moderate compression)
- **EDM/Hip-Hop:** 4-8 LU (heavy compression for consistent energy)

Higher values indicate more dynamic variation (soft passages vs loud sections). Lower values indicate heavy compression or limiting.

## Dynamics Analysis

### Crest Factor

Crest factor measures the ratio between the peak amplitude and the RMS (average) level of a signal.

**Formula:**
```
Crest Factor (dB) = 20 × log₁₀(Peak / RMS)
```

**Typical Values:**
- **6-8 dB:** Heavily compressed mix (brick-walled, loud everywhere)
- **8-12 dB:** Balanced mix (punchy but dynamic)
- **12-20 dB:** Very dynamic content (classical, jazz, acoustic)

::: tip Reading Crest Factor
Lower crest factor = more consistent loudness (heavy compression/limiting)
Higher crest factor = more dynamic variation (transients preserved)
:::

### RMS (Root Mean Square)

RMS measures the average signal level over time, which correlates strongly to perceived loudness.

**Characteristics:**
- Computed over sliding time windows (typically 300-400ms)
- Better loudness predictor than peak measurements
- Used for calculating crest factor and relative loudness
- Expressed in dB relative to full scale (dBFS)

## Frequency Spectrum Analysis

### Frequency Band Distribution

Audio is divided into three main bands, each serving distinct musical roles:

#### Low Frequencies (20-250 Hz)
**Musical Elements:** Bass guitar, kick drum, sub-bass synths, floor toms

**Balance Issues:**
- **Too much:** Muddy, boomy, lacks clarity
- **Too little:** Thin, weak, lacking weight and foundation
- **Sweet spot:** Provides warmth and power without clouding mids

#### Mid Frequencies (250-2000 Hz)
**Musical Elements:** Vocals, guitars, snare drum, piano body, most melodic content

**Balance Issues:**
- **Too much:** Boxy, nasal, honky, fatiguing
- **Too little:** Hollow, distant, lacks presence
- **Sweet spot:** Forward, clear, defined without harshness

#### High Frequencies (2000-20000 Hz)
**Musical Elements:** Cymbals, hi-hats, vocal sibilance, "air" and "sparkle"

**Balance Issues:**
- **Too much:** Harsh, sibilant, brittle, ear-fatiguing
- **Too little:** Dull, muffled, lacks clarity and definition
- **Sweet spot:** Crisp, clear, open without harshness

### FFT (Fast Fourier Transform)

FFT converts time-domain audio signals into frequency-domain representations, revealing the energy distribution across the frequency spectrum.

**Window Size Trade-offs:**
- **Larger windows:** Better frequency resolution, worse time resolution
- **Smaller windows:** Better time resolution, worse frequency resolution
- **Common window functions:** Hann, Hamming (reduce spectral leakage artifacts)

**Implementation in Mixtape:**
The analysis service computes RMS energy per frequency band and expresses it in dB relative to a reference level. This is compared across bands to assess frequency balance.

## Stereo Imaging

### Stereo Width Score

Stereo width quantifies how "wide" or "spacious" a mix sounds, measured on a 0 to 1+ scale.

**Score Interpretation:**
- **0.0:** Mono (no stereo separation, everything centered)
- **0.5:** Moderate stereo (typical for lead vocals, centered elements)
- **0.7-0.9:** Wide stereo (typical for full mixes with panned instruments)
- **1.0+:** Extreme width (may indicate phase issues, poor mono compatibility)

::: warning Mono Compatibility
Always check how your mix sounds in mono. Extreme stereo width (>1.0) can cause phase cancellation when summed to mono, resulting in disappearing instruments or a thin sound. Radio, mobile speakers, and some streaming platforms still use mono playback.
:::

### Mid/Side Processing

Mid/Side (M/S) processing separates the mono (center) content from the stereo (sides) content:

**Formulas:**
```
Mid (M) = (L + R) / 2    // Center/mono content
Side (S) = (L - R) / 2   // Stereo/width content
```

**Width Calculation:**
```
Stereo Width = Side Energy / Mid Energy
```

**Applications:**
- Widening the stereo image by boosting sides
- Cleaning up low frequencies in the center (mid)
- Independent EQ for center vs sides (e.g., brighten sides only)

### Correlation Coefficient

The correlation coefficient measures the phase relationship between left and right channels:

- **+1.0:** Perfectly in phase (mono, no stereo separation)
- **0.0:** Uncorrelated (wide stereo, good separation)
- **-1.0:** Perfectly out of phase (phase problems, mono incompatible)

::: danger Phase Issues
A correlation coefficient approaching -1.0 indicates serious phase problems. When summed to mono, these signals will cancel out, causing instruments to disappear or sound thin. This is a critical mix issue that requires investigation.
:::

## Audio File Metadata

The metadata service extracts technical file information using `ffprobe`:

- **Duration:** Total length in seconds
- **Format:** File container (WAV, MP3, FLAC, etc.)
- **Sample Rate:** Samples per second (44.1kHz, 48kHz, 96kHz)
- **Channels:** Mono (1), Stereo (2), Surround (5.1, 7.1)
- **Bitrate:** Data rate in kbps (lossy formats only)

**Processing Time:** 1-3 seconds (includes download + ffprobe execution)

## Further Reading

- [EBU R128 Specification](https://tech.ebu.ch/docs/r/r128.pdf) - Official loudness standard
- [ITU-R BS.1770-4](https://www.itu.int/rec/R-REC-BS.1770/) - Loudness measurement algorithms
- [Loudness Penalty](https://www.loudnesspenalty.com/) - Platform-specific loudness analysis tool
- [pyloudnorm Documentation](https://github.com/csteinmetz1/pyloudnorm) - Python implementation used by Mixtape
