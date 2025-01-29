const vscode = require('vscode');
const OpenAI = require('openai');

let currentPanel = undefined;
let outputChannel;

// Create output channel for debugging
function getOutputChannel() {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel('RN Bug Analyzer');
    }
    return outputChannel;
}

async function analyzeWithAI(error) {
    const logger = getOutputChannel();
    logger.show(); // Make debug output visible

    const config = vscode.workspace.getConfiguration('rn-bug-analyzer');
    const apiKey = config.get('openaiApiKey');

    logger.appendLine('Checking API key configuration...');
    if (!apiKey) {
        logger.appendLine('No API key found');
        throw new Error('OpenAI API key not configured. Please add it in settings (rn-bug-analyzer.openaiApiKey)');
    }
    logger.appendLine('API key found');

    const openai = new OpenAI({
        apiKey: apiKey
    });

    logger.appendLine('Sending request to OpenAI...');
    logger.appendLine(`Error to analyze: ${error}`);

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "You are a React Native expert. Analyze errors and provide solutions in JSON format."
                },
                {
                    role: "user",
                    content: `Analyze this React Native error and provide a solution in this exact JSON format:
                        {
                            "type": "error type here",
                            "cause": "detailed cause here",
                            "solution": "solution with code examples here",
                            "prevention": "prevention tips here"
                        }

                        Error: ${error}`
                }
            ],
            temperature: 0.3,
            max_tokens: 1000
        });

        logger.appendLine('Received response from OpenAI');
        const content = response.choices[0].message.content;
        logger.appendLine(`Raw AI response: ${content}`);

        try {
            const parsedResponse = JSON.parse(content);
            logger.appendLine('Successfully parsed JSON response');
            return parsedResponse;
        } catch (parseError) {
            logger.appendLine(`Failed to parse JSON: ${parseError.message}`);
            return {
                type: 'AI Analysis',
                cause: 'Raw AI Response',
                solution: content,
                prevention: 'AI response format error'
            };
        }
    } catch (error) {
        logger.appendLine(`OpenAI API Error: ${error.message}`);
        throw error;
    }
}

async function analyzeError(error) {
    const logger = getOutputChannel();
    const config = vscode.workspace.getConfiguration('rn-bug-analyzer');
    const useAI = config.get('useAI', true);

    logger.appendLine('Starting error analysis...');
    logger.appendLine(`AI Analysis enabled: ${useAI}`);

    try {
        if (useAI) {
            logger.appendLine('Attempting AI analysis...');
            const analysis = await analyzeWithAI(error);
            logger.appendLine('AI analysis completed');
            return analysis;
        }
    } catch (err) {
        logger.appendLine(`AI analysis failed: ${err.message}`);
        vscode.window.showErrorMessage(`AI analysis failed: ${err.message}`);
        return generateBasicAnalysis(error);
    }

    logger.appendLine('Using basic analysis');
    return generateBasicAnalysis(error);
}

function generateBasicAnalysis(error) {
    const errorLower = error.toLowerCase();
    const analysis = {
        type: '',
        cause: '',
        solution: '',
        prevention: ''
    };

    if (errorLower.includes('undefined is not an object')) {
        analysis.type = 'Null Reference Error';
        analysis.cause = 'Attempting to access properties on an undefined object';
        analysis.solution = 'Add null checks before accessing properties';
        analysis.prevention = 'Use TypeScript and initialize variables';
    } else if (errorLower.includes('cannot read property')) {
        analysis.type = 'Property Access Error';
        analysis.cause = 'Trying to access a property on null/undefined';
        analysis.solution = 'Use optional chaining or add null checks';
        analysis.prevention = 'Add proper type checking and default values';
    } else {
        analysis.type = 'General Error';
        analysis.cause = error;
        analysis.solution = 'Check component lifecycle and props';
        analysis.prevention = 'Add error boundaries and logging';
    }

    return analysis;
}

