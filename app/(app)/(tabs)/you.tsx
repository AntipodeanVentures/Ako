import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Screen, Segmented, SwitchRow, Text, TextField } from '@/src/components/ui';
import { aiErrorCopy } from '@/src/features/ai/client';
import { useAuth } from '@/src/features/auth';
import {
  deleteAllMyData,
  updateProfile,
  useDeleteKnowItem,
  useKnowItems,
  useProfile,
  useSaveKnowItems,
} from '@/src/features/profile';
import { KIND_LABELS, proposeItems, recomputeAbout, toRows, type ProposedItem } from '@/src/features/profile/know';
import { VERSION, sendReport } from '@/src/features/reporting';
import { useInvalidateSubject, useLiveSubjects, useSubjects, useUpdateSubject } from '@/src/features/subjects';
import { assignSchemas } from '@/src/features/subjects/schema';
import { isArchived, liveSubjects } from '@/src/features/subjects/summary';
import { KnowledgeMap } from '@/src/components/KnowledgeMap';
import { openLegal } from '@/src/lib/legal';
import { useTheme, type ThemePreference } from '@/src/theme';
import type { KnowItemRow } from '@/src/types/database';

// How much of what you learn the reviews are timed to keep. Higher means
// more reviews, closer together.
const TARGETS: { value: string; label: string; hint: string }[] = [
  { value: '0.85', label: '85%', hint: 'Fewer reviews. Some slips, caught at the next one.' },
  { value: '0.9', label: '90%', hint: 'The usual setting: a review when a card is about to slip.' },
  { value: '0.95', label: '95%', hint: 'More reviews, closer together. For something you need cold.' },
];

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

