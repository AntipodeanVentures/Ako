import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, Share, View } from 'react-native';

import { Button, Text } from '@/src/components/ui';
import { usePriorFields, useProfile } from '@/src/features/profile';
import { buildRecord, useIssueRecord, useMyRecord, useRevokeRecord } from '@/src/features/record';
import { useLiveSubjects } from '@/src/features/subjects';
import { liveSubjects } from '@/src/features/subjects/summary';
import { recordUrl } from '@/src/lib/site';
import { RecordView } from '@/src/screens/RecordView';
import { useTheme } from '@/src/theme';

// The record: what you can stand behind, drawn from today's state, and the controls that
// issue it as a page under a code, bring the page up to date, or withdraw it.
export default function RecordScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const live = useLiveSubjects(profile);
  const subjects = useMemo(() => liveSubjects(live.subjects), [live.subjects]);
  const priorQ = usePriorFields();
  const prior = useMemo(() => priorQ.data ?? [], [priorQ.data]);
  const retention = Number(profile?.retention ?? 0.9);
  const name = profile?.display_name?.trim() ?? '';
  const data = useMemo(() => buildRecord({ name, subjects, prior, retention }), [name, subjects, prior, retention]);
  const mine = useMyRecord(Boolean(profile));
  const issue = useIssueRecord(profile?.id);
  const revoke = useRevokeRecord();
  const current = mine.data ?? null;
  const url = current ? recordUrl(current.code) : null;

  return (
    <RecordView
      data={data}
      status="live"
      code={current?.code ?? null}
      url={url}
      onAccount={() => router.push('/you')}
      onVerify={(fieldId) => router.push({ pathname: '/verify/[fieldId]', params: { fieldId } })}
      onDetail={(fieldId) => router.push({ pathname: '/enrich/[fieldId]', params: { fieldId } })}
      actions={
        <SharePanel
          url={url}
          issuedAt={current?.issued_at ?? null}
          needsName={!name}
          busy={issue.isPending || revoke.isPending}
          error={issue.error || revoke.error ? 'That did not go through. Check your connection and try again.' : null}
          onIssue={() => issue.mutate(data)}
          onRevoke={() => current && revoke.mutate(current.code)}
          onEditName={() => router.push('/you')}
        />
      }
    />
  );
}

type PanelProps = {
  url: string | null;
  issuedAt: string | null;
  needsName: boolean;
  busy: boolean;
  error: string | null;
  onIssue: () => void;
  onRevoke: () => void;
  onEditName: () => void;
};

function SharePanel({ url, issuedAt, needsName, busy, error, onIssue, onRevoke, onEditName }: PanelProps) {
  const { colors, spacing, radius } = useTheme();
  const [note, setNote] = useState<string | null>(null);

  // The link goes out through the phone's share sheet; on the web through the browser's, or
  // onto the clipboard when the browser has none.
  const share = async () => {
    if (!url) return;
    setNote(null);
    try {
      if (Platform.OS === 'web') {
        const nav = (globalThis as { navigator?: { share?: (d: { url: string; title?: string }) => Promise<void>; clipboard?: { writeText: (t: string) => Promise<void> } } }).navigator;
        if (nav?.share) await nav.share({ url, title: 'Record of knowledge' });
        else if (nav?.clipboard) { await nav.clipboard.writeText(url); setNote('Link copied.'); }
        else setNote('Copy the link above.');
      } else {
        await Share.share(Platform.OS === 'ios' ? { url, message: 'My record of knowledge' } : { message: url });
      }
    } catch {
      // The share sheet was dismissed, or the browser refused: the link is on the screen either way.
    }
  };

  if (needsName) {
    return (
      <View style={{ gap: spacing.sm, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md }}>
        <Text variant="bodyStrong">A record needs a name on it.</Text>
        <Text variant="caption" color="textMuted">
          Add yours in Account, then share from here.
        </Text>
        <Button label="Add your name" variant="secondary" onPress={onEditName} />
      </View>
    );
  }

  if (!url) {
    return (
      <View style={{ gap: spacing.sm }}>
        <Text variant="caption" color="textMuted">
          Sharing issues this record as a page anyone can open, under a code they can check. What you have described but not shown is listed as a claim. You can withdraw it at any time.
        </Text>
        <Button label="Share" onPress={onIssue} loading={busy} />
        {error ? (
          <Text variant="caption" color="danger">
            {error}
          </Text>
        ) : null}
      </View>
    );
  }

  const issued = issuedAt ? new Date(issuedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button label="Share the link" onPress={share} loading={busy} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Bring up to date" variant="secondary" onPress={onIssue} loading={busy} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="caption" color="textMuted">
          {note ?? `The page shows the record as it stood on ${issued}.`}
        </Text>
        <Pressable onPress={onRevoke} disabled={busy} accessibilityRole="button" hitSlop={8}>
          <Text variant="caption" color="danger">
            Stop sharing
          </Text>
        </Pressable>
      </View>
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
