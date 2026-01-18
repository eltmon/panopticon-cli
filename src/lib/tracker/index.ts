/**
 * Issue Tracker Module
 *
 * Provides a unified interface for different issue tracking systems.
 */

// Core interface and types
export type {
  IssueTracker,
  Issue,
  IssueFilters,
  IssueState,
  IssueUpdate,
  NewIssue,
  Comment,
  TrackerType,
} from './interface.js';

export {
  NotImplementedError,
  IssueNotFoundError,
  TrackerAuthError,
} from './interface.js';

// Tracker implementations
export { LinearTracker } from './linear.js';
export { GitHubTracker } from './github.js';
export { GitLabTracker } from './gitlab.js';

// Factory functions
export type { TrackerConfig } from './factory.js';
export {
  createTracker,
  createTrackerFromConfig,
  getPrimaryTracker,
  getSecondaryTracker,
  getAllTrackers,
} from './factory.js';

// Cross-tracker linking
export type { TrackerLink, LinkDirection } from './linking.js';
export {
  LinkManager,
  getLinkManager,
  parseIssueRef,
  formatIssueRef,
} from './linking.js';
