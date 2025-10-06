import * as vscode from 'vscode';

export class TooltipActions {
  /**
   * Register commands for tooltip actions
   */
  public static registerCommands(context: vscode.ExtensionContext): void {
    // Open MDN documentation
    context.subscriptions.push(
      vscode.commands.registerCommand('baseline.openMDN', (url: string) => {
        if (url) {
          vscode.env.openExternal(vscode.Uri.parse(url));
        }
      })
    );

    // Open Can I Use
    context.subscriptions.push(
      vscode.commands.registerCommand('baseline.openCanIUse', (featureName: string) => {
        const url = `https://caniuse.com/?search=${encodeURIComponent(featureName)}`;
        vscode.env.openExternal(vscode.Uri.parse(url));
      })
    );

    // Copy code example
    context.subscriptions.push(
      vscode.commands.registerCommand('baseline.copyExample', (code: string) => {
        vscode.env.clipboard.writeText(code);
        vscode.window.showInformationMessage('📋 Code example copied to clipboard!');
      })
    );

    // Show alternative solutions
    context.subscriptions.push(
      vscode.commands.registerCommand('baseline.showAlternatives', (featureId: string) => {
        // Could open a webview with alternative solutions
        vscode.window.showInformationMessage(`Showing alternatives for: ${featureId}`);
      })
    );
  }
}
