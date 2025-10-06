import * as webpack from 'webpack';
import * as chalk from 'chalk';

interface BaselinePluginOptions {
  // Fail build if non-baseline features found
  failOnNonBaseline?: boolean;
  
  // Minimum baseline percentage required (0-100)
  threshold?: number;
  
  // Show detailed warnings
  verbose?: boolean;
  
  // Only check CSS
  cssOnly?: boolean;
  
  // Only check JavaScript
  jsOnly?: boolean;
  
  // Exclude certain files from checking
  exclude?: RegExp[];
}

interface FeatureUsage {
  feature: string;
  status: 'baseline' | 'limited' | 'not-baseline';
  file: string;
  line?: number;
}

class BaselineWebpackPlugin {
  private options: BaselinePluginOptions;
  private cssRegex = /\.(css|scss|sass|less)$/;
  private jsRegex = /\.(js|jsx|ts|tsx)$/;
  
  // Mock Baseline data
  private baselineData = {
    css: {
      'display': 'baseline',
      'flex': 'baseline',
      'gap': 'baseline',
      'grid': 'baseline',
      'container-type': 'limited',
      'backdrop-filter': 'baseline'
    },
    js: {
      'fetch': 'baseline',
      'Promise': 'baseline',
      'IntersectionObserver': 'baseline',
      'async': 'baseline',
      'document.startViewTransition': 'limited'
    }
  };

  constructor(options: BaselinePluginOptions = {}) {
    this.options = {
      failOnNonBaseline: false,
      threshold: 80,
      verbose: false,
      cssOnly: false,
      jsOnly: false,
      exclude: [/node_modules/],
      ...options
    };
  }

  apply(compiler: webpack.Compiler): void {
    const pluginName = 'BaselineWebpackPlugin';

    compiler.hooks.emit.tapAsync(pluginName, (compilation, callback) => {
      console.log(chalk.cyan('\n🔍 Baseline Compatibility Check\n'));

      const features: FeatureUsage[] = [];
      let baselineCount = 0;
      let limitedCount = 0;
      let nonBaselineCount = 0;

      // Analyze all assets
      for (const filename in compilation.assets) {
        // Skip excluded files
        if (this.shouldExclude(filename)) {
          continue;
        }

        const asset = compilation.assets[filename];
        const source = asset.source().toString();

        // Check CSS files
        if (this.cssRegex.test(filename) && !this.options.jsOnly) {
          const cssFeatures = this.analyzeCSS(source, filename);
          features.push(...cssFeatures);
        }

        // Check JavaScript files
        if (this.jsRegex.test(filename) && !this.options.cssOnly) {
          const jsFeatures = this.analyzeJavaScript(source, filename);
          features.push(...jsFeatures);
        }
      }

      // Count features by status
      features.forEach(f => {
        if (f.status === 'baseline') baselineCount++;
        else if (f.status === 'limited') limitedCount++;
        else nonBaselineCount++;
      });

      // Calculate score
      const total = baselineCount + limitedCount + nonBaselineCount;
      const score = total > 0 ? Math.round((baselineCount / total) * 100) : 100;

      // Print results
      this.printResults(score, baselineCount, limitedCount, nonBaselineCount, features);

      // Check thresholds
      const shouldFail = this.checkThresholds(score, nonBaselineCount);

      if (shouldFail) {
        compilation.errors.push(
          new webpack.WebpackError(
            `Baseline compatibility check failed: Score ${score}% is below threshold ${this.options.threshold}%`
          )
        );
      }

      callback();
    });

    // Add asset info to compilation
    compiler.hooks.compilation.tap(pluginName, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: pluginName,
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ANALYSE
        },
        () => {
          // Analysis hook for future detailed reporting
        }
      );
    });
  }

  private analyzeCSS(source: string, filename: string): FeatureUsage[] {
    const features: FeatureUsage[] = [];
    const propertyRegex = /([\w-]+)\s*:\s*([^;]+);/g;

    let match;
    while ((match = propertyRegex.exec(source)) !== null) {
      const property = match[1];
      const status = this.baselineData.css[property as keyof typeof this.baselineData.css];

      if (status) {
        features.push({
          feature: property,
          status: status as any,
          file: filename
        });
      }
    }

    return features;
  }

  private analyzeJavaScript(source: string, filename: string): FeatureUsage[] {
    const features: FeatureUsage[] = [];
    
    const patterns = [
      { regex: /\b(fetch|IntersectionObserver|Promise)\b/g, type: 'api' },
      { regex: /\basync\s+function/g, type: 'async' },
      { regex: /document\.(startViewTransition)/g, type: 'api' }
    ];

    patterns.forEach(({ regex }) => {
      let match;
      while ((match = regex.exec(source)) !== null) {
        const api = match[1] || 'async';
        const status = this.baselineData.js[api as keyof typeof this.baselineData.js];

        if (status) {
          features.push({
            feature: api,
            status: status as any,
            file: filename
          });
        }
      }
    });

    return features;
  }

  private shouldExclude(filename: string): boolean {
    if (!this.options.exclude) return false;
    return this.options.exclude.some(pattern => pattern.test(filename));
  }

  private printResults(
    score: number,
    baseline: number,
    limited: number,
    nonBaseline: number,
    features: FeatureUsage[]
  ): void {
    const scoreColor = score >= 80 ? chalk.green : score >= 60 ? chalk.yellow : chalk.red;
    
    console.log(`Baseline Score: ${scoreColor(score + '%')}`);
    console.log(`✓ Baseline:     ${chalk.green(baseline)}`);
    console.log(`⚠ Limited:      ${chalk.yellow(limited)}`);
    console.log(`✗ Non-Baseline: ${chalk.red(nonBaseline)}`);

    if (this.options.verbose && nonBaseline > 0) {
      console.log(chalk.yellow('\n⚠ Non-Baseline Features Found:\n'));
      const nonBaselineFeatures = features.filter(f => f.status === 'not-baseline');
      nonBaselineFeatures.forEach(f => {
        console.log(chalk.dim(`  ${f.file}: ${f.feature}`));
      });
    }

    console.log(); // Empty line
  }

  private checkThresholds(score: number, nonBaselineCount: number): boolean {
    if (this.options.failOnNonBaseline && nonBaselineCount > 0) {
      return true;
    }

    if (this.options.threshold && score < this.options.threshold) {
      return true;
    }

    return false;
  }
}

export = BaselineWebpackPlugin;
