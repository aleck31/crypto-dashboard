/**
 * Base Collector Interface
 *
 * Defines the interface that all collectors must implement.
 */

import type {
  SourceConfig,
  CollectorConfig,
  CollectorResult,
  ValidationResult,
  ProjectInfo,
  MarketInfo,
} from '@crypto-dashboard/shared';

/**
 * Base collector interface
 */
export interface Collector<TConfig extends CollectorConfig = CollectorConfig> {
  /** Collector type identifier */
  readonly type: string;

  /** Execute collection */
  collect(config: SourceConfig): Promise<CollectorResult>;

  /** Validate configuration */
  validateConfig(config: TConfig): ValidationResult;
}

/**
 * Abstract base class for collectors
 */
export abstract class BaseCollector<TConfig extends CollectorConfig = CollectorConfig>
  implements Collector<TConfig>
{
  abstract readonly type: string;

  abstract collect(config: SourceConfig): Promise<CollectorResult>;

  validateConfig(config: TConfig): ValidationResult {
    // Default implementation - override in subclasses for specific validation
    return { valid: true, errors: [] };
  }

  /**
   * Create a successful result
   */
  protected successResult(
    items: (ProjectInfo | MarketInfo)[],
    stats: { totalFetched: number; savedCount: number; skippedCount: number }
  ): CollectorResult {
    return {
      success: true,
      items,
      stats,
    };
  }

  /**
   * Create a failed result
   */
  protected failedResult(error: string): CollectorResult {
    return {
      success: false,
      items: [],
      error,
      stats: {
        totalFetched: 0,
        savedCount: 0,
        skippedCount: 0,
      },
    };
  }
}
