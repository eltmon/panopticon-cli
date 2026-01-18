/**
 * Cross-Tracker Linking
 *
 * Manages links between issues in different trackers.
 * Links are stored in a local JSON file for persistence.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { TrackerType } from './interface.js';

// Link direction types
export type LinkDirection = 'blocks' | 'blocked_by' | 'related' | 'duplicate_of';

// A single link between two issues
export interface TrackerLink {
  sourceIssueRef: string;    // e.g., "MIN-630"
  sourceTracker: TrackerType;
  targetIssueRef: string;    // e.g., "#42"
  targetTracker: TrackerType;
  direction: LinkDirection;
  createdAt: string;         // ISO timestamp
}

// Storage format
interface LinkStore {
  version: 1;
  links: TrackerLink[];
}

/**
 * Parse an issue reference to extract tracker and ID
 * Examples:
 *   "#42" -> { tracker: "github", ref: "#42" }
 *   "github#42" -> { tracker: "github", ref: "#42" }
 *   "MIN-630" -> { tracker: "linear", ref: "MIN-630" }
 *   "gitlab#15" -> { tracker: "gitlab", ref: "#15" }
 */
export function parseIssueRef(ref: string): { tracker: TrackerType; ref: string } | null {
  // Explicit tracker prefix
  if (ref.startsWith('github#')) {
    return { tracker: 'github', ref: `#${ref.slice(7)}` };
  }
  if (ref.startsWith('gitlab#')) {
    return { tracker: 'gitlab', ref: `#${ref.slice(7)}` };
  }
  if (ref.startsWith('linear:')) {
    return { tracker: 'linear', ref: ref.slice(7) };
  }

  // GitHub-style refs (#number)
  if (/^#\d+$/.test(ref)) {
    return { tracker: 'github', ref };
  }

  // Linear-style refs (XXX-123)
  if (/^[A-Z]+-\d+$/i.test(ref)) {
    return { tracker: 'linear', ref: ref.toUpperCase() };
  }

  return null;
}

/**
 * Format an issue ref with tracker prefix for display
 */
export function formatIssueRef(ref: string, tracker: TrackerType): string {
  if (tracker === 'github') {
    return ref.startsWith('#') ? `github${ref}` : `github#${ref}`;
  }
  if (tracker === 'gitlab') {
    return ref.startsWith('#') ? `gitlab${ref}` : `gitlab#${ref}`;
  }
  return ref; // Linear refs are already unique
}

/**
 * Link Manager for cross-tracker issue linking
 */
export class LinkManager {
  private storePath: string;
  private store: LinkStore;

  constructor(storePath?: string) {
    this.storePath = storePath ?? join(homedir(), '.panopticon', 'links.json');
    this.store = this.load();
  }

  private load(): LinkStore {
    if (existsSync(this.storePath)) {
      try {
        const data = JSON.parse(readFileSync(this.storePath, 'utf-8'));
        if (data.version === 1) {
          return data;
        }
      } catch {
        // Fall through to default
      }
    }
    return { version: 1, links: [] };
  }

  private save(): void {
    const dir = join(this.storePath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.storePath, JSON.stringify(this.store, null, 2));
  }

  /**
   * Add a link between two issues
   */
  addLink(
    source: { ref: string; tracker: TrackerType },
    target: { ref: string; tracker: TrackerType },
    direction: LinkDirection = 'related'
  ): TrackerLink {
    // Check if link already exists
    const existing = this.store.links.find(
      (l) =>
        l.sourceIssueRef === source.ref &&
        l.sourceTracker === source.tracker &&
        l.targetIssueRef === target.ref &&
        l.targetTracker === target.tracker
    );

    if (existing) {
      // Update direction if different
      if (existing.direction !== direction) {
        existing.direction = direction;
        this.save();
      }
      return existing;
    }

    const link: TrackerLink = {
      sourceIssueRef: source.ref,
      sourceTracker: source.tracker,
      targetIssueRef: target.ref,
      targetTracker: target.tracker,
      direction,
      createdAt: new Date().toISOString(),
    };

    this.store.links.push(link);
    this.save();
    return link;
  }

  /**
   * Remove a link between two issues
   */
  removeLink(
    source: { ref: string; tracker: TrackerType },
    target: { ref: string; tracker: TrackerType }
  ): boolean {
    const index = this.store.links.findIndex(
      (l) =>
        l.sourceIssueRef === source.ref &&
        l.sourceTracker === source.tracker &&
        l.targetIssueRef === target.ref &&
        l.targetTracker === target.tracker
    );

    if (index >= 0) {
      this.store.links.splice(index, 1);
      this.save();
      return true;
    }
    return false;
  }

  /**
   * Get all issues linked to a given issue
   */
  getLinkedIssues(ref: string, tracker: TrackerType): TrackerLink[] {
    return this.store.links.filter(
      (l) =>
        (l.sourceIssueRef === ref && l.sourceTracker === tracker) ||
        (l.targetIssueRef === ref && l.targetTracker === tracker)
    );
  }

  /**
   * Get all links (for debugging/admin)
   */
  getAllLinks(): TrackerLink[] {
    return [...this.store.links];
  }

  /**
   * Find linked issue in another tracker
   */
  findLinkedIssue(
    ref: string,
    sourceTracker: TrackerType,
    targetTracker: TrackerType
  ): string | null {
    // Check as source
    const asSource = this.store.links.find(
      (l) =>
        l.sourceIssueRef === ref &&
        l.sourceTracker === sourceTracker &&
        l.targetTracker === targetTracker
    );
    if (asSource) return asSource.targetIssueRef;

    // Check as target
    const asTarget = this.store.links.find(
      (l) =>
        l.targetIssueRef === ref &&
        l.targetTracker === sourceTracker &&
        l.sourceTracker === targetTracker
    );
    if (asTarget) return asTarget.sourceIssueRef;

    return null;
  }

  /**
   * Clear all links (for testing)
   */
  clear(): void {
    this.store.links = [];
    this.save();
  }
}

// Singleton instance
let _linkManager: LinkManager | null = null;

export function getLinkManager(): LinkManager {
  if (!_linkManager) {
    _linkManager = new LinkManager();
  }
  return _linkManager;
}
