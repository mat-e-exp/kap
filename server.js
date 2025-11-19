require('dotenv').config();
const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname)));

// Initialize Anthropic client
const anthropic = new Anthropic();

// Analyze document endpoint
app.post('/api/analyze-document', async (req, res) => {
    try {
        const { document } = req.body;

        if (!document || document.trim() === '') {
            return res.json({
                type: 'Unknown',
                context: 'No document provided',
                subject: ''
            });
        }

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 500,
            messages: [
                {
                    role: 'user',
                    content: `Analyze this document and identify what type it is and what knowledge areas it covers.

Document:
${document.substring(0, 3000)}

Respond in this exact JSON format:
{
    "type": "<one of: Job Description, CV/Resume, Study Material, Technical Documentation, Research Paper, Article, Other>",
    "context": "<brief 1-2 sentence description of what this document is about>",
    "subject": "<the main subject/topic area for generating test questions, e.g. 'React Development', 'Data Analysis', 'Machine Learning'>"
}

Only return the JSON, nothing else.`
                }
            ]
        });

        const content = response.content[0].text;

        let analysis;
        try {
            analysis = JSON.parse(content);
        } catch (e) {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                analysis = JSON.parse(jsonMatch[0]);
            } else {
                analysis = {
                    type: 'Unknown',
                    context: 'Could not analyze document',
                    subject: ''
                };
            }
        }

        res.json(analysis);
    } catch (error) {
        console.error('Document analysis error:', error);
        res.status(500).json({
            type: 'Error',
            context: 'Failed to analyze document',
            subject: ''
        });
    }
});

// Suggest topics endpoint
app.post('/api/suggest-topics', async (req, res) => {
    try {
        const { subject } = req.body;

        if (!subject || subject.trim() === '') {
            return res.json({ suggestions: [] });
        }

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 300,
            messages: [
                {
                    role: 'user',
                    content: `Given the subject "${subject}", suggest 4-5 specific topics within this field that would be good for interview questions or knowledge testing.

Return ONLY a JSON array of topic strings, no other text:
["Topic 1", "Topic 2", "Topic 3", "Topic 4", "Topic 5"]

Make topics specific and testable. For example:
- "JavaScript" → ["Closures & Scope", "Async/Await & Promises", "Prototypes & Inheritance", "Event Loop", "ES6+ Features"]
- "Cardiology" → ["Heart Failure Management", "Arrhythmia Recognition", "Coronary Artery Disease", "Valvular Heart Disease", "ECG Interpretation"]`
                }
            ]
        });

        const content = response.content[0].text;

        let suggestions;
        try {
            suggestions = JSON.parse(content);
        } catch (e) {
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                suggestions = JSON.parse(jsonMatch[0]);
            } else {
                suggestions = [];
            }
        }

        res.json({ suggestions });
    } catch (error) {
        console.error('Suggest topics error:', error);
        res.status(500).json({ suggestions: [] });
    }
});

