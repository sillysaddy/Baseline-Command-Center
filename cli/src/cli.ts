#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import { ProjectAnalyzer } from './analyzer';
import { Reporter } from './reporter';
import { ConfigLoader } from './config';
import { DependencyAuditor } from './dependencyAuditor'; // ...added import...

async function main() {
  program
    .name('baseline')
    .description('CLI tool for Baseline web platform compatibility analysis')
    .version('0.1.0');

  // Check command
  program
    .command('check')
    .description('Analyze project for Baseline compatibility')
    .option('-p, --path <path>', 'Project path to analyze', process.cwd())
    .option('-f, --format <format>', 'Output format (table, json, html)', 'table')
    .option('--css', 'Analyze CSS files only')
    .option('--js', 'Analyze JavaScript files only')
    .option('--fail-on-non-baseline', 'Exit with error if non-baseline features found')
    .option('--threshold <percentage>', 'Minimum baseline percentage required (0-100)', '80')
    .option('-o, --output <file>', 'Output file for results')
    .option('--verbose', 'Show detailed output')
    .action(async (options) => {
      try {
        await runCheck(options);
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // Init command
  program
    .command('init')
    .description('Create a .baselinerc.json configuration file')
    .action(() => {
      ConfigLoader.createDefaultConfig();
      console.log(chalk.green('✓ Created .baselinerc.json'));
    });

  // Stats command
  program
    .command('stats')
    .description('Show project Baseline statistics')
    .option('-p, --path <path>', 'Project path to analyze', process.cwd())
    .action(async (options) => {
      await runStats(options);
    });

  // Replaced audit command to run full dependency auditor
  program
    .command('audit')
    .description('Audit package.json dependencies for Baseline compatibility')
    .option('-p, --path <path>', 'Project path', process.cwd())
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      await runAudit(options);
    });

  program.parse();
}

async function runCheck(options: any) {
  const ora = (await import('ora')).default;
  const spinner = ora('Analyzing project...').start();

  try {
    // Load configuration
    const config = ConfigLoader.loadConfig(options.path);
    const mergedOptions = { ...config, ...options };

    // Create analyzer
    const analyzer = new ProjectAnalyzer(mergedOptions.path);

    // Analyze project
    const results = await analyzer.analyze({
      cssOnly: options.css,
      jsOnly: options.js,
      verbose: options.verbose
    });

    spinner.succeed('Analysis complete');

    // Generate report
    const reporter = new Reporter(results);

    if (options.output) {
      // Write to file
      await reporter.writeToFile(options.output, options.format);
      console.log(chalk.green(`\n✓ Results written to ${options.output}`));
    } else {
      // Print to console
      reporter.print(options.format);
    }

    // Check thresholds
    const threshold = parseInt(options.threshold);
    if (results.baselineScore < threshold) {
      console.log(
        chalk.yellow(
          `\n⚠ Warning: Baseline score (${results.baselineScore}%) is below threshold (${threshold}%)`
        )
      );
      if (options.failOnNonBaseline) {
        process.exit(1);
      }
    }

    // Exit with error if requested
    if (options.failOnNonBaseline && results.nonBaselineCount > 0) {
      console.log(
        chalk.red(`\n✗ Found ${results.nonBaselineCount} non-baseline features`)
      );
      process.exit(1);
    }

  } catch (error) {
    spinner.fail('Analysis failed');
    throw error;
  }
}

async function runStats(options: any) {
  const analyzer = new ProjectAnalyzer(options.path);
  const results = await analyzer.analyze({ verbose: false });

  console.log(chalk.bold('\n📊 Baseline Statistics\n'));
  console.log(`Total Files:        ${results.totalFiles}`);
  console.log(`CSS Files:          ${results.cssFiles}`);
  console.log(`JavaScript Files:   ${results.jsFiles}`);
  console.log(`\nBaseline Score:     ${chalk.green(results.baselineScore + '%')}`);
  console.log(`Baseline Features:  ${chalk.green(results.baselineCount)}`);
  console.log(`Limited Features:   ${chalk.yellow(results.limitedCount)}`);
  console.log(`Non-Baseline:       ${chalk.red(results.nonBaselineCount)}`);
}

async function runAudit(options: any) {
  const ora = (await import('ora')).default;
  const spinner = ora('Auditing dependencies...').start();

  try {
    const auditor = new DependencyAuditor(options.path);
    const results = await auditor.audit();

    spinner.succeed('Audit complete');

    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    // Print results
    console.log(chalk.bold('\n📦 Dependency Audit Report\n'));
    
    console.log(`Total Dependencies:       ${results.totalDependencies}`);
    console.log(`Production Dependencies:  ${results.productionDependencies}`);
    console.log(`Dev Dependencies:         ${results.devDependencies}`);
    console.log(`Potential Issues:         ${chalk.yellow(results.potentialIssues.length)}\n`);

    if (results.potentialIssues.length > 0) {
      console.log(chalk.bold('⚠️  Issues Found:\n'));

      // Group by severity
      const high = results.potentialIssues.filter((i: any) => i.severity === 'high');
      const medium = results.potentialIssues.filter((i: any) => i.severity === 'medium');
      const low = results.potentialIssues.filter((i: any) => i.severity === 'low');

      if (high.length > 0) {
        console.log(chalk.red.bold('  HIGH SEVERITY:\n'));
        high.forEach((issue: any) => {
          console.log(chalk.red(`  ❌ ${issue.package}`));
          console.log(chalk.dim(`     ${issue.issue}`));
          console.log(chalk.cyan(`     💡 ${issue.recommendation}\n`));
        });
      }

      if (medium.length > 0) {
        console.log(chalk.yellow.bold('  MEDIUM SEVERITY:\n'));
        medium.forEach((issue: any) => {
          console.log(chalk.yellow(`  ⚠️  ${issue.package}`));
          console.log(chalk.dim(`     ${issue.issue}`));
          console.log(chalk.cyan(`     💡 ${issue.recommendation}\n`));
        });
      }

      if (low.length > 0) {
        console.log(chalk.dim.bold('  LOW SEVERITY:\n'));
        low.forEach((issue: any) => {
          console.log(chalk.dim(`  ℹ️  ${issue.package}`));
          console.log(chalk.dim(`     ${issue.issue}`));
          console.log(chalk.cyan(`     💡 ${issue.recommendation}\n`));
        });
      }
    } else {
      console.log(chalk.green('✓ No issues found - all dependencies look good!\n'));
    }

    // Show dependencies with Baseline requirements
    const depsWithIssues = results.dependencies.filter((d: any) => d.hasIssues);
    if (depsWithIssues.length > 0 && !options.json) {
      console.log(chalk.bold('\n📋 Packages with Baseline Notes:\n'));
      depsWithIssues.slice(0, 10).forEach((dep: any) => {
        console.log(chalk.cyan(`  ${dep.name}@${dep.version}`));
        (dep.issues || []).forEach((issue: string) => {
          console.log(chalk.dim(`    - ${issue}`));
        });
        console.log();
      });

      if (depsWithIssues.length > 10) {
        console.log(chalk.dim(`  ... and ${depsWithIssues.length - 10} more\n`));
      }
    }

  } catch (error) {
    spinner.fail('Audit failed');
    throw error;
  }
}

main().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
