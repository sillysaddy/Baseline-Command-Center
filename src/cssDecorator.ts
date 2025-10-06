import * as vscode from 'vscode';
import { BaselineDataProvider, CSSFeature } from './baselineData';
import { CSSParser } from './utils/parser';
import { TooltipBuilder } from './tooltipBuilder';

export class CSSDecorator {
  private dataProvider: BaselineDataProvider;
  private parser: CSSParser;
  
  private baselineDecoration: vscode.TextEditorDecorationType;
  private limitedDecoration: vscode.TextEditorDecorationType;
  private nonBaselineDecoration: vscode.TextEditorDecorationType;

  private hoverProvider: vscode.Disposable | undefined;

  constructor(dataProvider: BaselineDataProvider) {
    this.dataProvider = dataProvider;
    this.parser = new CSSParser();
    
    console.log('🎨 CSSDecorator: Initializing decorations...');
    
    // Use 'after' decorations that appear at end of line
    this.baselineDecoration = vscode.window.createTextEditorDecorationType({
      after: {
        contentText: ' ✓ Baseline',
        color: new vscode.ThemeColor('charts.green'),
        fontWeight: 'bold',
        margin: '0 0 0 2em' // More margin to separate from code
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
    
    console.log('✅ CSSDecorator: Decorations initialized');
  }

  public async decorateDocument(editor: vscode.TextEditor): Promise<void> {
    console.log('🔍 CSSDecorator: Starting decoration for', editor.document.fileName);
    
    const document = editor.document;
    
    if (!this.isCSSDocument(document)) {
      console.log('⏭️ CSSDecorator: Not a CSS document, skipping');
      return;
    }

    console.log('📝 CSSDecorator: Parsing CSS properties...');
    const text = document.getText();
    const properties = this.parser.extractCSSProperties(text, document);

    console.log(`🔢 CSSDecorator: Found ${properties.length} CSS properties`);

    const baselineDecorations: vscode.DecorationOptions[] = [];
    const limitedDecorations: vscode.DecorationOptions[] = [];
    const nonBaselineDecorations: vscode.DecorationOptions[] = [];

    for (const prop of properties) {
      console.log(`  - Property: ${prop.name}`);
      const feature = this.dataProvider.getCSSFeature(prop.name);
      
      if (!feature) {
        console.log(`    ⚠️ No Baseline data for: ${prop.name}`);
        continue;
      }

      console.log(`    ✓ Found feature: ${feature.name}, status: ${feature.status}`);

      // Create decoration at END OF LINE, not at property position
      const line = document.lineAt(prop.line);
      const endOfLine = line.range.end;
      
      const decoration: vscode.DecorationOptions = {
        range: new vscode.Range(endOfLine, endOfLine), // Zero-width range at end of line
        hoverMessage: TooltipBuilder.createCSSTooltip(feature) // Use new tooltip builder
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

    console.log(`📊 Applying decorations: ${baselineDecorations.length} baseline, ${limitedDecorations.length} limited, ${nonBaselineDecorations.length} non-baseline`);

    editor.setDecorations(this.baselineDecoration, baselineDecorations);
    editor.setDecorations(this.limitedDecoration, limitedDecorations);
    editor.setDecorations(this.nonBaselineDecoration, nonBaselineDecorations);
    
    console.log('✅ CSSDecorator: Decorations applied');
    
    vscode.window.showInformationMessage(
      `Baseline: Found ${properties.length} properties (${baselineDecorations.length} baseline-ready)`
    );
  }

  private isCSSDocument(document: vscode.TextDocument): boolean {
    const cssLanguages = ['css', 'scss', 'less', 'postcss'];
    const isCss = cssLanguages.includes(document.languageId);
    console.log(`📄 Document language: ${document.languageId}, is CSS: ${isCss}`);
    return isCss;
  }

  public registerHoverProvider(): vscode.Disposable {
    if (this.hoverProvider) {
      this.hoverProvider.dispose();
    }

    console.log('👆 Registering hover provider...');

    this.hoverProvider = vscode.languages.registerHoverProvider(
      [
        { language: 'css', scheme: 'file' },
        { language: 'css', scheme: 'untitled' },
        { language: 'scss', scheme: 'file' },
        { language: 'scss', scheme: 'untitled' },
        { language: 'less', scheme: 'file' },
        { language: 'less', scheme: 'untitled' }
      ],
      {
        provideHover: (document, position) => {
          return this.provideHover(document, position);
        }
      }
    );

    return this.hoverProvider;
  }

  private provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.Hover | undefined {
    const range = document.getWordRangeAtPosition(position, /[\w-]+/);
    if (!range) {
      return undefined;
    }

    const word = document.getText(range);
    const feature = this.dataProvider.getCSSFeature(word);

    if (!feature) {
      return undefined;
    }

    return new vscode.Hover(TooltipBuilder.createCSSTooltip(feature), range);
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
