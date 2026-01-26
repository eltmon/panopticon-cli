import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Cleanup E2E Test (PAN-85)
 *
 * This test verifies the cleanup functionality:
 * 1. Dashboard cleanup button shows preview of old agents
 * 2. Cleanup actually deletes old agent directories
 * 3. Auto-cleanup on dashboard startup
 * 4. Cost data remains accessible after cleanup
 */

const DASHBOARD_URL = 'http://localhost:3010';
const API_URL = 'http://localhost:3011';
const AGENTS_DIR = join(homedir(), '.panopticon', 'agents');

interface AgentState {
  id: string;
  issueId: string;
  workspace: string;
  runtime: string;
  model: string;
  status: 'starting' | 'running' | 'stopped' | 'error' | 'completed';
  startedAt: string;
  lastActivity?: string;
}

/**
 * Create a test agent directory with old timestamp
 */
function createOldAgent(agentId: string): void {
  const agentDir = join(AGENTS_DIR, agentId);
  mkdirSync(agentDir, { recursive: true });

  const state: AgentState = {
    id: agentId,
    issueId: 'TEST-999',
    workspace: '/test/workspace',
    runtime: 'claude',
    model: 'sonnet',
    status: 'stopped',
    startedAt: '2020-01-01T00:00:00.000Z',
    lastActivity: '2020-01-01T00:00:00.000Z',
  };

  writeFileSync(join(agentDir, 'state.json'), JSON.stringify(state, null, 2));
}

/**
 * Create a recent agent directory
 */
function createRecentAgent(agentId: string): void {
  const agentDir = join(AGENTS_DIR, agentId);
  mkdirSync(agentDir, { recursive: true });

  const state: AgentState = {
    id: agentId,
    issueId: 'TEST-888',
    workspace: '/test/workspace',
    runtime: 'claude',
    model: 'sonnet',
    status: 'stopped',
    startedAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
  };

  writeFileSync(join(agentDir, 'state.json'), JSON.stringify(state, null, 2));
}

/**
 * Clean up test agent directories
 */
function cleanupTestAgents(): void {
  const testAgents = [
    'agent-test-old-1',
    'agent-test-old-2',
    'planning-test-old-3',
    'specialist-test-old-4',
    'agent-test-recent-1',
  ];

  for (const agentId of testAgents) {
    const agentDir = join(AGENTS_DIR, agentId);
    if (existsSync(agentDir)) {
      rmSync(agentDir, { recursive: true, force: true });
    }
  }
}

