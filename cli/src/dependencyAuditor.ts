import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

export interface PackageInfo {
  name: string;
  version: string;
  description?: string;
}

export interface DependencyAuditResult {
  totalDependencies: number;
  productionDependencies: number;
  devDependencies: number;
  dependencies: DependencyInfo[];
  potentialIssues: DependencyIssue[];
}

export interface DependencyInfo {
  name: string;
  version: string;
  type: 'production' | 'dev';
  hasIssues: boolean;
  issues: string[];
}

export interface DependencyIssue {
  package: string;
  severity: 'high' | 'medium' | 'low';
  issue: string;
  recommendation: string;
}

export class DependencyAuditor {
  private projectPath: string;
  
  // Known packages that require specific Baseline features
  private knownPackages: Record<string, PackageRequirement> = {
    // CSS-in-JS libraries
    'styled-components': {
      baselineFeatures: ['CSS Custom Properties', 'CSS Grid', 'Flexbox'],
      notes: 'Uses modern CSS features for styling'
    },
    '@emotion/react': {
      baselineFeatures: ['CSS Custom Properties', 'CSS Grid'],
      notes: 'Emotion uses modern CSS features'
    },
    'tailwindcss': {
      baselineFeatures: ['CSS Grid', 'Flexbox', 'Custom Properties'],
      notes: 'Tailwind generates modern CSS utility classes'
    },
    
    // Polyfill libraries (indicate non-baseline usage)
    'core-js': {
      baselineFeatures: [],
      notes: 'Polyfill library - indicates use of non-baseline JavaScript features',
      flag: 'polyfill'
    },
    'regenerator-runtime': {
      baselineFeatures: [],
      notes: 'Async/await polyfill for older browsers',
      flag: 'polyfill'
    },
    'whatwg-fetch': {
      baselineFeatures: [],
      notes: 'Fetch API polyfill - fetch is now Baseline',
      flag: 'unnecessary'
    },
    'intersection-observer': {
      baselineFeatures: [],
      notes: 'IntersectionObserver polyfill - now Baseline',
      flag: 'unnecessary'
    },
    
    // Framework dependencies
    'react': {
      baselineFeatures: ['ES6 Classes', 'Promises', 'Map/Set'],
      notes: 'React requires modern JavaScript baseline features'
    },
    'vue': {
      baselineFeatures: ['ES6 Classes', 'Promises', 'Proxy'],
      notes: 'Vue 3 requires Baseline JavaScript features'
    },
    'svelte': {
      baselineFeatures: ['ES6 Modules', 'Promises'],
      notes: 'Svelte compiles to modern JavaScript'
    },
    
    // Build tools
    'vite': {
      baselineFeatures: ['ES Modules', 'Dynamic Import'],
      notes: 'Vite uses native ES modules in development'
    },
    'webpack': {
      baselineFeatures: ['Promises', 'ES6'],
      notes: 'Modern webpack versions target Baseline features'
    },
    
    // CSS frameworks
    'bootstrap': {
      baselineFeatures: ['CSS Grid', 'Flexbox', 'Custom Properties'],
      notes: 'Bootstrap 5+ uses modern CSS features'
    },
    'bulma': {
      baselineFeatures: ['Flexbox', 'CSS Grid'],
      notes: 'Bulma is built on Flexbox'
    },

    // Common libraries / additions
    'axios': {
      baselineFeatures: ['Promises', 'Fetch API alternative'],
      notes: 'Consider using native fetch() which is now Baseline'
    },
    'jquery': {
      baselineFeatures: [],
      notes: 'Many jQuery features are now available natively with Baseline APIs',
      flag: 'unnecessary'
    },
    'moment': {
      baselineFeatures: [],
      notes: 'Consider modern alternatives like date-fns or native Intl.DateTimeFormat',
      flag: 'unnecessary'
    }
  };

  constructor(projectPath: string) {
    this.projectPath = path.resolve(projectPath);
  }

