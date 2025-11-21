# KAP - Knowledge Assessment Platform

**BETA** - Sentiment and facial analysis features are experimental and may not be accurate.

AI-powered Q&A practice tool for exams, interviews, or general knowledge. Generates questions for any subject or document, evaluates spoken answers, and tracks confidence through facial and behavioral analysis.

## Use Cases

- **Job Interview Prep** - Paste a job description and practice answering questions about the required skills
- **Technical Interview Training** - Test yourself on React, Python, SQL, or any technology at your experience level
- **Behavioural Interview Practice** - Practice STAR method responses with tailored behavioural questions
- **Management Interviews** - Prepare for leadership and management style questions
- **Exam Revision** - Paste study notes and generate questions to test your understanding
- **CV Gap Analysis** - Upload your CV and identify areas where you need to strengthen your knowledge
- **Professional Certification** - Practice for AWS, PMP, medical boards, or legal bar exams
- **Language Learning** - Test vocabulary, grammar, or cultural knowledge at different proficiency levels
- **Self-Awareness** - See how you appear when answering questions (expressions, confidence, stress)

## Features

- **Flexible Input** - Enter any subject or paste a document (job description, CV, study material)
- **Auto-Detection** - Automatically identifies document type and extracts relevant topics
- **Question Styles** - For CV/JD: Technical, Behavioural (STAR), Situational, Management, Competency, or Mixed
- **Difficulty Levels** - 5 levels from Beginner to Expert with evaluation tolerance adjusted accordingly
- **Text-to-Speech** - Questions read aloud (optional)
- **Voice Response** - Speak your answers using Web Speech API
- **Session Recording** - Record video/audio for playback in results (optional)
- **Real-time Analysis** - Confidence and stress metrics from facial expressions and behavior
- **Detailed Results** - Per-question breakdown with scores, feedback, and observations

## Observations

**Note:** Observations are experimental. These are raw metrics for your own interpretation, not predictions of confidence or performance.

During each question, the app records visual and speech metrics:

**Visual Observations:**
- **Expression** - Dominant facial expression detected (neutral, happy, sad, angry, fearful, surprised)
- **Confidence %** - Calculated from facial expressions and behavior
- **Stress %** - Calculated from facial expressions and behavior
- **Gaze Stability** - How centered your eyes remain
- **Time** - Duration to answer each question

**Speech Observations:**
- **Word Count** - Total words in your answer
- **WPM** - Words per minute (speaking pace)
- **Summary** - Brief description of response length and pace

These metrics let you spot your own patterns over multiple sessions. The app does not interpret what they mean - you draw your own conclusions.

## Requirements

- Node.js
- Anthropic API key
- Modern browser with camera/microphone support (Chrome recommended)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file with your Anthropic API key:
```
ANTHROPIC_API_KEY=your-key-here
```

3. Generate SSL certificates (required for camera/mic access):
```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

4. Start the server:
```bash
npm start
```

5. Open https://localhost:3075 in your browser

## How It Works

1. **Choose Input Method**
   - **Subject Tab**: Enter any topic (e.g., "React", "Contract Law", "Cardiology")
   - **Document Tab**: Paste job description, CV, or study material

2. **Configure Session**
   - Select difficulty level (1-5)
   - Choose number of questions (1-20)
   - For CV/JD: Select question style (Technical, Behavioural, Situational, Management, Competency, Mixed)
   - Toggle "Read questions aloud" (optional)
   - Toggle "Record session for playback" (optional)

3. **Answer Questions**
   - Questions appear one at a time (optionally read aloud)
   - Speak your answer (displayed as transcript)
   - Reset if needed, then move to next question

4. **Review Results**
   - Overall score
   - Per-question feedback and scores
   - Observations (confidence, stress, expression, speech metrics)
   - Session recording playback (if enabled)

## Architecture

```
+-------------------------------------------------------------+
|                        BROWSER                               |
+-------------------------------------------------------------+
|                                                              |
|  +-------------+  +-------------+  +-------------+           |
|  |   Camera    |  |  Microphone |  |   app.js    |           |
|  +------+------+  +------+------+  +------+------+           |
|         |                |                |                  |
|         v                v                |                  |
|  +-------------+  +-------------+         |                  |
|  | face-api.js |  | Web Speech  |         |                  |
|  | (emotions)  |  |    API      |         |                  |
|  +------+------+  | (STT + TTS) |         |                  |
|         |         +------+------+         |                  |
|         v                |                |                  |
|  +-------------+         |                |                  |
|  |  MediaPipe  |         |                |                  |
|  |  Face Mesh  |         |                |                  |
|  |  (behavior) |         |                |                  |
|  +------+------+         |                |                  |
|         |                |                |                  |
|         +--------+-------+----------------+                  |
|                  |                                           |
|                  v                                           |
|         +---------------+                                    |
|         |   Metrics &   |                                    |
|         |   Responses   |                                    |
|         +-------+-------+                                    |
|                 |                                            |
+-----------------+--------------------------------------------+
                  | HTTPS
                  v
+-------------------------------------------------------------+
|                    EXPRESS SERVER                            |
|                     (server.js)                              |
+-------------------------------------------------------------+
|                                                              |
|  /api/suggest-topics     - Topic suggestions                 |
|  /api/analyze-document   - Document type detection           |
|  /api/generate-questions - Question generation (with styles) |
|  /api/evaluate           - Answer evaluation                 |
|                                                              |
+-----------------------------+-------------------------------+
                              |
                              v
                    +-------------------+
                    |   Anthropic API   |
                    |   (Claude)        |
                    +-------------------+
```

## Tech Stack

- **Frontend**: Vanilla JS, face-api.js, MediaPipe Face Mesh, Web Speech API (STT + TTS)
- **Backend**: Express.js, Anthropic Claude API
- **Analysis**: Emotion detection, gaze tracking, blink rate, head pose

## API Endpoints

- `POST /api/suggest-topics` - Get topic suggestions (includes original subject)
- `POST /api/analyze-document` - Analyze document type
- `POST /api/generate-questions` - Generate assessment questions (supports question styles)
- `POST /api/evaluate` - Evaluate answer correctness (difficulty-aware)

## Known Limitations

- Session recording may have audio/video sync issues due to browser MediaRecorder constraints
- TTS voice quality varies by browser and operating system
- Filler word detection (um, uh, er) not supported - Web Speech API filters these out

## License

MIT
