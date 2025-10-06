import * as vscode from 'vscode';
import { BaselineDataProvider } from './baselineData';
import { CSSDecorator } from './cssDecorator';
import { JSDecorator } from './jsDecorator';
import { BaselineDashboardPanel } from './dashboardPanel';
import { TooltipActions } from './tooltipActions'; // <-- added import

let dataProvider: BaselineDataProvider;
let cssDecorator: CSSDecorator;
let jsDecorator: JSDecorator;
let dashboardPanel: BaselineDashboardPanel;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  console.log('🚀 Baseline Command Center is now active');

  // Register tooltip actions
  TooltipActions.registerCommands(context);

  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = '$(check) Baseline';
  statusBarItem.tooltip = 'Baseline Command Center Active';
  statusBarItem.command = 'baseline.showDashboard';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  try {
    // Initialize data provider
    dataProvider = new BaselineDataProvider(context);

    // Initialize decorators
    cssDecorator = new CSSDecorator(dataProvider);
    jsDecorator = new JSDecorator(dataProvider);

    // Initialize dashboard panel
    dashboardPanel = new BaselineDashboardPanel(context.extensionUri, dataProvider);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        BaselineDashboardPanel.viewType,
        dashboardPanel
      )
    );

    // Register hover providers
    context.subscriptions.push(cssDecorator.registerHoverProvider());
    context.subscriptions.push(jsDecorator.registerHoverProvider());

    // Show stats in status bar
    const stats = dataProvider.getStats();
    statusBarItem.text = `$(check) Baseline (${stats.css} CSS, ${stats.js} JS)`;
    
    console.log(`Loaded ${stats.css} CSS features, ${stats.js} JS APIs`);

    // Decorate active editor on activation
    if (vscode.window.activeTextEditor) {
      decorateEditor(vscode.window.activeTextEditor);
    }

    // Decorate when editor changes
    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
          updateStatusBar(editor);
          decorateEditor(editor);
        }
      })
    );

    // Decorate when document changes (debounced)
    let timeout: NodeJS.Timeout | undefined;
    context.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        if (editor && event.document === editor.document) {
          if (timeout) {
            clearTimeout(timeout);
          }
          timeout = setTimeout(() => {
            decorateEditor(editor);
            dashboardPanel.refresh(); // Update dashboard on changes
          }, 500);
        }
      })
    );

    // Register commands
    context.subscriptions.push(
      vscode.commands.registerCommand('baseline.checkCompatibility', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          decorateEditor(editor);
          vscode.window.showInformationMessage('✅ Baseline compatibility check complete');
        } else {
          vscode.window.showWarningMessage('⚠️ No active editor to check');
        }
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('baseline.refreshData', async () => {
        statusBarItem.text = '$(sync~spin) Baseline (refreshing...)';
        await dataProvider.refresh();
        const stats = dataProvider.getStats();
        statusBarItem.text = `$(check) Baseline (${stats.css} CSS, ${stats.js} JS)`;
        if (vscode.window.activeTextEditor) {
          decorateEditor(vscode.window.activeTextEditor);
        }
        dashboardPanel.refresh();
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('baseline.showDashboard', () => {
        vscode.commands.executeCommand('baselineDashboard.focus');
      })
    );

  } catch (error) {
    statusBarItem.text = '$(error) Baseline Error';
    statusBarItem.tooltip = `Error: ${error}`;
    vscode.window.showErrorMessage(`❌ Baseline activation failed: ${error}`);
    console.error('Baseline activation error:', error);
  }
}

function updateStatusBar(editor: vscode.TextEditor) {
  const isCss = ['css', 'scss', 'less'].includes(editor.document.languageId);
  const isJs = ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(editor.document.languageId);
  
  if (isCss || isJs) {
    const type = isCss ? 'CSS' : 'JS';
    statusBarItem.text = `$(check) Baseline (${type} Active)`;
    statusBarItem.backgroundColor = undefined;
  } else {
    const stats = dataProvider.getStats();
    statusBarItem.text = `$(check) Baseline (${stats.css} CSS, ${stats.js} JS)`;
    statusBarItem.backgroundColor = undefined;
  }
}

async function decorateEditor(editor: vscode.TextEditor): Promise<void> {
  const config = vscode.workspace.getConfiguration('baseline');
  
  if (!config.get('enableInlineBadges', true)) {
    return;
  }

  console.log('Decorating editor:', editor.document.fileName);
  
  // Decorate CSS files
  if (['css', 'scss', 'less'].includes(editor.document.languageId)) {
    await cssDecorator.decorateDocument(editor);
  }
  
  // Decorate JavaScript/TypeScript files
  if (['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(editor.document.languageId)) {
    await jsDecorator.decorateDocument(editor);
  }
}

export function deactivate() {
  if (cssDecorator) {
    cssDecorator.dispose();
  }
  if (jsDecorator) {
    jsDecorator.dispose();
  }
  if (statusBarItem) {
    statusBarItem.dispose();
  }
}
