import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// Import web-features package
// Note: Actual import will depend on package structure
// This is a type-safe wrapper around the data

export interface BaselineFeature {
  id: string;
  name: string;
  status: 'baseline' | 'limited' | 'not-baseline';
  since?: string; // Date when it became Baseline
  description: string;
  mdn_url?: string;
  spec_url?: string;
  browserSupport: {
    chrome?: string;
    edge?: string;
    firefox?: string;
    safari?: string;
  };
}

export interface CSSFeature extends BaselineFeature {
  properties: string[];
  values?: string[];
}

export interface JSFeature extends BaselineFeature {
  api: string;
  methods?: string[];
}

// Add proper type definitions at the top of the file
interface WebFeatureData {
  name?: string;
  description?: string;
  baseline?: {
    status?: string;
    since?: string;
  };
  css?: boolean;
  properties?: string[];
  values?: string[];
  javascript?: boolean;
  api?: string;
  methods?: string[];
  mdn_url?: string;
  spec_url?: string;
  support?: {
    chrome?: { version?: string };
    edge?: { version?: string };
    firefox?: { version?: string };
    safari?: { version?: string };
  };
}

interface WebFeaturesPackage {
  features?: Record<string, WebFeatureData>;
}

export class BaselineDataProvider {
  private cssFeatures: Map<string, CSSFeature> = new Map();
  private jsFeatures: Map<string, JSFeature> = new Map();
  private dataPath: string;
  private lastUpdate: Date | null = null;

  constructor(context: vscode.ExtensionContext) {
    this.dataPath = path.join(context.extensionPath, 'data', 'baseline-features.json');
    this.loadData();
  }

  /**
   * Load and parse web-features data
   */
  private async loadData(): Promise<void> {
    try {
      // TEMPORARY: Skip cache and always use mock data for development
      console.log('Creating mock Baseline data for development');
      this.createMockData();
      await this.cacheData();
      return;

      // TODO: Re-enable cache and web-features loading later
      /*
      if (fs.existsSync(this.dataPath)) {
        const cachedData = JSON.parse(fs.readFileSync(this.dataPath, 'utf-8'));
        this.parseCachedData(cachedData);
        this.lastUpdate = new Date(cachedData.lastUpdate);
        console.log('Loaded Baseline data from cache');
        return;
      }

      await this.loadFromPackage();
      */
    } catch (error) {
      console.error('Failed to load Baseline data:', error);
      this.createMockData();
    }
  }

  /**
   * Load data from web-features npm package
   */
  private async loadFromPackage(): Promise<void> {
    try {
      // Dynamic import of web-features package
      const webFeatures = require('web-features');
      
      // Parse and transform the data structure
      this.parseWebFeatures(webFeatures);

      // Cache the processed data
      await this.cacheData();
      
      this.lastUpdate = new Date();
      console.log('Loaded Baseline data from web-features package');
    } catch (error) {
      console.error('Failed to load from package:', error);
      throw error;
    }
  }

  /**
   * Parse web-features package structure
   */
  private parseWebFeatures(data: any): void {
    // Cast to proper type
    const webFeaturesData = data as WebFeaturesPackage;

    if (webFeaturesData.features) {
      for (const [featureId, featureData] of Object.entries(webFeaturesData.features)) {
        // featureData is now properly typed as WebFeatureData
        const feature = featureData as WebFeatureData;
        const baselineStatus = this.determineBaselineStatus(feature);

        // Check if it's a CSS feature
        if (feature.css || feature.properties) {
          const cssFeature: CSSFeature = {
            id: featureId,
            name: feature.name || featureId,
            status: baselineStatus,
            since: feature.baseline?.since,
            description: feature.description || '',
            mdn_url: feature.mdn_url,
            spec_url: feature.spec_url,
            properties: feature.properties || [],
            values: feature.values,
            browserSupport: this.extractBrowserSupport(feature)
          };
          
          // Index by each property for quick lookup
          cssFeature.properties.forEach(prop => {
            this.cssFeatures.set(prop, cssFeature);
          });
        }

        // Check if it's a JavaScript API
        if (feature.javascript || feature.api) {
          const jsFeature: JSFeature = {
            id: featureId,
            name: feature.name || featureId,
            status: baselineStatus,
            since: feature.baseline?.since,
            description: feature.description || '',
            mdn_url: feature.mdn_url,
            spec_url: feature.spec_url,
            api: feature.api || featureId,
            methods: feature.methods,
            browserSupport: this.extractBrowserSupport(feature)
          };

          this.jsFeatures.set(jsFeature.api, jsFeature);
        }
      }
    }
  }