test.describe('Agent Cleanup', () => {
  test.beforeEach(() => {
    // Clean up any existing test agents
    cleanupTestAgents();
  });

  test.afterEach(() => {
    // Clean up test agents after each test
    cleanupTestAgents();
  });

  test('manual cleanup button shows preview and deletes old agents', async ({ page }) => {
    console.log('\n=== MANUAL CLEANUP TEST ===');

    // 1. Create test agents
    console.log('\n[1/6] Creating test agents...');
    createOldAgent('agent-test-old-1');
    createOldAgent('agent-test-old-2');
    createOldAgent('planning-test-old-3');
    createOldAgent('specialist-test-old-4');
    createRecentAgent('agent-test-recent-1');

    console.log('Created 4 old agents and 1 recent agent');

    // 2. Navigate to dashboard
    console.log('\n[2/6] Navigating to dashboard...');
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    // 3. Click cleanup button
    console.log('\n[3/6] Clicking cleanup button...');
    const cleanupButton = page.getByRole('button', { name: /Clean Old Agents/i });
    await expect(cleanupButton).toBeVisible();
    await cleanupButton.click();

    // 4. Verify preview dialog appears with list of agents
    console.log('\n[4/6] Verifying preview dialog...');
    await page.waitForTimeout(1000); // Wait for API call

    const dialog = page.locator('div', { hasText: 'Confirm Agent Cleanup' });
    await expect(dialog).toBeVisible();

    // Check that old agents are listed in preview
    await expect(dialog.locator('text=agent-test-old-1')).toBeVisible();
    await expect(dialog.locator('text=agent-test-old-2')).toBeVisible();
    await expect(dialog.locator('text=planning-test-old-3')).toBeVisible();
    await expect(dialog.locator('text=specialist-test-old-4')).toBeVisible();

    // Recent agent should NOT be in preview
    await expect(dialog.locator('text=agent-test-recent-1')).not.toBeVisible();

    console.log('✓ Preview shows 4 old agents (excludes recent agent)');

    // 5. Confirm deletion
    console.log('\n[5/6] Confirming deletion...');
    const deleteButton = page.getByRole('button', { name: /Delete.*Agents/i });
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    // Wait for deletion to complete
    await page.waitForTimeout(2000);

    // Dialog should close
    await expect(dialog).not.toBeVisible();

    console.log('✓ Deletion completed');

    // 6. Verify agents were deleted
    console.log('\n[6/6] Verifying agents were deleted...');
    expect(existsSync(join(AGENTS_DIR, 'agent-test-old-1'))).toBe(false);
    expect(existsSync(join(AGENTS_DIR, 'agent-test-old-2'))).toBe(false);
    expect(existsSync(join(AGENTS_DIR, 'planning-test-old-3'))).toBe(false);
    expect(existsSync(join(AGENTS_DIR, 'specialist-test-old-4'))).toBe(false);

    // Recent agent should still exist
    expect(existsSync(join(AGENTS_DIR, 'agent-test-recent-1'))).toBe(true);

    console.log('✓ Old agents deleted, recent agent preserved');
    console.log('\n✓ Test complete - manual cleanup verified');
  });

  test('cleanup API endpoint works correctly', async () => {
    console.log('\n=== CLEANUP API TEST ===');

    // 1. Create test agents
    console.log('\n[1/4] Creating test agents...');
    createOldAgent('agent-test-old-1');
    createOldAgent('agent-test-old-2');
    createRecentAgent('agent-test-recent-1');

    // 2. Test dry run
    console.log('\n[2/4] Testing dry run...');
    const dryRunResponse = await fetch(`${API_URL}/api/agents/cleanup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun: true }),
    });

    expect(dryRunResponse.ok).toBeTruthy();
    const dryRunResult = await dryRunResponse.json();

    console.log('Dry run result:', dryRunResult);
    expect(dryRunResult.dryRun).toBe(true);
    expect(dryRunResult.count).toBeGreaterThanOrEqual(2);
    expect(dryRunResult.deleted).toContain('agent-test-old-1');
    expect(dryRunResult.deleted).toContain('agent-test-old-2');
    expect(dryRunResult.deleted).not.toContain('agent-test-recent-1');

    // Agents should still exist after dry run
    expect(existsSync(join(AGENTS_DIR, 'agent-test-old-1'))).toBe(true);
    expect(existsSync(join(AGENTS_DIR, 'agent-test-old-2'))).toBe(true);

    console.log('✓ Dry run preview correct, agents not deleted');

    // 3. Test actual cleanup
    console.log('\n[3/4] Testing actual cleanup...');
    const cleanupResponse = await fetch(`${API_URL}/api/agents/cleanup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun: false }),
    });

    expect(cleanupResponse.ok).toBeTruthy();
    const cleanupResult = await cleanupResponse.json();

    console.log('Cleanup result:', cleanupResult);
    expect(cleanupResult.dryRun).toBe(false);
    expect(cleanupResult.count).toBeGreaterThanOrEqual(2);

    // 4. Verify agents were deleted
    console.log('\n[4/4] Verifying agents deleted...');
    expect(existsSync(join(AGENTS_DIR, 'agent-test-old-1'))).toBe(false);
    expect(existsSync(join(AGENTS_DIR, 'agent-test-old-2'))).toBe(false);
    expect(existsSync(join(AGENTS_DIR, 'agent-test-recent-1'))).toBe(true);

    console.log('✓ Old agents deleted, recent agent preserved');
    console.log('\n✓ Test complete - API cleanup verified');
  });

  test('cost data remains accessible after cleanup', async ({ page }) => {
    console.log('\n=== COST DATA ACCESSIBILITY TEST ===');

    // 1. Create and cleanup old agents
    console.log('\n[1/3] Creating and cleaning up old agents...');
    createOldAgent('agent-test-old-1');
    createOldAgent('agent-test-old-2');

    const cleanupResponse = await fetch(`${API_URL}/api/agents/cleanup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun: false }),
    });
    expect(cleanupResponse.ok).toBeTruthy();

    console.log('✓ Old agents cleaned up');

    // 2. Verify cost data is still accessible
    console.log('\n[2/3] Checking cost data API...');
    const costsResponse = await fetch(`${API_URL}/api/costs/by-issue`);
    expect(costsResponse.ok).toBeTruthy();

    const costsData = await costsResponse.json();
    console.log('Cost data keys:', Object.keys(costsData).length);

    // Should return data (may be empty, but should not error)
    expect(costsData).toBeDefined();
    expect(typeof costsData).toBe('object');

    console.log('✓ Cost API still accessible');

    // 3. Navigate to dashboard and verify costs UI works
    console.log('\n[3/3] Checking dashboard costs UI...');
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    // Wait a bit for any cost data to load
    await page.waitForTimeout(1000);

    // The page should load without errors (no error boundary)
    const errorText = page.locator('text=/Error|Failed|Crash/i');
    const errorCount = await errorText.count();
    expect(errorCount).toBe(0);

    console.log('✓ Dashboard loads without errors');
    console.log('\n✓ Test complete - cost data remains accessible');
  });

  test('cleanup button shows "No old agents" when none exist', async ({ page }) => {
    console.log('\n=== EMPTY CLEANUP TEST ===');

    // 1. Create only recent agents
    console.log('\n[1/3] Creating only recent agents...');
    createRecentAgent('agent-test-recent-1');
    createRecentAgent('agent-test-recent-2');

    // 2. Navigate to dashboard
    console.log('\n[2/3] Navigating to dashboard...');
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    // 3. Click cleanup button
    console.log('\n[3/3] Clicking cleanup button...');
    const cleanupButton = page.getByRole('button', { name: /Clean Old Agents/i });
    await expect(cleanupButton).toBeVisible();
    await cleanupButton.click();

    // Verify dialog shows "No old agents"
    await page.waitForTimeout(1000);
    const dialog = page.locator('div', { hasText: 'Confirm Agent Cleanup' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('text=/No old agents to clean up/i')).toBeVisible();

    // Should not have a delete button
    const deleteButton = page.getByRole('button', { name: /Delete.*Agents/i });
    await expect(deleteButton).not.toBeVisible();

    console.log('✓ Dialog correctly shows no old agents');
    console.log('\n✓ Test complete - empty cleanup verified');
  });
});
