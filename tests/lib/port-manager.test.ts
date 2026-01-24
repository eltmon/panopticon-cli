import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PortManager, DEFAULT_BASE_PORTS } from '../../src/lib/port-manager';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('PortManager', () => {
  let manager: PortManager;
  let testDir: string;
  let statePath: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `port-manager-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    statePath = join(testDir, 'ports.json');
    manager = new PortManager(statePath);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('allocate', () => {
    it('should allocate ports for a new workspace', () => {
      const result = manager.allocate('workspace-1');

      expect(result.workspace).toBe('workspace-1');
      expect(result.offset).toBe(0);
      expect(result.ports.frontend).toBe(DEFAULT_BASE_PORTS.frontend);
      expect(result.ports.api).toBe(DEFAULT_BASE_PORTS.api);
    });

    it('should allocate incrementing offsets for multiple workspaces', () => {
      const result1 = manager.allocate('workspace-1');
      const result2 = manager.allocate('workspace-2');
      const result3 = manager.allocate('workspace-3');

      expect(result1.offset).toBe(0);
      expect(result2.offset).toBe(1);
      expect(result3.offset).toBe(2);

      expect(result2.ports.frontend).toBe(DEFAULT_BASE_PORTS.frontend + 1);
      expect(result3.ports.frontend).toBe(DEFAULT_BASE_PORTS.frontend + 2);
    });

    it('should return existing allocation for same workspace', () => {
      const result1 = manager.allocate('workspace-1');
      const result2 = manager.allocate('workspace-1');

      expect(result1.offset).toBe(result2.offset);
      expect(result1.ports).toEqual(result2.ports);
    });

    it('should allocate only requested services', () => {
      const result = manager.allocate('workspace-1', ['frontend', 'database']);

      expect(result.ports.frontend).toBeDefined();
      expect(result.ports.database).toBeDefined();
      expect(result.ports.api).toBeUndefined();
    });
  });

  describe('getWorkspacePorts', () => {
    it('should return ports for allocated workspace', () => {
      manager.allocate('workspace-1');
      const ports = manager.getWorkspacePorts('workspace-1');

      expect(ports.workspace).toBe('workspace-1');
      expect(ports.ports.frontend).toBe(DEFAULT_BASE_PORTS.frontend);
    });

    it('should throw for non-existent workspace', () => {
      expect(() => manager.getWorkspacePorts('non-existent')).toThrow(
        'Workspace not found'
      );
    });
  });

  describe('release', () => {
    it('should release workspace allocation', () => {
      manager.allocate('workspace-1');
      manager.release('workspace-1');

      expect(() => manager.getWorkspacePorts('workspace-1')).toThrow();
    });

    it('should not error when releasing non-existent workspace', () => {
      expect(() => manager.release('non-existent')).not.toThrow();
    });
  });

  describe('isPortAvailable', () => {
    it('should return true for unused port', () => {
      expect(manager.isPortAvailable(9999)).toBe(true);
    });

    it('should return false for allocated port', () => {
      manager.allocate('workspace-1');
      expect(manager.isPortAvailable(DEFAULT_BASE_PORTS.frontend)).toBe(false);
    });

    it('should return false for reserved port', () => {
      manager.reservePort(9999);
      expect(manager.isPortAvailable(9999)).toBe(false);
    });
  });

  describe('reservePort / unreservePort', () => {
    it('should reserve and unreserve ports', () => {
      manager.reservePort(9999);
      expect(manager.isPortAvailable(9999)).toBe(false);

      manager.unreservePort(9999);
      expect(manager.isPortAvailable(9999)).toBe(true);
    });
  });

  describe('listAllocations', () => {
    it('should list all allocations', () => {
      manager.allocate('workspace-1');
      manager.allocate('workspace-2');

      const allocations = manager.listAllocations();
      expect(allocations.length).toBe(2);
      expect(allocations.map((a) => a.workspace)).toContain('workspace-1');
      expect(allocations.map((a) => a.workspace)).toContain('workspace-2');
    });
  });

  describe('findWorkspaceByPort', () => {
    it('should find workspace using a port', () => {
      manager.allocate('workspace-1');
      const workspace = manager.findWorkspaceByPort(DEFAULT_BASE_PORTS.frontend);
      expect(workspace).toBe('workspace-1');
    });

    it('should return null for unused port', () => {
      const workspace = manager.findWorkspaceByPort(9999);
      expect(workspace).toBeNull();
    });
  });

  describe('getNextAvailablePort', () => {
    it('should return next available port for service', () => {
      manager.allocate('workspace-1');
      manager.allocate('workspace-2');

      const nextPort = manager.getNextAvailablePort('frontend');
      // After allocating offsets 0 and 1, next available is base + 2
      expect(nextPort).toBe(DEFAULT_BASE_PORTS.frontend + 2);
    });

    it('should throw for unknown service', () => {
      expect(() => manager.getNextAvailablePort('unknown')).toThrow(
        'Unknown service'
      );
    });
  });

  describe('compact', () => {
    it('should compact allocations removing gaps', () => {
      manager.allocate('workspace-1');
      manager.allocate('workspace-2');
      manager.allocate('workspace-3');
      manager.release('workspace-2');

      const beforeCompact = manager.getState();
      expect(beforeCompact.workspaces['workspace-3']).toBe(2);

      manager.compact();

      const afterCompact = manager.getState();
      expect(afterCompact.workspaces['workspace-1']).toBe(0);
      expect(afterCompact.workspaces['workspace-3']).toBe(1);
      expect(afterCompact.nextOffset).toBe(2);
    });
  });

  describe('persistence', () => {
    it('should persist state across instances', () => {
      manager.allocate('workspace-1');
      manager.allocate('workspace-2');

      // Create new manager instance with same state path
      const newManager = new PortManager(statePath);
      const allocations = newManager.listAllocations();

      expect(allocations.length).toBe(2);
      expect(allocations.map((a) => a.workspace)).toContain('workspace-1');
    });
  });

  describe('setBasePorts', () => {
    it('should allow custom base ports', () => {
      manager.setBasePorts({ frontend: 4000, api: 5000 });
      const result = manager.allocate('workspace-1');

      expect(result.ports.frontend).toBe(4000);
      expect(result.ports.api).toBe(5000);
    });
  });
});