  /**
   * Determine Baseline status from feature data
   */
private determineBaselineStatus(feature: WebFeatureData): 'baseline' | 'limited' | 'not-baseline' {
  // Handle baseline as boolean
  if (typeof feature.baseline === 'boolean') {
    return feature.baseline ? 'baseline' : 'not-baseline';
  }
  
  // Handle baseline as object
  if (typeof feature.baseline === 'object' && feature.baseline !== null) {
    if (feature.baseline.status === 'widely_available') {
      return 'baseline';
    } else if (feature.baseline.status === 'newly_available') {
      return 'limited';
    }
  }
  
  return 'not-baseline';
}

  /**
   * Extract browser support information
   */
  private extractBrowserSupport(feature: WebFeatureData): BaselineFeature['browserSupport'] {
    const support: BaselineFeature['browserSupport'] = {};
    
    if (feature.support) {
      support.chrome = feature.support.chrome?.version;
      support.edge = feature.support.edge?.version;
      support.firefox = feature.support.firefox?.version;
      support.safari = feature.support.safari?.version;
    }

    return support;
  }

  /**
   * Parse cached data structure
   */
  private parseCachedData(data: any): void {
    if (data.css) {
      for (const [property, feature] of Object.entries(data.css)) {
        this.cssFeatures.set(property, feature as CSSFeature);
      }
    }

    if (data.js) {
      for (const [api, feature] of Object.entries(data.js)) {
        this.jsFeatures.set(api, feature as JSFeature);
      }
    }
  }

