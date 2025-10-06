import type { Plugin } from 'vite';
import chalk from 'chalk';

interface BaselineVitePluginOptions {
  failOnNonBaseline?: boolean;
  threshold?: number;
  verbose?: boolean;
  cssOnly?: boolean;
  jsOnly?: boolean;
}

interface FeatureAnalysis {
  baseline: number;
  limited: number;
  nonBaseline: number;
  features: Array<{
    feature: string;
    status: string;
    file: string;
  }>;
}

export default function baselinePlugin(
  options: BaselineVitePluginOptions = {}
): Plugin {
  const config = {
    failOnNonBaseline: false,
    threshold: 80,
    verbose: false,
    cssOnly: false,
    jsOnly: false,
    ...options
  };

  const analysis: FeatureAnalysis = {
    baseline: 0,
    limited: 0,
    nonBaseline: 0,
    features: []
  };

  const baselineData = {
    css: {
      'display': 'baseline',
      'flex': 'baseline',
      'gap': 'baseline',
      'grid': 'baseline',
      'container-type': 'limited',
      'backdrop-filter': 'baseline',
      'transform': 'baseline'
    },
    js: {
      'fetch': 'baseline',
      'Promise': 'baseline',
      'IntersectionObserver': 'baseline',
      'ResizeObserver': 'baseline',
      'async': 'baseline',
      'document.startViewTransition': 'limited',
      'navigator.share': 'limited'
    }
  };

  return {
    name: 'vite-plugin-baseline',
    
    // Run in build mode
    apply: 'build',

    // Transform hook - analyze each module
    transform(code: string, id: string) {
      // Skip node_modules
      if (id.includes('node_modules')) {
        return null;
      }

      // Analyze CSS files
      if (/\.(css|scss|sass|less)$/.test(id) && !config.jsOnly) {
        analyzeCSS(code, id, analysis, baselineData.css, config.verbose);
      }

      // Analyze JavaScript/TypeScript files
      if (/\.(js|jsx|ts|tsx)$/.test(id) && !config.cssOnly) {
        analyzeJavaScript(code, id, analysis, baselineData.js, config.verbose);
      }

      return null;
    },

    // Build end - print results
    closeBundle() {
      printResults(analysis, config);

      // Check thresholds
      const total = analysis.baseline + analysis.limited + analysis.nonBaseline;
      const score = total > 0 ? Math.round((analysis.baseline / total) * 100) : 100;

      if (config.threshold && score < config.threshold) {
        const message = `Baseline score (${score}%) is below threshold (${config.threshold}%)`;
        if (config.failOnNonBaseline) {
          throw new Error(message);
        } else {
          console.warn(chalk.yellow(`\n⚠️  Warning: ${message}\n`));
        }
      }

      if (config.failOnNonBaseline && analysis.nonBaseline > 0) {
        throw new Error(`Found ${analysis.nonBaseline} non-baseline features`);
      }
    }
  };
}

function analyzeCSS(
  code: string,
  filename: string,
  analysis: FeatureAnalysis,
  baselineData: Record<string, string>,
  verbose: boolean
): void {
  const propertyRegex = /([\w-]+)\s*:\s*([^;]+);/g;
  let match;

  while ((match = propertyRegex.exec(code)) !== null) {
    const property = match[1];
    const status = baselineData[property];

    if (status) {
      analysis.features.push({
        feature: property,
        status,
        file: filename
      });

      if (status === 'baseline') {
        analysis.baseline++;
      } else if (status === 'limited') {
        analysis.limited++;
      } else {
        analysis.nonBaseline++;
      }
    }
  }
}

function analyzeJavaScript(
  code: string,
  filename: string,
  analysis: FeatureAnalysis,
  baselineData: Record<string, string>,
  verbose: boolean
): void {
  const patterns = [
    /\b(fetch|IntersectionObserver|ResizeObserver|Promise)\b/g,
    /\basync\s+function/g,
    /navigator\.(share)/g,
    /document\.(startViewTransition)/g
  ];

  patterns.forEach(regex => {
    let match;
    while ((match = regex.exec(code)) !== null) {
      const api = match[1] || 'async';
      const status = baselineData[api];

      if (status) {
        analysis.features.push({
          feature: api,
          status,
          file: filename
        });

        if (status === 'baseline') {
          analysis.baseline++;
        } else if (status === 'limited') {
          analysis.limited++;
        } else {
          analysis.nonBaseline++;
        }
      }
    }
  });
}

function printResults(analysis: FeatureAnalysis, config: BaselineVitePluginOptions): void {
  const total = analysis.baseline + analysis.limited + analysis.nonBaseline;
  const score = total > 0 ? Math.round((analysis.baseline / total) * 100) : 100;
  const scoreColor = score >= 80 ? chalk.green : score >= 60 ? chalk.yellow : chalk.red;

  console.log(chalk.cyan('\n🔍 Baseline Compatibility Check (Vite)\n'));
  console.log(`Baseline Score: ${scoreColor(score + '%')}`);
  console.log(`✓ Baseline:     ${chalk.green(analysis.baseline)}`);
  console.log(`⚠ Limited:      ${chalk.yellow(analysis.limited)}`);
  console.log(`✗ Non-Baseline: ${chalk.red(analysis.nonBaseline)}`);

  if (config.verbose && analysis.nonBaseline > 0) {
    console.log(chalk.yellow('\n⚠ Non-Baseline Features:\n'));
    const nonBaseline = analysis.features.filter(f => f.status === 'not-baseline');
    nonBaseline.forEach(f => {
      console.log(chalk.dim(`  ${f.file}: ${f.feature}`));
    });
  }

  console.log();
}

// Named export for TypeScript
export { baselinePlugin };
