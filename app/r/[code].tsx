import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, View } from 'react-native';

import { Button, Logo, Screen, Text } from '@/src/components/ui';
import { fetchPublicRecord, normaliseCode, recordFromSnapshot, RecordLookupError } from '@/src/features/record';
import { recordUrl } from '@/src/lib/site';
import { RecordView } from '@/src/screens/RecordView';
import { ThemeProvider, useTheme } from '@/src/theme';

// A record of knowledge opened by its code, with no sign-in. The code is checked against
// Ako's records as the page loads: it opens the record the learner issued, or it says plainly
// that no record has that code or that the learner withdrew it. Light, like the document it is.
export default function PublicRecordRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const key = normaliseCode(code ?? '') ?? '';
  const q = useQuery({ queryKey: ['public_record', key], queryFn: () => fetchPublicRecord(key), enabled: Boolean(key), retry: false });
  const data = q.data ? recordFromSnapshot(q.data.snapshot) : null;

  if (data && q.data) {
    return <RecordView data={{ ...data, name: q.data.name || data.name, issued: q.data.issued_at || data.issued }} status="public" code={q.data.code} url={recordUrl(q.data.code)} mode="light" />;
  }
  const err = q.error instanceof RecordLookupError ? q.error : null;
  const title = !key ? 'That is not a record code' : q.isLoading ? 'Checking the code' : err?.code === 'withdrawn' ? 'This record was withdrawn' : err?.code === 'not_found' ? 'No record has this code' : q.data && !data ? 'This record cannot be shown' : 'The record could not be read';
  const body = !key
    ? 'A record code has eight letters and numbers, like ACDE-FGHJ.'
    : q.isLoading
      ? 'One moment.'
      : err?.code === 'withdrawn'
        ? 'Its owner stopped sharing it. Ask them for a fresh link.'
        : err?.code === 'not_found'
          ? 'Check the code against the one you were given. A code that does not open a page is not a record Ako issued.'
          : 'Try again in a moment.';
  return (
    <ThemeProvider forceMode="light">
      <Notice title={title} body={body} loading={q.isLoading} onRetry={q.isLoading || !key ? undefined : () => q.refetch()} />
    </ThemeProvider>
  );
}

function Notice({ title, body, loading, onRetry }: { title: string; body: string; loading: boolean; onRetry?: () => void }) {
  const { spacing } = useTheme();
  const router = useRouter();
  return (
    <Screen scroll width="reading">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Logo size={20} />
        <Text variant="eyebrow" color="textMuted">
          Record of knowledge
        </Text>
      </View>
      <View style={{ marginTop: spacing.xxl, gap: spacing.md }}>
        {loading ? <ActivityIndicator size="small" /> : null}
        <Text variant="title">{title}</Text>
        <Text variant="body" color="textMuted">
          {body}
        </Text>
        {onRetry ? <Button label="Try again" variant="secondary" fullWidth={false} onPress={onRetry} /> : null}
        <Button label="Open Ako" variant="ghost" fullWidth={false} onPress={() => router.replace('/')} />
      </View>
    </Screen>
  );
}