  /**
   * Cache processed data to disk
   */
  private async cacheData(): Promise<void> {
    const cacheData = {
      lastUpdate: new Date().toISOString(),
      css: Object.fromEntries(this.cssFeatures),
      js: Object.fromEntries(this.jsFeatures)
    };

    const dataDir = path.dirname(this.dataPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(this.dataPath, JSON.stringify(cacheData, null, 2));
  }

  /**
   * Get CSS feature by property name
   */
  public getCSSFeature(property: string): CSSFeature | undefined {
    return this.cssFeatures.get(property);
  }

  /**
   * Get JS feature by API name
   */
  public getJSFeature(api: string): JSFeature | undefined {
    return this.jsFeatures.get(api);
  }

  /**
   * Check if data needs updating (older than 7 days)
   */
  public needsUpdate(): boolean {
    if (!this.lastUpdate) return true;
    
    const weekInMs = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - this.lastUpdate.getTime() > weekInMs;
  }

  /**
   * Force refresh data from package
   */
  public async refresh(): Promise<void> {
    await this.loadFromPackage();
    vscode.window.showInformationMessage('Baseline data refreshed successfully');
  }

  /**
   * Get total feature count
   */
  public getStats(): { css: number; js: number; baseline: number } {
    let baselineCount = 0;
    
    this.cssFeatures.forEach(feature => {
      if (feature.status === 'baseline') baselineCount++;
    });
    
    this.jsFeatures.forEach(feature => {
      if (feature.status === 'baseline') baselineCount++;
    });

    return {
      css: this.cssFeatures.size,
      js: this.jsFeatures.size,
      baseline: baselineCount
    };
  }

  /**
   * Create mock data for development/testing
   */
  private createMockData(): void {
    console.log('Creating mock Baseline data for development');
    
    // Mock CSS features (keep existing ones)
    const mockCSSFeatures: CSSFeature[] = [
      {
        id: 'css-display',
        name: 'CSS Display',
        status: 'baseline',
        since: '2015-07',
        description: 'The display CSS property sets whether an element is treated as a block or inline box.',
        properties: ['display'],
        browserSupport: { chrome: '1', edge: '12', firefox: '1', safari: '1' }
      },
      {
        id: 'css-gap',
        name: 'CSS Gap Property',
        status: 'baseline',
        since: '2021-09',
        description: 'The gap property defines spacing between rows and columns in flexbox and grid layouts.',
        properties: ['gap', 'row-gap', 'column-gap'],
        browserSupport: { chrome: '84', edge: '84', firefox: '63', safari: '14.1' }
      },
      {
        id: 'css-flexbox',
        name: 'CSS Flexible Box Layout',
        status: 'baseline',
        since: '2017-03',
        description: 'Flexbox layout provides an efficient way to align and distribute space among items.',
        properties: ['flex', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-content', 'flex-grow', 'flex-shrink', 'flex-basis'],
        browserSupport: { chrome: '29', edge: '12', firefox: '20', safari: '9' }
      },
      {
        id: 'css-grid',
        name: 'CSS Grid Layout',
        status: 'baseline',
        since: '2020-01',
        description: 'CSS Grid Layout excels at dividing a page into major regions.',
        properties: ['grid', 'grid-template-columns', 'grid-template-rows', 'grid-area', 'grid-column', 'grid-row'],
        browserSupport: { chrome: '57', edge: '16', firefox: '52', safari: '10.1' }
      },
      {
        id: 'css-position-sticky',
        name: 'CSS Position Sticky',
        status: 'baseline',
        since: '2020-07',
        description: 'The sticky position creates a hybrid of relative and fixed positioning.',
        properties: ['position'],
        browserSupport: { chrome: '56', edge: '16', firefox: '32', safari: '13' }
      },
      {
        id: 'css-container-queries',
        name: 'CSS Container Queries',
        status: 'limited',
        since: '2023-02',
        description: 'Container queries allow you to apply styles based on the size of a container.',
        properties: ['container-type', 'container-name', 'container'],
        browserSupport: { chrome: '105', edge: '105', firefox: '110', safari: '16' }
      },
      {
        id: 'css-backdrop-filter',
        name: 'CSS Backdrop Filter',
        status: 'baseline',
        since: '2022-03',
        description: 'Applies graphical effects to the area behind an element.',
        properties: ['backdrop-filter'],
        browserSupport: { chrome: '76', edge: '79', firefox: '103', safari: '9' }
      },
      {
        id: 'css-color-oklch',
        name: 'CSS OKLCH Colors',
        status: 'limited',
        since: '2023-09',
        description: 'The oklch() color function represents colors in a perceptually uniform color space.',
        properties: ['color'],
        browserSupport: { chrome: '111', edge: '111', firefox: '113', safari: '16.4' }
      }
    ];
  
    // NEW: Mock JavaScript API features
    const mockJSFeatures: JSFeature[] = [
      {
        id: 'fetch-api',
        name: 'Fetch API',
        status: 'baseline',
        since: '2017-03',
        description: 'The Fetch API provides a modern interface for fetching resources across the network.',
        api: 'fetch',
        methods: ['fetch', 'Response', 'Request', 'Headers'],
        browserSupport: { chrome: '42', edge: '14', firefox: '39', safari: '10.1' }
      },
      {
        id: 'promises',
        name: 'JavaScript Promises',
        status: 'baseline',
        since: '2016-09',
        description: 'Promises represent the eventual completion or failure of an asynchronous operation.',
        api: 'Promise',
        methods: ['then', 'catch', 'finally', 'all', 'race'],
        browserSupport: { chrome: '32', edge: '12', firefox: '29', safari: '8' }
      },
      {
        id: 'async-await',
        name: 'Async/Await',
        status: 'baseline',
        since: '2017-06',
        description: 'Async functions enable writing promise-based code as if it were synchronous.',
        api: 'async',
        methods: ['async', 'await'],
        browserSupport: { chrome: '55', edge: '15', firefox: '52', safari: '10.1' }
      },
      {
        id: 'intersection-observer',
        name: 'Intersection Observer',
        status: 'baseline',
        since: '2019-09',
        description: 'Provides a way to asynchronously observe changes in the intersection of a target element.',
        api: 'IntersectionObserver',
        methods: ['observe', 'unobserve', 'disconnect'],
        browserSupport: { chrome: '51', edge: '15', firefox: '55', safari: '12.1' }
      },
      {
        id: 'resize-observer',
        name: 'Resize Observer',
        status: 'baseline',
        since: '2020-07',
        description: 'Reports changes to the dimensions of an element\'s content or border box.',
        api: 'ResizeObserver',
        methods: ['observe', 'unobserve', 'disconnect'],
        browserSupport: { chrome: '64', edge: '79', firefox: '69', safari: '13.1' }
      },
      {
        id: 'mutation-observer',
        name: 'Mutation Observer',
        status: 'baseline',
        since: '2015-07',
        description: 'Provides the ability to watch for changes being made to the DOM tree.',
        api: 'MutationObserver',
        methods: ['observe', 'disconnect', 'takeRecords'],
        browserSupport: { chrome: '26', edge: '12', firefox: '14', safari: '7' }
      },
      {
        id: 'local-storage',
        name: 'Local Storage',
        status: 'baseline',
        since: '2015-07',
        description: 'Allows storing key-value pairs in a web browser with no expiration date.',
        api: 'localStorage',
        methods: ['getItem', 'setItem', 'removeItem', 'clear'],
        browserSupport: { chrome: '4', edge: '12', firefox: '3.5', safari: '4' }
      },
      {
        id: 'web-crypto',
        name: 'Web Crypto API',
        status: 'baseline',
        since: '2017-09',
        description: 'Provides cryptographic operations in web applications.',
        api: 'crypto',
        methods: ['subtle', 'getRandomValues'],
        browserSupport: { chrome: '37', edge: '12', firefox: '34', safari: '11' }
      },
      {
        id: 'broadcast-channel',
        name: 'Broadcast Channel',
        status: 'baseline',
        since: '2022-03',
        description: 'Allows communication between browsing contexts (windows, tabs, iframes).',
        api: 'BroadcastChannel',
        methods: ['postMessage', 'close'],
        browserSupport: { chrome: '54', edge: '79', firefox: '38', safari: '15.4' }
      },
      {
        id: 'web-share-api',
        name: 'Web Share API',
        status: 'limited',
        since: '2023-03',
        description: 'Enables sharing of text, URLs, and files to user-selected share targets.',
        api: 'navigator.share',
        methods: ['share', 'canShare'],
        browserSupport: { chrome: '89', edge: '93', firefox: '71', safari: '12.1' }
      },
      {
        id: 'view-transitions',
        name: 'View Transitions API',
        status: 'limited',
        since: '2024-01',
        description: 'Provides a mechanism for easily creating animated transitions between different DOM states.',
        api: 'document.startViewTransition',
        methods: ['startViewTransition'],
        browserSupport: { chrome: '111', edge: '111', firefox: 'No', safari: '18' }
      }
    ];
  
    // Index CSS features by property name
    mockCSSFeatures.forEach(feature => {
      feature.properties.forEach(prop => {
        this.cssFeatures.set(prop, feature);
      });
    });
  
    // Index JS features by API name
    mockJSFeatures.forEach(feature => {
      this.jsFeatures.set(feature.api, feature);
      // Also index by each method for detailed detection
      if (feature.methods) {
        feature.methods.forEach(method => {
          this.jsFeatures.set(method, feature);
        });
      }
    });
  
    console.log(`Mock data created: ${this.cssFeatures.size} CSS properties, ${mockJSFeatures.length} JS APIs indexed`);
    this.lastUpdate = new Date();
  }
}
