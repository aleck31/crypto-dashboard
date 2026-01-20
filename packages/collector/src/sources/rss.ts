import type { MarketInfo, MarketInfoSource } from '@crypto-dashboard/shared';
import { generateContentHash, calculateTTL } from '@crypto-dashboard/shared';

/**
 * RSS Feed Configuration
 */
interface RSSFeed {
  source: MarketInfoSource;
  url: string;
  name: string;
}

const RSS_FEEDS: RSSFeed[] = [
  {
    source: 'rss:coindesk',
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    name: 'CoinDesk',
  },
  {
    source: 'rss:cointelegraph',
    url: 'https://cointelegraph.com/rss',
    name: 'Cointelegraph',
  },
  {
    source: 'rss:theblock',
    url: 'https://www.theblock.co/rss.xml',
    name: 'The Block',
  },
  {
    source: 'rss:decrypt',
    url: 'https://decrypt.co/feed',
    name: 'Decrypt',
  },
];

/**
 * Simple RSS XML parser
 * Note: In production, consider using a proper XML parser library
 */
function parseRSSItems(xml: string): RSSItem[] {
  const items: RSSItem[] = [];

  // Extract items using regex (simple approach)
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

interface RSSItem {
  title: string;
  link?: string;
  description: string;
  pubDate?: string;
  author?: string;
  category?: string;
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
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Fetch RSS feed and convert to MarketInfo
 */
async function fetchRSSFeed(feed: RSSFeed): Promise<MarketInfo[]> {
  try {
    const response = await fetch(feed.url, {
      headers: {
        'User-Agent': 'CryptoDashboard/1.0',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const xml = await response.text();
    const items = parseRSSItems(xml);

    const now = new Date().toISOString();
    const ttl = calculateTTL(30); // Keep for 30 days

    return items.slice(0, 20).map((item) => {
      const contentHash = generateContentHash(item.title + item.link);
      const id = `${feed.source.replace('rss:', '')}-${contentHash}`;

      // Parse publish date
      let publishedAt = now;
      if (item.pubDate) {
        try {
          publishedAt = new Date(item.pubDate).toISOString();
        } catch {
          publishedAt = now;
        }
      }

      // Extract published date (YYYY-MM-DD) for GSI
      const publishedDate = publishedAt.split('T')[0];

      const info: MarketInfo = {
        id,
        source: feed.source,
        rawData: item as unknown as Record<string, unknown>,
        title: item.title,
        content: item.description,
        url: item.link,
        publishedAt,
        author: item.author,
        tags: item.category ? [item.category] : undefined,
        language: 'en',
        collectedAt: now,
        processedStatus: 'pending',
        contentHash,
        ttl,
        // Additional field for date-index GSI
        publishedDate,
      } as MarketInfo & { publishedDate: string };

      return info;
    });
  } catch (error) {
    console.error(`Error fetching RSS feed ${feed.name}:`, error);
    return [];
  }
}

/**
 * Collect MarketInfo from all RSS feeds
 */
export async function collectRSSMarketInfo(): Promise<MarketInfo[]> {
  const results: MarketInfo[] = [];

  for (const feed of RSS_FEEDS) {
    console.log(`Fetching RSS feed: ${feed.name}...`);
    try {
      const items = await fetchRSSFeed(feed);
      results.push(...items);
      console.log(`Fetched ${items.length} items from ${feed.name}`);
    } catch (error) {
      console.error(`Error fetching ${feed.name}:`, error);
    }

    // Add delay between feeds
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return results;
}
