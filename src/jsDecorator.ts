import * as vscode from 'vscode';
import { BaselineDataProvider, JSFeature } from './baselineData';
import { JSParser } from './utils/jsParser';
import { TooltipBuilder } from './tooltipBuilder';

/**
 * Manages inline decorations for JavaScript APIs showing Baseline status
 */
export class JSDecorator {
  private dataProvider: BaselineDataProvider;
  private parser: JSParser;
  
  private baselineDecoration: vscode.TextEditorDecorationType;
  private limitedDecoration: vscode.TextEditorDecorationType;
  private nonBaselineDecoration: vscode.TextEditorDecorationType;

  private hoverProvider: vscode.Disposable | undefined;

  constructor(dataProvider: BaselineDataProvider) {
    this.dataProvider = dataProvider;
    this.parser = new JSParser();
    
    console.log('🎨 JSDecorator: Initializing decorations...');
    
    this.baselineDecoration = vscode.window.createTextEditorDecorationType({
      after: {
        contentText: ' ✓ Baseline',
        color: new vscode.ThemeColor('charts.green'),
        fontWeight: 'bold',
        margin: '0 0 0 2em'
      },
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
    });

    this.limitedDecoration = vscode.window.createTextEditorDecorationType({
      after: {
        contentText: ' ⚠ Limited',
        color: new vscode.ThemeColor('charts.yellow'),
        fontWeight: 'bold',
        margin: '0 0 0 2em'
      },
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
    });

    this.nonBaselineDecoration = vscode.window.createTextEditorDecorationType({
      after: {
        contentText: ' ✗ Not Baseline',
        color: new vscode.ThemeColor('charts.red'),
        fontWeight: 'bold',
        margin: '0 0 0 2em'
      },
      backgroundColor: new vscode.ThemeColor('errorBackground'),
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
    });
    
    console.log('✅ JSDecorator: Decorations initialized');
  }

  public async decorateDocument(editor: vscode.TextEditor): Promise<void> {
    console.log('🔍 JSDecorator: Starting decoration for', editor.document.fileName);
    
    const document = editor.document;
    
    if (!this.isJSDocument(document)) {
      console.log('⏭️ JSDecorator: Not a JS/TS document, skipping');
      return;
    }

    console.log('📝 JSDecorator: Parsing JavaScript APIs...');
    const text = document.getText();
    const apiUsages = this.parser.extractAPIUsage(text, document);

    console.log(`🔢 JSDecorator: Found ${apiUsages.length} API usages`);

    const baselineDecorations: vscode.DecorationOptions[] = [];
    const limitedDecorations: vscode.DecorationOptions[] = [];
    const nonBaselineDecorations: vscode.DecorationOptions[] = [];

    // Group by line to avoid duplicate badges
    const lineFeatures = new Map<number, JSFeature>();

    for (const usage of apiUsages) {
      console.log(`  - API: ${usage.api}`);
      const feature = this.dataProvider.getJSFeature(usage.api);
      
      if (!feature) {
        console.log(`    ⚠️ No Baseline data for: ${usage.api}`);
        continue;
      }

      console.log(`    ✓ Found feature: ${feature.name}, status: ${feature.status}`);

      // Only add one badge per line (the first feature found)
      if (!lineFeatures.has(usage.line)) {
        lineFeatures.set(usage.line, feature);
      }
    }

    // Create decorations at end of each line
    for (const [lineNumber, feature] of lineFeatures) {
      const line = document.lineAt(lineNumber);
      const endOfLine = line.range.end;
      
      const decoration: vscode.DecorationOptions = {
        range: new vscode.Range(endOfLine, endOfLine),
        hoverMessage: TooltipBuilder.createJSTooltip(feature) // Use new tooltip builder
      };

      switch (feature.status) {
        case 'baseline':
          baselineDecorations.push(decoration);
          break;
        case 'limited':
          limitedDecorations.push(decoration);
          break;
        case 'not-baseline':
          nonBaselineDecorations.push(decoration);
          break;
      }
    }

    console.log(`📊 Applying JS decorations: ${baselineDecorations.length} baseline, ${limitedDecorations.length} limited, ${nonBaselineDecorations.length} non-baseline`);

    editor.setDecorations(this.baselineDecoration, baselineDecorations);
    editor.setDecorations(this.limitedDecoration, limitedDecorations);
    editor.setDecorations(this.nonBaselineDecoration, nonBaselineDecorations);
    
    console.log('✅ JSDecorator: Decorations applied');
    
    if (apiUsages.length > 0) {
      vscode.window.showInformationMessage(
        `Baseline: Found ${apiUsages.length} JS APIs (${baselineDecorations.length} baseline-ready)`
      );
    }
  }

  private provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.Hover | undefined {
    const range = document.getWordRangeAtPosition(position, /[\w.]+/);
    if (!range) {
      return undefined;
    }

    const word = document.getText(range);
    const feature = this.dataProvider.getJSFeature(word);

    if (!feature) {
      return undefined;
    }

    return new vscode.Hover(TooltipBuilder.createJSTooltip(feature), range);
  }

  private isJSDocument(document: vscode.TextDocument): boolean {
    const jsLanguages = ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'];
    const isJs = jsLanguages.includes(document.languageId);
    console.log(`📄 Document language: ${document.languageId}, is JS: ${isJs}`);
    return isJs;
  }

  public registerHoverProvider(): vscode.Disposable {
    if (this.hoverProvider) {
      this.hoverProvider.dispose();
    }

    console.log('👆 Registering JS hover provider...');

    this.hoverProvider = vscode.languages.registerHoverProvider(
      [
        { language: 'javascript', scheme: 'file' },
        { language: 'javascript', scheme: 'untitled' },
        { language: 'typescript', scheme: 'file' },
        { language: 'typescript', scheme: 'untitled' },
        { language: 'javascriptreact', scheme: 'file' },
        { language: 'javascriptreact', scheme: 'untitled' },
        { language: 'typescriptreact', scheme: 'file' },
        { language: 'typescriptreact', scheme: 'untitled' }
      ],
      {
        provideHover: (document, position) => {
          return this.provideHover(document, position);
        }
      }
    );

    return this.hoverProvider;
  }

  public dispose(): void {
    this.baselineDecoration.dispose();
    this.limitedDecoration.dispose();
    this.nonBaselineDecoration.dispose();
    
    if (this.hoverProvider) {
      this.hoverProvider.dispose();
    }
  }
}