// Generate questions endpoint
app.post('/api/generate-questions', async (req, res) => {
    try {
        const { subject, difficulty, count, documentContext } = req.body;
        const questionCount = count || 5;

        const difficultyDescriptions = {
            '1': 'beginner level - basic terminology and simple concepts',
            '2': 'junior developer level - fundamental concepts and common practices',
            '3': 'mid-level developer - practical application and deeper understanding',
            '4': 'senior developer level - advanced concepts and architectural decisions',
            '5': 'expert level - complex scenarios, trade-offs, and edge cases'
        };

        const subjectName = subject;
        const difficultyDesc = difficultyDescriptions[difficulty] || difficultyDescriptions['3'];

        // Build prompt with optional document context
        let promptContent = `Generate ${questionCount} questions for: ${subjectName}

Difficulty: ${difficultyDesc}`;

        if (documentContext) {
            promptContent += `

This is based on a ${documentContext.type}. Generate questions that test knowledge relevant to this specific document:

Document excerpt:
${documentContext.text}

Generate questions that would test someone's competency for the skills/knowledge described in this document.`;
        }

        promptContent += `

CRITICAL Requirements:
- Each question must be answerable in ONE SENTENCE (15-30 words max answer)
- Ask about ONE specific thing per question, not multiple concepts
- Questions should be direct and focused
- No compound questions or multi-part questions

Examples of GOOD questions (single focus):
- "What is the purpose of the virtual keyword in C++?"
- "What does the GROUP BY clause do in SQL?"
- "What is the time complexity of binary search?"

Examples of BAD questions (too complex):
- "Explain the differences between abstract classes and interfaces, and when would you use each?"
- "What are microservices, how do they communicate, and what are the pros and cons?"

Return ONLY a JSON array of ${questionCount} question strings, no other text:
["Question 1?", "Question 2?", ...]`;

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: questionCount > 10 ? 1500 : 800,
            messages: [
                {
                    role: 'user',
                    content: promptContent
                }
            ]
        });

        const content = response.content[0].text;

        // Parse JSON from response
        let questions;
        try {
            questions = JSON.parse(content);
        } catch (e) {
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                questions = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Could not parse questions');
            }
        }

        res.json({ questions });
    } catch (error) {
        console.error('Question generation error:', error);
        res.status(500).json({
            questions: [
                'What is your experience with this subject area?',
                'Can you explain a key concept in this field?',
                'What are common best practices?',
                'How would you approach a typical problem?',
                'What tools or technologies do you prefer?'
            ]
        });
    }
});

// Evaluate answer endpoint
app.post('/api/evaluate', async (req, res) => {
    try {
        const { question, answer, difficulty } = req.body;

        if (!answer || answer.trim() === '' || answer === 'Your response will appear here...') {
            return res.json({
                score: 0,
                feedback: 'No answer provided',
                correct: false
            });
        }

        const difficultyExpectations = {
            '1': 'This is a BEGINNER level question. Accept basic, simple answers that show fundamental understanding. Do not expect technical depth or nuance.',
            '2': 'This is a JUNIOR level question. Accept straightforward answers that demonstrate core concepts. Some technical terminology expected but not deep expertise.',
            '3': 'This is a MID-LEVEL question. Expect practical understanding and reasonable technical depth. Should demonstrate working knowledge.',
            '4': 'This is a SENIOR level question. Expect comprehensive answers with good technical depth, awareness of trade-offs, and practical experience.',
            '5': 'This is an EXPERT level question. Expect sophisticated answers demonstrating deep expertise, nuanced understanding of edge cases, and architectural insight.'
        };

        const expectation = difficultyExpectations[difficulty] || difficultyExpectations['3'];

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 500,
            messages: [
                {
                    role: 'user',
                    content: `You are evaluating a technical interview answer. Be fair but rigorous.

${expectation}

Question: ${question}

Candidate's Answer: ${answer}

Evaluate the answer APPROPRIATE TO THE DIFFICULTY LEVEL and respond in this exact JSON format:
{
    "score": <number 0-100>,
    "correct": <boolean>,
    "feedback": "<brief 1-2 sentence feedback>"
}

Scoring guide (adjust expectations based on difficulty level):
- 80-100: Correct and appropriate for the level
- 60-79: Mostly correct, minor issues for this level
- 40-59: Partially correct, gaps for this level
- 20-39: Shows some understanding but insufficient for this level
- 0-19: Incorrect or no understanding shown

Only return the JSON, nothing else.`
                }
            ]
        });

        const content = response.content[0].text;

        // Parse JSON from response
        let evaluation;
        try {
            evaluation = JSON.parse(content);
        } catch (e) {
            // Try to extract JSON if there's extra text
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                evaluation = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Could not parse evaluation response');
            }
        }

        res.json(evaluation);
    } catch (error) {
        console.error('Evaluation error:', error);
        res.status(500).json({
            score: 50,
            feedback: 'Could not evaluate answer',
            correct: false
        });
    }
});

// Load SSL certificates
const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
};

// Start HTTPS server
const PORT = 3075;
https.createServer(sslOptions, app).listen(PORT, () => {
    console.log(`Server running at https://localhost:${PORT}`);
});
