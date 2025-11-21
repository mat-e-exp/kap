// Sentiment Analyser - Combined face-api.js + MediaPipe Version
class SentimentAnalyser {
    constructor() {
        // DOM Elements
        this.setupScreen = document.getElementById('setup-screen');
        this.analysisScreen = document.getElementById('analysis-screen');
        this.resultsScreen = document.getElementById('results-screen');
        this.startBtn = document.getElementById('start-btn');
        this.nextBtn = document.getElementById('next-btn');
        this.restartBtn = document.getElementById('restart-btn');
        this.video = document.getElementById('video');
        this.overlay = document.getElementById('overlay');
        this.questionText = document.getElementById('question-text');
        this.questionNum = document.getElementById('question-num');
        this.transcript = document.getElementById('transcript');
        this.listeningIndicator = document.getElementById('listening-indicator');
        this.expressionIndicator = document.getElementById('current-expression');
        this.confidenceMeter = document.getElementById('confidence-meter');
        this.stressMeter = document.getElementById('stress-meter');
        this.confidenceValue = document.getElementById('confidence-value');
        this.stressValue = document.getElementById('stress-value');
        this.cameraStatus = document.getElementById('camera-status');
        this.micStatus = document.getElementById('mic-status');

        // State
        this.currentQuestion = 0;
        this.questions = [];
        this.selectedSubject = '';
        this.documentContext = null;
        this.activeTab = 'subject';
        this.results = [];
        this.stream = null;
        this.recognition = null;
        this.isListening = false;
        this.modelsLoaded = false;

        // MediaPipe
        this.faceMesh = null;
        this.animationId = null;

        // Combined metrics tracking
        this.metricsHistory = [];
        this.baselineMetrics = null;
        this.blinkCount = 0;
        this.lastBlinkTime = 0;
        this.eyesClosed = false;

        // Accumulated transcript
        this.fullTranscript = '';

        // Timer
        this.questionStartTime = null;
        this.timerInterval = null;

        // Recording
        this.sessionRecording = null;
        this.mediaRecorder = null;
        this.recordingChunks = [];

        // Landmark indices for MediaPipe
        this.LANDMARKS = {
            leftEye: [33, 160, 158, 133, 153, 144],
            rightEye: [362, 385, 387, 263, 373, 380],
        };

        this.init();
    }

    async init() {
        this.startBtn.addEventListener('click', () => this.startAnalysis());
        this.nextBtn.addEventListener('click', () => this.nextQuestion());
        this.restartBtn.addEventListener('click', () => this.restart());

        // Reset button
        const resetBtn = document.getElementById('reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetAnswer());
        }

        // Subject suggestions
        const suggestBtn = document.getElementById('suggest-btn');
        if (suggestBtn) {
            suggestBtn.addEventListener('click', () => this.getSuggestions());
        }

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Document analyze button
        const analyzeBtn = document.getElementById('analyze-btn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => this.analyzeDocument());
        }

        // Disable button while loading
        this.startBtn.disabled = true;
        this.startBtn.textContent = 'Loading models...';

        // Load both face-api and MediaPipe models
        await this.loadAllModels();
    }

    resetAnswer() {
        // Stop any ongoing speech
        this.stopSpeaking();

        this.fullTranscript = '';
        this.transcript.textContent = 'Your response will appear here...';
        this.transcript.classList.add('placeholder');
        this.metricsHistory = [];
        this.blinkCount = 0;

        // Restart listening
        this.listeningIndicator.querySelector('span').textContent = 'Listening...';
        this.startListening();
    }

    switchTab(tabName) {
        this.activeTab = tabName;

        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab content
        document.getElementById('subject-tab').classList.toggle('active', tabName === 'subject');
        document.getElementById('document-tab').classList.toggle('active', tabName === 'document');

        // Clear document context when switching to subject tab
        if (tabName === 'subject') {
            this.documentContext = null;
            document.getElementById('document-analysis').classList.add('hidden');
        }
    }

