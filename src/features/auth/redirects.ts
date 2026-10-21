import { Platform } from 'react-native';

// Where emailed auth links should land. On the web that is this same site;
// on a phone build it is the app's own scheme. Both must be on the
// project's redirect allow-list (Authentication, URL configuration).
export function resetRedirect(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}/reset-password`;
  return 'ako://reset-password';
}

export function confirmRedirect(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}/sign-in`;
  return 'ako://sign-in';
}
