/**
 * REST API Collector
 *
 * Generic REST API collector that uses configuration to fetch and transform data.
 */

import type {
  SourceConfig,
  RestApiConfig,
  RestApiEndpoint,
  FieldMapping,
  FieldMappingRule,
  CollectorResult,
  ValidationResult,
  ProjectInfo,
  MarketInfo,
  ProjectInfoSource,
} from '@crypto-dashboard/shared';
import { generateProjectInfoId, generateContentHash } from '@crypto-dashboard/shared';
import { BaseCollector } from './base.js';

/**
 * REST API Collector implementation
 */
export class RestApiCollector extends BaseCollector<RestApiConfig> {
  readonly type = 'api:rest';

  async collect(sourceConfig: SourceConfig): Promise<CollectorResult> {
    const config = sourceConfig.config as RestApiConfig;

    try {
      console.log(`Collecting from REST API: ${sourceConfig.name} (${config.baseUrl})...`);

      const allItems: (ProjectInfo | MarketInfo)[] = [];
      const requestDelay = config.requestDelay || 1000;

      for (const endpoint of config.endpoints) {
        try {
          const items = await this.fetchEndpoint(sourceConfig, config, endpoint);
          allItems.push(...items);
          console.log(`Fetched ${items.length} items from ${endpoint.path}`);
        } catch (error) {
          console.error(`Error fetching ${endpoint.path}:`, error);
        }

        // Delay between requests
        if (config.endpoints.indexOf(endpoint) < config.endpoints.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, requestDelay));
        }
      }

      return this.successResult(allItems, {
        totalFetched: allItems.length,
        savedCount: allItems.length,
        skippedCount: 0,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error collecting from ${sourceConfig.name}:`, error);
      return this.failedResult(errorMessage);
    }
  }

  private async fetchEndpoint(
    sourceConfig: SourceConfig,
    config: RestApiConfig,
    endpoint: RestApiEndpoint
  ): Promise<(ProjectInfo | MarketInfo)[]> {
    // Build URL (path can include query string)
    const url = `${config.baseUrl}${endpoint.path}`;

    // Build headers
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...(config.headers || {}),
    };

    // Fetch data with retry logic
    const data = await this.fetchWithRetry(url, headers, endpoint.method);

    // Handle array or object response
    const items = Array.isArray(data) ? data : [data];

    // Apply limit if specified
    const limitedItems = endpoint.limit ? items.slice(0, endpoint.limit) : items;

    // Transform items using mapping
    const now = new Date().toISOString();
    const source = sourceConfig.sourceId as ProjectInfoSource;

    return limitedItems.map((item) => {
      const mappedData = this.applyMapping(item, endpoint.mapping);
      const rawData = item as Record<string, unknown>;
      const dataHash = generateContentHash(JSON.stringify(rawData));

      // Determine ID from mapping or generate one
      const sourceId = String(mappedData.id || mappedData.slug || mappedData.symbol || Math.random());

      // Helper to safely convert to string or undefined
      const toStringOrUndefined = (value: unknown): string | undefined => {
        if (value === null || value === undefined) return undefined;
        return String(value);
      };

      if (sourceConfig.type === 'project_info') {
        const info: ProjectInfo = {
          id: generateProjectInfoId(source, sourceId),
          source,
          sourceId,
          rawData,
          name: String(mappedData.name || sourceId),
          logo: toStringOrUndefined(mappedData.image || mappedData.logo),
          website: toStringOrUndefined(mappedData.url || mappedData.website),
          description: toStringOrUndefined(mappedData.description),
          sourceCategory: toStringOrUndefined(mappedData.category || mappedData.sourceCategory),
          twitter: toStringOrUndefined(mappedData.twitter || mappedData.twitter_handle),
          tokenSymbol: toStringOrUndefined(mappedData.symbol || mappedData.tokenSymbol),
          collectedAt: now,
          processedStatus: 'pending',
          dataHash,
        };
        return info;
      } else {
        // MarketInfo - less common for REST API collectors
        const info: MarketInfo = {
          id: `${source}-${dataHash}`,
          source: source as unknown as import('@crypto-dashboard/shared').MarketInfoSource,
          rawData,
          title: String(mappedData.title || mappedData.name || ''),
          content: String(mappedData.content || mappedData.description || ''),
          url: toStringOrUndefined(mappedData.url),
          publishedAt: String(mappedData.publishedAt || now),
          collectedAt: now,
          processedStatus: 'pending',
          contentHash: dataHash,
        };
        return info;
      }
    });
  }

  private async fetchWithRetry(
    url: string,
    headers: Record<string, string>,
    method: 'GET' | 'POST',
    retries = 3
  ): Promise<unknown> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, { method, headers });

        if (response.status === 429) {
          // Rate limited, wait and retry
          const waitTime = Math.min(60000, 1000 * Math.pow(2, i + 1));
          console.log(`Rate limited, waiting ${waitTime}ms...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
    throw new Error('Max retries exceeded');
  }

  private applyMapping(
    data: Record<string, unknown>,
    mapping: FieldMapping
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [targetField, rule] of Object.entries(mapping)) {
      if (typeof rule === 'string') {
        // Simple field mapping
        result[targetField] = this.getNestedValue(data, rule);
      } else {
        // Complex mapping rule
        const mappingRule = rule as FieldMappingRule;
        let value = this.getNestedValue(data, mappingRule.source);

        if (value === undefined && mappingRule.default !== undefined) {
          value = mappingRule.default;
        }

        if (value !== undefined && mappingRule.transform) {
          value = this.transformValue(value, mappingRule.transform);
        }

        result[targetField] = value;
      }
    }

    return result;
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  private transformValue(
    value: unknown,
    transform: 'string' | 'number' | 'date' | 'array' | 'lowercase' | 'uppercase'
  ): unknown {
    switch (transform) {
      case 'string':
        return String(value);
      case 'number':
        return Number(value);
      case 'date':
        return new Date(String(value)).toISOString();
      case 'array':
        return Array.isArray(value) ? value : [value];
      case 'lowercase':
        return String(value).toLowerCase();
      case 'uppercase':
        return String(value).toUpperCase();
      default:
        return value;
    }
  }

  validateConfig(config: RestApiConfig): ValidationResult {
    const errors: string[] = [];

    if (!config.baseUrl) {
      errors.push('baseUrl is required');
    } else if (!config.baseUrl.startsWith('http://') && !config.baseUrl.startsWith('https://')) {
      errors.push('baseUrl must start with http:// or https://');
    }

    if (!config.endpoints || config.endpoints.length === 0) {
      errors.push('At least one endpoint is required');
    } else {
      for (const endpoint of config.endpoints) {
        if (!endpoint.path) {
          errors.push('Endpoint path is required');
        }
        if (!endpoint.mapping || Object.keys(endpoint.mapping).length === 0) {
          errors.push('Endpoint mapping is required');
        }
      }
    }

    if (config.rateLimit !== undefined && config.rateLimit < 1) {
      errors.push('rateLimit must be at least 1');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
