import * as assert from 'assert';
import * as vscode from 'vscode';

// Use Mocha's global describe/it functions
// @types/mocha provides these

describe('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  it('Sample test', () => {
    assert.strictEqual(-1, [1, 2, 3].indexOf(5));
    assert.strictEqual(-1, [1, 2, 3].indexOf(0));
  });

  it('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('your-publisher.baseline-command-center'));
  });
});
