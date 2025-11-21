# KAP - Future Improvements

## High Priority

### Audio/Video Sync in Session Recording
- **Issue**: Video playback is slower than audio, causing drift over time
- **Cause**: Browser MediaRecorder clock drift between video and audio tracks during encoding
- **Attempted fixes**: Separate streams, canvas capture, various codecs - none resolved the issue
- **Workaround**: Currently using playback delay offset, but drift still occurs
- **Solution**: May require server-side muxing with ffmpeg, or accepting as a known limitation

### Filler Word Detection
- **Issue**: Web Speech API filters out hesitation sounds (um, uh, er, ah) before returning transcript
- **Impact**: Cannot measure verbal disfluencies which are important indicators of uncertainty/nervousness
- **Solution**: Integrate a speech API that supports disfluency detection:
  - Google Cloud Speech-to-Text (with `enable_automatic_punctuation` and disfluency options)
  - AssemblyAI (has built-in filler word detection)
  - Deepgram (supports disfluencies)
- **Note**: These are paid services - need to evaluate cost vs benefit

## Medium Priority

### Sentiment Analysis Calibration
- Current facial/behavioral confidence scoring is generic
- Per-user baseline calibration would improve accuracy
- Consider adding a calibration phase at session start

### Speech Pace Analysis
- Add detection of pauses/hesitations between words
- Track speaking rhythm consistency

### Question Style for Non-CV Documents
- Currently question styles only appear for CV/Job Description
- Could be useful for study materials too (e.g., "comprehension" vs "recall" questions)

## Low Priority

### Export Results
- Allow users to download session results as PDF/CSV

### Session History
- Store past sessions for progress tracking over time
- Compare performance across multiple sessions

### Voice Selection
- Allow users to choose from available TTS voices
- Remember preference across sessions
