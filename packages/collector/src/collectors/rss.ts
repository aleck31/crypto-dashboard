/**
 * RSS Collector
 *
 * Collects MarketInfo from RSS feeds based on SourceConfig.
 */

import type {
  SourceConfig,
  RssConfig,
  CollectorResult,
  ValidationResult,
  MarketInfo,
  MarketInfoSource,
} from '@crypto-dashboard/shared';
import { generateContentHash, calculateTTL } from '@crypto-dashboard/shared';
import { BaseCollector } from './base.js';

interface FeedItem {
  title: string;
  link?: string;
  description: string;
  pubDate?: string;
  author?: string;
  category?: string;
}

/**
 * Detect feed format (RSS or Atom)
 */
function isAtomFeed(xml: string): boolean {
  return xml.includes('<feed') && xml.includes('xmlns="http://www.w3.org/2005/Atom"');
}

/**
 * Parse RSS format items (<item> tags)
 */
function parseRSSItems(xml: string): FeedItem[] {
  const items: FeedItem[] = [];

  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const description = extractTag(itemXml, 'description');
    const pubDate = extractTag(itemXml, 'pubDate');
    const author = extractTag(itemXml, 'author') || extractTag(itemXml, 'dc:creator');
    const category = extractTag(itemXml, 'category');

    if (title) {
      items.push({
        title: cleanHtml(title),
        link,
        description: cleanHtml(description || ''),
        pubDate,
        author,
        category,
      });
    }
  }

  return items;
}

/**
 * Parse Atom format entries (<entry> tags)
 */
function parseAtomEntries(xml: string): FeedItem[] {
  const items: FeedItem[] = [];

  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entryXml = match[1];

    const title = extractTag(entryXml, 'title');
    // Atom uses <link href="..."/> attribute instead of <link>...</link>
    const link = extractAtomLink(entryXml);
    // Atom uses <summary> or <content> instead of <description>
    const description = extractTag(entryXml, 'summary') || extractTag(entryXml, 'content');
    // Atom uses <published> or <updated> instead of <pubDate>
    const pubDate = extractTag(entryXml, 'published') || extractTag(entryXml, 'updated');
    // Atom uses <author><name>...</name></author>
    const author = extractAtomAuthor(entryXml);
    // Atom uses <category term="..."/> attribute
    const category = extractAtomCategory(entryXml);

    if (title) {
      items.push({
        title: cleanHtml(title),
        link,
        description: cleanHtml(description || ''),
        pubDate,
        author,
        category,
      });
    }
  }

  return items;
}

/**
 * Extract link from Atom format (<link href="..."/>)
 */
function extractAtomLink(xml: string): string | undefined {
  // Match <link href="..." rel="alternate"/> or just <link href="..."/>
  const linkRegex = /<link[^>]*href=["']([^"']+)["'][^>]*>/i;
  const match = xml.match(linkRegex);
  return match ? match[1] : undefined;
}

/**
 * Extract author from Atom format (<author><name>...</name></author>)
 */
function extractAtomAuthor(xml: string): string | undefined {
  const authorRegex = /<author[^>]*>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<\/author>/i;
  const match = xml.match(authorRegex);
  return match ? match[1].trim() : undefined;
}

/**
 * Extract category from Atom format (<category term="..."/>)
 */
function extractAtomCategory(xml: string): string | undefined {
  const categoryRegex = /<category[^>]*term=["']([^"']+)["'][^>]*>/i;
  const match = xml.match(categoryRegex);
  return match ? match[1] : undefined;
}

/**
 * Parse feed items (auto-detect RSS or Atom format)
 */
function parseFeedItems(xml: string): FeedItem[] {
  if (isAtomFeed(xml)) {
    console.log('Detected Atom feed format');
    return parseAtomEntries(xml);
  } else {
    console.log('Detected RSS feed format');
    return parseRSSItems(xml);
  }
}

function extractTag(xml: string, tag: string): string | undefined {
  // Handle CDATA sections
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) {
    return cdataMatch[1].trim();
  }

  // Handle regular tags
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : undefined;
}

function cleanHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * RSS Collector implementation
 */
export class RssCollector extends BaseCollector<RssConfig> {
  readonly type = 'rss';

  async collect(sourceConfig: SourceConfig): Promise<CollectorResult> {
    const config = sourceConfig.config as RssConfig;

    try {
      console.log(`Collecting RSS from ${sourceConfig.name} (${config.url})...`);

      const response = await fetch(config.url, {
        headers: {
          'User-Agent': config.userAgent || 'CryptoDashboard/1.0',
          'Accept': 'application/rss+xml, application/xml, text/xml',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xml = await response.text();
      const items = parseFeedItems(xml);

      const maxItems = config.maxItems || 20;
      const now = new Date().toISOString();
      const ttl = calculateTTL(30);

      // Determine the source identifier for MarketInfo
      const source = sourceConfig.sourceId as MarketInfoSource;

      const marketInfoItems: MarketInfo[] = items.slice(0, maxItems).map((item) => {
        const contentHash = generateContentHash(item.title + item.link);
        const id = `${sourceConfig.sourceId.replace('rss:', '')}-${contentHash}`;

        let publishedAt = now;
        if (item.pubDate) {
          try {
            publishedAt = new Date(item.pubDate).toISOString();
          } catch {
            publishedAt = now;
          }
        }

        const publishedDate = publishedAt.split('T')[0];

        const info: MarketInfo & { publishedDate: string } = {
          id,
          source,
          rawData: item as unknown as Record<string, unknown>,
          title: item.title,
          content: item.description,
          publishedAt,
          language: config.language || 'en',
          collectedAt: now,
          processedStatus: 'pending',
          contentHash,
          ttl,
          publishedDate,
        };

        // Add optional fields only if they have values
        if (item.link) info.url = item.link;
        if (item.author) info.author = item.author;
        if (item.category) info.tags = [item.category];

        return info;
      });

      console.log(`Collected ${marketInfoItems.length} items from ${sourceConfig.name}`);

      return this.successResult(marketInfoItems, {
        totalFetched: marketInfoItems.length,
        savedCount: marketInfoItems.length,
        skippedCount: items.length - marketInfoItems.length,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error collecting RSS from ${sourceConfig.name}:`, error);
      return this.failedResult(errorMessage);
    }
  }

  validateConfig(config: RssConfig): ValidationResult {
    const errors: string[] = [];

    if (!config.url) {
      errors.push('RSS URL is required');
    } else if (!config.url.startsWith('http://') && !config.url.startsWith('https://')) {
      errors.push('RSS URL must start with http:// or https://');
    }

    if (config.maxItems !== undefined && (config.maxItems < 1 || config.maxItems > 100)) {
      errors.push('maxItems must be between 1 and 100');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
