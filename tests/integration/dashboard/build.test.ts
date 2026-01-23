import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync } from 'fs';
import { execa } from 'execa';
import { resolve } from 'path';

describe('Dashboard server build', () => {
  const bundlePath = resolve(process.cwd(), 'dist/dashboard/server.js');

  beforeAll(async () => {
    // Build the dashboard server before running tests
    console.log('Building dashboard server...');
    await execa('npm', ['run', 'build:dashboard:server'], {
      cwd: process.cwd(),
      stdio: 'inherit',
    });
  }, 60000); // Allow 60s for build

  it('should create bundled server file', () => {
    expect(existsSync(bundlePath)).toBe(true);
  });

  it('should not contain bindings package code', async () => {
    // This test verifies that the bindings package (used by better-sqlite3)
    // is not bundled. The bindings package uses __filename before it's polyfilled,
    // which causes "ReferenceError: __filename is not defined" in ESM.
    const { readFileSync } = await import('fs');
    const bundleContent = readFileSync(bundlePath, 'utf-8');

    // The bindings package should NOT be in the bundle
    // It's a dependency of better-sqlite3, which should be externalized
    expect(bundleContent).not.toMatch(/function bindings/);
    expect(bundleContent).not.toMatch(/bindings\.js/);
  });

  it('should externalize native addons', async () => {
    // Read the bundle and verify native addons are not bundled
    const { readFileSync } = await import('fs');
    const bundleContent = readFileSync(bundlePath, 'utf-8');

    // These packages should be imported, not bundled
    expect(bundleContent).toMatch(/import.*better-sqlite3/);
    expect(bundleContent).toMatch(/import.*@homebridge\/node-pty-prebuilt-multiarch/);

    // The bindings package should NOT be in the bundle (it's a dep of better-sqlite3)
    // If it's bundled, it will try to use __filename and crash
    expect(bundleContent).not.toMatch(/function bindings/);
  });
});
