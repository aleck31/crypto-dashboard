/**
 * Collector Registry
 *
 * Maps collector types to their implementations.
 */

import type { CollectorType } from '@crypto-dashboard/shared';
import type { Collector } from './base.js';
import { RssCollector } from './rss.js';
import { RestApiCollector } from './rest-api.js';

/**
 * Registry of available collectors
 */
const collectors = new Map<CollectorType, Collector>([
  ['rss', new RssCollector()],
  ['api:rest', new RestApiCollector()],
  // Future collectors:
  // ['api:graphql', new GraphQLCollector()],
  // ['twitter', new TwitterCollector()],
  // ['scraper', new ScraperCollector()],
]);

/**
 * Get a collector by type
 */
export function getCollector(type: CollectorType): Collector | undefined {
  return collectors.get(type);
}

/**
 * Check if a collector type is supported
 */
export function isCollectorSupported(type: CollectorType): boolean {
  return collectors.has(type);
}

/**
 * Get all supported collector types
 */
export function getSupportedCollectorTypes(): CollectorType[] {
  return Array.from(collectors.keys());
}

/**
 * Register a new collector
 */
export function registerCollector(type: CollectorType, collector: Collector): void {
  collectors.set(type, collector);
}
