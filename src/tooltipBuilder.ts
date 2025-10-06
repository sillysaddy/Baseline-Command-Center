import * as vscode from 'vscode';
import { BaselineFeature, CSSFeature, JSFeature } from './baselineData';

export class TooltipBuilder {
  /**
   * Create a rich hover tooltip for CSS features
   */
  public static createCSSTooltip(feature: CSSFeature): vscode.MarkdownString {
    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;
    // supportHtml is still available on MarkdownString in many VS Code versions
    // keep it for richer content; fallbacks will ignore it if unsupported.
    // @ts-ignore
    markdown.supportHtml = true;

    // Header with status emoji
    const statusEmoji = this.getStatusEmoji(feature.status);
    markdown.appendMarkdown(`### ${statusEmoji} ${feature.name}\n\n`);

    // Status badge with timeline
    this.appendStatusSection(markdown, feature);

    // Description
    if (feature.description) {
      markdown.appendMarkdown(`${feature.description}\n\n`);
    }

    // Browser support table
    this.appendBrowserSupport(markdown, feature.browserSupport);

    // Properties list
    if (feature.properties && feature.properties.length > 0) {
      markdown.appendMarkdown(`**Properties:**\n\n`);
      feature.properties.forEach(prop => {
        markdown.appendMarkdown(`- \`${prop}\`\n`);
      });
      markdown.appendMarkdown('\n');
    }

    // Code examples
    this.appendCSSExample(markdown, feature);

    // Migration tips for non-baseline features
    if (feature.status !== 'baseline') {
      this.appendMigrationTips(markdown, feature);
    }

    // Links
    this.appendLinks(markdown, feature);

    // Footer
    markdown.appendMarkdown(`---\n\n`);
    markdown.appendMarkdown(`💡 *Click to see full documentation*\n`);

    return markdown;
  }

  /**
   * Create a rich hover tooltip for JavaScript APIs
   */
  public static createJSTooltip(feature: JSFeature): vscode.MarkdownString {
    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;
    // @ts-ignore
    markdown.supportHtml = true;

    // Header with status emoji
    const statusEmoji = this.getStatusEmoji(feature.status);
    markdown.appendMarkdown(`### ${statusEmoji} ${feature.name}\n\n`);

    // API name
    if (feature.api) {
      markdown.appendMarkdown(`**API:** \`${feature.api}\`\n\n`);
    }

    // Status badge with timeline
    this.appendStatusSection(markdown, feature);

    // Description
    if (feature.description) {
      markdown.appendMarkdown(`${feature.description}\n\n`);
    }

    // Browser support table
    this.appendBrowserSupport(markdown, feature.browserSupport);

    // Available methods
    if (feature.methods && feature.methods.length > 0) {
      markdown.appendMarkdown(`**Available Methods:**\n\n`);
      const methodsBlock = feature.methods.map(m => `${m}()`).join('\n');
      markdown.appendMarkdown('```\n' + methodsBlock + '\n```\n\n');
    }

    // Code examples
    this.appendJSExample(markdown, feature);

    // Migration tips for non-baseline features
    if (feature.status !== 'baseline') {
      this.appendJSMigrationTips(markdown, feature);
    }

    // Links
    this.appendLinks(markdown, feature);

    // Footer
    markdown.appendMarkdown(`---\n\n`);
    markdown.appendMarkdown(`💡 *Click to see full documentation*\n`);

    return markdown;
  }

  /**
   * Get status emoji
   */
  private static getStatusEmoji(status: string): string {
    const emojis: Record<string, string> = {
      'baseline': '✅',
      'limited': '⚠️',
      'not-baseline': '❌'
    };
    return emojis[status] || '❓';
  }

  /**
   * Append status section with timeline
   */
  private static appendStatusSection(markdown: vscode.MarkdownString, feature: BaselineFeature): void {
    if (feature.status === 'baseline') {
      const since = feature.since ? ` since ${feature.since}` : '';
      markdown.appendMarkdown(`**🎯 Baseline Feature**${since}\n\n`);
      markdown.appendMarkdown('✓ Widely available across all major browsers\n');
      markdown.appendMarkdown('✓ Safe to use in production\n\n');
    } else if (feature.status === 'limited') {
      const since = feature.since ? ` since ${feature.since}` : '';
      markdown.appendMarkdown(`**⚠️ Newly Available**${since}\n\n`);
      markdown.appendMarkdown('⚠ Available in recent browser versions\n');
      markdown.appendMarkdown('⚠ Consider fallbacks for older browsers\n\n');
    } else {
      markdown.appendMarkdown('**❌ Not Baseline**\n\n');
      markdown.appendMarkdown('❌ Limited browser support\n');
      markdown.appendMarkdown('❌ Requires polyfills or alternatives\n\n');
    }
  }

  /**
   * Append browser support table
   */
  private static appendBrowserSupport(
    markdown: vscode.MarkdownString,
    browserSupport: BaselineFeature['browserSupport']
  ): void {
    if (!browserSupport || Object.keys(browserSupport).length === 0) {
      return;
    }

    markdown.appendMarkdown('**Browser Support:**\n\n');
    markdown.appendMarkdown('| Browser | Version |\n');
    markdown.appendMarkdown('|---------|---------|\n');

    const browsers = [
      { name: 'Chrome', key: 'chrome' as const, emoji: '🟢' },
      { name: 'Edge', key: 'edge' as const, emoji: '🔵' },
      { name: 'Firefox', key: 'firefox' as const, emoji: '🟠' },
      { name: 'Safari', key: 'safari' as const, emoji: '🔵' }
    ];

    browsers.forEach(browser => {
      const version = browserSupport[browser.key];
      if (version && version !== 'No') {
        markdown.appendMarkdown(`| ${browser.emoji} ${browser.name} | ${version}+ |\n`);
      } else if (version === 'No') {
        markdown.appendMarkdown(`| ${browser.emoji} ${browser.name} | ❌ Not supported |\n`);
      }
    });

    markdown.appendMarkdown('\n');
  }

