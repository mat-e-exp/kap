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

### API Cost Optimization
- **Current cost**: ~$0.03 per 10-question session (~3k input tokens, ~1.5k output tokens)
- **Optimization 1 - Prompt Caching** (up to 90% savings):
  - Cache evaluation rules and difficulty descriptions
  - Could reduce evaluation costs to ~$0.002 per question
  - Anthropic Prompt Caching: cached tokens cost 0.1x base price
- **Optimization 2 - Batch API** (50% discount):
  - Process all evaluations as a batch instead of individual calls
  - Would reduce session cost from $0.032 to ~$0.016
  - Trade-off: Async processing adds latency
- **Optimization 3 - Model Selection**:
  - Use Claude Haiku for topic suggestions (20x cheaper)
  - Keep Sonnet 4 only for question generation and evaluation
- **Impact**: Heavy usage (500 sessions/month) would drop from $16 to ~$3-5/month

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
