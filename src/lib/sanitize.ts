// Input sanitization utilities for security

/**
 * Escape HTML entities to prevent XSS
 */
export function escapeHtml(str: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };
  
  return str.replace(/[&<>"'`=/]/g, (char) => htmlEntities[char] || char);
}

/**
 * Remove all HTML tags from string
 */
export function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize string for safe display (escape HTML but preserve newlines)
 */
export function sanitizeText(str: string): string {
  return escapeHtml(str.trim());
}

/**
 * Sanitize username (alphanumeric, underscore, period only)
 */
export function sanitizeUsername(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_.]/g, '')
    .slice(0, 30);
}

/**
 * Sanitize email
 */
export function sanitizeEmail(str: string): string {
  return str.toLowerCase().trim();
}

/**
 * Sanitize phone number (digits only with optional leading +)
 */
export function sanitizePhone(str: string): string {
  const cleaned = str.replace(/[^\d+]/g, '');
  return cleaned.startsWith('+') ? cleaned : cleaned.replace(/^\+?/, '');
}

/**
 * Sanitize URL - validate and return safe URL or empty string
 */
export function sanitizeUrl(str: string): string {
  try {
    const url = new URL(str.trim());
    // Only allow http and https protocols
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return '';
    }
    return url.toString();
  } catch {
    return '';
  }
}

/**
 * Sanitize filename
 */
export function sanitizeFilename(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 255);
}

/**
 * Sanitize hashtag
 */
export function sanitizeHashtag(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 50);
}

/**
 * Sanitize search query
 */
export function sanitizeSearchQuery(str: string): string {
  return str
    .trim()
    .replace(/[<>]/g, '')
    .slice(0, 100);
}

/**
 * Validate and sanitize JSON input
 */
export function sanitizeJson(str: string): object | null {
  try {
    const parsed = JSON.parse(str);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Truncate string safely (doesn't break in middle of word)
 */
export function truncate(str: string, maxLength: number, suffix = '...'): string {
  if (str.length <= maxLength) return str;
  
  const truncated = str.slice(0, maxLength - suffix.length);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.7) {
    return truncated.slice(0, lastSpace) + suffix;
  }
  
  return truncated + suffix;
}

/**
 * Remove potentially dangerous attributes from object
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  allowedKeys: (keyof T)[]
): Partial<T> {
  const sanitized: Partial<T> = {};
  
  for (const key of allowedKeys) {
    if (key in obj) {
      const value = obj[key];
      if (typeof value === 'string') {
        sanitized[key] = sanitizeText(value) as T[keyof T];
      } else {
        sanitized[key] = value;
      }
    }
  }
  
  return sanitized;
}

/**
 * Check if string contains potential XSS vectors
 */
export function containsXss(str: string): boolean {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /data:/gi,
    /vbscript:/gi,
  ];
  
  return xssPatterns.some((pattern) => pattern.test(str));
}

export default {
  escapeHtml,
  stripHtml,
  sanitizeText,
  sanitizeUsername,
  sanitizeEmail,
  sanitizePhone,
  sanitizeUrl,
  sanitizeFilename,
  sanitizeHashtag,
  sanitizeSearchQuery,
  sanitizeJson,
  truncate,
  sanitizeObject,
  containsXss,
};
