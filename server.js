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
                    content: `Given the subject "${subject}", suggest 4-5 specific topics within this field that would be good for knowledge assessment.

Return ONLY a JSON array of topic strings, no other text:
["Topic 1", "Topic 2", "Topic 3", "Topic 4", "Topic 5"]

Make topics specific and testable. For example:
- "World War II" → ["European Theatre", "Pacific Theatre", "Key Battles", "Political Leaders", "Home Front"]
- "Cricket" → ["Test Match Rules", "Famous Players", "Historic Series", "Batting Techniques", "Tournament History"]
- "Chemistry" → ["Periodic Table", "Chemical Bonds", "Organic Chemistry", "Reactions", "Laboratory Techniques"]`
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
        const { subject, difficulty, count, documentContext, questionStyle } = req.body;
        const questionCount = count || 5;

        const difficultyDescriptions = {
            '1': 'beginner level - basic terminology and simple concepts',
            '2': 'intermediate level - fundamental concepts and common knowledge',
            '3': 'competent level - practical understanding and deeper knowledge',
            '4': 'advanced level - complex concepts and nuanced understanding',
            '5': 'expert level - sophisticated scenarios, edge cases, and deep expertise'
        };

        const questionStyleConfig = {
            'mixed': {
                description: 'Generate a mix of question types: some technical knowledge, some behavioural (past experiences), and some situational (hypothetical scenarios).',
                examples: `- "What experience do you have with [specific skill from document]?"
- "Tell me about a time you had to learn a new technology quickly."
- "How would you handle a situation where project requirements changed mid-way?"`,
                answerLength: 'Answers may range from one sentence for factual questions to 2-3 sentences for experiential questions.'
            },
            'technical': {
                description: 'Focus ONLY on technical knowledge questions - testing specific skills, tools, methodologies, and domain expertise mentioned in the document.',
                examples: `- "What is the purpose of [specific technology/tool]?"
- "How does [concept] work in practice?"
- "What are the key differences between [technology A] and [technology B]?"`,
                answerLength: 'Each question must be answerable in ONE SENTENCE (15-30 words max answer).'
            },
            'behavioural': {
                description: 'Focus ONLY on behavioural questions using STAR method - asking about PAST experiences. All questions MUST start with phrases like "Tell me about a time when...", "Describe a situation where...", "Give an example of when you..."',
                examples: `- "Tell me about a time when you had to meet a tight deadline."
- "Describe a situation where you had to resolve a conflict with a colleague."
- "Give an example of when you had to adapt to a significant change at work."`,
                answerLength: 'These questions require candidates to describe past experiences, so answers will be 2-4 sentences.'
            },
            'situational': {
                description: 'Focus ONLY on situational judgement questions - presenting HYPOTHETICAL scenarios. All questions MUST start with phrases like "What would you do if...", "How would you handle...", "Imagine you are faced with..."',
                examples: `- "What would you do if a team member was consistently underperforming?"
- "How would you handle a situation where you disagreed with your manager's decision?"
- "Imagine you discover a critical bug the day before launch - what steps would you take?"`,
                answerLength: 'These questions ask about hypothetical responses, so answers will be 2-3 sentences explaining the approach.'
            },
            'management': {
                description: 'Focus ONLY on management and leadership questions - about team leadership, delegation, motivation, conflict resolution, strategic thinking, and people management.',
                examples: `- "How do you approach delegating tasks to team members?"
- "What is your strategy for motivating an underperforming team?"
- "How do you balance competing priorities when managing multiple projects?"`,
                answerLength: 'These questions require explanation of management approach, so answers will be 2-3 sentences.'
            },
            'competency': {
                description: 'Focus ONLY on competency-based questions - directly assessing specific skills and abilities required for the role as mentioned in the document.',
                examples: `- "How have you demonstrated [specific competency] in your previous roles?"
- "What approach do you take to [specific skill area]?"
- "Describe how you would apply [competency] in this role."`,
                answerLength: 'These questions assess specific competencies, so answers will be 1-3 sentences.'
            }
        };

        const subjectName = subject;
        const difficultyDesc = difficultyDescriptions[difficulty] || difficultyDescriptions['3'];

        // Build prompt - structure depends on whether we have a styled CV/JD or not
        let promptContent;

        if (documentContext && questionStyle && questionStyleConfig[questionStyle]) {
            // CV/Job Description with style selected - style is PRIMARY
            const styleConfig = questionStyleConfig[questionStyle];
            const styleNames = {
                'mixed': 'mixed-style interview',
                'technical': 'technical knowledge',
                'behavioural': 'behavioural (STAR method)',
                'situational': 'situational judgement',
                'management': 'management and leadership',
                'competency': 'competency-based'
            };

            promptContent = `Generate ${questionCount} ${styleNames[questionStyle]} questions for interviewing a candidate.

=== QUESTION STYLE (PRIMARY REQUIREMENT - MUST FOLLOW) ===
${styleConfig.description}

${styleConfig.answerLength}

Examples of the EXACT question style required:
${styleConfig.examples}

=== CANDIDATE CONTEXT ===
Use the following ${documentContext.type} as context:

Document:
${documentContext.text}

The candidate's field is: ${subjectName}
Difficulty level: ${difficultyDesc}

Requirements:
- ALL questions MUST match the style described above
- CRITICAL: Each question MUST reference a SPECIFIC skill, technology, experience, or requirement mentioned in the document above
- Do NOT ask generic questions - every question should be tailored to THIS specific document
- Ask about ONE specific thing per question
- Questions should be direct and focused
- No compound questions or multi-part questions

Examples of what to do:
- If CV mentions "5 years React experience" → ask specifically about React
- If JD requires "team leadership" → ask about their leadership experience
- If CV lists "AWS certification" → ask about AWS

Examples of what NOT to do:
- Generic questions like "Tell me about a challenge you faced" without linking to document content
- Questions about skills/technologies not mentioned in the document`;

        } else if (documentContext) {
            // Document without style - default knowledge questions
            promptContent = `Generate ${questionCount} questions specifically about: ${subjectName}

IMPORTANT: All questions must be directly and specifically about "${subjectName}" - not about related topics or the general field.

Difficulty: ${difficultyDesc}

This is based on a ${documentContext.type}. Generate questions that test knowledge relevant to this specific document:

Document excerpt:
${documentContext.text}

Requirements:
- Each question must be answerable in ONE SENTENCE (15-30 words max answer)
- Ask about ONE specific thing per question
- Questions should be direct and focused
- No compound questions or multi-part questions`;

        } else {
            // Subject-only questions (no document)
            promptContent = `Generate ${questionCount} questions specifically about: ${subjectName}

IMPORTANT: All questions must be directly and specifically about "${subjectName}" - not about related topics or the general field.

Difficulty: ${difficultyDesc}

CRITICAL Requirements:
- Each question must be answerable in ONE SENTENCE (15-30 words max answer)
- Ask about ONE specific thing per question, not multiple concepts
- Questions should be direct and focused
- No compound questions or multi-part questions

Examples of GOOD questions (single focus):
- "What year did the Berlin Wall fall?"
- "What is the chemical symbol for gold?"
- "Who wrote Pride and Prejudice?"
- "What is the capital of Australia?"

Examples of BAD questions (too complex):
- "Explain the causes and consequences of World War I and how it led to World War II."
- "Compare and contrast the economic policies of three different countries and their outcomes."`;
        }

        // Add random variation to explore different aspects
        const variationPrompts = [
            'Focus on advanced technical depth and expert-level nuances.',
            'Prioritize practical real-world challenges and implementation experience.',
            'Explore edge cases, troubleshooting scenarios, and problem-solving.',
            'Focus on architectural decisions, design patterns, and trade-offs.',
            'Ask about team collaboration, code review practices, and knowledge sharing.',
            'Emphasize performance optimization, scalability, and best practices.',
            'Focus on less obvious aspects and secondary skills mentioned in the document.'
        ];
        const randomVariation = variationPrompts[Math.floor(Math.random() * variationPrompts.length)];

        promptContent += `

VARIATION GUIDANCE: ${randomVariation}

Return ONLY a JSON array of ${questionCount} question strings, no other text:
["Question 1?", "Question 2?", ...]`;

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: questionCount > 10 ? 1500 : 800,
            temperature: 1.0,
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
        const { question, answer, difficulty, subject } = req.body;

        if (!answer || answer.trim() === '' || answer === 'Your response will appear here...') {
            return res.json({
                score: 0,
                feedback: 'No answer provided',
                correct: false
            });
        }

        const difficultyTolerance = {
            '1': 'LENIENT - Accept partial answers, rough approximations, and minor inaccuracies. Focus on whether the core idea is correct.',
            '2': 'MODERATE - Accept reasonable answers with minor gaps. Some imprecision is acceptable.',
            '3': 'STANDARD - Expect accurate answers but allow minor omissions. Core facts must be correct.',
            '4': 'STRICT - Expect precise and complete answers. Minor inaccuracies reduce the score.',
            '5': 'RIGOROUS - Expect highly precise answers with correct details. No tolerance for factual errors.'
        };

        const tolerance = difficultyTolerance[difficulty] || difficultyTolerance['3'];
        const subjectContext = subject ? `Subject area: ${subject}` : '';

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 500,
            messages: [
                {
                    role: 'user',
                    content: `You are evaluating a knowledge assessment answer.

${subjectContext}

Question: ${question}

Candidate's Answer: ${answer}

EVALUATION RULES:
1. First determine if the answer is FACTUALLY CORRECT for the subject area
2. If you are uncertain about the factual accuracy, give the benefit of the doubt to the candidate
3. Apply the following tolerance level for partial credit:
   ${tolerance}

IMPORTANT:
- A factually correct answer should score 80+ regardless of difficulty
- Difficulty affects how much partial credit is given for incomplete/imprecise answers
- A factually incorrect answer should score below 50 at any difficulty level

Respond in this exact JSON format:
{
    "score": <number 0-100>,
    "correct": <boolean - true if the core answer is factually correct>,
    "feedback": "<brief 1-2 sentence feedback>"
}

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

// Suggest answer endpoint
app.post('/api/suggest-answer', async (req, res) => {
    try {
        const { question, difficulty, subject, questionStyle } = req.body;

        if (!question) {
            return res.status(400).json({ suggestion: 'No question provided' });
        }

        const difficultyLabels = {
            '1': 'beginner',
            '2': 'intermediate',
            '3': 'competent',
            '4': 'advanced',
            '5': 'expert'
        };

        const difficultyLevel = difficultyLabels[difficulty] || 'competent';
        const styleContext = questionStyle ? ` (${questionStyle} style)` : '';

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 300,
            temperature: 0.8,
            messages: [
                {
                    role: 'user',
                    content: `Provide a strong example answer to this interview question${styleContext}.

Question: ${question}

Subject area: ${subject || 'general'}
Difficulty level: ${difficultyLevel}

Provide a concise, high-quality example answer that would score 80-90%.
Keep it natural and conversational, not robotic.
For technical questions: 1-2 sentences covering key points.
For behavioural/situational questions: 2-4 sentences, use STAR method if applicable (Situation, Task, Action, Result).

Return ONLY the example answer text, no labels, quotes, or extra formatting.`
                }
            ]
        });

        const suggestion = response.content[0].text.trim();
        res.json({ suggestion });
    } catch (error) {
        console.error('Suggestion error:', error);
        res.status(500).json({ suggestion: 'Could not generate suggestion' });
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
