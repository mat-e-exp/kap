# KAP - Knowledge Assessment Platform

**⚠️ BETA** - Sentiment and facial analysis features are experimental and may not be accurate.

AI-powered knowledge assessment tool that generates questions for any subject, evaluates spoken answers, and tracks confidence through facial and behavioral analysis.

## Use Cases

- **Job Interview Prep** - Paste a job description and practice answering questions about the required skills
- **Technical Interview Training** - Test yourself on React, Python, SQL, or any technology at your experience level
- **Exam Revision** - Paste study notes and generate questions to test your understanding
- **CV Gap Analysis** - Upload your CV and identify areas where you need to strengthen your knowledge
- **Professional Certification** - Practice for AWS, PMP, medical boards, or legal bar exams
- **Language Learning** - Test vocabulary, grammar, or cultural knowledge at different proficiency levels
- **Onboarding Assessment** - Create quick knowledge checks for new team members

## Features

- **Flexible Input** - Enter any subject or paste a document (job description, CV, study material)
- **Auto-Detection** - Automatically identifies document type and extracts relevant topics
- **Difficulty Levels** - 5 levels from Beginner to Expert with evaluation adjusted accordingly
- **Voice Response** - Speak your answers using Web Speech API
- **Real-time Analysis** - Confidence and stress metrics from facial expressions and behavior
- **Detailed Results** - Per-question breakdown with scores, feedback, and sentiment accuracy

## Sentiment Analysis

**Note:** Sentiment analysis is experimental. Results may not accurately reflect your actual confidence or stress levels.

During each question, the app analyzes your facial expressions and behavior to generate sentiment metrics:

**Metrics tracked:**
- **Confidence** - Based on emotions (happy/neutral increase, fearful/sad decrease) and behavior (steady gaze, minimal head movement)
- **Stress** - Based on emotions (fearful/surprised/angry) and behavior (blink rate, gaze instability, lip tension)
- **Dominant Emotion** - Most prominent expression (neutral, happy, sad, angry, fearful, surprised)
- **Gaze Stability** - How centered your eyes remain
- **Blink Rate** - Number of blinks during your answer
- **Time** - Duration to answer each question

**Sentiment Accuracy:**
Results show whether your sentiment predicted answer correctness:
- **Match** - Seemed confident and was correct, or seemed uncertain and was incorrect
- **Mismatch** - Seemed confident but wrong, or seemed uncertain but correct

This helps identify when you may be overconfident in wrong answers or underselling correct knowledge.

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

3. **Answer Questions**
   - Questions appear one at a time
   - Speak your answer (displayed as transcript)
   - Reset if needed, then move to next question

4. **Review Results**
   - Overall score
   - Per-question feedback and scores
   - Sentiment analysis (confidence, stress, expression)
   - Accuracy of sentiment predictions

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Camera     │  │  Microphone  │  │   app.js     │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │                │
│         ▼                 ▼                 │                │
│  ┌──────────────┐  ┌──────────────┐         │                │
│  │  face-api.js │  │ Web Speech   │         │                │
│  │  (emotions)  │  │    API       │         │                │
│  └──────┬───────┘  │ (transcript) │         │                │
│         │          └──────┬───────┘         │                │
│         ▼                 │                 │                │
│  ┌──────────────┐         │                 │                │
│  │  MediaPipe   │         │                 │                │
│  │  Face Mesh   │         │                 │                │
│  │  (behavior)  │         │                 │                │
│  └──────┬───────┘         │                 │                │
│         │                 │                 │                │
│         └────────┬────────┴─────────────────┘                │
│                  │                                           │
│                  ▼                                           │
│         ┌───────────────┐                                    │
│         │   Metrics &   │                                    │
│         │   Responses   │                                    │
│         └───────┬───────┘                                    │
│                 │                                            │
└─────────────────┼────────────────────────────────────────────┘
                  │ HTTPS
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    EXPRESS SERVER                            │
│                     (server.js)                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  /api/suggest-topics     - Topic suggestions                 │
│  /api/analyze-document   - Document type detection           │
│  /api/generate-questions - Question generation               │
│  /api/evaluate           - Answer evaluation                 │
│                                                              │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │   Anthropic API   │
                    │   (Claude)        │
                    └───────────────────┘
```

## Tech Stack

- **Frontend**: Vanilla JS, face-api.js, MediaPipe Face Mesh
- **Backend**: Express.js, Anthropic Claude API
- **Analysis**: Emotion detection, gaze tracking, blink rate, head pose

## API Endpoints

- `POST /api/suggest-topics` - Get topic suggestions
- `POST /api/analyze-document` - Analyze document type
- `POST /api/generate-questions` - Generate assessment questions
- `POST /api/evaluate` - Evaluate answer correctness

## License

MIT