    async analyzeDocument() {
        const documentInput = document.getElementById('document-input');
        const analyzeBtn = document.getElementById('analyze-btn');
        const analysisDiv = document.getElementById('document-analysis');
        const detectedType = document.getElementById('detected-type');
        const analysisContext = document.getElementById('analysis-context');

        const documentText = documentInput.value.trim();
        if (!documentText) {
            alert('Please paste a document first');
            return;
        }

        analyzeBtn.disabled = true;
        analyzeBtn.textContent = 'Analyzing...';

        try {
            const response = await fetch('/api/analyze-document', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ document: documentText })
            });

            const data = await response.json();

            this.documentContext = {
                type: data.type,
                context: data.context,
                subject: data.subject,
                text: documentText
            };

            detectedType.textContent = data.type;
            analysisContext.textContent = data.context;
            analysisDiv.classList.remove('hidden');

            // Show question style selector for CV or Job Description
            const questionStyleDiv = document.getElementById('question-style-selection');
            const typeLC = data.type.toLowerCase();
            if (typeLC.includes('cv') || typeLC.includes('resume') ||
                typeLC.includes('job') || typeLC.includes('description')) {
                questionStyleDiv.classList.remove('hidden');
            } else {
                questionStyleDiv.classList.add('hidden');
            }

        } catch (error) {
            console.error('Error analyzing document:', error);
            alert('Failed to analyze document');
        }

        analyzeBtn.disabled = false;
        analyzeBtn.textContent = 'Analyze Document';
    }

    async getSuggestions() {
        const subjectInput = document.getElementById('subject-input');
        const suggestBtn = document.getElementById('suggest-btn');
        const suggestionsContainer = document.getElementById('suggestions-container');
        const suggestionsList = document.getElementById('suggestions-list');

        const subject = subjectInput.value.trim();
        if (!subject) {
            alert('Please enter a subject first');
            return;
        }

        suggestBtn.disabled = true;
        suggestBtn.textContent = 'Loading...';

        try {
            const response = await fetch('/api/suggest-topics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject })
            });

            const data = await response.json();

            if (data.suggestions && data.suggestions.length > 0) {
                // Add the original subject as the first option (highlighted green)
                const originalSubjectChip = `<button type="button" class="suggestion-chip suggestion-chip-original">${subject}</button>`;
                const topicChips = data.suggestions.map(s =>
                    `<button type="button" class="suggestion-chip">${s}</button>`
                ).join('');
                suggestionsList.innerHTML = originalSubjectChip + topicChips;

                // Add click handlers to chips
                suggestionsList.querySelectorAll('.suggestion-chip').forEach(chip => {
                    chip.addEventListener('click', () => {
                        subjectInput.value = chip.textContent;
                        suggestionsContainer.classList.add('hidden');
                    });
                });

                suggestionsContainer.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Error getting suggestions:', error);
        }

        suggestBtn.disabled = false;
        suggestBtn.textContent = 'Suggest Topics';
    }

    async loadAllModels() {
        try {
            // Load face-api models for emotion detection
            const FACEAPI_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model';
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(FACEAPI_URL),
                faceapi.nets.faceExpressionNet.loadFromUri(FACEAPI_URL)
            ]);
            console.log('face-api models loaded');

            // Initialize MediaPipe Face Mesh for behavioural signals
            this.faceMesh = new FaceMesh({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
                }
            });

            this.faceMesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            this.faceMesh.onResults((results) => this.onMediaPipeResults(results));
            console.log('MediaPipe Face Mesh initialized');

            this.modelsLoaded = true;
            this.startBtn.disabled = false;
            this.startBtn.textContent = 'Begin Analysis';
        } catch (error) {
            console.error('Error loading models:', error);
            this.startBtn.textContent = 'Error loading models';
            alert('Failed to load models. Please refresh the page.');
        }
    }

    async startAnalysis() {
        console.log('startAnalysis called');

        if (!this.modelsLoaded) {
            alert('Models not loaded yet. Please wait.');
            return;
        }

        // Get selected subject, difficulty, and question count
        const subjectInput = document.getElementById('subject-input');
        const difficultySelect = document.getElementById('difficulty-select');
        const questionsSelect = document.getElementById('questions-select');
        this.selectedDifficulty = difficultySelect.value;
        this.questionCount = parseInt(questionsSelect.value);

        // Determine subject based on active tab
        if (this.activeTab === 'document' && this.documentContext) {
            this.selectedSubject = this.documentContext.subject;
        } else {
            this.selectedSubject = subjectInput.value.trim();
        }

        if (!this.selectedSubject) {
            if (this.activeTab === 'document') {
                alert('Please analyze a document first');
            } else {
                alert('Please enter a subject');
            }
            this.startBtn.disabled = false;
            this.startBtn.textContent = 'Begin Interview';
            return;
        }

        // Disable button and show loading
        this.startBtn.disabled = true;
        this.startBtn.textContent = 'Generating questions...';

        try {
            // Generate questions for selected subject, difficulty, and count
            const requestBody = {
                subject: this.selectedSubject,
                difficulty: this.selectedDifficulty,
                count: this.questionCount
            };

            // Add document context if available
            if (this.documentContext) {
                requestBody.documentContext = {
                    type: this.documentContext.type,
                    text: this.documentContext.text.substring(0, 3000)
                };

                // Add question style if CV/Job Description
                const questionStyleSelect = document.getElementById('question-style');
                if (questionStyleSelect && !questionStyleSelect.parentElement.classList.contains('hidden')) {
                    requestBody.questionStyle = questionStyleSelect.value;
                }
            }

            const questionsResponse = await fetch('/api/generate-questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            const questionsData = await questionsResponse.json();
            this.questions = questionsData.questions;
            console.log('Questions generated:', this.questions);

            this.startBtn.textContent = 'Starting camera...';

            console.log('Requesting media devices...');

            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                },
                audio: true
            });
            console.log('Media stream obtained');

            this.video.srcObject = this.stream;
            this.cameraStatus.classList.add('granted');
            this.micStatus.classList.add('granted');

            this.setupSpeechRecognition();
            this.showScreen('analysis');

            // Start session recording if enabled
            this.recordingEnabled = document.getElementById('record-session').checked;
            if (this.recordingEnabled) {
                this.startRecording();
            }

            this.video.addEventListener('loadeddata', () => {
                this.startCombinedDetection();
            });

            this.loadQuestion();

            // Establish baseline after 3 seconds
            setTimeout(() => {
                this.baselineMetrics = this.calculateAverageMetrics();
                console.log('Baseline established:', this.baselineMetrics);
            }, 3000);

        } catch (error) {
            console.error('Error:', error);
            this.startBtn.disabled = false;
            this.startBtn.textContent = 'Begin Interview';
            if (error.name === 'NotAllowedError') {
                this.cameraStatus.classList.add('denied');
                this.micStatus.classList.add('denied');
                alert('Camera and microphone access is required.');
            } else {
                alert('Error: ' + error.message);
            }
        }
    }

    startCombinedDetection() {
        const canvas = this.overlay;
        canvas.width = this.video.videoWidth;
        canvas.height = this.video.videoHeight;

        // Store latest MediaPipe results
        this.latestMediaPipeData = null;

        const processFrame = async () => {
            if (this.video.readyState === 4) {
                // Run face-api for emotions
                const faceApiDetections = await faceapi
                    .detectAllFaces(this.video, new faceapi.TinyFaceDetectorOptions())
                    .withFaceExpressions();

                // Run MediaPipe for behavioural signals
                await this.faceMesh.send({ image: this.video });

                // Combine results
                if (faceApiDetections.length > 0) {
                    const emotions = faceApiDetections[0].expressions;
                    const behaviour = this.latestMediaPipeData || {};

                    const combinedMetrics = {
                        // Emotions from face-api
                        emotions: emotions,
                        dominantEmotion: this.getDominantEmotion(emotions),

                        // Behaviour from MediaPipe
                        blinkRate: this.blinkCount,
                        gazeDirection: behaviour.gazeDirection || 0.5,
                        lipTension: behaviour.lipTension || 0,
                        eyebrowHeight: behaviour.eyebrowHeight || 0,
                        headPose: behaviour.headPose || { yaw: 0, pitch: 0 },

                        timestamp: Date.now()
                    };

                    this.metricsHistory.push(combinedMetrics);

                    // Keep last 30 readings
                    if (this.metricsHistory.length > 30) {
                        this.metricsHistory.shift();
                    }

                    this.updateDisplay(combinedMetrics);
                }
            }

            this.animationId = requestAnimationFrame(processFrame);
        };

        processFrame();
    }

    onMediaPipeResults(results) {
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const landmarks = results.multiFaceLandmarks[0];

            // Calculate behavioural metrics
            const ear = this.calculateEAR(landmarks);

            // Blink detection
            const blinkThreshold = 0.2;
            if (ear < blinkThreshold && !this.eyesClosed) {
                this.eyesClosed = true;
                const now = Date.now();
                if (now - this.lastBlinkTime > 100) {
                    this.blinkCount++;
                    this.lastBlinkTime = now;
                }
            } else if (ear >= blinkThreshold) {
                this.eyesClosed = false;
            }

            // Store for combination with face-api
            this.latestMediaPipeData = {
                gazeDirection: this.calculateGazeDirection(landmarks),
                lipTension: this.calculateLipTension(landmarks),
                eyebrowHeight: this.calculateEyebrowHeight(landmarks),
                headPose: this.calculateHeadPose(landmarks)
            };
        }
    }

    getDominantEmotion(emotions) {
        return Object.entries(emotions).reduce((a, b) =>
            a[1] > b[1] ? a : b
        )[0];
    }

    calculateEAR(landmarks) {
        const leftEAR = this.calculateEyeEAR(landmarks, this.LANDMARKS.leftEye);
        const rightEAR = this.calculateEyeEAR(landmarks, this.LANDMARKS.rightEye);
        return (leftEAR + rightEAR) / 2;
    }

    calculateEyeEAR(landmarks, eyeIndices) {
        const p1 = landmarks[eyeIndices[0]];
        const p2 = landmarks[eyeIndices[1]];
        const p3 = landmarks[eyeIndices[2]];
        const p4 = landmarks[eyeIndices[3]];
        const p5 = landmarks[eyeIndices[4]];
        const p6 = landmarks[eyeIndices[5]];

        const vertical1 = this.distance(p2, p6);
        const vertical2 = this.distance(p3, p5);
        const horizontal = this.distance(p1, p4);

        return (vertical1 + vertical2) / (2.0 * horizontal);
    }

    calculateGazeDirection(landmarks) {
        const leftIris = landmarks[468] || landmarks[159];
        const rightIris = landmarks[473] || landmarks[386];
        const leftEyeInner = landmarks[133];
        const leftEyeOuter = landmarks[33];
        const rightEyeInner = landmarks[362];
        const rightEyeOuter = landmarks[263];

        const leftEyeWidth = this.distance(leftEyeInner, leftEyeOuter);
        const rightEyeWidth = this.distance(rightEyeInner, rightEyeOuter);

        const leftIrisPos = (leftIris.x - leftEyeOuter.x) / leftEyeWidth;
        const rightIrisPos = (rightIris.x - rightEyeOuter.x) / rightEyeWidth;

        return (leftIrisPos + rightIrisPos) / 2;
    }

    calculateLipTension(landmarks) {
        const upperLip = landmarks[13];
        const lowerLip = landmarks[14];
        const lipDistance = this.distance(upperLip, lowerLip);
        return 1 - Math.min(lipDistance * 10, 1);
    }

    calculateEyebrowHeight(landmarks) {
        const leftEyebrowCenter = landmarks[105];
        const rightEyebrowCenter = landmarks[334];
        const leftEyeCenter = landmarks[159];
        const rightEyeCenter = landmarks[386];

        const leftHeight = leftEyeCenter.y - leftEyebrowCenter.y;
        const rightHeight = rightEyeCenter.y - rightEyebrowCenter.y;

        return (leftHeight + rightHeight) / 2;
    }

    calculateHeadPose(landmarks) {
        const noseTip = landmarks[1];
        const leftCheek = landmarks[234];
        const rightCheek = landmarks[454];

        const faceWidth = this.distance(leftCheek, rightCheek);
        const noseOffset = noseTip.x - (leftCheek.x + rightCheek.x) / 2;
        const yaw = noseOffset / faceWidth;

        const chin = landmarks[152];
        const forehead = landmarks[10];
        const faceHeight = this.distance(forehead, chin);
        const noseVerticalOffset = noseTip.y - (forehead.y + chin.y) / 2;
        const pitch = noseVerticalOffset / faceHeight;

        return { yaw, pitch };
    }

    distance(p1, p2) {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    }

    updateDisplay(metrics) {
        // Show dominant emotion
        this.expressionIndicator.textContent = this.capitalise(metrics.dominantEmotion);

        // Calculate combined scores
        const confidence = this.calculateConfidenceScore(metrics);
        const stress = this.calculateStressScore(metrics);

        this.confidenceMeter.style.width = `${confidence}%`;
        this.stressMeter.style.width = `${stress}%`;
        this.confidenceValue.textContent = `${confidence}%`;
        this.stressValue.textContent = `${stress}%`;
    }

    calculateConfidenceScore(metrics) {
        let score = 55;  // Start slightly above neutral

        // Emotion-based (from face-api)
        const e = metrics.emotions;
        score += (e.neutral || 0) * 20;  // Neutral is good
        score += (e.happy || 0) * 40;    // Happy is confident
        score -= (e.fearful || 0) * 25;
        score -= (e.sad || 0) * 15;
        score -= (e.surprised || 0) * 10;
        score -= (e.angry || 0) * 8;

        // Behaviour-based (from MediaPipe) - reduced penalties
        const gazeDiff = Math.abs(metrics.gazeDirection - 0.5);
        score -= gazeDiff * 10;

        const headMovement = Math.abs(metrics.headPose.yaw) + Math.abs(metrics.headPose.pitch);
        score -= headMovement * 5;

        score -= metrics.lipTension * 5;

        return Math.max(0, Math.min(100, Math.round(score)));
    }

    calculateStressScore(metrics) {
        let score = 15;  // Baseline stress

        // Emotion-based (from face-api)
        const e = metrics.emotions;
        score += (e.fearful || 0) * 40;
        score += (e.surprised || 0) * 20;
        score += (e.angry || 0) * 25;
        score += (e.sad || 0) * 20;
        score += (e.disgusted || 0) * 15;

        // Behaviour-based (from MediaPipe)
        if (this.baselineMetrics) {
            const blinkIncrease = metrics.blinkRate - this.baselineMetrics.blinkRate;
            score += Math.max(0, blinkIncrease * 2);
        }

        const gazeDiff = Math.abs(metrics.gazeDirection - 0.5);
        score += gazeDiff * 20;

        score += metrics.lipTension * 15;

        const headMovement = Math.abs(metrics.headPose.yaw) + Math.abs(metrics.headPose.pitch);
        score += headMovement * 10;

        return Math.max(0, Math.min(100, Math.round(score)));
    }

    calculateAverageMetrics() {
        if (this.metricsHistory.length === 0) return null;

        const avg = {
            emotions: {
                neutral: 0, happy: 0, sad: 0, angry: 0,
                fearful: 0, disgusted: 0, surprised: 0
            },
            blinkRate: this.blinkCount,
            gazeDirection: 0,
            lipTension: 0,
            eyebrowHeight: 0,
            headPose: { yaw: 0, pitch: 0 }
        };

        this.metricsHistory.forEach(m => {
            Object.keys(avg.emotions).forEach(key => {
                avg.emotions[key] += m.emotions[key] || 0;
            });
            avg.gazeDirection += m.gazeDirection;
            avg.lipTension += m.lipTension;
            avg.eyebrowHeight += m.eyebrowHeight;
            if (m.headPose) {
                avg.headPose.yaw += m.headPose.yaw || 0;
                avg.headPose.pitch += m.headPose.pitch || 0;
            }
        });

        const count = this.metricsHistory.length;
        Object.keys(avg.emotions).forEach(key => {
            avg.emotions[key] /= count;
        });
        avg.gazeDirection /= count;
        avg.lipTension /= count;
        avg.eyebrowHeight /= count;
        avg.headPose.yaw /= count;
        avg.headPose.pitch /= count;

        // Add dominant emotion
        avg.dominantEmotion = this.getDominantEmotion(avg.emotions);

        return avg;
    }

    setupSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.error('Speech recognition not supported');
            this.transcript.textContent = 'Speech recognition not supported. Please use Chrome.';
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-GB';

        this.recognition.onresult = (event) => {
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    // Accumulate final transcripts
                    this.fullTranscript += transcript + ' ';
                } else {
                    interimTranscript = transcript;
                }
            }

            // Show accumulated transcript + any interim text
            const displayText = this.fullTranscript + interimTranscript;
            this.transcript.textContent = displayText.trim() || 'Listening...';
            this.transcript.classList.remove('placeholder');
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'no-speech') {
                this.recognition.stop();
                setTimeout(() => this.startListening(), 100);
            }
        };

        this.recognition.onend = () => {
            if (this.isListening) {
                this.recognition.start();
            }
        };
    }

    startListening() {
        if (this.recognition) {
            this.isListening = true;
            this.recognition.start();
            this.listeningIndicator.classList.remove('hidden');
        }
    }

    stopListening() {
        if (this.recognition) {
            this.isListening = false;
            this.recognition.stop();
            this.listeningIndicator.classList.add('hidden');
        }
    }

    loadQuestion() {
        this.questionNum.textContent = this.currentQuestion + 1;
        document.getElementById('question-total').textContent = this.questions.length;
        this.questionText.textContent = this.questions[this.currentQuestion];
        this.transcript.textContent = 'Your response will appear here...';
        this.transcript.classList.add('placeholder');
        this.nextBtn.disabled = false;  // Always enabled
        this.metricsHistory = [];
        this.blinkCount = 0;
        this.fullTranscript = '';  // Reset accumulated transcript

        // Start timer
        this.questionStartTime = Date.now();
        this.startTimer();

        // Read question aloud, then start listening
        this.speakQuestion(this.questions[this.currentQuestion]);
    }

    speakQuestion(text) {
        // Cancel any ongoing speech
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }

        // Check if TTS is enabled via checkbox
        const readAloudEnabled = document.getElementById('read-aloud')?.checked ?? true;

        // Skip TTS if disabled or not supported
        if (!readAloudEnabled || !window.speechSynthesis) {
            // Start listening after short delay
            this.listeningIndicator.classList.remove('hidden');
            this.listeningIndicator.querySelector('span').textContent = 'Listening...';
            setTimeout(() => this.startListening(), 500);
            return;
        }

        // Show reading indicator
        this.listeningIndicator.classList.remove('hidden');
        this.listeningIndicator.querySelector('span').textContent = 'Reading question...';

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;  // Slightly slower for clarity
        utterance.pitch = 1;

        // Try to select a good voice (prefer UK English)
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang === 'en-GB') ||
                               voices.find(v => v.lang.startsWith('en')) ||
                               voices[0];
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        utterance.onend = () => {
            // TTS finished, now start listening
            this.listeningIndicator.querySelector('span').textContent = 'Listening...';
            this.startListening();
        };

        utterance.onerror = () => {
            // TTS failed, fallback to listening
            this.listeningIndicator.querySelector('span').textContent = 'Listening...';
            this.startListening();
        };

        window.speechSynthesis.speak(utterance);
    }

    stopSpeaking() {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
    }

    startRecording() {
        if (!this.stream) return;

        this.videoChunks = [];
        this.audioChunks = [];

        try {
            // Record video and audio SEPARATELY to avoid clock drift during muxing

            // Video-only stream from the camera
            const videoOnlyStream = new MediaStream(this.stream.getVideoTracks());
            this.videoRecorder = new MediaRecorder(videoOnlyStream, {
                mimeType: 'video/webm',
                videoBitsPerSecond: 2500000
            });
            this.videoRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    this.videoChunks.push(e.data);
                }
            };

            // Audio-only stream from the microphone
            const audioOnlyStream = new MediaStream(this.stream.getAudioTracks());
            this.audioRecorder = new MediaRecorder(audioOnlyStream, {
                mimeType: 'audio/webm'
            });
            this.audioRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    this.audioChunks.push(e.data);
                }
            };

            // Start both recorders simultaneously
            this.videoRecorder.start();
            this.audioRecorder.start();
        } catch (err) {
            console.error('Recording not supported:', err);
        }
    }

    stopRecording() {
        return new Promise((resolve) => {
            // Check if we have active recorders
            const videoActive = this.videoRecorder && this.videoRecorder.state !== 'inactive';
            const audioActive = this.audioRecorder && this.audioRecorder.state !== 'inactive';

            if (!videoActive && !audioActive) {
                resolve(null);
                return;
            }

            let videoUrl = null;
            let audioUrl = null;
            let stoppedCount = 0;
            const checkComplete = () => {
                stoppedCount++;
                if (stoppedCount >= 2) {
                    resolve({ videoUrl, audioUrl });
                }
            };

            if (videoActive) {
                this.videoRecorder.onstop = () => {
                    const blob = new Blob(this.videoChunks, { type: 'video/webm' });
                    videoUrl = URL.createObjectURL(blob);
                    checkComplete();
                };
                this.videoRecorder.stop();
            } else {
                checkComplete();
            }

            if (audioActive) {
                this.audioRecorder.onstop = () => {
                    const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
                    audioUrl = URL.createObjectURL(blob);
                    checkComplete();
                };
                this.audioRecorder.stop();
            } else {
                checkComplete();
            }
        });
    }

    startTimer() {
        const timerEl = document.getElementById('question-timer');
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.questionStartTime) / 1000);
            const mins = Math.floor(elapsed / 60);
            const secs = elapsed % 60;
            timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        return Date.now() - this.questionStartTime;
    }

    nextQuestion() {
        // Stop any ongoing speech
        this.stopSpeaking();

        const timeElapsed = this.stopTimer();
        const avgMetrics = this.calculateAverageMetrics();
        const userResponse = this.fullTranscript.trim() || 'No response provided';

        // Store answer and metrics (no evaluation yet)
        const defaultMetrics = {
            emotions: { neutral: 0.5, happy: 0, sad: 0, angry: 0, fearful: 0, disgusted: 0, surprised: 0 },
            blinkRate: 0,
            gazeDirection: 0.5,
            lipTension: 0,
            eyebrowHeight: 0,
            headPose: { yaw: 0, pitch: 0 }
        };
        const metricsToUse = avgMetrics || defaultMetrics;

        // Calculate speech metrics
        const speechMetrics = this.calculateSpeechMetrics(userResponse, timeElapsed);

        this.results.push({
            question: this.questions[this.currentQuestion],
            response: userResponse,
            timeMs: timeElapsed,
            metrics: avgMetrics,
            sentiment: {
                confidence: this.calculateConfidenceScore(metricsToUse),
                stress: this.calculateStressScore(metricsToUse),
                dominantEmotion: avgMetrics?.dominantEmotion || 'neutral',
                blinkRate: this.blinkCount,
                gazeStability: avgMetrics ? Math.round((1 - Math.abs(avgMetrics.gazeDirection - 0.5) * 2) * 100) : 50
            },
            speech: speechMetrics
        });

        this.stopListening();
        this.currentQuestion++;

        if (this.currentQuestion < this.questions.length) {
            this.loadQuestion();
        } else {
            // All questions answered - now evaluate
            this.evaluateAllAnswers();
        }
    }

    async evaluateAllAnswers() {
        // Stop session recording before stopping camera (if enabled)
        if (this.recordingEnabled) {
            this.sessionRecording = await this.stopRecording();
        }

        // Stop camera
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }

        // Show evaluating screen
        this.showScreen('evaluating');

        const evalStatus = document.getElementById('eval-status');
        const evalProgress = document.getElementById('eval-progress-bar');

        // Evaluate each answer
        for (let i = 0; i < this.results.length; i++) {
            evalStatus.textContent = `Evaluating question ${i + 1} of ${this.results.length}...`;
            evalProgress.style.width = `${((i) / this.results.length) * 100}%`;

            let evaluation = { score: 50, feedback: 'Could not evaluate', correct: false };
            try {
                const response = await fetch('/api/evaluate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        question: this.results[i].question,
                        answer: this.results[i].response,
                        difficulty: this.selectedDifficulty,
                        subject: this.selectedSubject
                    })
                });

                if (response.ok) {
                    evaluation = await response.json();
                }
            } catch (error) {
                console.error('Evaluation error:', error);
            }

            // Add evaluation to result
            this.results[i].score = evaluation.score;
            this.results[i].feedback = evaluation.feedback;
            this.results[i].correct = evaluation.correct;

            evalProgress.style.width = `${((i + 1) / this.results.length) * 100}%`;
        }

        evalStatus.textContent = 'Complete!';

        // Show results after short delay
        setTimeout(() => this.showResults(), 500);
    }

    calculateTruthScore(metrics) {
        if (!metrics) return 50;

        let score = 55;

        // Emotion factors (face-api)
        const e = metrics.emotions;
        score += (e.neutral || 0) * 25;
        score += (e.happy || 0) * 15;
        score -= (e.fearful || 0) * 30;
        score -= (e.surprised || 0) * 10;
        score -= (e.angry || 0) * 15;
        score -= (e.sad || 0) * 10;

        // Behaviour factors (MediaPipe)
        const gazeDiff = Math.abs(metrics.gazeDirection - 0.5);
        score -= gazeDiff * 25;

        score -= metrics.lipTension * 10;

        // Compare to baseline
        if (this.baselineMetrics) {
            const blinkIncrease = metrics.blinkRate - this.baselineMetrics.blinkRate;
            score -= Math.max(0, blinkIncrease * 2);

            const eyebrowChange = Math.abs(metrics.eyebrowHeight - this.baselineMetrics.eyebrowHeight);
            score -= eyebrowChange * 50;
        }

        return Math.max(0, Math.min(100, Math.round(score)));
    }

    showResults() {
        const overallScore = Math.round(
            this.results.reduce((sum, r) => sum + r.score, 0) / this.results.length
        );

        document.getElementById('verdict-score').textContent = `${overallScore}%`;

        const breakdown = document.getElementById('question-breakdown');
        breakdown.innerHTML = this.results.map((r, i) => {
            const scoreClass = r.score >= 70 ? 'high' : r.score >= 40 ? 'medium' : 'low';
            const correctIcon = r.correct ? '✓' : '✗';
            const correctClass = r.correct ? 'correct' : 'incorrect';
            const s = r.sentiment;
            return `
                <div class="breakdown-item">
                    <div class="breakdown-main">
                        <div class="breakdown-header">
                            <span class="breakdown-question">${i + 1}. ${r.question}</span>
                            <span class="breakdown-score ${scoreClass}">${r.score}%</span>
                        </div>
                        <span class="breakdown-response">"${r.response}"</span>
                        <span class="breakdown-feedback ${correctClass}">
                            <span class="correct-icon">${correctIcon}</span>
                            ${r.feedback}
                        </span>
                    </div>
                    <div class="breakdown-observations">
                        <div class="sentiment-title">Observations <span class="beta-tag">BETA</span></div>
                        <div class="sentiment-item">
                            <span class="sentiment-label">Expression</span>
                            <span class="sentiment-value">${this.capitalise(s.dominantEmotion)}</span>
                        </div>
                        <div class="sentiment-item">
                            <span class="sentiment-label">Confidence</span>
                            <span class="sentiment-value">${s.confidence}%</span>
                        </div>
                        <div class="sentiment-item">
                            <span class="sentiment-label">Stress</span>
                            <span class="sentiment-value">${s.stress}%</span>
                        </div>
                        <div class="sentiment-item">
                            <span class="sentiment-label">Gaze</span>
                            <span class="sentiment-value">${s.gazeStability}%</span>
                        </div>
                        <div class="sentiment-item">
                            <span class="sentiment-label">Time</span>
                            <span class="sentiment-value">${this.formatTime(r.timeMs)}</span>
                        </div>
                    </div>
                    <div class="breakdown-speech">
                        <div class="sentiment-title">Speech <span class="beta-tag">BETA</span></div>
                        <div class="sentiment-item">
                            <span class="sentiment-label">Words</span>
                            <span class="sentiment-value">${r.speech.wordCount}</span>
                        </div>
                        <div class="sentiment-item">
                            <span class="sentiment-label">WPM</span>
                            <span class="sentiment-value">${r.speech.wpm}</span>
                        </div>
                        <div class="speech-summary">${r.speech.summary}</div>
                    </div>
                </div>
            `;
        }).join('');

        // Set session recording video/audio if available
        const sessionRecordingDiv = document.querySelector('.session-recording');
        const sessionVideo = document.getElementById('session-video');
        const sessionAudio = document.getElementById('session-audio');
        const playBtn = document.getElementById('play-recording');
        const recordingTime = document.getElementById('recording-time');

        if (this.sessionRecording && this.sessionRecording.videoUrl) {
            sessionVideo.src = this.sessionRecording.videoUrl;
            sessionAudio.src = this.sessionRecording.audioUrl;
            sessionRecordingDiv.style.display = 'block';

            // Sync playback controls
            let isPlaying = false;
            let timeUpdateInterval = null;

            // Wait for metadata to load, then log durations for investigation
            let videoDuration = 0;
            let audioDuration = 0;

            sessionVideo.onloadedmetadata = () => {
                videoDuration = sessionVideo.duration;
                console.log('VIDEO duration:', videoDuration, 'seconds');
                console.log('VIDEO playbackRate:', sessionVideo.playbackRate);
                if (audioDuration > 0) {
                    console.log('RATIO (audio/video):', audioDuration / videoDuration);
                }
            };

            sessionAudio.onloadedmetadata = () => {
                audioDuration = sessionAudio.duration;
                console.log('AUDIO duration:', audioDuration, 'seconds');
                if (videoDuration > 0) {
                    console.log('RATIO (audio/video):', audioDuration / videoDuration);
                }
            };

            playBtn.onclick = () => {
                if (isPlaying) {
                    sessionVideo.pause();
                    sessionAudio.pause();
                    playBtn.textContent = 'Play';
                    if (timeUpdateInterval) clearInterval(timeUpdateInterval);
                } else {
                    // Start video immediately, delay audio start
                    sessionVideo.currentTime = 0;
                    sessionAudio.currentTime = 0;
                    sessionVideo.play();
                    setTimeout(() => {
                        if (!sessionVideo.paused) {
                            sessionAudio.play();
                        }
                    }, AUDIO_DELAY * 1000);
                    playBtn.textContent = 'Pause';

                    // Update time display
                    timeUpdateInterval = setInterval(() => {
                        const time = Math.floor(sessionVideo.currentTime);
                        const mins = Math.floor(time / 60);
                        const secs = time % 60;
                        recordingTime.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
                    }, 500);
                }
                isPlaying = !isPlaying;
            };

            // When video ends, stop audio too
            sessionVideo.onended = () => {
                sessionAudio.pause();
                playBtn.textContent = 'Play';
                isPlaying = false;
                if (timeUpdateInterval) clearInterval(timeUpdateInterval);
            };
        } else {
            sessionRecordingDiv.style.display = 'none';
        }

        this.showScreen('results');
    }

    restart() {
        this.currentQuestion = 0;
        this.results = [];
        this.questions = [];
        this.metricsHistory = [];
        this.baselineMetrics = null;
        this.blinkCount = 0;
        this.sessionRecording = null;

        // Reset tab state and document context
        this.activeTab = 'subject';
        this.documentContext = null;

        // Reset tab UI to subject
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === 'subject');
        });
        document.getElementById('subject-tab').classList.add('active');
        document.getElementById('document-tab').classList.remove('active');
        document.getElementById('document-analysis').classList.add('hidden');
        document.getElementById('question-style-selection').classList.add('hidden');
        document.getElementById('question-style').value = 'mixed';

        this.cameraStatus.classList.remove('granted', 'denied');
        this.micStatus.classList.remove('granted', 'denied');
        this.startBtn.disabled = false;
        this.startBtn.textContent = 'Begin Interview';

        this.showScreen('setup');
    }

    showScreen(screenName) {
        this.setupScreen.classList.remove('active');
        this.analysisScreen.classList.remove('active');
        this.resultsScreen.classList.remove('active');
        document.getElementById('evaluating-screen').classList.remove('active');

        switch (screenName) {
            case 'setup':
                this.setupScreen.classList.add('active');
                break;
            case 'analysis':
                this.analysisScreen.classList.add('active');
                break;
            case 'evaluating':
                document.getElementById('evaluating-screen').classList.add('active');
                break;
            case 'results':
                this.resultsScreen.classList.add('active');
                break;
        }
    }

    capitalise(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    formatTime(ms) {
        const secs = Math.floor(ms / 1000);
        const mins = Math.floor(secs / 60);
        const remainingSecs = secs % 60;
        return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
    }

    calculateSpeechMetrics(transcript, timeMs) {
        const words = transcript.trim().split(/\s+/).filter(w => w.length > 0);
        const wordCount = words.length;
        const seconds = timeMs / 1000;
        const wpm = seconds > 0 ? Math.round((wordCount / seconds) * 60) : 0;

        // Generate summary
        const lengthDesc = wordCount < 10 ? 'Brief' : wordCount < 30 ? 'Moderate' : 'Detailed';
        const paceDesc = wpm < 100 ? 'slow pace' : wpm < 150 ? 'steady pace' : 'fast pace';
        const summary = `${lengthDesc}, ${paceDesc}`;

        return {
            wordCount,
            wpm,
            summary
        };
    }
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    new SentimentAnalyser();
});