  async audit(): Promise<DependencyAuditResult> {
    const packageJsonPath = path.join(this.projectPath, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      throw new Error('package.json not found in project directory');
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    const dependencies = packageJson.dependencies || {};
    const devDependencies = packageJson.devDependencies || {};

    const allDeps: DependencyInfo[] = [];
    const issues: DependencyIssue[] = [];

    // Audit production dependencies
    for (const [name, version] of Object.entries(dependencies)) {
      const depInfo = this.auditPackage(name, version as string, 'production');
      allDeps.push(depInfo);
      
      if (depInfo.hasIssues) {
        depInfo.issues.forEach(issue => {
          issues.push(this.createIssue(name, issue));
        });
      }
    }

    // Audit dev dependencies
    for (const [name, version] of Object.entries(devDependencies)) {
      const depInfo = this.auditPackage(name, version as string, 'dev');
      allDeps.push(depInfo);
      
      if (depInfo.hasIssues) {
        depInfo.issues.forEach(issue => {
          issues.push(this.createIssue(name, issue));
        });
      }
    }

    return {
      totalDependencies: allDeps.length,
      productionDependencies: Object.keys(dependencies).length,
      devDependencies: Object.keys(devDependencies).length,
      dependencies: allDeps,
      potentialIssues: issues
    };
  }

  private auditPackage(name: string, version: string, type: 'production' | 'dev'): DependencyInfo {
    const issues: string[] = [];
    const knownPackage = this.knownPackages[name];

    if (knownPackage) {
      if (knownPackage.flag === 'polyfill') {
        issues.push(`Uses polyfills - may indicate non-baseline feature usage`);
      } else if (knownPackage.flag === 'unnecessary') {
        issues.push(`Polyfill may be unnecessary - feature is now Baseline`);
      }

      if (knownPackage.notes) {
        issues.push(knownPackage.notes);
      }
    }

    // Check for old versions that might not use Baseline features
    if (this.isOldVersion(name, version)) {
      issues.push(`Old version detected - consider upgrading to use Baseline features`);
    }

    return {
      name,
      version,
      type,
      hasIssues: issues.length > 0,
      issues
    };
  }

  private isOldVersion(name: string, version: string): boolean {
    // Remove version prefixes like ^, ~, >=
    const cleanVersion = version.replace(/^[\^~>=<]+/, '');
    const major = parseInt(cleanVersion.split('.')[0] || '0');

    // Define major versions that are considered old for popular packages
    const oldVersions: Record<string, number> = {
      'react': 16,
      'vue': 2,
      'bootstrap': 4,
      'jquery': 3, // jQuery itself is often unnecessary with Baseline features
      'lodash': 3,
      'moment': 2 // Consider modern alternatives like date-fns
    };

    const threshold = oldVersions[name];
    if (threshold && major < threshold) {
      return true;
    }

    return false;
  }

  private createIssue(packageName: string, issueText: string): DependencyIssue {
    const knownPackage = this.knownPackages[packageName];
    let severity: 'high' | 'medium' | 'low' = 'low';
    let recommendation = 'Review package usage and consider alternatives';

    if (knownPackage?.flag === 'unnecessary') {
      severity = 'medium';
      recommendation = `Remove ${packageName} - the feature is now Baseline and doesn't need a polyfill`;
    } else if (knownPackage?.flag === 'polyfill') {
      severity = 'low';
      recommendation = 'Review if polyfills are needed for your target browsers';
    } else if (issueText.includes('Old version')) {
      severity = 'medium';
      recommendation = `Upgrade ${packageName} to latest version for better Baseline support`;
    }

    return {
      package: packageName,
      severity,
      issue: issueText,
      recommendation
    };
  }
}

interface PackageRequirement {
  baselineFeatures: string[];
  notes: string;
  flag?: 'polyfill' | 'unnecessary';
}
