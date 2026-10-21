import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Screen, Text, TextField } from '@/src/components/ui';
import { aiErrorCopy } from '@/src/features/ai/client';
import { useAuth } from '@/src/features/auth';
import {
  deleteAllMyData,
  useDeleteKnowItem,
  useKnowItems,
  useProfile,
  useSaveKnowItems,
} from '@/src/features/profile';
import { openLegal } from '@/src/lib/legal';
import { KIND_LABELS, proposeItems, recomputeAbout, toRows, type ProposedItem } from '@/src/features/profile/know';
import { useTheme } from '@/src/theme';
import type { KnowItemRow } from '@/src/types/database';

// You: what you already know (which every lesson builds on), your account,
// and sign out. Reminders and read-aloud arrive with the phone builds.
export default function YouScreen() {
  const { spacing, colors } = useTheme();
  const { signOut, session } = useAuth();
  const { profile, refresh } = useProfile();
  const items = useKnowItems();
  const save = useSaveKnowItems(profile?.id);
  const remove = useDeleteKnowItem();

  const [material, setMaterial] = useState('');
  const [proposed, setProposed] = useState<{ summary: string; items: ProposedItem[] } | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const deleteEverything = async () => {
    if (!profile) return;
    setDeleting(true);
    try {
      await deleteAllMyData(profile.id);
    } finally {
      await signOut();
    }
  };

  const read = async () => {
    if (!material.trim()) return;
    setReading(true);
    setError(null);
    try {
      setProposed(await proposeItems(material.trim()));
    } catch (e) {
      setError(aiErrorCopy(e));
    } finally {
      setReading(false);
    }
  };

  const confirm = async () => {
    if (!proposed || !profile) return;
    setError(null);
    try {
      const rows = toRows(proposed.items, material.length > 600 ? 'cv' : 'typed');
      await save.mutateAsync(rows);
      const after = [...(items.data ?? []), ...rows.map((r, i) => ({ ...r, id: `new-${i}`, profile_id: profile.id, confirmed_at: '', created_at: '' }))] as KnowItemRow[];
      await recomputeAbout(profile, after, proposed.summary);
      await refresh();
      setProposed(null);
      setMaterial('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  };

  const drop = async (row: KnowItemRow) => {
    if (!profile) return;
    await remove.mutateAsync(row.id);
    await recomputeAbout(profile, (items.data ?? []).filter((r) => r.id !== row.id));
    await refresh();
  };

  const grouped = Object.keys(KIND_LABELS)
    .map((kind) => ({ kind, label: KIND_LABELS[kind], rows: (items.data ?? []).filter((r) => r.kind === kind) }))
    .filter((g) => g.rows.length);

  return (
    <Screen scroll>
      <Text variant="title">You</Text>

      <View style={{ marginTop: spacing.xxl, gap: spacing.sm }}>
        <Text variant="eyebrow" color="textMuted">
          What you already know
        </Text>
        <Text variant="body" color="textMuted">
          Lessons draw comparisons from this and skip what you can do. Paste your CV or LinkedIn About, or type a few lines: jobs, qualifications, languages, sports, serious hobbies.
        </Text>
      </View>

      {grouped.length ? (
        <View style={{ marginTop: spacing.lg }}>
          {grouped.map((g) => (
            <View key={g.kind} style={{ paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.xs }}>
              <Text variant="caption" color="textMuted">
                {g.label}
              </Text>
              {g.rows.map((r) => (
                <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text variant="body" style={{ flex: 1 }}>
                    {r.title}
                    {r.detail ? (
                      <Text variant="body" color="textMuted">
                        {' '}
                        ({r.detail})
                      </Text>
                    ) : null}
                  </Text>
                  <Pressable onPress={() => drop(r)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${r.title}`}>
                    <Ionicons name="close" size={16} color={colors.textMuted} />
                  </Pressable>
                </View>
              ))}
            </View>
          ))}
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border }} />
        </View>
      ) : null}

      {!proposed ? (
        <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
          <TextField
            label={grouped.length ? 'Add more' : 'Start here'}
            value={material}
            onChangeText={setMaterial}
            placeholder="Airline captain, 12 years. Brown belt in judo. Conversational French."
            multiline
            style={{ minHeight: 96, textAlignVertical: 'top' }}
          />
          <Button label="Read it" onPress={read} loading={reading} disabled={!material.trim()} variant={grouped.length ? 'secondary' : 'primary'} />
          {error ? (
            <Text variant="caption" color="danger">
              {error}
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
          <Text variant="bodyStrong">Keep what is right. Nothing is saved until you confirm.</Text>
          {proposed.summary ? (
            <Text variant="body" color="textMuted">
              {proposed.summary}
            </Text>
          ) : null}
          <View>
            {proposed.items.map((it) => (
              <Pressable
                key={it.id}
                onPress={() => setProposed({ ...proposed, items: proposed.items.map((x) => (x.id === it.id ? { ...x, keep: !x.keep } : x)) })}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: it.keep }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}
              >
                <Ionicons name={it.keep ? 'checkbox' : 'square-outline'} size={20} color={it.keep ? colors.text : colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text variant="body" color={it.keep ? 'text' : 'textMuted'}>
                    {it.text}
                    {it.level ? ` (${it.level})` : ''}
                  </Text>
                  <Text variant="caption" color="textMuted">
                    {KIND_LABELS[it.kind]}
                  </Text>
                </View>
              </Pressable>
            ))}
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border }} />
          </View>
          <Button label={`Save ${proposed.items.filter((i) => i.keep).length} items`} onPress={confirm} loading={save.isPending} disabled={!proposed.items.some((i) => i.keep)} />
          <Pressable onPress={() => setProposed(null)} style={{ alignSelf: 'center', padding: spacing.sm }}>
            <Text variant="caption" color="textMuted">
              Cancel
            </Text>
          </Pressable>
          {error ? (
            <Text variant="caption" color="danger">
              {error}
            </Text>
          ) : null}
        </View>
      )}

      <View style={{ marginTop: spacing.xxxl }}>
        <Text variant="eyebrow" color="textMuted" style={{ marginBottom: spacing.sm }}>
          Account
        </Text>
        <Row label="Name" value={profile?.display_name || ''} />
        <Row label="Email" value={session?.user.email || ''} />
        <Row label="Review target" value={`${Math.round(Number(profile?.retention ?? 0.9) * 100)}% recall`} last />
      </View>

      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <Button label="Sign out" variant="secondary" onPress={signOut} />
        {!confirmDelete ? (
          <Pressable onPress={() => setConfirmDelete(true)} style={{ alignSelf: 'center', padding: spacing.sm }}>
            <Text variant="caption" color="textMuted">
              Delete my data
            </Text>
          </Pressable>
        ) : (
          <View style={{ gap: spacing.sm, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: 12 }}>
            <Text variant="bodyStrong">Delete everything?</Text>
            <Text variant="body" color="textMuted">
              Your subjects, progress, cards and profile go at once. There is no undo.
            </Text>
            <Button label="Delete everything" variant="danger" onPress={deleteEverything} loading={deleting} />
            <Pressable onPress={() => setConfirmDelete(false)} style={{ alignSelf: 'center', padding: spacing.sm }}>
              <Text variant="caption" color="textMuted">
                Keep it
              </Text>
            </Pressable>
          </View>
        )}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, marginTop: spacing.md }}>
          <Pressable onPress={() => openLegal('privacy')}>
            <Text variant="caption" color="textMuted">
              Privacy
            </Text>
          </Pressable>
          <Pressable onPress={() => openLegal('terms')}>
            <Text variant="caption" color="textMuted">
              Terms
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { spacing, colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderTopWidth: 1,
        borderBottomWidth: last ? 1 : 0,
        borderColor: colors.border,
      }}
    >
      <Text variant="body" color="textMuted">
        {label}
      </Text>
      <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
        {value}
      </Text>
    </View>
  );
}
