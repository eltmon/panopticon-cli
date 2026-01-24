/**
 * Port Manager for workspace port allocation
 *
 * Tracks port assignments across workspaces to avoid conflicts.
 * Supports three strategies: offset, dynamic, and static.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

/**
 * Port allocation state
 */
export interface PortState {
  /** Map of workspace name to port offset */
  workspaces: Record<string, number>;
  /** Next available offset */
  nextOffset: number;
  /** Explicitly reserved ports */
  reserved: number[];
  /** Last updated timestamp */
  updatedAt: string;
}

/**
 * Port allocation for a workspace
 */
export interface WorkspacePorts {
  /** Workspace name */
  workspace: string;
  /** Port offset from base */
  offset: number;
  /** Calculated ports for each service */
  ports: Record<string, number>;
}

/**
 * Default base ports for common services
 */
export const DEFAULT_BASE_PORTS: Record<string, number> = {
  frontend: 5173,
  api: 8080,
  database: 5432,
  redis: 6379,
  elasticsearch: 9200,
  kibana: 5601,
  grafana: 3000,
  prometheus: 9090,
};

/**
 * Port Manager class
 */
export class PortManager {
  private statePath: string;
  private state: PortState;
  private basePorts: Record<string, number>;

  constructor(
    statePath?: string,
    basePorts: Record<string, number> = DEFAULT_BASE_PORTS
  ) {
    this.statePath = statePath || join(
      process.env.HOME || '',
      '.panopticon',
      'state',
      'ports.json'
    );
    this.basePorts = basePorts;
    this.state = this.loadState();
  }

  /**
   * Load state from disk
   */
  private loadState(): PortState {
    if (existsSync(this.statePath)) {
      try {
        return JSON.parse(readFileSync(this.statePath, 'utf-8'));
      } catch {
        // Return default state if file is corrupted
      }
    }

    return {
      workspaces: {},
      nextOffset: 0,
      reserved: [],
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Save state to disk
   */
  private saveState(): void {
    this.state.updatedAt = new Date().toISOString();
    mkdirSync(dirname(this.statePath), { recursive: true });
    writeFileSync(this.statePath, JSON.stringify(this.state, null, 2));
  }

  /**
   * Allocate ports for a workspace
   */
  allocate(workspace: string, services?: string[]): WorkspacePorts {
    // Check if workspace already has allocation
    if (this.state.workspaces[workspace] !== undefined) {
      return this.getWorkspacePorts(workspace, services);
    }

    // Allocate new offset
    const offset = this.state.nextOffset;
    this.state.workspaces[workspace] = offset;
    this.state.nextOffset = offset + 1;
    this.saveState();

    return this.getWorkspacePorts(workspace, services);
  }

  /**
   * Get ports for a workspace
   */
  getWorkspacePorts(workspace: string, services?: string[]): WorkspacePorts {
    const offset = this.state.workspaces[workspace];
    if (offset === undefined) {
      throw new Error(`Workspace not found: ${workspace}`);
    }

    const ports: Record<string, number> = {};
    const serviceList = services || Object.keys(this.basePorts);

    for (const service of serviceList) {
      const basePort = this.basePorts[service];
      if (basePort !== undefined) {
        ports[service] = basePort + offset;
      }
    }

    return { workspace, offset, ports };
  }

  /**
   * Release ports for a workspace
   */
  release(workspace: string): void {
    if (this.state.workspaces[workspace] !== undefined) {
      delete this.state.workspaces[workspace];
      this.saveState();
    }
  }

  /**
   * Check if a port is available
   */
  isPortAvailable(port: number): boolean {
    // Check reserved ports
    if (this.state.reserved.includes(port)) {
      return false;
    }

    // Check allocated ports
    for (const offset of Object.values(this.state.workspaces)) {
      for (const basePort of Object.values(this.basePorts)) {
        if (basePort + offset === port) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Reserve a specific port
   */
  reservePort(port: number): void {
    if (!this.state.reserved.includes(port)) {
      this.state.reserved.push(port);
      this.saveState();
    }
  }

  /**
   * Unreserve a port
   */
  unreservePort(port: number): void {
    const index = this.state.reserved.indexOf(port);
    if (index !== -1) {
      this.state.reserved.splice(index, 1);
      this.saveState();
    }
  }

  /**
   * List all allocated workspaces
   */
  listAllocations(): WorkspacePorts[] {
    return Object.keys(this.state.workspaces).map((workspace) =>
      this.getWorkspacePorts(workspace)
    );
  }

  /**
   * Find workspace using a specific port
   */
  findWorkspaceByPort(port: number): string | null {
    for (const [workspace, offset] of Object.entries(this.state.workspaces)) {
      for (const basePort of Object.values(this.basePorts)) {
        if (basePort + offset === port) {
          return workspace;
        }
      }
    }
    return null;
  }

  /**
   * Get the next available port for a service
   */
  getNextAvailablePort(service: string): number {
    const basePort = this.basePorts[service];
    if (basePort === undefined) {
      throw new Error(`Unknown service: ${service}`);
    }

    // Find the highest used offset
    const maxOffset = Math.max(0, ...Object.values(this.state.workspaces));
    return basePort + maxOffset + 1;
  }

  /**
   * Compact allocations (remove gaps in offsets)
   */
  compact(): void {
    const workspaces = Object.keys(this.state.workspaces).sort(
      (a, b) => this.state.workspaces[a] - this.state.workspaces[b]
    );

    let newOffset = 0;
    for (const workspace of workspaces) {
      this.state.workspaces[workspace] = newOffset;
      newOffset++;
    }

    this.state.nextOffset = newOffset;
    this.saveState();
  }

  /**
   * Get current state (for debugging/inspection)
   */
  getState(): PortState {
    return { ...this.state };
  }

  /**
   * Set custom base ports
   */
  setBasePorts(basePorts: Record<string, number>): void {
    this.basePorts = { ...DEFAULT_BASE_PORTS, ...basePorts };
  }
}

// Export default instance
export const portManager = new PortManager();
