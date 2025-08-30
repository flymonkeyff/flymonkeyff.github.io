// TouchDesigner 연동용 한글 멜로디 생성기
// WebSocket을 통해 실시간 데이터 전송

class KoreanMelodyGenerator {
    constructor() {
        // WebSocket 연결
        this.socket = null;
        this.wsUrl = 'ws://localhost:9980';
        this.reconnectInterval = null;
        this.maxReconnectAttempts = 5;
        this.reconnectAttempts = 0;
        
        // 오디오 설정
        this.audioContext = null;
        this.masterGainNode = null;
        this.audioInitialized = false;
        
        // 마우스 위치
        this.mouseX = 0.5;
        this.mouseY = 0.5;
        
        // DOM 요소들
        this.elements = {};
        
        // 자모음 매핑 데이터
        this.APP_DATA = {
            consonantMapping: {
                "ㄱ": {"note": "C", "octave": 4, "name": "도"},
                "ㄴ": {"note": "D", "octave": 4, "name": "레"},
                "ㄷ": {"note": "E", "octave": 4, "name": "미"},
                "ㄹ": {"note": "F", "octave": 4, "name": "파"},
                "ㅁ": {"note": "G", "octave": 4, "name": "솔"},
                "ㅂ": {"note": "A", "octave": 4, "name": "라"},
                "ㅅ": {"note": "B", "octave": 4, "name": "시"},
                "ㅇ": {"note": "C", "octave": 5, "name": "높은도"},
                "ㅈ": {"note": "D", "octave": 5, "name": "높은레"},
                "ㅊ": {"note": "E", "octave": 5, "name": "높은미"},
                "ㅋ": {"note": "F", "octave": 5, "name": "높은파"},
                "ㅌ": {"note": "G", "octave": 5, "name": "높은솔"},
                "ㅍ": {"note": "A", "octave": 5, "name": "높은라"},
                "ㅎ": {"note": "B", "octave": 5, "name": "높은시"}
            },
            vowelMapping: {
                "ㅏ": {"note": "C", "octave": 4, "name": "중간도"},
                "ㅑ": {"note": "D", "octave": 4, "name": "중간레"},
                "ㅓ": {"note": "E", "octave": 4, "name": "중간미"},
                "ㅕ": {"note": "F", "octave": 4, "name": "중간파"},
                "ㅗ": {"note": "G", "octave": 4, "name": "중간솔"},
                "ㅛ": {"note": "A", "octave": 4, "name": "중간라"},
                "ㅜ": {"note": "B", "octave": 4, "name": "중간시"},
                "ㅠ": {"note": "C", "octave": 5, "name": "높은도"},
                "ㅡ": {"note": "D", "octave": 5, "name": "높은레"},
                "ㅣ": {"note": "E", "octave": 5, "name": "높은미"}
            },
            consonants: ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"],
            vowels: ["ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ","ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ"],
            finalConsonants: ["","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"]
        };
        
        this.init();
    }

    init() {
        this.initializeElements();
        this.setupEventListeners();
        this.initWebSocket();
    }

    initializeElements() {
        this.elements = {
            welcomeScreen: document.getElementById('welcome-screen'),
            mainApp: document.getElementById('main-app'),
            startBtn: document.getElementById('start-btn'),
            koreanInput: document.getElementById('korean-input'),
            currentCharDisplay: document.getElementById('current-char-display'),
            consonantNote: document.getElementById('consonant-note'),
            vowelNote: document.getElementById('vowel-note'),
            clearBtn: document.getElementById('clear-btn'),
            reconnectBtn: document.getElementById('reconnect-btn'),
            connectionStatus: document.getElementById('connection-status'),
            statusText: document.querySelector('.status-text'),
            debugLog: document.getElementById('debug-log')
        };
    }

    setupEventListeners() {
        this.elements.startBtn.addEventListener('click', this.handleStart.bind(this));
        this.elements.koreanInput.addEventListener('input', this.handleKoreanInput.bind(this));
        this.elements.clearBtn.addEventListener('click', this.clearInput.bind(this));
        this.elements.reconnectBtn.addEventListener('click', this.reconnectWebSocket.bind(this));
        
        // 마우스 움직임 추적
        document.addEventListener('mousemove', (e) => {
            this.mouseX = e.clientX / window.innerWidth;
            this.mouseY = e.clientY / window.innerHeight;
        });
    }

    // WebSocket 연결 초기화
    initWebSocket() {
        try {
            this.socket = new WebSocket(this.wsUrl);
            this.setupWebSocketHandlers();
        } catch (error) {
            console.error('WebSocket 연결 실패:', error);
            this.updateConnectionStatus(false, 'WebSocket 연결 실패');
        }
    }