function getWebviewContent() {
    return `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { 
                padding: 1.5rem; 
                font-family: system-ui, -apple-system, sans-serif;
                color: var(--vscode-editor-foreground);
                background-color: var(--vscode-editor-background);
                line-height: 1.5;
                position: relative;
            }
            h2 {
                margin-bottom: 1.5rem;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            textarea { 
                width: 100%; 
                min-height: 120px; 
                margin: 1rem 0;
                padding: 12px;
                background-color: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                border-radius: 6px;
                font-family: 'SF Mono', Monaco, Menlo, Consolas, monospace;
                font-size: 13px;
                line-height: 1.5;
                resize: vertical;
            }
            textarea:focus {
                outline: none;
                border-color: var(--vscode-focusBorder);
            }
            button { 
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                transition: all 0.2s;
            }
            button:hover {
                opacity: 0.9;
            }
            .error {
                color: var(--vscode-errorForeground);
                padding: 1rem;
                border-left: 3px solid var(--vscode-errorForeground);
                background-color: var(--vscode-inputValidation-errorBackground);
                margin: 1rem 0;
                border-radius: 0 4px 4px 0;
            }
            #output { 
                margin: 1rem 0;
                padding: 8px;
                font-size: 13px;
                color: var(--vscode-textPreformat-foreground);
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .analysis {
                margin-top: 1.5rem;
            }
            .analysis h3 {
                font-size: 14px;
                margin: 0 0 1rem 0;
                padding: 4px 8px;
                background-color: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                border-radius: 4px;
                display: inline-block;
            }
            .analysis div {
                padding: 0.75rem;
                margin: 0.5rem 0;
                background-color: var(--vscode-editor-inactiveSelectionBackground);
                border-radius: 4px;
                font-size: 13px;
                position: relative; /* For positioning copy button if needed */
            }
            .analysis strong {
                color: var(--vscode-textLink-foreground);
            }
            /* Spinner Styles */
            .spinner {
                border: 4px solid var(--vscode-editor-background);
                border-top: 4px solid var(--vscode-editor-foreground);
                border-radius: 50%;
                width: 20px;
                height: 20px;
                animation: spin 1s linear infinite;
                display: inline-block;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            /* Toast Notification Styles */
            #toast {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background-color: var(--vscode-editorWidget-background);
                color: var(--vscode-editorWidget-foreground);
                border: 1px solid var(--vscode-editorWidget-border);
                padding: 10px 16px;
                border-radius: 4px;
                opacity: 0;
                transition: opacity 0.3s ease;
                z-index: 9999;
            }
            #toast.show {
                opacity: 1;
            }
            .copy-btn {
                margin-left: 8px;
                background-color: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                padding: 4px 8px;
                float: right;
            }
            .copy-btn:hover {
                opacity: 0.9;
            }
        </style>
    </head>
    <body>
        <h2>🔍 React Native Error Analyzer</h2>
        
        <!-- Output area (displays status, e.g. "Analyzing...", plus spinner) -->
        <div id="output">Ready to analyze errors.</div>
        
        <!-- Error input text area -->
        <textarea id="errorInput" placeholder="Paste your React Native error message here..." spellcheck="false"></textarea>
        
        <!-- Analyze button -->
        <button id="analyzeBtn" onclick="handleAnalyze()">
            <span>⚡</span>
            Analyze Error
        </button>
        
        <!-- Results area -->
        <div id="result"></div>
        
        <!-- Toast notification -->
        <div id="toast"></div>
        
        <script>
            const vscode = acquireVsCodeApi();
            const output = document.getElementById('output');
            const errorInput = document.getElementById('errorInput');
            const result = document.getElementById('result');
            const toast = document.getElementById('toast');

            function handleAnalyze() {
                const error = errorInput.value.trim();
                
                // Show spinner and message
                output.innerHTML = '<div class="spinner"></div> Analyzing...';

                if (!error) {
                    result.innerHTML = '<div class="error">Please enter an error message</div>';
                    hideSpinner();
                    return;
                }

                vscode.postMessage({
                    command: 'analyze',
                    error: error
                });
            }

            // Hide spinner by reverting to normal text in #output
            function hideSpinner(message = 'Analysis complete') {
                output.innerHTML = message;
            }

            // Show toast notification with some text
            function showToast(msg) {
                toast.textContent = msg;
                toast.classList.add('show');
                setTimeout(() => {
                    toast.classList.remove('show');
                }, 3000);
            }

            // Copy text from a given element by ID
            function copyTextFromElement(elementId) {
                const el = document.getElementById(elementId);
                if (!el) return;
                const textToCopy = el.textContent || el.innerText;
                
                navigator.clipboard.writeText(textToCopy)
                    .then(() => {
                        showToast('Copied to clipboard!');
                    })
                    .catch(err => {
                        showToast('Failed to copy!');
                        console.error(err);
                    });
            }

            // Handle messages from the extension
            window.addEventListener('message', event => {
                const message = event.data;

                switch (message.type) {
                    case 'error':
                        result.innerHTML = '<div class="error">' + message.message + '</div>';
                        hideSpinner('Analysis failed');
                        break;
                        
                    case 'analysis':
                        const analysis = message.result;
                        let html = '<div class="analysis">';

                        if (analysis.type) {
                            html += \`
                                <h3>📋 \${analysis.type}</h3>
                            \`;
                        }
                        if (analysis.cause) {
                            html += \`
                                <div>
                                    <strong>🔍 Root Cause:</strong> 
                                    <span class="analysis-text" id="analysis-cause">\${analysis.cause}</span>
                                    <button class="copy-btn" data-copy-target="analysis-cause">Copy</button>
                                </div>
                            \`;
                        }
                        if (analysis.solution) {
                            html += \`
                                <div>
                                    <strong>🛠️ Solution:</strong> 
                                    <span class="analysis-text" id="analysis-solution">\${analysis.solution}</span>
                                    <button class="copy-btn" data-copy-target="analysis-solution">Copy</button>
                                </div>
                            \`;
                        }
                        if (analysis.prevention) {
                            html += \`
                                <div>
                                    <strong>🛡️ Prevention:</strong> 
                                    <span class="analysis-text" id="analysis-prevention">\${analysis.prevention}</span>
                                    <button class="copy-btn" data-copy-target="analysis-prevention">Copy</button>
                                </div>
                            \`;
                        }

                        html += '</div>';
                        result.innerHTML = html;

                        // Attach copy button event listeners
                        attachCopyButtons();

                        hideSpinner();
                        break;
                }
            });

            // Attach event listeners to all copy buttons
            function attachCopyButtons() {
                const copyButtons = document.querySelectorAll('.copy-btn');
                copyButtons.forEach(btn => {
                    btn.addEventListener('click', () => {
                        const targetId = btn.getAttribute('data-copy-target');
                        copyTextFromElement(targetId);
                    });
                });
            }

            // Support for keyboard shortcuts (Ctrl/Cmd + Enter)
            errorInput.addEventListener('keydown', (e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    handleAnalyze();
                }
            });
        </script>
    </body>
    </html>`;
}

