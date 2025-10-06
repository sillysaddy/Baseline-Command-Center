import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';

export interface AnalysisResult {
  totalFiles: number;
  cssFiles: number;
  jsFiles: number;
  baselineCount: number;
  limitedCount: number;
  nonBaselineCount: number;
  baselineScore: number;
  cssFeatures: FeatureUsage[];
  jsFeatures: FeatureUsage[];
  fileResults: FileResult[];
}

export interface FeatureUsage {
  name: string;
  feature: string;
  status: 'baseline' | 'limited' | 'not-baseline';
  count: number;
  files: string[];
}

export interface FileResult {
  file: string;
  language: 'css' | 'js';
  baselineCount: number;
  limitedCount: number;
  nonBaselineCount: number;
  features: string[];
}

export interface AnalyzeOptions {
  cssOnly?: boolean;
  jsOnly?: boolean;
  verbose?: boolean;
}

export class ProjectAnalyzer {
  private projectPath: string;
  
  // Mock Baseline data (same as VS Code extension)
  private baselineData = {
    css: {
      'display': 'baseline',
      'flex': 'baseline',
      'flex-direction': 'baseline',
      'flex-wrap': 'baseline',
      'justify-content': 'baseline',
      'align-items': 'baseline',
      'gap': 'baseline',
      'grid': 'baseline',
      'grid-template-columns': 'baseline',
      'grid-template-rows': 'baseline',
      'position': 'baseline',
      'backdrop-filter': 'baseline',
      'transform': 'baseline',
      'container-type': 'limited',
      'container-name': 'limited',
      'container': 'limited'
    },
    js: {
      'fetch': 'baseline',
      'Promise': 'baseline',
      'async': 'baseline',
      'await': 'baseline',
      'IntersectionObserver': 'baseline',
      'ResizeObserver': 'baseline',
      'MutationObserver': 'baseline',
      'localStorage': 'baseline',
      'crypto': 'baseline',
      'BroadcastChannel': 'baseline',
      'navigator.share': 'limited',
      'document.startViewTransition': 'limited'
    }
  };

  constructor(projectPath: string) {
    this.projectPath = path.resolve(projectPath);
  }

  async analyze(options: AnalyzeOptions = {}): Promise<AnalysisResult> {
    const cssFiles = await this.findFiles('**/*.{css,scss,less}', options);
    const jsFiles = await this.findFiles('**/*.{js,ts,jsx,tsx}', options);

    const fileResults: FileResult[] = [];
    let totalBaseline = 0;
    let totalLimited = 0;
    let totalNonBaseline = 0;

    // Analyze CSS files
    if (!options.jsOnly) {
      for (const file of cssFiles) {
        const result = await this.analyzeCSSFile(file, options.verbose);
        fileResults.push(result);
        totalBaseline += result.baselineCount;
        totalLimited += result.limitedCount;
        totalNonBaseline += result.nonBaselineCount;
      }
    }

    // Analyze JavaScript files
    if (!options.cssOnly) {
      for (const file of jsFiles) {
        const result = await this.analyzeJSFile(file, options.verbose);
        fileResults.push(result);
        totalBaseline += result.baselineCount;
        totalLimited += result.limitedCount;
        totalNonBaseline += result.nonBaselineCount;
      }
    }

    const totalFeatures = totalBaseline + totalLimited + totalNonBaseline;
    const baselineScore = totalFeatures > 0 
      ? Math.round((totalBaseline / totalFeatures) * 100) 
      : 100;

    // Aggregate feature usage
    const cssFeatures = this.aggregateFeatures(fileResults.filter(f => f.language === 'css'));
    const jsFeatures = this.aggregateFeatures(fileResults.filter(f => f.language === 'js'));

    return {
      totalFiles: cssFiles.length + jsFiles.length,
      cssFiles: cssFiles.length,
      jsFiles: jsFiles.length,
      baselineCount: totalBaseline,
      limitedCount: totalLimited,
      nonBaselineCount: totalNonBaseline,
      baselineScore,
      cssFeatures,
      jsFeatures,
      fileResults
    };
  }

  private async findFiles(pattern: string, options: AnalyzeOptions): Promise<string[]> {
    const files = await glob(pattern, {
      cwd: this.projectPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
      absolute: false
    });

    return files.map(f => path.join(this.projectPath, f));
  }

  private async analyzeCSSFile(filePath: string, verbose?: boolean): Promise<FileResult> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const propertyRegex = /([\w-]+)\s*:\s*([^;]+);/g;
    
    const features = new Set<string>();
    let baselineCount = 0;
    let limitedCount = 0;
    let nonBaselineCount = 0;

    let match;
    while ((match = propertyRegex.exec(content)) !== null) {
      const property = match[1];
      const status = this.baselineData.css[property as keyof typeof this.baselineData.css];

      if (status) {
        features.add(property);
        if (status === 'baseline') baselineCount++;
        else if (status === 'limited') limitedCount++;
        else nonBaselineCount++;
      }
    }

    if (verbose && features.size > 0) {
      console.log(chalk.dim(`  ${path.relative(this.projectPath, filePath)}: ${features.size} features`));
    }

    return {
      file: filePath,
      language: 'css',
      baselineCount,
      limitedCount,
      nonBaselineCount,
      features: Array.from(features)
    };
  }

  private async analyzeJSFile(filePath: string, verbose?: boolean): Promise<FileResult> {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    const patterns = [
      /\b(fetch|localStorage|crypto)\b/g,
      /\b(IntersectionObserver|ResizeObserver|MutationObserver)\b/g,
      /\b(Promise)\b/g,
      /\basync\s+function/g,
      /\bawait\s+/g,
      /navigator\.(share)/g,
      /document\.(startViewTransition)/g
    ];

    const features = new Set<string>();
    let baselineCount = 0;
    let limitedCount = 0;
    let nonBaselineCount = 0;

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const api = match[1] || 'async';
        const status = this.baselineData.js[api as keyof typeof this.baselineData.js];

        if (status) {
          features.add(api);
          if (status === 'baseline') baselineCount++;
          else if (status === 'limited') limitedCount++;
          else nonBaselineCount++;
        }
      }
    });

    if (verbose && features.size > 0) {
      console.log(chalk.dim(`  ${path.relative(this.projectPath, filePath)}: ${features.size} APIs`));
    }

    return {
      file: filePath,
      language: 'js',
      baselineCount,
      limitedCount,
      nonBaselineCount,
      features: Array.from(features)
    };
  }

  private aggregateFeatures(results: FileResult[]): FeatureUsage[] {
    const featureMap = new Map<string, FeatureUsage>();

    results.forEach(result => {
      result.features.forEach(feature => {
        const existing = featureMap.get(feature);
        const status = (result.language === 'css' 
          ? this.baselineData.css[feature as keyof typeof this.baselineData.css]
          : this.baselineData.js[feature as keyof typeof this.baselineData.js]) as any;

        if (existing) {
          existing.count++;
          existing.files.push(result.file);
        } else {
          featureMap.set(feature, {
            name: feature,
            feature,
            status: status || 'not-baseline',
            count: 1,
            files: [result.file]
          });
        }
      });
    });

    return Array.from(featureMap.values()).sort((a, b) => b.count - a.count);
  }
}
