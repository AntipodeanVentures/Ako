import { Link } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Logo, Screen, Text, TextField } from '@/src/components/ui';
import { useAuth } from '@/src/features/auth';
import { useTheme } from '@/src/theme';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export default function SignUpScreen() {
  const { spacing } = useTheme();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Tell us your first name.');
      return;
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setSubmitting(true);
    try {
      const { needsConfirmation } = await signUp({
        email: email.trim(),
        password,
        displayName: name.trim(),
      });
      if (needsConfirmation) {
        setConfirmationSent(true);
      }
      // Otherwise the route guard redirects once the session is set.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create your account.');
      setSubmitting(false);
    }
  };

  if (confirmationSent) {
    return (
      <Screen width="narrow">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg }}>
          <Logo size={40} />
          <Text variant="title" center>
            Check your email
          </Text>
          <Text variant="body" color="textMuted" center>
            We sent a link to {email.trim()}. Open it, then come back and sign in.
          </Text>
          <Link href="/sign-in">
            <Text variant="bodyStrong">Back to sign in</Text>
          </Link>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll width="narrow">
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.xxl }}>
        <View style={{ alignItems: 'center', gap: spacing.lg }}>
          <Logo size={40} />
          <View style={{ gap: spacing.xs }}>
            <Text variant="title" center>
              Create your account
            </Text>
            <Text variant="body" color="textMuted" center>
              A tutor that takes you from where you are to the level you want, and shows the evidence.
            </Text>
          </View>
        </View>

        <View style={{ gap: spacing.lg }}>
          <TextField
            label="First name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="givenName"
            placeholder="Alex"
            returnKeyType="next"
          />
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
            autoComplete="new-password"
            textContentType="newPassword"
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            returnKeyType="go"
            onSubmitEditing={onSubmit}
          />
          {error ? (
            <Text variant="caption" color="danger" center>
              {error}
            </Text>
          ) : null}
          <Button label="Create account" onPress={onSubmit} loading={submitting} />
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.xs }}>
          <Text variant="body" color="textMuted">
            Already have one?
          </Text>
          <Link href="/sign-in">
            <Text variant="bodyStrong">Sign in</Text>
          </Link>
        </View>
      </View>
    </Screen>
  );
}
