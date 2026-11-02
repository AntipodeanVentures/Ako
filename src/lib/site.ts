import { Platform } from 'react-native';

// Where the web app lives, for links that leave the app: a record's public page, the legal
// pages. On the web it is wherever this page was served from; on a phone it is the configured
// site URL.
const SITE = process.env.EXPO_PUBLIC_SITE_URL || '';

export function siteUrl(): string {
  return Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : SITE;
}

export const recordUrl = (code: string) => `${siteUrl()}/r/${code}`;

// The link without its scheme, as printed on the record itself.
export const printableUrl = (url: string) => url.replace(/^https?:\/\//, '');
