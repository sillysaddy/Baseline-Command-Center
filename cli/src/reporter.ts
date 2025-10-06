import chalk from 'chalk';
import { table } from 'table';
import * as fs from 'fs';
import { AnalysisResult } from './analyzer';

export class Reporter {
  constructor(private results: AnalysisResult) {}

  print(format: string = 'table'): void {
    switch (format) {
      case 'json':
        this.printJSON();
        break;
      case 'table':
      default:
        this.printTable();
        break;
    }
  }

  async writeToFile(filePath: string, format: string): Promise<void> {
    let content: string;

    switch (format) {
      case 'json':
        content = JSON.stringify(this.results, null, 2);
        break;
      case 'html':
        content = this.generateHTML();
        break;
      default:
        content = this.generateTextReport();
        break;
    }

    fs.writeFileSync(filePath, content, 'utf-8');
  }

  private printTable(): void {
    console.log(chalk.bold('\n📊 Baseline Compatibility Report\n'));

    // Summary
    const summaryData = [
      ['Metric', 'Value'],
      ['Total Files', this.results.totalFiles.toString()],
      ['CSS Files', this.results.cssFiles.toString()],
      ['JavaScript Files', this.results.jsFiles.toString()],
      ['Baseline Score', this.colorizeScore(this.results.baselineScore) + '%'],
      ['Baseline Features', chalk.green(this.results.baselineCount.toString())],
      ['Limited Features', chalk.yellow(this.results.limitedCount.toString())],
      ['Non-Baseline Features', chalk.red(this.results.nonBaselineCount.toString())]
    ];

    console.log(table(summaryData));

    // Top CSS Features
    if (this.results.cssFeatures.length > 0) {
      console.log(chalk.bold('\n🎨 Top CSS Features\n'));
      const cssData = [
        ['Feature', 'Status', 'Count'],
        ...this.results.cssFeatures.slice(0, 10).map(f => [
          f.name,
          this.colorizeStatus(f.status),
          f.count.toString()
        ])
      ];
      console.log(table(cssData));
    }

    // Top JavaScript APIs
    if (this.results.jsFeatures.length > 0) {
      console.log(chalk.bold('\n⚡ Top JavaScript APIs\n'));
      const jsData = [
        ['API', 'Status', 'Count'],
        ...this.results.jsFeatures.slice(0, 10).map(f => [
          f.name,
          this.colorizeStatus(f.status),
          f.count.toString()
        ])
      ];
      console.log(table(jsData));
    }
  }

  private printJSON(): void {
    console.log(JSON.stringify(this.results, null, 2));
  }

  private generateTextReport(): string {
    let report = '# Baseline Compatibility Report\n\n';
    report += `Total Files: ${this.results.totalFiles}\n`;
    report += `Baseline Score: ${this.results.baselineScore}%\n`;
    report += `Baseline Features: ${this.results.baselineCount}\n`;
    report += `Limited Features: ${this.results.limitedCount}\n`;
    report += `Non-Baseline Features: ${this.results.nonBaselineCount}\n`;
    return report;
  }

  private generateHTML(): string {
    return `<!DOCTYPE html>
<html>
<head>
  <title>Baseline Compatibility Report</title>
  <style>
    body { font-family: system-ui; padding: 40px; max-width: 1200px; margin: 0 auto; }
    h1 { color: #333; }
    .score { font-size: 48px; font-weight: bold; margin: 20px 0; }
    .score.high { color: #4CAF50; }
    .score.medium { color: #FF9800; }
    .score.low { color: #F44336; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; }
    .baseline { color: #4CAF50; }
    .limited { color: #FF9800; }
    .non-baseline { color: #F44336; }
  </style>
</head>
<body>
  <h1>📊 Baseline Compatibility Report</h1>
  <div class="score ${this.getScoreClass(this.results.baselineScore)}">${this.results.baselineScore}%</div>
  
  <h2>Summary</h2>
  <table>
    <tr><td>Total Files</td><td>${this.results.totalFiles}</td></tr>
    <tr><td>Baseline Features</td><td>${this.results.baselineCount}</td></tr>
    <tr><td>Limited Features</td><td>${this.results.limitedCount}</td></tr>
    <tr><td>Non-Baseline Features</td><td>${this.results.nonBaselineCount}</td></tr>
  </table>
</body>
</html>`;
  }

  private colorizeScore(score: number): string {
    if (score >= 80) return chalk.green(score.toString());
    if (score >= 60) return chalk.yellow(score.toString());
    return chalk.red(score.toString());
  }

  private colorizeStatus(status: string): string {
    if (status === 'baseline') return chalk.green('✓ Baseline');
    if (status === 'limited') return chalk.yellow('⚠ Limited');
    return chalk.red('✗ Not Baseline');
  }

  private getScoreClass(score: number): string {
    if (score >= 80) return 'high';
    if (score >= 60) return 'medium';
    return 'low';
  }
}
