import * as vscode from 'vscode';

export interface JSAPIUsage {
  api: string;
  range: vscode.Range;
  line: number;
  context: string; // surrounding code for better detection
}

/**
 * Parse JavaScript/TypeScript documents to extract API usage
 */
export class JSParser {
  /**
   * Extract JavaScript API usage from document
   */
  public extractAPIUsage(text: string, document: vscode.TextDocument): JSAPIUsage[] {
    const apiUsages: JSAPIUsage[] = [];
    
    // Patterns to detect various JavaScript APIs
    const patterns = [
      // Constructor patterns: new IntersectionObserver(), new Promise()
      { regex: /new\s+([\w.]+)\s*\(/g, type: 'constructor' },
      
      // Global API patterns: fetch(), crypto.subtle
      { regex: /\b(fetch|localStorage|sessionStorage|crypto|navigator)\b/g, type: 'global' },
      
      // Observer patterns
      { regex: /\b(IntersectionObserver|ResizeObserver|MutationObserver|PerformanceObserver)\b/g, type: 'observer' },
      
      // Async/await patterns
      { regex: /\basync\s+function/g, type: 'async' },
      { regex: /\bawait\s+/g, type: 'await' },
      
      // Promise patterns
      { regex: /\bPromise\b/g, type: 'promise' },
      
      // Modern JS features
      { regex: /\b(WeakMap|WeakSet|Map|Set)\b/g, type: 'collection' },
      { regex: /\b(Proxy|Reflect)\b/g, type: 'meta' },
      
      // DOM APIs
      { regex: /\b(querySelector|querySelectorAll|getElementById)\b/g, type: 'dom' },
      
      // Web APIs
      { regex: /\b(BroadcastChannel|WebSocket|Worker|ServiceWorker)\b/g, type: 'web' },
      
      // Navigator APIs
      { regex: /navigator\.(share|geolocation|mediaDevices|serviceWorker)/g, type: 'navigator' },
      
      // Document APIs
      { regex: /document\.(startViewTransition|requestStorageAccess)/g, type: 'document' }
    ];

    patterns.forEach(({ regex, type }) => {
      let match;
      while ((match = regex.exec(text)) !== null) {
        const apiName = match[1] || match[0];
        const matchStart = match.index;
        const matchEnd = matchStart + apiName.length;

        // Get position and range
        const startPos = document.positionAt(matchStart);
        const endPos = document.positionAt(matchEnd);
        const range = new vscode.Range(startPos, endPos);

        // Get surrounding context (20 chars before and after)
        const contextStart = Math.max(0, matchStart - 20);
        const contextEnd = Math.min(text.length, matchEnd + 20);
        const context = text.substring(contextStart, contextEnd).trim();

        // Clean up API name for lookups
        const cleanedApi = this.cleanAPIName(apiName, type);

        apiUsages.push({
          api: cleanedApi,
          range: range,
          line: startPos.line,
          context: context
        });
      }
    });

    // Remove duplicates on the same line
    return this.deduplicateUsages(apiUsages);
  }

  /**
   * Clean up API names for consistent lookup
   */
  private cleanAPIName(apiName: string, type: string): string {
    // Remove 'new' keyword
    apiName = apiName.replace(/^new\s+/, '');
    
    // Handle special cases
    if (apiName === 'async function' || apiName.includes('async')) {
      return 'async';
    }
    if (apiName.includes('await')) {
      return 'async'; // Map await to async feature
    }
    
    // Keep full navigator.* and document.* paths
    if (apiName.startsWith('navigator.') || apiName.startsWith('document.')) {
      return apiName;
    }
    
    return apiName.trim();
  }

  /**
   * Remove duplicate API usages on the same line
   */
  private deduplicateUsages(usages: JSAPIUsage[]): JSAPIUsage[] {
    const seen = new Set<string>();
    return usages.filter(usage => {
      const key = `${usage.line}:${usage.api}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Check if position is inside a comment
   */
  public isInsideComment(document: vscode.TextDocument, position: vscode.Position): boolean {
    const line = document.lineAt(position.line).text;
    const charPos = position.character;
    
    // Check for single-line comment
    const singleComment = line.indexOf('//');
    if (singleComment !== -1 && charPos > singleComment) {
      return true;
    }
    
    // TODO: Add multi-line comment detection if needed
    return false;
  }
}