function createWebviewPanel(context) {
    const logger = getOutputChannel();
    const panel = vscode.window.createWebviewPanel(
        'errorAnalysis',
        'RN Error Analyzer',
        vscode.ViewColumn.Two,
        { enableScripts: true, retainContextWhenHidden: true }
    );

    panel.webview.html = getWebviewContent();
    logger.appendLine('Webview panel created');

    panel.webview.onDidReceiveMessage(
        async message => {
            logger.appendLine(`Received message: ${message.command}`);
            
            switch (message.command) {
                case 'analyze':
                    try {
                        logger.appendLine('Starting analysis...');
                        const analysis = await analyzeError(message.error);
                        logger.appendLine('Analysis completed. Sending results to webview...');
                        logger.appendLine(`Analysis result: ${JSON.stringify(analysis, null, 2)}`);
                        
                        panel.webview.postMessage({
                            type: 'analysis',
                            result: analysis
                        });
                    } catch (err) {
                        logger.appendLine(`Error during analysis: ${err.message}`);
                        panel.webview.postMessage({
                            type: 'error',
                            message: `Analysis failed: ${err.message}`
                        });
                    }
                    return;

                case 'getSelectedText':
                    const editor = vscode.window.activeTextEditor;
                    if (editor) {
                        const text = editor.document.getText(editor.selection);
                        if (text) {
                            panel.webview.postMessage({
                                command: 'selectedText',
                                text: text
                            });
                        }
                    }
                    return;
            }
        },
        undefined,
        context.subscriptions
    );

    return panel;
}

function activate(context) {
    const logger = getOutputChannel();
    logger.show();
    logger.appendLine('Activating RN Bug Analyzer extension...');

    let disposable = vscode.commands.registerCommand('rn-bug-analyzer.analyze', () => {
        if (currentPanel) {
            currentPanel.reveal();
        } else {
            currentPanel = createWebviewPanel(context);
            currentPanel.onDidDispose(() => {
                currentPanel = undefined;
            });
        }
    });

    context.subscriptions.push(disposable);
}

function deactivate() {
    if (outputChannel) {
        outputChannel.dispose();
    }
}

module.exports = {
    activate,
    deactivate
};