import { Link } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Logo, Screen, Text, TextField } from '@/src/components/ui';
import { resetRedirect } from '@/src/features/auth/redirects';
import { getSupabase } from '@/src/lib/supabase';
import { useTheme } from '@/src/theme';

export default function ForgotPasswordScreen() {
  const { spacing } = useTheme();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const send = async () => {
    setError(null);
    if (!email.trim()) {
      setError('Enter your email.');
      return;
    }
    setSubmitting(true);
    try {
      const { error: e } = await getSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: resetRedirect() });
      if (e) throw e;
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the email.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll width="narrow">
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.xxl }}>
        <View style={{ alignItems: 'center', gap: spacing.lg }}>
          <Logo size={40} />
          <View style={{ gap: spacing.xs }}>
            <Text variant="title" center>
              {sent ? 'Check your email' : 'Reset your password'}
            </Text>
            <Text variant="body" color="textMuted" center>
              {sent
                ? `We sent a link to ${email.trim()}. Open it on this device to choose a new password.`
                : 'We will email you a link to choose a new one.'}
            </Text>
          </View>
        </View>

        {!sent ? (
          <View style={{ gap: spacing.lg }}>
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              placeholder="you@example.com"
              returnKeyType="go"
              onSubmitEditing={send}
            />
            {error ? (
              <Text variant="caption" color="danger" center>
                {error}
              </Text>
            ) : null}
            <Button label="Send the link" onPress={send} loading={submitting} />
          </View>
        ) : null}

        <Link href="/sign-in" style={{ alignSelf: 'center' }}>
          <Text variant="bodyStrong">Back to sign in</Text>
        </Link>
      </View>
    </Screen>
  );
}
