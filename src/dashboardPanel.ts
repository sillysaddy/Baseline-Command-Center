import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { BaselineDataProvider } from './baselineData';
import { CSSParser } from './utils/parser';
import { JSParser } from './utils/jsParser';

interface ProjectStats {
  totalFiles: number;
  cssFiles: number;
  jsFiles: number;
  totalCSSProperties: number;
  totalJSAPIs: number;
  baselineCSSCount: number;
  limitedCSSCount: number;
  nonBaselineCSSCount: number;
  baselineJSCount: number;
  limitedJSCount: number;
  nonBaselineJSCount: number;
  baselineScore: number;
}

export class BaselineDashboardPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = 'baselineDashboard';
  
  private _view?: vscode.WebviewView;
  private dataProvider: BaselineDataProvider;
  private cssParser: CSSParser;
  private jsParser: JSParser;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    dataProvider: BaselineDataProvider
  ) {
    this.dataProvider = dataProvider;
    this.cssParser = new CSSParser();
    this.jsParser = new JSParser();
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'refresh':
          await this.refresh();
          break;
        case 'analyzeProject':
          await this.analyzeProject();
          break;
      }
    });

    // Initial load
    this.refresh();
  }

  public async refresh() {
    if (this._view) {
      const stats = await this.getProjectStats();
      this._view.webview.postMessage({ type: 'update', stats });
    }
  }

  private async getProjectStats(): Promise<ProjectStats> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    
    if (!workspaceFolders) {
      return this.getEmptyStats();
    }

    let totalFiles = 0;
    let cssFiles = 0;
    let jsFiles = 0;
    let totalCSSProperties = 0;
    let totalJSAPIs = 0;
    let baselineCSSCount = 0;
    let limitedCSSCount = 0;
    let nonBaselineCSSCount = 0;
    let baselineJSCount = 0;
    let limitedJSCount = 0;
    let nonBaselineJSCount = 0;

    // Find all CSS and JS files
    const cssPattern = '**/*.{css,scss,less}';
    const jsPattern = '**/*.{js,ts,jsx,tsx}';
    
    const cssUris = await vscode.workspace.findFiles(cssPattern, '**/node_modules/**', 100);
    const jsUris = await vscode.workspace.findFiles(jsPattern, '**/node_modules/**', 100);

    cssFiles = cssUris.length;
    jsFiles = jsUris.length;
    totalFiles = cssFiles + jsFiles;

    // Analyze CSS files
    for (const uri of cssUris.slice(0, 50)) { // Limit to 50 files for performance
      try {
        const document = await vscode.workspace.openTextDocument(uri);
        const text = document.getText();
        const properties = this.cssParser.extractCSSProperties(text, document);
        
        totalCSSProperties += properties.length;

        for (const prop of properties) {
          const feature = this.dataProvider.getCSSFeature(prop.name);
          if (feature) {
            if (feature.status === 'baseline') baselineCSSCount++;
            else if (feature.status === 'limited') limitedCSSCount++;
            else nonBaselineCSSCount++;
          }
        }
      } catch (error) {
        console.error('Error analyzing CSS file:', error);
      }
    }

    // Analyze JS files
    for (const uri of jsUris.slice(0, 50)) { // Limit to 50 files for performance
      try {
        const document = await vscode.workspace.openTextDocument(uri);
        const text = document.getText();
        const apis = this.jsParser.extractAPIUsage(text, document);
        
        totalJSAPIs += apis.length;

        const seenOnLine = new Set<number>();
        for (const api of apis) {
          if (seenOnLine.has(api.line)) continue;
          seenOnLine.add(api.line);

          const feature = this.dataProvider.getJSFeature(api.api);
          if (feature) {
            if (feature.status === 'baseline') baselineJSCount++;
            else if (feature.status === 'limited') limitedJSCount++;
            else nonBaselineJSCount++;
          }
        }
      } catch (error) {
        console.error('Error analyzing JS file:', error);
      }
    }

    const totalBaseline = baselineCSSCount + baselineJSCount;
    const totalFeatures = totalCSSProperties + totalJSAPIs;
    const baselineScore = totalFeatures > 0 ? Math.round((totalBaseline / totalFeatures) * 100) : 100;

    return {
      totalFiles,
      cssFiles,
      jsFiles,
      totalCSSProperties,
      totalJSAPIs,
      baselineCSSCount,
      limitedCSSCount,
      nonBaselineCSSCount,
      baselineJSCount,
      limitedJSCount,
      nonBaselineJSCount,
      baselineScore
    };
  }

  private getEmptyStats(): ProjectStats {
    return {
      totalFiles: 0,
      cssFiles: 0,
      jsFiles: 0,
      totalCSSProperties: 0,
      totalJSAPIs: 0,
      baselineCSSCount: 0,
      limitedCSSCount: 0,
      nonBaselineCSSCount: 0,
      baselineJSCount: 0,
      limitedJSCount: 0,
      nonBaselineJSCount: 0,
      baselineScore: 100
    };
  }

  private async analyzeProject() {
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Analyzing project for Baseline compatibility...',
        cancellable: false
      },
      async (progress) => {
        progress.report({ increment: 0 });
        await this.refresh();
        progress.report({ increment: 100 });
        vscode.window.showInformationMessage('✅ Project analysis complete!');
      }
    );
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Baseline Dashboard</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 16px;
    }

    h1 {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    h2 {
      font-size: 16px;
      font-weight: 600;
      margin-top: 20px;
      margin-bottom: 12px;
      color: var(--vscode-foreground);
    }

    .subtitle {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 20px;
    }

    .score-container {
      text-align: center;
      padding: 24px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 8px;
      margin-bottom: 20px;
    }

    .score {
      font-size: 48px;
      font-weight: bold;
      color: var(--vscode-charts-green);
      margin-bottom: 8px;
    }

    .score.warning {
      color: var(--vscode-charts-yellow);
    }

    .score.error {
      color: var(--vscode-charts-red);
    }

    .score-label {
      font-size: 14px;
      color: var(--vscode-descriptionForeground);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 20px;
    }

    .stat-card {
      background: var(--vscode-editor-inactiveSelectionBackground);
      padding: 12px;
      border-radius: 4px;
    }

    .stat-value {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 4px;
    }

    .stat-label {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }

    .status-bar {
      display: flex;
      height: 24px;
      border-radius: 4px;
      overflow: hidden;
      margin: 12px 0;
    }

    .status-segment {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 600;
      transition: opacity 0.2s;
    }

    .status-segment:hover {
      opacity: 0.8;
    }

    .status-baseline {
      background: var(--vscode-charts-green);
      color: white;
    }

    .status-limited {
      background: var(--vscode-charts-yellow);
      color: black;
    }

    .status-non-baseline {
      background: var(--vscode-charts-red);
      color: white;
    }

    .breakdown {
      margin-top: 12px;
    }

    .breakdown-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .breakdown-item:last-child {
      border-bottom: none;
    }

    .breakdown-label {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .breakdown-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .dot-baseline {
      background: var(--vscode-charts-green);
    }

    .dot-limited {
      background: var(--vscode-charts-yellow);
    }

    .dot-non-baseline {
      background: var(--vscode-charts-red);
    }

    .breakdown-value {
      font-weight: 600;
    }

    button {
      width: 100%;
      padding: 8px 16px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      margin-top: 16px;
    }

    button:hover {
      background: var(--vscode-button-hoverBackground);
    }

    button:active {
      opacity: 0.8;
    }

    .loading {
      text-align: center;
      padding: 40px 20px;
      color: var(--vscode-descriptionForeground);
    }

    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: var(--vscode-descriptionForeground);
    }

    .empty-state h3 {
      margin-bottom: 8px;
      color: var(--vscode-foreground);
    }
  </style>
</head>
<body>
  <h1>📊 Baseline Dashboard</h1>
  <p class="subtitle">Project-wide compatibility analysis</p>

  <div id="content">
    <div class="loading">Loading project stats...</div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      
      switch (message.type) {
        case 'update':
          updateDashboard(message.stats);
          break;
      }
    });

    function updateDashboard(stats) {
      const content = document.getElementById('content');
      
      if (stats.totalFiles === 0) {
        content.innerHTML = \`
          <div class="empty-state">
            <h3>No workspace open</h3>
            <p>Open a folder to see Baseline statistics</p>
          </div>
        \`;
        return;
      }

      const scoreClass = stats.baselineScore >= 80 ? '' : stats.baselineScore >= 60 ? 'warning' : 'error';
      const totalBaseline = stats.baselineCSSCount + stats.baselineJSCount;
      const totalLimited = stats.limitedCSSCount + stats.limitedJSCount;
      const totalNonBaseline = stats.nonBaselineCSSCount + stats.nonBaselineJSCount;
      const totalFeatures = stats.totalCSSProperties + stats.totalJSAPIs;

      const baselinePercent = totalFeatures > 0 ? (totalBaseline / totalFeatures) * 100 : 0;
      const limitedPercent = totalFeatures > 0 ? (totalLimited / totalFeatures) * 100 : 0;
      const nonBaselinePercent = totalFeatures > 0 ? (totalNonBaseline / totalFeatures) * 100 : 0;

      content.innerHTML = \`
        <div class="score-container">
          <div class="score \${scoreClass}">\${stats.baselineScore}%</div>
          <div class="score-label">Baseline Compatibility Score</div>
        </div>

        <h2>📁 Project Overview</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">\${stats.totalFiles}</div>
            <div class="stat-label">Total Files</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">\${totalFeatures}</div>
            <div class="stat-label">Features Detected</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">\${stats.cssFiles}</div>
            <div class="stat-label">CSS Files</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">\${stats.jsFiles}</div>
            <div class="stat-label">JS/TS Files</div>
          </div>
        </div>

        <h2>🎨 CSS Features</h2>
        <div class="status-bar">
          \${baselinePercent > 0 ? \`<div class="status-segment status-baseline" style="width: \${stats.baselineCSSCount > 0 ? (stats.baselineCSSCount / stats.totalCSSProperties * 100) : 0}%">\${stats.baselineCSSCount}</div>\` : ''}
          \${limitedPercent > 0 ? \`<div class="status-segment status-limited" style="width: \${stats.limitedCSSCount > 0 ? (stats.limitedCSSCount / stats.totalCSSProperties * 100) : 0}%">\${stats.limitedCSSCount}</div>\` : ''}
          \${nonBaselinePercent > 0 ? \`<div class="status-segment status-non-baseline" style="width: \${stats.nonBaselineCSSCount > 0 ? (stats.nonBaselineCSSCount / stats.totalCSSProperties * 100) : 0}%">\${stats.nonBaselineCSSCount}</div>\` : ''}
        </div>
        <div class="breakdown">
          <div class="breakdown-item">
            <div class="breakdown-label">
              <div class="breakdown-dot dot-baseline"></div>
              <span>Baseline</span>
            </div>
            <div class="breakdown-value">\${stats.baselineCSSCount}</div>
          </div>
          <div class="breakdown-item">
            <div class="breakdown-label">
              <div class="breakdown-dot dot-limited"></div>
              <span>Limited</span>
            </div>
            <div class="breakdown-value">\${stats.limitedCSSCount}</div>
          </div>
          <div class="breakdown-item">
            <div class="breakdown-label">
              <div class="breakdown-dot dot-non-baseline"></div>
              <span>Non-Baseline</span>
            </div>
            <div class="breakdown-value">\${stats.nonBaselineCSSCount}</div>
          </div>
        </div>

        <h2>⚡ JavaScript APIs</h2>
        <div class="status-bar">
          \${stats.baselineJSCount > 0 ? \`<div class="status-segment status-baseline" style="width: \${(stats.baselineJSCount / stats.totalJSAPIs * 100)}%">\${stats.baselineJSCount}</div>\` : ''}
          \${stats.limitedJSCount > 0 ? \`<div class="status-segment status-limited" style="width: \${(stats.limitedJSCount / stats.totalJSAPIs * 100)}%">\${stats.limitedJSCount}</div>\` : ''}
          \${stats.nonBaselineJSCount > 0 ? \`<div class="status-segment status-non-baseline" style="width: \${(stats.nonBaselineJSCount / stats.totalJSAPIs * 100)}%">\${stats.nonBaselineJSCount}</div>\` : ''}
        </div>
        <div class="breakdown">
          <div class="breakdown-item">
            <div class="breakdown-label">
              <div class="breakdown-dot dot-baseline"></div>
              <span>Baseline</span>
            </div>
            <div class="breakdown-value">\${stats.baselineJSCount}</div>
          </div>
          <div class="breakdown-item">
            <div class="breakdown-label">
              <div class="breakdown-dot dot-limited"></div>
              <span>Limited</span>
            </div>
            <div class="breakdown-value">\${stats.limitedJSCount}</div>
          </div>
          <div class="breakdown-item">
            <div class="breakdown-label">
              <div class="breakdown-dot dot-non-baseline"></div>
              <span>Non-Baseline</span>
            </div>
            <div class="breakdown-value">\${stats.nonBaselineJSCount}</div>
          </div>
        </div>

        <button onclick="refresh()">🔄 Refresh Analysis</button>
        <button onclick="analyzeProject()">🔍 Deep Scan Project</button>
      \`;
    }

    function refresh() {
      vscode.postMessage({ type: 'refresh' });
    }

    function analyzeProject() {
      vscode.postMessage({ type: 'analyzeProject' });
    }

    // Request initial data
    vscode.postMessage({ type: 'refresh' });
  </script>
</body>
</html>`;
  }
}
