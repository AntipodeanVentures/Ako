import { Linking, Platform } from 'react-native';

// The privacy notice and terms are static pages served beside the web app
// (public/privacy.html, public/terms.html). Phone builds open the hosted
// copies at the site URL.
const SITE = process.env.EXPO_PUBLIC_SITE_URL || '';

export function legalUrl(page: 'privacy' | 'terms'): string {
  const base = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : SITE;
  return `${base}/${page}.html`;
}

export function openLegal(page: 'privacy' | 'terms') {
  Linking.openURL(legalUrl(page)).catch(() => {});
}
