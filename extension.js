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
        <style>
            body { 
                padding: 1rem; 
                font-family: system-ui, -apple-system, sans-serif;
                color: var(--vscode-editor-foreground);
                background-color: var(--vscode-editor-background);
            }
            textarea { 
                width: 100%; 
                min-height: 120px; 
                margin: 1rem 0;
                padding: 8px;
                background-color: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                border-radius: 4px;
            }
            button {
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
            }
            button:hover {
                background-color: var(--vscode-button-hoverBackground);
            }
            #result { 
                white-space: pre-wrap;
                margin-top: 1rem;
                padding: 1rem;
                background-color: var(--vscode-editor-inactiveSelectionBackground);
                border-radius: 4px;
            }
            .error {
                color: var(--vscode-errorForeground);
                padding: 1rem;
                border-left: 3px solid var(--vscode-errorForeground);
            }
            .loading {
                margin-top: 1rem;
                color: var(--vscode-textLink-foreground);
            }
            .section {
                margin: 1rem 0;
                padding: 1rem;
                background-color: var(--vscode-editor-inactiveSelectionBackground);
                border-radius: 4px;
            }
            .section-title {
                font-weight: bold;
                margin-bottom: 0.5rem;
            }
            code {
                background-color: var(--vscode-textPreformat-background);
                padding: 2px 4px;
                border-radius: 3px;
            }
        </style>
    </head>
    <body>
        <h2>React Native Error Analyzer</h2>
        <textarea id="errorInput" placeholder="Paste your React Native error message here..."></textarea>
        <button id="analyzeBtn">Analyze Error</button>
        <div id="loading" class="loading" style="display: none;">Analyzing...</div>
        <div id="result"></div>

        <script>
            const vscode = acquireVsCodeApi();
            const errorInput = document.getElementById('errorInput');
            const analyzeBtn = document.getElementById('analyzeBtn');
            const loading = document.getElementById('loading');
            const result = document.getElementById('result');

            // Get selected text if any
            vscode.postMessage({ command: 'getSelectedText' });

            analyzeBtn.onclick = () => {
                const error = errorInput.value.trim();
                if (!error) {
                    result.innerHTML = '<div class="error">Please enter an error message to analyze.</div>';
                    return;
                }
                
                loading.style.display = 'block';
                result.innerHTML = '';
                
                vscode.postMessage({
                    command: 'analyze',
                    error: error
                });
            };

            window.addEventListener('message', event => {
                loading.style.display = 'none';
                
                if (event.data.type === 'error') {
                    result.innerHTML = '<div class="error">' + event.data.message + '</div>';
                    return;
                }

                if (event.data.type === 'analysis') {
                    const analysis = event.data.result;
                    let html = '';
                    
                    if (analysis.type) {
                        html += '<div class="section">';
                        html += '<div class="section-title">Error Type</div>';
                        html += analysis.type;
                        html += '</div>';
                    }

                    if (analysis.cause) {
                        html += '<div class="section">';
                        html += '<div class="section-title">Root Cause</div>';
                        html += analysis.cause;
                        html += '</div>';
                    }

                    if (analysis.solution) {
                        html += '<div class="section">';
                        html += '<div class="section-title">Solution</div>';
                        html += analysis.solution;
                        html += '</div>';
                    }

                    if (analysis.prevention) {
                        html += '<div class="section">';
                        html += '<div class="section-title">Prevention</div>';
                        html += analysis.prevention;
                        html += '</div>';
                    }

                    result.innerHTML = html;
                }

                if (event.data.command === 'selectedText' && event.data.text) {
                    errorInput.value = event.data.text;
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
        { enableScripts: true }
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