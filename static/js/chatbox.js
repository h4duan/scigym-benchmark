// Chatbox functionality for SciGym demo - Syntax Checked
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
            console.log('Chat history loaded, length:', this.chatHistory.length);
            console.log('First 500 characters:', this.chatHistory.substring(0, 500));
            this.parseChatHistory();
            console.log('Parsed', this.parsedMessages.length, 'messages');
            
            // Debug: Show first few parsed messages
            console.log('First parsed message:', this.parsedMessages[0]);
            if (this.parsedMessages.length > 1) {
                console.log('Second parsed message:', this.parsedMessages[1]);
            }
            
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
                    { type: 'text', content: ['Welcome to SciGym! You are tasked with discovering the missing reactions in a biological system.'], subSection: null }
                ]
            },
            {
                type: 'agent',
                section: 'thoughts',
                content: [
                    { type: 'text', content: ['I need to analyze the given SBML model and understand what reactions might be missing. Let me start by examining the current model structure.'], subSection: null }
                ]
            },
            {
                type: 'agent',
                section: 'action',
                content: [
                    { type: 'code', content: ['import pandas as pd', 'import numpy as np', 'print("Starting analysis...")'], language: 'python', subSection: 'code' }
                ]
            },
            {
                type: 'environment',
                section: 'experiment_result',
                content: [
                    { type: 'text', content: ['Experiment completed successfully!'], subSection: 'experiment_result' },
                    { type: 'experimental_data', content: ['Time,Species_A,Species_B', '0,1.0,0.5', '1,1.2,0.6', '2,1.4,0.7'], subSection: 'experiment_result' }
                ]
            },
            {
                type: 'agent',
                section: 'thoughts',
                content: [
                    { type: 'text', content: ['Based on the experimental data, I can see that both species are increasing over time. This suggests a production reaction might be missing.'], subSection: null }
                ]
            }
        ];
    }

    parseChatHistory() {
        console.log('Starting to parse chat history...');
        const lines = this.chatHistory.split('\n');
        console.log('Total lines to parse:', lines.length);
        
        let currentMessage = null;
        let currentContent = [];
        let inCodeBlock = false;
        let codeBlock = [];
        let currentCodeLanguage = '';
        let inXMLBlock = false;
        let xmlBlock = [];
        let hasStarted = false;
        let currentSubSection = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Initialize with first content if we haven't started yet
            if (!hasStarted && line.trim()) {
                console.log('Starting parsing with line:', line);
                currentMessage = { type: 'environment', section: 'task_setup' };
                currentContent = [];
                hasStarted = true;
            }
            
            // Check for iteration markers (handle both correct and misspelled versions)
            if (line.match(/^# Iteration/) || line.match(/^# Interation/)) {
                console.log('Found iteration marker:', line);
                if (currentMessage) {
                    this.addMessage(currentMessage, currentContent);
                    console.log('Added message:', currentMessage.type, currentMessage.section);
                }
                currentMessage = null;
                currentContent = [];
                currentSubSection = null;
                continue;
            }
            
            // Check for agent messages
            if (line.match(/^## Thoughts/)) {
                console.log('Found thoughts section:', line);
                if (currentMessage) {
                    this.addMessage(currentMessage, currentContent);
                    console.log('Added previous message:', currentMessage.type, currentMessage.section);
                }
                currentMessage = { type: 'agent', section: 'thoughts' };
                currentContent = [];
                currentSubSection = null;
                continue;
            }
            
            if (line.match(/^## Action/)) {
                console.log('Found action section:', line);
                if (currentMessage) {
                    this.addMessage(currentMessage, currentContent);
                    console.log('Added previous message:', currentMessage.type, currentMessage.section);
                }
                currentMessage = { type: 'agent', section: 'action' };
                currentContent = [];
                currentSubSection = null;
                continue;
            }
            
            // Check for environment messages
            if (line.match(/^# Observation/)) {
                console.log('Found observation section:', line);
                if (currentMessage) {
                    this.addMessage(currentMessage, currentContent);
                    console.log('Added previous message:', currentMessage.type, currentMessage.section);
                }
                currentMessage = { type: 'environment', section: 'observation' };
                currentContent = [];
                currentSubSection = null;
                continue;
            }
            
            // Parse subsections for agent actions
            if (currentMessage && currentMessage.type === 'agent' && currentMessage.section === 'action') {
                if (line.match(/^### Experiment/)) {
                    console.log('Found experiment subsection');
                    currentSubSection = 'experiment';
                    continue;
                }
                if (line.match(/^### Code/)) {
                    console.log('Found code subsection');
                    currentSubSection = 'code';
                    continue;
                }
            }
            
            // Parse subsections for environment responses
            if (currentMessage && currentMessage.type === 'environment') {
                if (line.match(/^## Code Stderror/)) {
                    console.log('Found code error section');
                    if (currentContent.length > 0) {
                        this.addMessage(currentMessage, currentContent);
                        console.log('Added previous message before code error');
                    }
                    currentMessage = { type: 'environment', section: 'code_error' };
                    currentContent = [];
                    currentSubSection = 'code_error';
                    continue;
                }
                if (line.match(/^## Code Stdout/)) {
                    console.log('Found code output section');
                    if (currentContent.length > 0) {
                        this.addMessage(currentMessage, currentContent);
                        console.log('Added previous message before code output');
                    }
                    currentMessage = { type: 'environment', section: 'code_output' };
                    currentContent = [];
                    currentSubSection = 'code_output';
                    continue;
                }
                if (line.match(/^## Experiment Result/)) {
                    console.log('Found experiment result section');
                    if (currentContent.length > 0) {
                        this.addMessage(currentMessage, currentContent);
                        console.log('Added previous message before experiment result');
                    }
                    currentMessage = { type: 'environment', section: 'experiment_result' };
                    currentContent = [];
                    currentSubSection = 'experiment_result';
                    continue;
                }
            }
            
            // Check for other environment sections
            if (line.match(/^## Task Info/)) {
                console.log('Found task info section');
                if (currentMessage) {
                    this.addMessage(currentMessage, currentContent);
                }
                currentMessage = { type: 'environment', section: 'task_info' };
                currentContent = [];
                currentSubSection = null;
                continue;
            }
            
            if (line.match(/^## Incomplete SBML Model/)) {
                console.log('Found SBML model section');
                if (currentMessage) {
                    this.addMessage(currentMessage, currentContent);
                }
                currentMessage = { type: 'environment', section: 'sbml_model' };
                currentContent = [];
                currentSubSection = null;
                continue;
            }
            
            if (line.match(/^## Max iterations/)) {
                console.log('Found max iterations section');
                if (currentMessage) {
                    this.addMessage(currentMessage, currentContent);
                }
                currentMessage = { type: 'environment', section: 'iteration_info' };
                currentContent = [];
                currentSubSection = null;
                continue;
            }
            
            // Skip reminder and other sections we don't want
            if (line.match(/^## Reminder/)) {
                console.log('Skipping reminder section');
                // Skip all content until we find the next major section
                let j = i + 1;
                while (j < lines.length) {
                    const nextLine = lines[j];
                    // Stop when we find a new iteration, thoughts, action, or observation
                    if (nextLine.match(/^# (Iteration|Interation)/) || 
                        nextLine.match(/^## (Thoughts|Action)/) || 
                        nextLine.match(/^# Observation/)) {
                        break;
                    }
                    j++;
                }
                i = j - 1;
                continue;
            }
            
            // Skip other headers
            if (line.match(/^### Allowed libraries/)) {
                continue;
            }
            
            // Handle XML blocks
            if (line.match(/^<\?xml/) || line.match(/^<sbml/)) {
                console.log('Starting XML block');
                inXMLBlock = true;
                xmlBlock = [line];
                continue;
            }
            
            if (inXMLBlock) {
                xmlBlock.push(line);
                if (line.match(/^<\/sbml>/)) {
                    console.log('Ending XML block');
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
                    console.log('Ending code block');
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
                    console.log('Starting code block');
                    currentCodeLanguage = line.replace(/```/g, '').trim() || 'text';
                    inCodeBlock = true;
                    codeBlock = [];
                }
                continue;
            }
            
            if (inCodeBlock) {
                codeBlock.push(line);
            } else if (currentMessage && line.trim()) {
                // Handle content based on current subsection
                if (currentSubSection === 'experiment_result' && (line.match(/^Time\s+id_/) || line.match(/^\d+/) || line.match(/^\d+\.\d+e[+-]\d+/) || line.match(/^\.\.\./))) {
                    if (currentContent.length === 0 || currentContent[currentContent.length - 1].type !== 'experimental_data') {
                        currentContent.push({ 
                            type: 'experimental_data', 
                            content: [],
                            subSection: currentSubSection 
                        });
                    }
                    currentContent[currentContent.length - 1].content.push(line);
                } else if ((currentSubSection === 'code_error' || currentSubSection === 'code_output') && line.trim()) {
                    if (currentContent.length === 0 || currentContent[currentContent.length - 1].type !== 'code' || currentContent[currentContent.length - 1].subSection !== currentSubSection) {
                        currentContent.push({ 
                            type: 'code', 
                            content: [],
                            language: 'text',
                            subSection: currentSubSection 
                        });
                    }
                    currentContent[currentContent.length - 1].content.push(line);
                } else {
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
            console.log('Added final message:', currentMessage.type, currentMessage.section);
        }
        
        console.log('Parsing complete. Total messages:', this.parsedMessages.length);
    }
    
    addMessage(messageInfo, content) {
        if (content.length > 0) {
            console.log('Adding message:', messageInfo.type, messageInfo.section, 'with', content.length, 'content items');
            
            // Debug: Log content structure
            content.forEach((item, idx) => {
                console.log(`  Content ${idx}: type=${item.type}, subSection=${item.subSection}, contentLength=${Array.isArray(item.content) ? item.content.length : typeof item.content}`);
            });
            
            this.parsedMessages.push({
                ...messageInfo,
                content: content
            });
        } else {
            console.log('Skipping empty message:', messageInfo.type, messageInfo.section);
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
                    <h3>🤖 SciGym Demo</h3>
                    <p>This chat history shows Claude conducting scientific discovery through iterative experimentation and data analysis.</p>
                    <div class="demo-info">
                        <span>Duration: ~1 minute</span> • 
                        <span>${this.parsedMessages.length} messages</span>
                    </div>
                    <div class="play-options">
                        <button class="primary-action-button" onclick="window.chatParser.startAutoPlay()">
                            <span class="btn-emoji">▶️</span>
                            <span>Start Demo</span>
                        </button>
                        <div class="alternative-options">
                            <span class="alternative-text">or</span>
                            <a class="alternative-link" onclick="window.chatParser.startManualMode()">browse manually</a>
                        </div>
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
                <button class="control-btn manual-switch-btn" onclick="window.chatParser.startManualMode()">📜 Manual</button>
                <div class="progress-bar">
                    <div class="progress-fill"></div>
                </div>
            </div>
            <div class="chat-messages-container"></div>
        `;
        
        this.playNextMessage();
    }

    startManualMode() {
        console.log('Starting manual scroll mode');
        this.isPlaying = false;
        this.currentMessageIndex = 0;
        
        const chatContainer = document.getElementById('chat-container');
        chatContainer.innerHTML = `
            <div class="manual-controls">
                <div class="manual-header">
                    <h4>📜 Manual Navigation Mode</h4>
                    <p>Navigate through the conversation at your own pace</p>
                </div>
                <div class="manual-nav">
                    <button class="nav-btn prev-btn" onclick="window.chatParser.showPreviousMessage()" disabled>
                        ← Previous
                    </button>
                    <span class="message-counter">
                        Message <span id="current-msg">1</span> of ${this.parsedMessages.length}
                    </span>
                    <button class="nav-btn next-btn" onclick="window.chatParser.showNextMessage()">
                        Next →
                    </button>
                </div>
                <div class="manual-progress">
                    <div class="manual-progress-fill"></div>
                </div>
                <button class="switch-mode-btn" onclick="window.chatParser.startAutoPlay()">
                    ▶️ Switch to Auto-Play
                </button>
            </div>
            <div class="manual-message-container"></div>
        `;
        
        this.showCurrentMessage();
    }

    showPreviousMessage() {
        if (this.currentMessageIndex > 0) {
            this.currentMessageIndex--;
            this.showCurrentMessage();
        }
    }

    showNextMessage() {
        if (this.currentMessageIndex < this.parsedMessages.length - 1) {
            this.currentMessageIndex++;
            this.showCurrentMessage();
        }
    }

    showCurrentMessage() {
        const messageContainer = document.querySelector('.manual-message-container');
        const prevBtn = document.querySelector('.prev-btn');
        const nextBtn = document.querySelector('.next-btn');
        const currentMsgSpan = document.getElementById('current-msg');
        const progressFill = document.querySelector('.manual-progress-fill');
        
        if (!messageContainer) return;
        
        // Update counter and progress
        currentMsgSpan.textContent = this.currentMessageIndex + 1;
        const progress = ((this.currentMessageIndex + 1) / this.parsedMessages.length) * 100;
        progressFill.style.width = `${progress}%`;
        
        // Update button states
        prevBtn.disabled = this.currentMessageIndex === 0;
        nextBtn.disabled = this.currentMessageIndex === this.parsedMessages.length - 1;
        
        // Show current message
        const message = this.parsedMessages[this.currentMessageIndex];
        const messageElement = this.createMessageElement(message, this.currentMessageIndex);
        
        // Animate message change
        messageContainer.style.opacity = '0.3';
        messageContainer.style.transform = 'translateY(10px)';
        
        setTimeout(() => {
            messageContainer.innerHTML = '';
            messageContainer.appendChild(messageElement);
            
            setTimeout(() => {
                messageContainer.style.opacity = '1';
                messageContainer.style.transform = 'translateY(0)';
            }, 50);
        }, 150);
        
        // Handle completion
        if (this.currentMessageIndex === this.parsedMessages.length - 1) {
            setTimeout(() => {
                const manualControls = document.querySelector('.manual-controls');
                const completionBadge = document.createElement('div');
                completionBadge.className = 'completion-badge';
                completionBadge.innerHTML = '✅ Conversation Complete!';
                manualControls.appendChild(completionBadge);
            }, 500);
        }
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
            
            // Animate message appearance
            setTimeout(() => {
                messageElement.style.transition = 'all 0.5s ease';
                messageElement.style.opacity = '1';
                messageElement.style.transform = 'translateY(0)';
            }, 100);
            
            // Better scrolling behavior - only scroll if needed and more gently
            setTimeout(() => {
                const containerHeight = messagesContainer.clientHeight;
                const containerScrollTop = messagesContainer.scrollTop;
                const containerScrollBottom = containerScrollTop + containerHeight;
                
                const messageTop = messageElement.offsetTop;
                const messageBottom = messageTop + messageElement.offsetHeight;
                
                // Only scroll if the message is not fully visible
                if (messageBottom > containerScrollBottom) {
                    // Calculate minimal scroll needed to show the message
                    const scrollNeeded = messageBottom - containerScrollBottom + 20; // 20px padding
                    
                    // Smooth scroll by the minimal amount needed
                    messagesContainer.scrollTo({
                        top: containerScrollTop + scrollNeeded,
                        behavior: 'smooth'
                    });
                }
            }, 600); // Wait for message animation to complete
        }

        this.currentMessageIndex++;
        this.updateProgressBar();

        // Schedule next message
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
                // Handle both array and string content for backward compatibility
                const codeContent = Array.isArray(item.content) ? item.content.join('\n') : item.content;
                const codeContainer = this.createCodeBlock(codeContent, item.language, item.subSection);
                contentDiv.appendChild(codeContainer);
            } else if (item.type === 'xml') {
                // Handle both array and string content for backward compatibility
                const xmlContent = Array.isArray(item.content) ? item.content.join('\n') : item.content;
                const xmlContainer = this.createCodeBlock(xmlContent, item.language, item.subSection);
                contentDiv.appendChild(xmlContainer);
            } else if (item.type === 'experimental_data') {
                // Handle both array and string content for backward compatibility
                const dataContent = Array.isArray(item.content) ? item.content.join('\n') : item.content;
                const dataContainer = this.createCodeBlock(dataContent, 'text', item.subSection);
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
                buttonText = '🧪 View Full Proposal';
                collapseText = '🧪 Collapse Proposal';
                blockType = 'experiment-block';
                headerIcon = '🧪';
                headerText = 'Experiment Proposal';
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

// Handle escape key to exit fullscreen
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const chatSection = document.getElementById('chat-demo-section');
        if (chatSection && chatSection.classList.contains('fullscreen')) {
            toggleFullscreen();
        }
    }
});

// Global variable for the parser instance
let chatParser;

// Initialize chatbox when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing chatbox...');
    window.chatParser = new ChatboxParser();
    window.chatParser.loadChatHistory();
});