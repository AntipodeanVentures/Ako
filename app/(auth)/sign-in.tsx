import { Link } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Logo, Screen, Text, TextField } from '@/src/components/ui';
import { useAuth } from '@/src/features/auth';
import { useTheme } from '@/src/theme';

export default function SignInScreen() {
  const { spacing } = useTheme();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    try {
      await signIn({ email: email.trim(), password });
      // The route guard redirects once the session is established.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in.');
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll>
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.xl }}>
        <View style={{ alignItems: 'center' }}>
          <Logo size={48} showWordmark />
        </View>

        <View style={{ gap: spacing.xs }}>
          <Text variant="title">Welcome back</Text>
          <Text variant="body" color="textMuted">
            Sign in to continue with Ako.
          </Text>
        </View>

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
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            placeholder="Your password"
          />
          {error ? (
            <Text variant="caption" color="danger">
              {error}
            </Text>
          ) : null}
          <Button label="Sign in" onPress={onSubmit} loading={submitting} />
        </View>

        <Link href="/sign-up" style={{ alignSelf: 'center' }}>
          <Text variant="bodyStrong" color="primary">
            Create an account
          </Text>
        </Link>
      </View>
    </Screen>
  );
}
