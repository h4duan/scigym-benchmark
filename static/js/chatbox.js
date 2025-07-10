// Chatbox functionality for SciGym demo
class ChatboxParser {
    constructor() {
        this.chatHistory = '';
        this.parsedMessages = [];
    }

    async loadChatHistory() {
        try {
            const response = await fetch('./static/chat/chat_history_demo.txt');
            this.chatHistory = await response.text();
            this.parseChatHistory();
            this.renderChatbox();
        } catch (error) {
            console.error('Error loading chat history:', error);
        }
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
                // Don't create a new message here, let the content sections handle it
                currentMessage = null;
                currentContent = [];
                continue;
            }
            
            // Check for agent messages (thoughts and actions)
            if (line.match(/^## Thoughts/)) {
                if (currentMessage) {
                    this.addMessage(currentMessage, currentContent);
                }
                currentMessage = { type: 'agent', section: 'thoughts' };
                currentContent = [];
                continue;
            }
            
            if (line.match(/^## Action/)) {
                if (currentMessage) {
                    this.addMessage(currentMessage, currentContent);
                }
                currentMessage = { type: 'agent', section: 'action' };
                currentContent = [];
                continue;
            }
            
            // Check for environment messages
            if (line.match(/^# Observation/)) {
                if (currentMessage) {
                    this.addMessage(currentMessage, currentContent);
                }
                currentMessage = { type: 'environment', section: 'observation' };
                currentContent = [];
                continue;
            }
            
            // Check for experiment results (separate message type)
            if (line.match(/^## Experiment Result/)) {
                if (currentMessage) {
                    this.addMessage(currentMessage, currentContent);
                }
                currentMessage = { type: 'environment', section: 'experiment_result' };
                currentContent = [];
                continue;
            }
            
            // Check for code execution errors
            if (line.match(/^## Code Stderror/)) {
                if (currentMessage) {
                    this.addMessage(currentMessage, currentContent);
                }
                currentMessage = { type: 'environment', section: 'code_error' };
                currentContent = [];
                continue;
            }
            
            // Check for task info sections  
            if (line.match(/^## Task Info/)) {
                if (currentMessage) {
                    this.addMessage(currentMessage, currentContent);
                }
                currentMessage = { type: 'environment', section: 'task_info' };
                currentContent = [];
                continue;
            }
            
            // Check for SBML model sections
            if (line.match(/^## Incomplete SBML Model/)) {
                if (currentMessage) {
                    this.addMessage(currentMessage, currentContent);
                }
                currentMessage = { type: 'environment', section: 'sbml_model' };
                currentContent = [];
                continue;
            }
            
            // Check for max iterations and other setup info
            if (line.match(/^## Max iterations/)) {
                if (currentMessage) {
                    this.addMessage(currentMessage, currentContent);
                }
                currentMessage = { type: 'environment', section: 'iteration_info' };
                currentContent = [];
                continue;
            }
            
            // Skip headers that aren't part of main content
            if (line.match(/^### Experiment|^### Code|^### Allowed libraries/)) {
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
                    // End of XML block
                    currentContent.push({
                        type: 'xml',
                        content: xmlBlock.join('\n'),
                        language: 'xml'
                    });
                    xmlBlock = [];
                    inXMLBlock = false;
                }
                continue;
            }
            
            // Handle code blocks
            if (line.match(/^```/)) {
                if (inCodeBlock) {
                    // End of code block
                    if (codeBlock.length > 0) {
                        currentContent.push({
                            type: 'code',
                            content: codeBlock.join('\n'),
                            language: currentCodeLanguage
                        });
                    }
                    codeBlock = [];
                    inCodeBlock = false;
                    currentCodeLanguage = '';
                } else {
                    // Start of code block
                    currentCodeLanguage = line.replace(/```/g, '').trim() || 'text';
                    inCodeBlock = true;
                    codeBlock = [];
                }
                continue;
            }
            
            if (inCodeBlock) {
                codeBlock.push(line);
            } else if (currentMessage && line.trim()) {
                // Check if this looks like CSV/experimental data table content
                if (line.match(/^Time\s+id_/) || line.match(/^\d+/) || line.match(/^\d+\.\d+e[+-]\d+/) || line.match(/^\.\.\./)) {
                    // This is experimental data content
                    if (currentContent.length === 0 || currentContent[currentContent.length - 1].type !== 'experimental_data') {
                        currentContent.push({ type: 'experimental_data', content: [] });
                    }
                    currentContent[currentContent.length - 1].content.push(line);
                } else {
                    // Regular text content - only add non-empty lines
                    if (currentContent.length === 0 || currentContent[currentContent.length - 1].type !== 'text') {
                        currentContent.push({ type: 'text', content: [] });
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
    
    renderChatbox() {
        const chatContainer = document.getElementById('chat-container');
        if (!chatContainer) return;
        
        chatContainer.innerHTML = '';
        
        this.parsedMessages.forEach((message, index) => {
            const messageDiv = this.createMessageElement(message, index);
            chatContainer.appendChild(messageDiv);
        });
    }
    
    createMessageElement(message, index) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${message.type}`;
        
        // Create header
        const header = document.createElement('div');
        header.className = 'chat-header';
        
        const avatar = document.createElement('div');
        avatar.className = 'chat-avatar';
        avatar.textContent = message.type === 'agent' ? '🤖' : '🔬';
        
        const title = document.createElement('div');
        title.className = 'chat-title';
        if (message.type === 'agent') {
            title.textContent = message.section === 'thoughts' ? 'LLM Agent - Thoughts' : 'LLM Agent - Action';
        } else {
            // Environment messages with specific sections
            switch (message.section) {
                case 'task_setup':
                    title.textContent = 'SciGym Environment - Task Setup';
                    break;
                case 'task_info':
                    title.textContent = 'SciGym Environment - Task Instructions';
                    break;
                case 'sbml_model':
                    title.textContent = 'SciGym Environment - Initial SBML Model';
                    break;
                case 'iteration_info':
                    title.textContent = 'SciGym Environment - Iteration Limits';
                    break;
                case 'experiment_result':
                    title.textContent = 'SciGym Environment - Experiment Results';
                    break;
                case 'code_error':
                    title.textContent = 'SciGym Environment - Code Error';
                    break;
                default:
                    title.textContent = 'SciGym Environment - Results';
            }
        }
        
        header.appendChild(avatar);
        header.appendChild(title);
        messageDiv.appendChild(header);
        
        // Create content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'chat-content';
        
        message.content.forEach((item, itemIndex) => {
            if (item.type === 'text') {
                const textDiv = document.createElement('div');
                textDiv.className = 'chat-text';
                textDiv.innerHTML = item.content.join('<br>');
                contentDiv.appendChild(textDiv);
            } else if (item.type === 'code') {
                const codeContainer = this.createExpandableCodeBlock(item.content, item.language, `${index}-${itemIndex}`, 'code');
                contentDiv.appendChild(codeContainer);
            } else if (item.type === 'xml') {
                const xmlContainer = this.createExpandableCodeBlock(item.content, item.language, `${index}-${itemIndex}`, 'xml');
                contentDiv.appendChild(xmlContainer);
            } else if (item.type === 'experimental_data') {
                const dataContainer = this.createExpandableCodeBlock(item.content.join('\n'), 'text', `${index}-${itemIndex}`, 'data');
                contentDiv.appendChild(dataContainer);
            }
        });
        
        messageDiv.appendChild(contentDiv);
        return messageDiv;
    }
    
    createExpandableCodeBlock(code, language, id, blockType = 'code') {
        const container = document.createElement('div');
        container.className = 'expandable-code-container';
        
        // Determine block characteristics
        const lines = code.split('\n');
        let isLong, previewLines, buttonText, collapseText;
        
        switch (blockType) {
            case 'xml':
                isLong = lines.length > 8;
                previewLines = lines.slice(0, 6);
                buttonText = '📋 View Full SBML';
                collapseText = '📋 Collapse SBML';
                break;
            case 'data':
                isLong = lines.length > 10;
                previewLines = lines.slice(0, 8);
                buttonText = '📊 View Full Data';
                collapseText = '📊 Collapse Data';
                break;
            default:
                isLong = lines.length > 5;
                previewLines = lines.slice(0, 4);
                buttonText = '📄 View Full Code';
                collapseText = '📄 Collapse Code';
        }
        
        const preview = previewLines.join('\n');
        
        const previewDiv = document.createElement('div');
        previewDiv.className = 'code-preview';
        
        const previewCode = document.createElement('pre');
        previewCode.innerHTML = `<code class="language-${language}">${this.escapeHtml(preview)}${isLong ? '\n...' : ''}</code>`;
        previewDiv.appendChild(previewCode);
        
        if (isLong) {
            const expandBtn = document.createElement('button');
            expandBtn.className = 'expand-code-btn';
            expandBtn.textContent = buttonText;
            expandBtn.onclick = () => this.expandCode(id);
            previewDiv.appendChild(expandBtn);
        }
        
        container.appendChild(previewDiv);
        
        // Create full view (hidden by default)
        if (isLong) {
            const fullDiv = document.createElement('div');
            fullDiv.className = 'code-full hidden';
            fullDiv.id = `full-${id}`;
            
            const fullCode = document.createElement('pre');
            fullCode.innerHTML = `<code class="language-${language}">${this.escapeHtml(code)}</code>`;
            fullDiv.appendChild(fullCode);
            
            const collapseBtn = document.createElement('button');
            collapseBtn.className = 'collapse-code-btn';
            collapseBtn.textContent = collapseText;
            collapseBtn.onclick = () => this.collapseCode(id);
            fullDiv.appendChild(collapseBtn);
            
            container.appendChild(fullDiv);
        }
        
        return container;
    }
    
    expandCode(id) {
        const preview = document.querySelector(`#full-${id}`).parentElement.querySelector('.code-preview');
        const full = document.getElementById(`full-${id}`);
        
        preview.style.display = 'none';
        full.classList.remove('hidden');
    }
    
    collapseCode(id) {
        const preview = document.querySelector(`#full-${id}`).parentElement.querySelector('.code-preview');
        const full = document.getElementById(`full-${id}`);
        
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
        // Exit fullscreen
        chatSection.classList.remove('fullscreen');
        body.classList.remove('fullscreen-active');
        icon.textContent = '⛶';
        text.textContent = 'Fullscreen';
        
        // Remove overlay if it exists
        const overlay = document.querySelector('.fullscreen-overlay');
        if (overlay) {
            overlay.remove();
        }
    } else {
        // Enter fullscreen
        chatSection.classList.add('fullscreen');
        body.classList.add('fullscreen-active');
        icon.textContent = '⛝';
        text.textContent = 'Exit Fullscreen';
        
        // Create overlay to hide background content
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

// Initialize chatbox when page loads
document.addEventListener('DOMContentLoaded', function() {
    const parser = new ChatboxParser();
    parser.loadChatHistory();
});