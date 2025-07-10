// Self-contained chatbox that doesn't need external files
class ChatboxParser {
    constructor() {
        this.chatHistory = '';
        this.parsedMessages = [];
        this.isPlaying = false;
        this.currentMessageIndex = 0;
        this.playbackSpeed = 3000; // Much slower - 3 seconds between messages
        this.playbackTimeout = null;
    }

    async loadChatHistory() {
        try {
            console.log('Loading chat history from file...');
            const response = await fetch('./static/chat/chat_history_demo.txt');
            this.chatHistory = await response.text();
            console.log('Chat history loaded, parsing...');
            this.parseChatHistory();
            console.log('Parsed', this.parsedMessages.length, 'messages');
            this.initializeChatbox();
        } catch (error) {
            console.error('Error loading chat history:', error);
            console.log('Falling back to sample data...');
            this.createSampleData();
            this.initializeChatbox();
        }
    }

    createSampleData() {
        // Fallback sample data if file loading fails
        this.parsedMessages = [
            {
                type: 'environment',
                section: 'task_setup',
                content: [
                    { type: 'text', content: ['Welcome to SciGym! You are tasked with discovering the missing reactions in a biological system.'] }
                ]
            },
            {
                type: 'agent',
                section: 'thoughts',
                content: [
                    { type: 'text', content: ['I need to analyze the given SBML model and understand what reactions might be missing. Let me start by examining the current model structure.'] }
                ]
            },
            {
                type: 'agent',
                section: 'action',
                content: [
                    { type: 'code', content: 'import pandas as pd\nimport numpy as np\nprint("Starting analysis...")', language: 'python' }
                ]
            },
            {
                type: 'environment',
                section: 'experiment_result',
                content: [
                    { type: 'text', content: ['Experiment completed successfully!'] },
                    { type: 'experimental_data', content: ['Time,Species_A,Species_B', '0,1.0,0.5', '1,1.2,0.6', '2,1.4,0.7'] }
                ]
            },
            {
                type: 'agent',
                section: 'thoughts',
                content: [
                    { type: 'text', content: ['Based on the experimental data, I can see that both species are increasing over time. This suggests a production reaction might be missing.'] }
                ]
            }
        ];
    }