  /**
   * Append CSS code example
   */
  private static appendCSSExample(markdown: vscode.MarkdownString, feature: CSSFeature): void {
    const examples: Record<string, string> = {
      'css-flexbox': `.container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}`,
      'css-grid': `.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
}`,
      'css-gap': `.flex-container {
  display: flex;
  gap: 1rem;
}`,
      'css-container-queries': `.card {
  container-type: inline-size;
}

@container (min-width: 400px) {
  .card-content {
    display: grid;
  }
}`,
      'css-backdrop-filter': `.glassmorphism {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
}`
    };

    const example = examples[feature.id];
    if (example) {
      markdown.appendMarkdown(`**Example:**\n\n`);
      markdown.appendMarkdown('```css\n' + example + '\n```\n\n');
    }
  }

  /**
   * Append JavaScript code example
   */
  private static appendJSExample(markdown: vscode.MarkdownString, feature: JSFeature): void {
    const examples: Record<string, string> = {
      'fetch-api': `async function getData() {
  const response = await fetch('/api/data');
  const data = await response.json();
  return data;
}`,
      'intersection-observer': `const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
});

observer.observe(element);`,
      'promises': `const promise = new Promise((resolve, reject) => {
  setTimeout(() => resolve('Done!'), 1000);
});

promise
  .then(result => console.log(result))
  .catch(error => console.error(error));`,
      'async-await': `async function processData() {
  try {
    const data = await fetchData();
    const processed = await transformData(data);
    return processed;
  } catch (error) {
    console.error('Error:', error);
  }
}`,
      'resize-observer': `const resizeObserver = new ResizeObserver(entries => {
  entries.forEach(entry => {
    console.log('New size:', entry.contentRect);
  });
});

resizeObserver.observe(element);`,
      'local-storage': `// Save data
localStorage.setItem('user', JSON.stringify(userData));

// Retrieve data
const user = JSON.parse(localStorage.getItem('user'));

// Remove data
localStorage.removeItem('user');`
    };

    const example = examples[feature.id];
    if (example) {
      markdown.appendMarkdown(`**Example:**\n\n`);
      markdown.appendMarkdown('```js\n' + example + '\n```\n\n');
    }
  }

  /**
   * Append migration tips for CSS
   */
  private static appendMigrationTips(markdown: vscode.MarkdownString, feature: CSSFeature): void {
    markdown.appendMarkdown(`**💡 Migration Tips:**\n\n`);

    const tips: Record<string, string[]> = {
      'css-container-queries': [
        'Use `@supports` to detect support',
        'Provide fallback layouts using media queries',
        'Consider using PostCSS plugin for better support'
      ],
      'css-color-oklch': [
        'Provide fallback colors using standard formats',
        'Use progressive enhancement',
        'Test thoroughly in target browsers'
      ]
    };

    const featureTips = tips[feature.id];
    if (featureTips) {
      featureTips.forEach(tip => {
        markdown.appendMarkdown(`- ${tip}\n`);
      });
      markdown.appendMarkdown('\n');
    } else {
      markdown.appendMarkdown(`- Test in your target browsers\n`);
      markdown.appendMarkdown(`- Provide appropriate fallbacks\n`);
      markdown.appendMarkdown(`- Consider feature detection\n\n`);
    }
  }

  /**
   * Append migration tips for JavaScript
   */
  private static appendJSMigrationTips(markdown: vscode.MarkdownString, feature: JSFeature): void {
    markdown.appendMarkdown(`**💡 Migration Tips:**\n\n`);

    const tips: Record<string, string[]> = {
      'view-transitions': [
        'Check for feature support: `if (document.startViewTransition)`',
        'Provide fallback for browsers without support',
        'Use progressive enhancement approach'
      ],
      'web-share-api': [
        'Check `navigator.share` availability',
        'Provide traditional sharing fallbacks',
        'Graceful degradation for desktop browsers'
      ]
    };

    const featureTips = tips[feature.id];
    if (featureTips) {
      featureTips.forEach(tip => {
        markdown.appendMarkdown(`- ${tip}\n`);
      });
      markdown.appendMarkdown('\n');
    } else {
      markdown.appendMarkdown(`- Use feature detection before using API\n`);
      markdown.appendMarkdown(`- Consider polyfills if needed\n`);
      markdown.appendMarkdown(`- Provide graceful degradation\n\n`);
    }
  }

  /**
   * Append documentation links
   */
  private static appendLinks(markdown: vscode.MarkdownString, feature: BaselineFeature): void {
    markdown.appendMarkdown(`**Resources:**\n\n`);

    if (feature.mdn_url) {
      markdown.appendMarkdown(`- [📚 MDN Documentation](${feature.mdn_url})\n`);
    }

    if (feature.spec_url) {
      markdown.appendMarkdown(`- [📋 Specification](${feature.spec_url})\n`);
    }

    // Add web.dev Baseline link
    markdown.appendMarkdown(`- [🌐 Baseline Status](https://web.dev/baseline)\n`);
    markdown.appendMarkdown(`- [🔍 Can I Use](https://caniuse.com/?search=${encodeURIComponent(feature.name)})\n`);
    markdown.appendMarkdown('\n');
  }
}
