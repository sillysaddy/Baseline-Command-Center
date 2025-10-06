import * as fs from 'fs';
import * as path from 'path';

export interface BaselineConfig {
  threshold?: number;
  failOnNonBaseline?: boolean;
  ignore?: string[];
  include?: string[];
}

export class ConfigLoader {
  static loadConfig(projectPath: string): BaselineConfig {
    const configPath = path.join(projectPath, '.baselinerc.json');
    
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    }

    return {};
  }

  static createDefaultConfig(): void {
    const defaultConfig: BaselineConfig = {
      threshold: 80,
      failOnNonBaseline: false,
      ignore: ['node_modules/**', 'dist/**', 'build/**'],
      include: ['src/**/*.{css,scss,less,js,ts,jsx,tsx}']
    };

    fs.writeFileSync(
      '.baselinerc.json',
      JSON.stringify(defaultConfig, null, 2),
      'utf-8'
    );
  }
}