    parseChatHistory() {
        const lines = this.chatHistory.split('\n');
        let currentMessage = null;
        let currentContent = [];
        let inCodeBlock = false;
        let codeBlock = [];
        let currentCodeLanguage = '';
        let inXMLBlock = false;
        let xmlBlock = [];
        let hasStarted = false;
        let currentSubSection = null; // Track subsections like ### Experiment, ### Code
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Initialize with first content if we haven't started yet
            if (!hasStarted && line.trim()) {
                currentMessage = { type: 'environment', section: 'task_setup' };
                currentContent = [];
                hasStarted = true;
            }
            
            // Check for iteration markers - these start new sections
            if (line.match(/^# Iteration/)) {
                if (currentMessage) {
                    this.addMessage(currentMessage, currentContent);
                }
                currentMessage = null;
                currentContent = [];
                currentSubSection = null;
                continue;
            }
            
            // Check for agent messages (thoughts and actions)
            if (line.match(/^## Thoughts/)) {
                if (currentMessage) {
                    this.addMessage(currentMessage, currentContent);
                }
                currentMessage = { type: 'agent', section: 'thoughts' };
                currentContent = [];
                currentSubSection = null;
                continue;
            }
            
            if (line.match(/^## Action/)) {
                if (currentMessage) {
                    this.addMessage(currentMessage, currentContent);
                }
                currentMessage = { type: 'agent', section: 'action' };
                currentContent = [];
                currentSubSection = null;
                continue;
            }
            
            // Check for environment messages
            if (line.match(/^# Observation/)) {
                if (currentMessage) {
                    this.addMessage(currentMessage, currentContent);
                }
                currentMessage = { type: 'environment', section: 'observation' };
                currentContent = [];
                currentSubSection = null;
                continue;
            }
            
            // Parse subsections for agent actions
            if (currentMessage && currentMessage.type === 'agent' && currentMessage.section === 'action') {
                if (line.match(/^### Experiment/)) {
                    currentSubSection = 'experiment';
                    continue;
                }
                if (line.match(/^### Code/)) {
                    currentSubSection = 'code';
                    continue;
                }
            }
            
            // Parse subsections for environment responses
            if (currentMessage && currentMessage.type === 'environment') {
                if (line.match(/^## Code Stderror/)) {
                    // Finish current content and start new message for code error
                    if (currentContent.length > 0) {
                        this.addMessage(currentMessage, currentContent);
                    }
                    currentMessage = { type: 'environment', section: 'code_error' };
                    currentContent = [];
                    currentSubSection = 'code_error';
                    continue;
                }
                if (line.match(/^## Code Stdout/)) {
                    // Finish current content and start new message for code output
                    if (currentContent.length > 0) {
                        this.addMessage(currentMessage, currentContent);
                    }
                    currentMessage = { type: 'environment', section: 'code_output' };
                    currentContent = [];
                    currentSubSection = 'code_output';
                    continue;
                }
                if (line.match(/^## Experiment Result/)) {
                    // Finish current content and start new message for experiment result
                    if (currentContent.length > 0) {
                        this.addMessage(currentMessage, currentContent);
                    }
                    currentMessage = { type: 'environment', section: 'experiment_result' };
                    currentContent = [];
                    currentSubSection = 'experiment_result';
                    continue;
                }
            }
            
            // Check for other environment sections
            if (line.match(/^## Task Info/)) {
                if (currentMessage) {
                    this.addMessage(currentMessage, currentContent);
                }
                currentMessage = { type: 'environment', section: 'task_info' };
                currentContent = [];
                currentSubSection = null;
                continue;
            }
            
            if (line.match(/^## Incomplete SBML Model/)) {
                if (currentMessage) {
                    this.addMessage(currentMessage, currentContent);
                }
                currentMessage = { type: 'environment', section: 'sbml_model' };
                currentContent = [];
                currentSubSection = null;
                continue;
            }
            
            if (line.match(/^## Max iterations/)) {
                if (currentMessage) {
                    this.addMessage(currentMessage, currentContent);
                }
                currentMessage = { type: 'environment', section: 'iteration_info' };
                currentContent = [];
                currentSubSection = null;
                continue;
            }
            
            // Skip other headers
            if (line.match(/^### Allowed libraries/)) {
                continue;
            }
            
            // Handle XML blocks (SBML content)
            if (line.match(/^<\?xml/) || line.match(/^<sbml/)) {
                inXMLBlock = true;
                xmlBlock = [line];
                continue;
            }
            
            if (inXMLBlock) {
                xmlBlock.push(line);
                if (line.match(/^<\/sbml>/)) {
                    currentContent.push({
                        type: 'xml',
                        content: xmlBlock.join('\n'),
                        language: 'xml',
                        subSection: currentSubSection
                    });
                    xmlBlock = [];
                    inXMLBlock = false;
                }
                continue;
            }
            
            // Handle code blocks
            if (line.match(/^```/)) {
                if (inCodeBlock) {
                    if (codeBlock.length > 0) {
                        currentContent.push({
                            type: 'code',
                            content: codeBlock.join('\n'),
                            language: currentCodeLanguage,
                            subSection: currentSubSection
                        });
                    }
                    codeBlock = [];
                    inCodeBlock = false;
                    currentCodeLanguage = '';
                } else {
                    currentCodeLanguage = line.replace(/```/g, '').trim() || 'text';
                    inCodeBlock = true;
                    codeBlock = [];
                }
                continue;
            }
            
            if (inCodeBlock) {
                codeBlock.push(line);
            } else if (currentMessage && line.trim()) {
                // Handle experimental data or regular text based on subsection
                if (currentSubSection === 'experiment_result' && (line.match(/^Time\s+id_/) || line.match(/^\d+/) || line.match(/^\d+\.\d+e[+-]\d+/) || line.match(/^\.\.\./))) {
                    if (currentContent.length === 0 || currentContent[currentContent.length - 1].type !== 'experimental_data') {
                        currentContent.push({ 
                            type: 'experimental_data', 
                            content: [],
                            subSection: currentSubSection 
                        });
                    }
                    currentContent[currentContent.length - 1].content.push(line);
                } else {
                    // Regular text content
                    if (currentContent.length === 0 || currentContent[currentContent.length - 1].type !== 'text' || currentContent[currentContent.length - 1].subSection !== currentSubSection) {
                        currentContent.push({ 
                            type: 'text', 
                            content: [],
                            subSection: currentSubSection 
                        });
                    }
                    currentContent[currentContent.length - 1].content.push(line);
                }
            }
        }
        
        // Add final message if exists
        if (currentMessage && currentContent.length > 0) {
            this.addMessage(currentMessage, currentContent);
        }
    }
    
    addMessage(messageInfo, content) {
        if (content.length > 0) {
            this.parsedMessages.push({
                ...messageInfo,
                content: content
            });
        }
    }

    initializeChatbox() {
        const chatContainer = document.getElementById('chat-container');
        if (!chatContainer) {
            console.error('Chat container not found');
            return;
        }
        
        console.log('Initializing chatbox with play screen');
        
        chatContainer.innerHTML = `
            <div class="chat-play-screen">
                <div class="play-content">
                    <div class="play-icon">🎬</div>
                    <h3>Interactive Scientific Discovery Demo</h3>
                    <p>Watch an LLM agent iteratively design experiments, analyze data, and discover biological mechanisms in real-time.</p>
                    <button class="play-button" onclick="window.chatParser.startAutoPlay()">
                        ▶️ Start Demo
                    </button>
                    <div class="demo-info">
                        <span>Duration: ~1 minute</span> • 
                        <span>${this.parsedMessages.length} messages</span>
                    </div>
                </div>
            </div>
        `;
    }

    startAutoPlay() {
        console.log('Starting auto-play');
        if (this.isPlaying) return;
        
        this.isPlaying = true;
        this.currentMessageIndex = 0;
        
        const chatContainer = document.getElementById('chat-container');
        chatContainer.innerHTML = `
            <div class="chat-controls">
                <button class="control-btn pause-btn" onclick="window.chatParser.pauseAutoPlay()">⏸️ Pause</button>
                <button class="control-btn speed-btn" onclick="window.chatParser.toggleSpeed()">⏩ Speed: 1x</button>
                <button class="control-btn restart-btn" onclick="window.chatParser.restartAutoPlay()">🔄 Restart</button>
                <div class="progress-bar">
                    <div class="progress-fill"></div>
                </div>
            </div>
            <div class="chat-messages-container"></div>
        `;
        
        this.playNextMessage();
    }

    pauseAutoPlay() {
        this.isPlaying = false;
        if (this.playbackTimeout) {
            clearTimeout(this.playbackTimeout);
            this.playbackTimeout = null;
        }
        
        const pauseBtn = document.querySelector('.pause-btn');
        if (pauseBtn) {
            pauseBtn.innerHTML = '▶️ Resume';
            pauseBtn.onclick = () => window.chatParser.resumeAutoPlay();
        }
    }

    resumeAutoPlay() {
        this.isPlaying = true;
        const pauseBtn = document.querySelector('.pause-btn');
        if (pauseBtn) {
            pauseBtn.innerHTML = '⏸️ Pause';
            pauseBtn.onclick = () => window.chatParser.pauseAutoPlay();
        }
        this.playNextMessage();
    }

    toggleSpeed() {
        const speedBtn = document.querySelector('.speed-btn');
        if (this.playbackSpeed === 3000) {
            this.playbackSpeed = 1500; // 2x speed
            speedBtn.innerHTML = '⏩ Speed: 2x';
        } else if (this.playbackSpeed === 1500) {
            this.playbackSpeed = 800; // 4x speed
            speedBtn.innerHTML = '⏩ Speed: 4x';
        } else {
            this.playbackSpeed = 3000; // 1x speed (slower)
            speedBtn.innerHTML = '⏩ Speed: 1x';
        }
    }

    restartAutoPlay() {
        this.pauseAutoPlay();
        this.currentMessageIndex = 0;
        const messagesContainer = document.querySelector('.chat-messages-container');
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
        }
        this.updateProgressBar();
        this.resumeAutoPlay();
    }

    playNextMessage() {
        if (!this.isPlaying || this.currentMessageIndex >= this.parsedMessages.length) {
            if (this.currentMessageIndex >= this.parsedMessages.length) {
                this.onAutoPlayComplete();
            }
            return;
        }

        const message = this.parsedMessages[this.currentMessageIndex];
        const messageElement = this.createMessageElement(message, this.currentMessageIndex);
        
        const messagesContainer = document.querySelector('.chat-messages-container');
        if (messagesContainer) {
            messageElement.style.opacity = '0';
            messageElement.style.transform = 'translateY(20px)';
            messagesContainer.appendChild(messageElement);
            
            setTimeout(() => {
                messageElement.style.transition = 'all 0.5s ease';
                messageElement.style.opacity = '1';
                messageElement.style.transform = 'translateY(0)';
            }, 100);
            
            setTimeout(() => {
                messageElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }, 300);
        }

        this.currentMessageIndex++;
        this.updateProgressBar();

        this.playbackTimeout = setTimeout(() => {
            this.playNextMessage();
        }, this.playbackSpeed);
    }

    updateProgressBar() {
        const progressFill = document.querySelector('.progress-fill');
        if (progressFill) {
            const progress = (this.currentMessageIndex / this.parsedMessages.length) * 100;
            progressFill.style.width = `${progress}%`;
        }
    }

    onAutoPlayComplete() {
        this.isPlaying = false;
        const controls = document.querySelector('.chat-controls');
        if (controls) {
            controls.innerHTML = `
                <div class="completion-message">
                    <span class="completion-icon">✅</span>
                    <span>Demo completed! The agent successfully discovered biological mechanisms through iterative experimentation.</span>
                    <button class="control-btn restart-btn" onclick="window.chatParser.restartAutoPlay()">🔄 Watch Again</button>
                </div>
            `;
        }
    }

    createMessageElement(message, index) {
        const messageDiv = document.createElement('div');
        
        // Style like chat messages - different layout for agent vs environment
        if (message.type === 'agent') {
            messageDiv.className = 'chat-bubble agent-bubble';
        } else {
            messageDiv.className = 'chat-bubble environment-bubble';
        }
        
        // Create avatar and name header
        const messageHeader = document.createElement('div');
        messageHeader.className = 'message-header';
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = message.type === 'agent' ? '🤖' : '🔬';
        
        const name = document.createElement('div');
        name.className = 'message-name';
        if (message.type === 'agent') {
            name.textContent = message.section === 'thoughts' ? 'AI Agent (thinking)' : 'AI Agent';
        } else {
            name.textContent = 'SciGym Environment';
        }
        
        messageHeader.appendChild(avatar);
        messageHeader.appendChild(name);
        messageDiv.appendChild(messageHeader);
        
        // Create message content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        message.content.forEach((item, itemIndex) => {
            if (item.type === 'text') {
                const textDiv = document.createElement('div');
                textDiv.className = 'message-text';
                textDiv.innerHTML = item.content.join('<br>');
                contentDiv.appendChild(textDiv);
            } else if (item.type === 'code') {
                const codeContainer = this.createCodeBlock(item.content, item.language, item.subSection);
                contentDiv.appendChild(codeContainer);
            } else if (item.type === 'xml') {
                const xmlContainer = this.createCodeBlock(item.content, item.language, item.subSection);
                contentDiv.appendChild(xmlContainer);
            } else if (item.type === 'experimental_data') {
                const dataContainer = this.createCodeBlock(item.content.join('\n'), 'text', item.subSection);
                contentDiv.appendChild(dataContainer);
            }
        });
        
        messageDiv.appendChild(contentDiv);
        
        // Add typing indicator effect
        if (message.type === 'agent') {
            this.addTypingEffect(contentDiv);
        }
        
        return messageDiv;
    }

    addTypingEffect(contentDiv) {
        // Add a subtle typing indicator for agent messages
        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'typing-indicator';
        typingIndicator.innerHTML = '<span></span><span></span><span></span>';
        
        // Show typing indicator briefly before showing content
        contentDiv.style.display = 'none';
        contentDiv.parentElement.appendChild(typingIndicator);
        
        setTimeout(() => {
            typingIndicator.remove();
            contentDiv.style.display = 'block';
        }, 800);
    }

    createCodeBlock(code, language, subSection) {
        const container = document.createElement('div');
        container.className = 'expandable-code-container';
        
        // Determine block characteristics based on subsection
        const lines = code.split('\n');
        let isLong, previewLines, buttonText, collapseText, blockType, headerIcon, headerText;
        
        // Map subsections to specific styling
        switch (subSection) {
            case 'experiment':
                isLong = lines.length > 6;
                previewLines = lines.slice(0, 5);
                buttonText = '🧪 View Full Experiment';
                collapseText = '🧪 Collapse Experiment';
                blockType = 'experiment-block';
                headerIcon = '🧪';
                headerText = 'Experiment Design';
                break;
            case 'code':
                isLong = lines.length > 5;
                previewLines = lines.slice(0, 4);
                buttonText = '💻 View Full Code';
                collapseText = '💻 Collapse Code';
                blockType = 'code-block';
                headerIcon = '💻';
                headerText = 'Python Code';
                break;
            case 'code_error':
                isLong = lines.length > 4;
                previewLines = lines.slice(0, 3);
                buttonText = '❌ View Full Error';
                collapseText = '❌ Collapse Error';
                blockType = 'error-block';
                headerIcon = '❌';
                headerText = 'Code Error';
                break;
            case 'code_output':
                isLong = lines.length > 8;
                previewLines = lines.slice(0, 6);
                buttonText = '📤 View Full Output';
                collapseText = '📤 Collapse Output';
                blockType = 'output-block';
                headerIcon = '📤';
                headerText = 'Code Output';
                break;
            case 'experiment_result':
                isLong = lines.length > 10;
                previewLines = lines.slice(0, 8);
                buttonText = '📊 View Full Results';
                collapseText = '📊 Collapse Results';
                blockType = 'data-block';
                headerIcon = '📊';
                headerText = 'Experiment Results';
                break;
            default:
                if (language === 'xml') {
                    isLong = lines.length > 8;
                    previewLines = lines.slice(0, 6);
                    buttonText = '🧬 View Full SBML';
                    collapseText = '🧬 Collapse SBML';
                    blockType = 'xml-block';
                    headerIcon = '🧬';
                    headerText = 'SBML Model';
                } else {
                    isLong = lines.length > 6;
                    previewLines = lines.slice(0, 5);
                    buttonText = '📄 View Full';
                    collapseText = '📄 Collapse';
                    blockType = 'text-block';
                    headerIcon = '📄';
                    headerText = 'Details';
                }
        }
        
        // Add block type class for specific styling
        container.classList.add(blockType);
        
        const preview = previewLines.join('\n');
        
        const previewDiv = document.createElement('div');
        previewDiv.className = 'code-preview';
        
        // Add block type header
        const blockHeader = document.createElement('div');
        blockHeader.className = 'block-header';
        blockHeader.innerHTML = `<span class="block-icon">${headerIcon}</span><span class="block-title">${headerText}</span>`;
        previewDiv.appendChild(blockHeader);
        
        const previewCode = document.createElement('pre');
        previewCode.innerHTML = `<code class="language-${language}">${this.escapeHtml(preview)}${isLong ? '\n...' : ''}</code>`;
        previewDiv.appendChild(previewCode);
        
        if (isLong) {
            const expandBtn = document.createElement('button');
            expandBtn.className = 'expand-code-btn';
            expandBtn.innerHTML = `<span class="btn-icon">${headerIcon}</span><span>${buttonText}</span>`;
            expandBtn.onclick = () => this.expandCode(container);
            previewDiv.appendChild(expandBtn);
        }
        
        container.appendChild(previewDiv);
        
        // Create full view (hidden by default)
        if (isLong) {
            const fullDiv = document.createElement('div');
            fullDiv.className = 'code-full hidden';
            
            const fullHeader = document.createElement('div');
            fullHeader.className = 'block-header';
            fullHeader.innerHTML = `<span class="block-icon">${headerIcon}</span><span class="block-title">${headerText} (Complete)</span>`;
            fullDiv.appendChild(fullHeader);
            
            const fullCode = document.createElement('pre');
            fullCode.innerHTML = `<code class="language-${language}">${this.escapeHtml(code)}</code>`;
            fullDiv.appendChild(fullCode);
            
            const collapseBtn = document.createElement('button');
            collapseBtn.className = 'collapse-code-btn';
            collapseBtn.innerHTML = `<span class="btn-icon">📖</span><span>${collapseText}</span>`;
            collapseBtn.onclick = () => this.collapseCode(container);
            fullDiv.appendChild(collapseBtn);
            
            container.appendChild(fullDiv);
        }
        
        return container;
    }
    
    expandCode(container) {
        const preview = container.querySelector('.code-preview');
        const full = container.querySelector('.code-full');
        
        preview.style.display = 'none';
        full.classList.remove('hidden');
    }
    
    collapseCode(container) {
        const preview = container.querySelector('.code-preview');
        const full = container.querySelector('.code-full');
        
        full.classList.add('hidden');
        preview.style.display = 'block';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Fullscreen functionality
function toggleFullscreen() {
    const chatSection = document.getElementById('chat-demo-section');
    const body = document.body;
    const icon = document.getElementById('fullscreen-icon');
    const text = document.getElementById('fullscreen-text');
    
    if (chatSection.classList.contains('fullscreen')) {
        chatSection.classList.remove('fullscreen');
        body.classList.remove('fullscreen-active');
        icon.textContent = '⛶';
        text.textContent = 'Fullscreen';
        
        const overlay = document.querySelector('.fullscreen-overlay');
        if (overlay) {
            overlay.remove();
        }
    } else {
        chatSection.classList.add('fullscreen');
        body.classList.add('fullscreen-active');
        icon.textContent = '⛝';
        text.textContent = 'Exit Fullscreen';
        
        const overlay = document.createElement('div');
        overlay.className = 'fullscreen-overlay';
        body.appendChild(overlay);
    }
}

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const chatSection = document.getElementById('chat-demo-section');
        if (chatSection && chatSection.classList.contains('fullscreen')) {
            toggleFullscreen();
        }
    }
});

// Initialize chatbox when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing chatbox...');
    window.chatParser = new ChatboxParser();
    window.chatParser.loadChatHistory(); // This will now load your real file
});