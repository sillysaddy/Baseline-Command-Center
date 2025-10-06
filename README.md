# Baseline Command Center

> Real-time web platform compatibility awareness for developers, right in your editor.

[![VS Code](https://img.shields.io/badge/VS%20Code-1.80%2B-blue)](https://code.visualstudio.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Baseline Command Center** is a VS Code extension that provides instant feedback on web platform feature compatibility. Know which CSS properties and JavaScript APIs are **Baseline-ready** as you code, helping you build modern, interoperable web experiences with confidence.

![Baseline Command Center Demo](https://via.placeholder.com/800x400?text=Add+Screenshot+Here)

---

## ✨ Features

### 🎨 Real-Time CSS Analysis
- **Inline badges** showing Baseline status (`baseline`, `limited`, `non-baseline`) for CSS properties.
- **Instant feedback** on properties like `display`, `gap`, `grid`, `flexbox`, and more.
- **Visual indicators** to quickly identify features that might require fallbacks.

### ⚡ JavaScript API Detection
- **Automatic detection** of browser APIs like `fetch`, `IntersectionObserver`, `Promise`, and `localStorage`.
- **Line-by-line status** for API usage in your JavaScript and TypeScript files.
- **Smart parsing** that understands modern syntax like `async/await` and `new Promise()`.

### 📊 Analytics Dashboard
- **Project-wide statistics** showing overall Baseline compatibility in a dedicated sidebar view.
- **Visual breakdowns** of CSS and JavaScript feature usage.
- **A "Baseline Score"** to track your project's readiness at a glance.
- **Deep scan** your entire workspace for a comprehensive analysis.

### 💡 Rich Hover Tooltips
- **Detailed browser support** tables with version numbers for major browsers.
- **Code examples** for each feature to get you started quickly.
- **Migration tips** for newly available or non-baseline features.
- **Direct links** to MDN documentation, specifications, and Can I Use.

###  CLI & Build Tool Integration
- **`@baseline/cli`**: A powerful command-line tool to analyze projects, audit dependencies, and generate reports (`json`, `html`, `table`).
- **`@baseline/webpack-plugin`**: Integrate Baseline checks directly into your Webpack build process.
- **`@baseline/vite-plugin`**: Get compatibility feedback in your Vite builds.
- **`@baseline/rollup-plugin`**: Analyze your code during Rollup bundling.

### ⚙️ Customizable Settings
- Toggle inline badges on or off.
- Enable or disable highlighting for non-Baseline features.
- Configure automatic weekly updates for the Baseline feature data.

---

## 🚀 Getting Started

### Installation

1. Open **Visual Studio Code**.
2. Go to the **Extensions** view (`Ctrl+Shift+X` or `Cmd+Shift+X`).
3. Search for "**Baseline Command Center**".
4. Click **Install**.

### Quick Start

1.  **Open a CSS or JavaScript file**: Inline badges and highlighting will appear automatically.
2.  **Hover over a property or API**: A detailed tooltip will provide compatibility information.
3.  **View the Dashboard**: Click the **Baseline icon** (`$(check-all)`) in the Activity Bar to see project-wide stats.
4.  **Run a command**: Open the Command Palette (`Ctrl+Shift+P`) and type `Baseline:` to see available actions.

---

## 📖 Usage

### VS Code Extension

The extension activates automatically when you open files with the following languages: `css`, `scss`, `less`, `javascript`, `typescript`, `javascriptreact`, `typescriptreact`.

#### Commands

-   `Baseline: Show Dashboard`: Opens the project dashboard in the sidebar.
-   `Baseline: Check Compatibility`: Manually triggers an analysis of the active editor.
-   `Baseline: Refresh Data`: Forces an update of the web features data from the underlying `web-features` package.

#### Configuration

You can customize the extension's behavior in your VS Code settings (`settings.json`):

```json
{
  "baseline.enableInlineBadges": true, // Show/hide inline status badges
  "baseline.highlightNonBaseline": true, // Highlight features that are not baseline
  "baseline.autoUpdate": true // Automatically update feature data weekly
}
```

### Command-Line Interface (CLI)

The CLI tool allows you to run Baseline analysis outside of VS Code, ideal for CI/CD environments.

#### Installation

```sh
npm install -g @baseline/cli
```

#### Commands

-   `baseline check`: Analyze a project for Baseline compatibility.
    -   `--path <path>`: The project path to analyze.
    -   `--format <format>`: Output format (`table`, `json`, `html`).
    -   `--output <file>`: Path to write the report file.
    -   `--fail-on-non-baseline`: Exit with an error code if non-baseline features are found.
-   `baseline audit`: Audit `package.json` dependencies for known compatibility issues or unnecessary polyfills.
-   `baseline stats`: Show a quick summary of project statistics.
-   `baseline init`: Create a `.baselinerc.json` configuration file in your project.

### Build Tool Plugins

Integrate Baseline checks directly into your build process to enforce compatibility standards.

#### Webpack

Install the plugin:
`npm install --save-dev @baseline/webpack-plugin`

In your `webpack.config.js`:
```javascript
// webpack.config.js
const BaselineWebpackPlugin = require('@baseline/webpack-plugin');

module.exports = {
  // ...
  plugins: [
    new BaselineWebpackPlugin({
      failOnNonBaseline: true,
      threshold: 90 // Fail if score is below 90%
    })
  ]
};
```

#### Vite

Install the plugin:
`npm install --save-dev @baseline/vite-plugin`

In your `vite.config.ts`:
```typescript
// vite.config.ts
import baselinePlugin from '@baseline/vite-plugin';

export default {
  plugins: [
    baselinePlugin({
      verbose: true
    })
  ]
};
```

#### Rollup

Install the plugin:
`npm install --save-dev @baseline/rollup-plugin`

In your `rollup.config.js`:
```javascript
// rollup.config.js
import baselinePlugin from '@baseline/rollup-plugin';

export default {
  // ...
  plugins: [
    baselinePlugin()
  ]
};
```

---

## CONTRIBUTING

Contributions are welcome! Please feel free to open an issue or submit a pull request.

### Development Setup

1.  Clone the repository.
2.  Run `npm install` in the root, `cli`, `plugins/webpack`, `plugins/vite`, and `plugins/rollup` directories.
3.  Open the root folder in VS Code.
4.  Press `F5` to open a new Extension Development Host window with the extension loaded.
5.  Use the "Run Task" command to start the `watch` task for automatic compilation.

### Running Tests

-   Install the [Extension Test Runner](https://marketplace.visualstudio.com/items?itemName=ms-vscode.extension-test-runner).
-   Open the **Testing** view from the Activity Bar.
-   Click the **Run Tests** button. Test files are located in `src/test`.

---

## CHANGELOG

See [CHANGELOG.md](CHANGELOG.md) for a history of changes.

## LICENSE

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
