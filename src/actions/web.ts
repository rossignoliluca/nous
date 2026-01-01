/**
 * Web Actions
 *
 * Fetch URLs, search the web, interact with APIs.
 */

import { ActionResult } from './index';

/**
 * Fetch a URL
 */
export async function fetchUrl(
  url: string,
  options?: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers?: Record<string, string>;
    body?: string | object;
    timeout?: number;
  }
): Promise<ActionResult> {
  try {
    const controller = new AbortController();
    const timeout = options?.timeout || 30000;

    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const fetchOptions: RequestInit = {
      method: options?.method || 'GET',
      headers: options?.headers,
      signal: controller.signal,
    };

    if (options?.body) {
      fetchOptions.body = typeof options.body === 'string'
        ? options.body
        : JSON.stringify(options.body);

      if (!fetchOptions.headers) {
        fetchOptions.headers = {};
      }
      if (typeof options.body === 'object') {
        (fetchOptions.headers as Record<string, string>)['Content-Type'] = 'application/json';
      }
    }

    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || '';
    let body: string;

    if (contentType.includes('application/json')) {
      const json = await response.json();
      body = JSON.stringify(json, null, 2);
    } else {
      body = await response.text();
    }

    // Truncate very long responses
    const maxLength = 50000;
    if (body.length > maxLength) {
      body = body.slice(0, maxLength) + '\n... (truncated)';
    }

    return {
      success: response.ok,
      output: body,
      metadata: {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        url: response.url,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.name === 'AbortError'
        ? 'Request timed out'
        : `Fetch failed: ${error.message}`,
    };
  }
}

/**
 * Search the web (using DuckDuckGo HTML)
 * Note: For better results, use a proper search API
 */
export async function search(
  query: string,
  options?: { limit?: number }
): Promise<ActionResult> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'NOUS/1.0 (Autopoietic System)',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Search failed: ${response.status}`,
      };
    }

    const html = await response.text();

    // Extract results (basic parsing)
    const results: { title: string; url: string; snippet: string }[] = [];
    const resultRegex = /<a class="result__a" href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([^<]+)<\/a>/g;

    let match;
    const limit = options?.limit || 5;

    while ((match = resultRegex.exec(html)) !== null && results.length < limit) {
      results.push({
        url: match[1],
        title: match[2].trim(),
        snippet: match[3].trim(),
      });
    }

    if (results.length === 0) {
      // Fallback: try simpler extraction
      const linkRegex = /<a class="result__a" href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
      while ((match = linkRegex.exec(html)) !== null && results.length < limit) {
        results.push({
          url: match[1],
          title: match[2].trim(),
          snippet: '',
        });
      }
    }

    return {
      success: true,
      output: results.map((r, i) =>
        `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`
      ).join('\n\n'),
      metadata: { results, query },
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Search failed: ${error.message}`,
    };
  }
}

/**
 * Check if a URL is reachable
 */
export async function ping(url: string): Promise<ActionResult> {
  try {
    const start = Date.now();
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000),
    });
    const duration = Date.now() - start;

    return {
      success: true,
      output: `${response.status} ${response.statusText} (${duration}ms)`,
      metadata: {
        reachable: response.ok,
        status: response.status,
        duration,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Unreachable: ${error.message}`,
      metadata: { reachable: false },
    };
  }
}

/**
 * Download a file
 */
export async function downloadFile(
  url: string,
  destPath: string
): Promise<ActionResult> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      return {
        success: false,
        error: `Download failed: ${response.status}`,
      };
    }

    const buffer = await response.arrayBuffer();
    const fs = await import('fs');
    const path = await import('path');

    const absolutePath = path.resolve(destPath);
    const dir = path.dirname(absolutePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(absolutePath, Buffer.from(buffer));

    return {
      success: true,
      output: `Downloaded to ${destPath}`,
      metadata: {
        size: buffer.byteLength,
        path: absolutePath,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Download failed: ${error.message}`,
    };
  }
}

/**
 * Make an API request with JSON
 */
export async function apiRequest(
  url: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    data?: object;
    headers?: Record<string, string>;
    auth?: { type: 'bearer' | 'basic'; token: string };
  }
): Promise<ActionResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (options.auth) {
    if (options.auth.type === 'bearer') {
      headers['Authorization'] = `Bearer ${options.auth.token}`;
    } else if (options.auth.type === 'basic') {
      headers['Authorization'] = `Basic ${options.auth.token}`;
    }
  }

  return fetchUrl(url, {
    method: options.method || 'GET',
    headers,
    body: options.data,
  });
}
