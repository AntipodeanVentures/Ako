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
    <Screen scroll width="narrow">
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.xxl }}>
        <View style={{ alignItems: 'center', gap: spacing.lg }}>
          <Logo size={40} />
          <Text variant="title" center>
            Welcome back
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
            returnKeyType="next"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            placeholder="Your password"
            returnKeyType="go"
            onSubmitEditing={onSubmit}
          />
          {error ? (
            <Text variant="caption" color="danger" center>
              {error}
            </Text>
          ) : null}
          <Button label="Sign in" onPress={onSubmit} loading={submitting} />
          <Link href="/forgot-password" style={{ alignSelf: 'center' }}>
            <Text variant="caption" color="textMuted">
              Forgotten your password?
            </Text>
          </Link>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.xs }}>
          <Text variant="body" color="textMuted">
            New here?
          </Text>
          <Link href="/sign-up">
            <Text variant="bodyStrong">Create an account</Text>
          </Link>
        </View>
      </View>
    </Screen>
  );
}