// You: what you already know (which every lesson builds on), your account
// and its settings, subjects put away, and sign out.
export default function YouScreen() {
  const { spacing, colors, radius, preference, setPreference } = useTheme();
  const { signOut, session } = useAuth();
  const { profile, refresh } = useProfile();
  const items = useKnowItems();
  const save = useSaveKnowItems(profile?.id);
  const remove = useDeleteKnowItem();
  const subjects = useSubjects();
  const updateSubject = useUpdateSubject();
  const archived = (subjects.data ?? []).filter(isArchived);
  const live = useLiveSubjects(profile);
  // Memoised: the map re-settles its layout whenever this array changes.
  const mapped = useMemo(() => liveSubjects(live.subjects), [live.subjects]);
  const invalidate = useInvalidateSubject();
  const knowItems = useMemo(() => items.data ?? [], [items.data]);
  // Topics written before the map existed are placed under their fields once, then the plans reload.
  const place = useCallback(async () => { await assignSchemas(mapped); invalidate(); }, [mapped, invalidate]);

  const [material, setMaterial] = useState('');
  const [proposed, setProposed] = useState<{ summary: string; items: ProposedItem[] } | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [problem, setProblem] = useState('');
  const [problemState, setProblemState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [name, setName] = useState(profile?.display_name ?? '');
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savingTarget, setSavingTarget] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  useEffect(() => {
    if (!editingName) setName(profile?.display_name ?? '');
  }, [profile?.display_name, editingName]);

  const sendProblem = async () => {
    if (!problem.trim()) return;
    setProblemState('sending');
    try {
      await sendReport('problem', problem.trim());
      setProblem('');
      setProblemState('sent');
    } catch {
      setProblemState('failed');
    }
  };

  const saveName = async () => {
    if (!profile) return;
    setSavingName(true);
    setSettingsError(null);
    try {
      await updateProfile(profile.id, { display_name: name.trim() });
      await refresh();
      setEditingName(false);
    } catch {
      setSettingsError('Could not save your name. Check your connection and try again.');
    } finally {
      setSavingName(false);
    }
  };

  const setTarget = async (v: string) => {
    if (!profile) return;
    setSavingTarget(true);
    setSettingsError(null);
    try {
      await updateProfile(profile.id, { retention: Number(v) });
      await refresh();
    } catch {
      setSettingsError('Could not save the review target. Check your connection and try again.');
    } finally {
      setSavingTarget(false);
    }
  };

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
      // Pasting the same CV twice should not list every job twice.
      const have = new Set((items.data ?? []).map((r) => r.title.trim().toLowerCase()));
      const rows = toRows(proposed.items, material.length > 600 ? 'cv' : 'typed').filter((r) => !have.has(r.title.trim().toLowerCase()));
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

  const target = String(Number(profile?.retention ?? 0.9));
  const targetValue = TARGETS.some((t) => t.value === target) ? target : '0.9';

  return (
    <Screen scroll>
      <Text variant="title">You</Text>

      {mapped.length ? (
        <View style={{ marginTop: spacing.xxl, gap: spacing.sm }}>
          <Text variant="eyebrow" color="textMuted">
            What you know
          </Text>
          <Text variant="body" color="textMuted">
            Every subject and topic, hanging off what you brought with you. It fades where memory is fading and brightens after a review.
          </Text>
          <View style={{ marginTop: spacing.xs }}>
            <KnowledgeMap subjects={mapped} know={knowItems} retention={Number(profile?.retention ?? 0.9)} onPlace={place} />
          </View>
        </View>
      ) : null}

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

      <View style={{ marginTop: spacing.xxxl, gap: spacing.lg }}>
        <Text variant="eyebrow" color="textMuted">
          Settings
        </Text>

        <View style={{ gap: spacing.sm }}>
          {editingName ? (
            <View style={{ gap: spacing.sm }}>
              <TextField label="Name" value={name} onChangeText={setName} autoFocus maxLength={60} />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Button label="Save" onPress={saveName} loading={savingName} disabled={!name.trim()} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label="Cancel" variant="ghost" onPress={() => setEditingName(false)} />
                </View>
              </View>
            </View>
          ) : (
            <Row label="Name" value={profile?.display_name || 'Add your name'} onPress={() => setEditingName(true)} />
          )}
          <Row label="Email" value={session?.user.email || ''} last />
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text variant="bodyStrong">Review target</Text>
          <Text variant="caption" color="textMuted">
            How much of what you learn the reviews are timed to keep. A review is due when a card is about to drop below it.
          </Text>
          <Segmented options={TARGETS} value={savingTarget ? null : targetValue} onChange={(v) => void setTarget(v)} />
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text variant="bodyStrong">Appearance</Text>
          <Segmented options={THEMES} value={preference} onChange={setPreference} />
        </View>

        <SwitchRow
          label="Daily reminder email"
          description="At 7 in the morning, UK time, on days you have not yet studied: how many reviews are due and the next idea. Nothing on days you have already been in."
          value={Boolean(profile?.reminder_time)}
          onChange={async (on) => {
            if (!profile) return;
            await updateProfile(profile.id, { reminder_time: on ? '07:00' : null });
            await refresh();
          }}
        />
        {settingsError ? (
          <Text variant="caption" color="danger">
            {settingsError}
          </Text>
        ) : null}
      </View>

      {archived.length ? (
        <View style={{ marginTop: spacing.xxxl, gap: spacing.sm }}>
          <Text variant="eyebrow" color="textMuted">
            Put away
          </Text>
          <Text variant="caption" color="textMuted">
            Subjects you have set aside. Their progress is kept; bring one back and it picks up where it was.
          </Text>
          <View style={{ marginTop: spacing.xs }}>
            {archived.map((s) => (
              <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text variant="body" style={{ flex: 1 }} numberOfLines={2}>
                  {s.plan?.title || s.title}
                </Text>
                <Pressable
                  onPress={() => updateSubject.mutate({ id: s.id, stats: { ...(s.stats ?? {}), archived: false } })}
                  disabled={updateSubject.isPending}
                  accessibilityRole="button"
                  hitSlop={8}
                >
                  <Text variant="bodyStrong" color="primary">
                    Bring back
                  </Text>
                </Pressable>
              </View>
            ))}
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border }} />
          </View>
        </View>
      ) : null}

      <View style={{ marginTop: spacing.xxxl, gap: spacing.md }}>
        <View style={{ gap: spacing.xs }}>
          <Text variant="eyebrow" color="textMuted">
            Report a problem
          </Text>
          <Text variant="body" color="textMuted">
            Something wrong, confusing or slow? Say what happened and where. The report carries which screen you were on and the build, so a line is enough.
          </Text>
        </View>
        <TextField
          label="What happened"
          value={problem}
          onChangeText={(v) => { setProblem(v); if (problemState !== 'idle') setProblemState('idle'); }}
          placeholder="The lesson ended before the questions. The Start button did nothing."
          multiline
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />
        <Button label="Send" variant="secondary" onPress={sendProblem} loading={problemState === 'sending'} disabled={!problem.trim()} />
        {problemState === 'sent' ? (
          <Text variant="caption" color="accent">
            Sent. Thank you.
          </Text>
        ) : problemState === 'failed' ? (
          <Text variant="caption" color="danger">
            It did not send. Check your connection and try again.
          </Text>
        ) : null}
      </View>

      <View style={{ marginTop: spacing.xxxl, gap: spacing.md }}>
        <Button label="Sign out" variant="secondary" onPress={signOut} />
        {!confirmDelete ? (
          <Pressable onPress={() => setConfirmDelete(true)} style={{ alignSelf: 'center', padding: spacing.sm }}>
            <Text variant="caption" color="textMuted">
              Delete my data
            </Text>
          </Pressable>
        ) : (
          <View style={{ gap: spacing.sm, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md }}>
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
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.lg, marginTop: spacing.md }}>
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
          <Text variant="caption" color="textMuted">
            Version {VERSION}
          </Text>
        </View>
      </View>
    </Screen>
  );
}

function Row({ label, value, last, onPress }: { label: string; value: string; last?: boolean; onPress?: () => void }) {
  const { spacing, colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => ({
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderTopWidth: 1,
        borderBottomWidth: last ? 1 : 0,
        borderColor: colors.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text variant="body" color="textMuted">
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 }}>
        <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
          {value}
        </Text>
        {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
      </View>
    </Pressable>
  );
}
