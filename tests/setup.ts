/**
 * Global test setup for Panopticon tests
 */

import { vi, beforeEach, afterEach } from 'vitest';
import { rmSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Test fixtures directory
export const FIXTURES_DIR = join(__dirname, 'fixtures');
export const TEMP_DIR = join(__dirname, '.temp');

// Clean up temp directory before each test
beforeEach(() => {
  if (existsSync(TEMP_DIR)) {
    try {
      rmSync(TEMP_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch (error) {
      // Ignore cleanup errors
      console.warn('Failed to clean up TEMP_DIR in beforeEach:', error);
    }
  }
  mkdirSync(TEMP_DIR, { recursive: true });
});

// Clean up temp directory after each test suite
afterEach(() => {
  if (existsSync(TEMP_DIR)) {
    try {
      rmSync(TEMP_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch (error) {
      // Ignore cleanup errors
      console.warn('Failed to clean up TEMP_DIR in afterEach:', error);
    }
  }
});

// Mock console to reduce noise in tests (optional)
// Uncomment if needed:
// vi.spyOn(console, 'log').mockImplementation(() => {});
// vi.spyOn(console, 'error').mockImplementation(() => {});

// Global mock for execa to avoid actual shell commands
vi.mock('execa', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    execa: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
    execaSync: vi.fn().mockReturnValue({ stdout: '', stderr: '', exitCode: 0 }),
  };
});
