import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Logo, Screen, Text, TextField } from '@/src/components/ui';
import { useAuth } from '@/src/features/auth';
import { getSupabase } from '@/src/lib/supabase';
import { useTheme } from '@/src/theme';

const MIN_PASSWORD_LENGTH = 8;

// The emailed link lands here with a code; the client exchanges it for a
// session (detectSessionInUrl on the web), and the learner chooses a new
// password. The route guard leaves this screen alone while that happens.
export default function ResetPasswordScreen() {
  const { spacing } = useTheme();
  const router = useRouter();
  const { session, loading } = useAuth();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [waited, setWaited] = useState(false);

  // Give the URL exchange a few seconds before deciding the link is bad.
  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 4000);
    return () => clearTimeout(t);
  }, []);

  const save = async () => {
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== again) {
      setError('The two passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const { error: e } = await getSupabase().auth.updateUser({ password });
      if (e) throw e;
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the new password.');
    } finally {
      setSubmitting(false);
    }
  };

  const body = done ? (
    <>
      <Text variant="title" center>
        Password changed
      </Text>
      <Button label="Continue" onPress={() => router.replace('/')} />
    </>
  ) : !session ? (
    <>
      <Text variant="title" center>
        {loading || !waited ? 'One moment' : 'This link has expired'}
      </Text>
      {waited && !loading ? (
        <>
          <Text variant="body" color="textMuted" center>
            Reset links work once and for a short time. Ask for a new one.
          </Text>
          <Button label="Send a new link" onPress={() => router.replace('/forgot-password')} />
        </>
      ) : null}
    </>
  ) : (
    <>
      <Text variant="title" center>
        Choose a new password
      </Text>
      <View style={{ gap: spacing.lg }}>
        <TextField
          label="New password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
        />
        <TextField
          label="Again"
          value={again}
          onChangeText={setAgain}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder="The same password"
          returnKeyType="go"
          onSubmitEditing={save}
        />
        {error ? (
          <Text variant="caption" color="danger" center>
            {error}
          </Text>
        ) : null}
        <Button label="Save" onPress={save} loading={submitting} />
      </View>
    </>
  );

  return (
    <Screen scroll width="narrow">
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.xxl }}>
        <View style={{ alignItems: 'center' }}>
          <Logo size={40} />
        </View>
        <View style={{ gap: spacing.lg }}>{body}</View>
      </View>
    </Screen>
  );
}