    setupWebSocketHandlers() {
        this.socket.onopen = () => {
            console.log('TouchDesigner와 연결되었습니다.');
            this.updateConnectionStatus(true, 'TouchDesigner 연결됨');
            this.reconnectAttempts = 0;
            this.addDebugLog('TouchDesigner 연결 성공');
            
            // 연결 확인 메시지 전송
            this.sendToTouchDesigner({
                type: 'connection',
                message: 'Web client connected',
                timestamp: Date.now()
            });
        };

        this.socket.onclose = () => {
            console.log('TouchDesigner와 연결이 끊어졌습니다.');
            this.updateConnectionStatus(false, 'TouchDesigner 연결 끊김');
            this.addDebugLog('TouchDesigner 연결 끊김');
            this.attemptReconnect();
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket 오류:', error);
            this.updateConnectionStatus(false, 'WebSocket 오류');
            this.addDebugLog('WebSocket 오류: ' + error.message);
        };

        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.addDebugLog('TD로부터 수신: ' + JSON.stringify(data));
            } catch (e) {
                this.addDebugLog('TD로부터 수신: ' + event.data);
            }
        };
    }

    // 자동 재연결 시도
    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            this.addDebugLog(`재연결 시도 ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
            
            setTimeout(() => {
                this.initWebSocket();
            }, 2000 * this.reconnectAttempts); // 점진적으로 대기 시간 증가
        } else {
            this.addDebugLog('최대 재연결 시도 횟수 초과');
            this.updateConnectionStatus(false, '재연결 실패 - 수동 재연결 필요');
        }
    }

    // 수동 재연결
    reconnectWebSocket() {
        this.reconnectAttempts = 0;
        this.addDebugLog('수동 재연결 시도');
        this.initWebSocket();
    }

    // 연결 상태 업데이트
    updateConnectionStatus(connected, message) {
        if (connected) {
            this.elements.connectionStatus.classList.remove('disconnected');
            this.elements.connectionStatus.classList.add('connected');
        } else {
            this.elements.connectionStatus.classList.remove('connected');
            this.elements.connectionStatus.classList.add('disconnected');
        }
        this.elements.statusText.textContent = message;
    }

    // TouchDesigner로 데이터 전송
    sendToTouchDesigner(data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            try {
                const jsonData = JSON.stringify(data);
                this.socket.send(jsonData);
                this.addDebugLog('TD로 전송: ' + jsonData);
                return true;
            } catch (error) {
                console.error('데이터 전송 실패:', error);
                this.addDebugLog('전송 실패: ' + error.message);
                return false;
            }
        } else {
            this.addDebugLog('연결 끊김 - 전송 실패');
            return false;
        }
    }

    // 디버그 로그 추가
    addDebugLog(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;
        console.log(logMessage);
        
        if (this.elements.debugLog) {
            this.elements.debugLog.innerHTML += logMessage + '\n';
            this.elements.debugLog.scrollTop = this.elements.debugLog.scrollHeight;
        }
    }

    // 오디오 초기화
    async handleStart() {
        try {
            await this.initializeAudio();
            this.elements.welcomeScreen.classList.add('hidden');
            this.elements.mainApp.classList.remove('hidden');
            this.elements.koreanInput.focus();
            this.addDebugLog('애플리케이션 시작됨');
        } catch (error) {
            console.error('시작 실패:', error);
            alert('오디오 초기화에 실패했습니다. 브라우저 설정을 확인해주세요.');
        }
    }

    async initializeAudio() {
        try {
            // 사용자 제스처 후 AudioContext 생성
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 44100
            });
            
            this.masterGainNode = this.audioContext.createGain();
            this.masterGainNode.gain.setValueAtTime(0.7, this.audioContext.currentTime);
            this.masterGainNode.connect(this.audioContext.destination);
            
            // AudioContext 상태 확인 및 시작
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            this.audioInitialized = true;
            this.addDebugLog('오디오 초기화 성공');
            
            // 테스트 톤 재생
            this.playTestTone();
            
        } catch (error) {
            console.error('오디오 초기화 실패:', error);
            this.addDebugLog('오디오 초기화 실패: ' + error.message);
            throw error;
        }
    }

    // 테스트 톤 재생
    playTestTone() {
        if (!this.audioInitialized) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
        
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
        
        oscillator.connect(gainNode);
        gainNode.connect(this.masterGainNode);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.5);
        
        this.addDebugLog('테스트 톤 재생됨');
    }

    // 한글 입력 처리
    handleKoreanInput(e) {
        const text = e.target.value;
        const lastChar = text[text.length - 1];
        
        if (!lastChar) {
            this.clearCurrentDisplay();
            return;
        }

        // 한글 문자인지 확인
        const charCode = lastChar.charCodeAt(0);
        if (charCode < 0xAC00 || charCode > 0xD7A3) {
            this.clearCurrentDisplay();
            return;
        }
        
        const decomposed = this.decomposeHangeul(lastChar);
        if (decomposed) {
            this.updateCurrentDisplay(lastChar, decomposed);
            this.playCharacterSound(decomposed);
        }
    }

    // 한글 분해
    decomposeHangeul(char) {
        const base = char.charCodeAt(0) - 0xAC00;
        const consonantIndex = Math.floor(base / 588);
        const vowelIndex = Math.floor((base % 588) / 28);
        const finalConsonantIndex = base % 28;
        
        return {
            consonant: this.APP_DATA.consonants[consonantIndex],
            vowel: this.APP_DATA.vowels[vowelIndex],
            finalConsonant: this.APP_DATA.finalConsonants[finalConsonantIndex]
        };
    }

    // 화면 표시 업데이트
    updateCurrentDisplay(char, decomposed) {
        this.elements.currentCharDisplay.textContent = char;
        
        const consonantInfo = this.APP_DATA.consonantMapping[decomposed.consonant];
        if (consonantInfo) {
            this.elements.consonantNote.textContent = `${decomposed.consonant} (${consonantInfo.name})`;
        } else {
            this.elements.consonantNote.innerHTML = '&nbsp;';
        }
        
        const vowelInfo = this.APP_DATA.vowelMapping[decomposed.vowel];
        if (vowelInfo) {
            this.elements.vowelNote.textContent = `${decomposed.vowel} (${vowelInfo.name})`;
        } else {
            this.elements.vowelNote.innerHTML = '&nbsp;';
        }
    }
    
    clearCurrentDisplay() {
        this.elements.currentCharDisplay.innerHTML = '&nbsp;';
        this.elements.consonantNote.innerHTML = '&nbsp;';
        this.elements.vowelNote.innerHTML = '&nbsp;';
    }

    clearInput() {
        this.elements.koreanInput.value = '';
        this.clearCurrentDisplay();
        this.addDebugLog('입력 초기화');
    }
    
    // 캐릭터 사운드 재생 및 TouchDesigner로 전송
    playCharacterSound(decomposed) {
        if (!this.audioInitialized) {
            this.addDebugLog('오디오가 초기화되지 않음');
            return;
        }

        const notesToPlay = [];
        
        // 자음 정보
        const consonantInfo = this.APP_DATA.consonantMapping[decomposed.consonant];
        if (consonantInfo) {
            notesToPlay.push({
                ...consonantInfo,
                type: 'consonant',
                jamo: decomposed.consonant
            });
        }
        
        // 모음 정보
        const vowelInfo = this.APP_DATA.vowelMapping[decomposed.vowel];
        if (vowelInfo) {
            notesToPlay.push({
                ...vowelInfo,
                type: 'vowel',
                jamo: decomposed.vowel
            });
        }

        // 오디오 재생
        notesToPlay.forEach(noteInfo => {
            this.playNote(noteInfo);
        });
        
        // TouchDesigner로 데이터 전송
        const touchDesignerData = {
            type: 'hangeul_input',
            char: decomposed.consonant + decomposed.vowel + (decomposed.finalConsonant || ''),
            decomposed: {
                consonant: decomposed.consonant,
                vowel: decomposed.vowel,
                final: decomposed.finalConsonant || ''
            },
            notes: notesToPlay.map(note => ({
                note: note.note,
                octave: note.octave,
                frequency: this.getFrequency(note.note, note.octave),
                type: note.type,
                jamo: note.jamo,
                name: note.name
            })),
            mouse: {
                x: this.mouseX,
                y: this.mouseY
            },
            timestamp: Date.now()
        };
        
        this.sendToTouchDesigner(touchDesignerData);
    }
    
    // 음표 재생
    playNote(noteInfo) {
        if (!this.audioContext) return;
        
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            // 주파수 계산 (마우스 Y 위치로 옥타브 조절)
            const baseFrequency = this.getFrequency(noteInfo.note, noteInfo.octave);
            const octaveShift = (this.mouseY - 0.5) * 2; // -1 ~ +1
            const frequency = baseFrequency * Math.pow(2, octaveShift * 0.5);
            
            oscillator.type = noteInfo.type === 'consonant' ? 'sawtooth' : 'sine';
            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
            
            // 마우스 X 위치로 볼륨 조절
            const volume = 0.1 + (this.mouseX * 0.4); // 0.1 ~ 0.5
            
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 1.0);
            
            oscillator.connect(gainNode);
            gainNode.connect(this.masterGainNode);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 1.0);
            
        } catch (error) {
            console.error('음표 재생 실패:', error);
            this.addDebugLog('음표 재생 실패: ' + error.message);
        }
    }
    
    // 주파수 계산
    getFrequency(note, octave) {
        const noteFrequencies = {
            'C': 261.63, 'D': 293.66, 'E': 329.63, 'F': 349.23,
            'G': 392.00, 'A': 440.00, 'B': 493.88
        };
        
        const baseFreq = noteFrequencies[note] || 440;
        return baseFreq * Math.pow(2, octave - 4);
    }
}

// 애플리케이션 시작
document.addEventListener('DOMContentLoaded', () => {
    window.melodyGenerator = new KoreanMelodyGenerator();
});

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
    if (window.melodyGenerator && window.melodyGenerator.socket) {
        window.melodyGenerator.socket.close();
    }
});