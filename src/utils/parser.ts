import * as vscode from 'vscode';

export interface CSSProperty {
  name: string;
  value: string;
  range: vscode.Range;
  line: number;
}

/**
 * Parse CSS documents to extract properties
 */
export class CSSParser {
  /**
   * Extract all CSS properties from document
   */
  public extractCSSProperties(text: string, document: vscode.TextDocument): CSSProperty[] {
    const properties: CSSProperty[] = [];
    
    // Regex to match CSS property declarations
    // Matches: property-name: value;
    const propertyRegex = /([\w-]+)\s*:\s*([^;]+);/g;
    
    let match;
    while ((match = propertyRegex.exec(text)) !== null) {
      const propertyName = match[1];
      const propertyValue = match[2].trim();
      const matchStart = match.index;
      const matchEnd = matchStart + match[0].length;

      // Get position and range
      const startPos = document.positionAt(matchStart);
      const endPos = document.positionAt(matchStart + propertyName.length);
      const range = new vscode.Range(startPos, endPos);

      properties.push({
        name: propertyName,
        value: propertyValue,
        range: range,
        line: startPos.line
      });
    }

    return properties;
  }

  /**
   * Check if position is inside a CSS rule block
   */
  public isInsideRuleBlock(document: vscode.TextDocument, position: vscode.Position): boolean {
    const text = document.getText();
    const offset = document.offsetAt(position);
    
    let braceDepth = 0;
    for (let i = 0; i < offset; i++) {
      if (text[i] === '{') braceDepth++;
      if (text[i] === '}') braceDepth--;
    }

    return braceDepth > 0;
  }
}
