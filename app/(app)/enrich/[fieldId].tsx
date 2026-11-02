import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Button, Chips, Missing, Screen, Segmented, Text, TextField } from '@/src/components/ui';
import { STAGES, stageName } from '@/src/engine/ladder';
import type { StageId } from '@/src/engine/types';
import { aiErrorCopy, callJson } from '@/src/features/ai/client';
import { useKnowItems, usePriorFields, useProfile, useSavePriorFields, useUpdatePriorField } from '@/src/features/profile';
import { fieldName, recomputeAbout } from '@/src/features/profile/know';
import { useTheme } from '@/src/theme';
import type { PriorFieldRow } from '@/src/types/database';

// Adding detail to a field the learner brought with them: two or three questions in the terms
// the discipline uses (its parts, their standing, other disciplines of the same domain), then
// what the answers add to the map, to confirm: areas with a level each, sibling disciplines,
// and a better line on the field itself. Each area is then something Verify can check on its own.

type Question = { slot: 'parts' | 'standing' | 'siblings'; q: string; options: string[]; multi: boolean };
type Enriched = { areas: { area: string; level: StageId; basis: string }[]; siblings: { discipline: string; level: StageId; basis: string }[]; basis: string; level: StageId | '' };
type Proposed = { areas: (Enriched['areas'][number] & { keep: boolean })[]; siblings: (Enriched['siblings'][number] & { keep: boolean })[]; basis: string; level: StageId };
const OTHER = 'Something else';

export default function EnrichRoute() {
  const { fieldId } = useLocalSearchParams<{ fieldId: string }>();
  const fields = usePriorFields();
  const field = (fields.data ?? []).find((f) => f.id === fieldId);
  if (!field) return <Missing loading={fields.isLoading} title="This field is no longer on your map" body="It may have been removed on another device." />;
  return <EnrichScreen field={field} />;
}

function EnrichScreen({ field }: { field: PriorFieldRow }) {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { profile, refresh } = useProfile();
  const items = useKnowItems();
  const fields = usePriorFields();
  const save = useSavePriorFields(profile?.id);
  const update = useUpdatePriorField();
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [picked, setPicked] = useState<string[][]>([]);
  const [typed, setTyped] = useState<string[]>([]);
  const [proposed, setProposed] = useState<Proposed | null>(null);
  const [busy, setBusy] = useState<string | null>('Thinking about what to ask');
  const [error, setError] = useState<string | null>(null);
  const name = fieldName(field);
  const body = { domain: field.domain, field: field.field, area: field.area, level: field.level, basis: field.basis };

  useEffect(() => {
    (async () => {
      try {
        const r = await callJson<{ enrich: { questions: Question[] } }>('extract', { kind: 'enrich', field: body });
        setQuestions(r.enrich.questions);
        setPicked(r.enrich.questions.map(() => []));
        setTyped(r.enrich.questions.map(() => ''));
        setBusy(null);
      } catch (e) {
        setBusy(null);
        setError(aiErrorCopy(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const answerOf = (i: number) => [...picked[i].filter((p) => p !== OTHER), typed[i].trim()].filter(Boolean).join(', ');
  const answered = questions ? questions.some((_, i) => answerOf(i)) : false;

  const apply = async () => {
    if (!questions) return;
    setBusy('Working out what this adds');
    setError(null);
    try {
      const answers = questions.map((q, i) => ({ q: q.q, a: answerOf(i) })).filter((a) => a.a);
      const r = await callJson<{ enriched: Enriched }>('extract', { kind: 'enrich_apply', field: body, answers });
      const e = r.enriched;
      setProposed({ areas: e.areas.map((a) => ({ ...a, keep: true })), siblings: e.siblings.map((s) => ({ ...s, keep: true })), basis: e.basis || field.basis, level: (e.level || field.level) as StageId });
      setBusy(null);
    } catch (err) {
      setBusy(null);
      setError(aiErrorCopy(err));
    }
  };

  const confirm = async () => {
    if (!proposed || !profile) return;
    setBusy('Saving');
    setError(null);
    try {
      const existing = fields.data ?? [];
      const rows = [
        ...proposed.areas.filter((a) => a.keep).map((a) => ({ domain: field.domain, field: field.field, area: a.area, level: a.level, basis: a.basis, source: 'typed' as const })),
        ...proposed.siblings.filter((s) => s.keep).map((s) => ({ domain: field.domain, field: s.discipline, area: '', level: s.level, basis: s.basis, source: 'typed' as const })),
      ];
      if (rows.length) await save.mutateAsync({ fields: rows, existing });
      // The field itself keeps what it learned: a fuller basis line and, where the standing says so, its level.
      const own: { basis?: string; level?: StageId } = {};
      if (proposed.basis && proposed.basis !== field.basis) own.basis = proposed.basis;
      if (proposed.level !== field.level && !field.verified_level) own.level = proposed.level;
      if (Object.keys(own).length) await update.mutateAsync({ id: field.id, ...own });
      const after = [
        ...existing.map((f) => (f.id === field.id ? { ...f, ...own } : f)),
        ...rows.map((r, i) => ({ ...r, id: `new-${i}`, profile_id: profile.id, verified_level: null, verified_at: null, verified: null, evidence: { ok: 0, n: 0 }, created_at: '', updated_at: '' })),
      ] as PriorFieldRow[];
      await recomputeAbout(profile, items.data ?? [], undefined, after);
      await refresh();
      router.canGoBack() ? router.back() : router.replace('/record');
    } catch (err) {
      setBusy(null);
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/record'));
  const levelOptions = STAGES.map((st) => ({ value: st.id as StageId, label: st.short }));

  return (
    <Screen scroll width="reading">
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="eyebrow" color="textMuted">
            Add detail
          </Text>
          <Text variant="title">{name}</Text>
          <Text variant="caption" color="textMuted">
            {stageName(field.level)}{field.basis ? ` · ${field.basis}` : ''}
          </Text>
        </View>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} style={{ padding: 4 }}>
          <Ionicons name="close" size={22} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={{ marginTop: spacing.xl, gap: spacing.xl }}>
        {error ? (
          <View style={{ gap: spacing.md }}>
            <Text variant="body" color="danger">
              {error}
            </Text>
            <Button label="Back" variant="secondary" onPress={close} />
          </View>
        ) : busy && !proposed ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <ActivityIndicator size="small" />
            <Text variant="bodyStrong">{busy}</Text>
          </View>
        ) : proposed ? (
          <>
            <Text variant="body" color="textMuted">
              What this adds to your map. Keep what is right; nothing is saved until you confirm.
            </Text>
            {proposed.areas.length ? (
              <View style={{ gap: spacing.sm }}>
                <Text variant="eyebrow" color="textMuted">
                  Parts of {field.field}
                </Text>
                {proposed.areas.map((a, i) => (
                  <View key={a.area} style={{ paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm }}>
                    <Pressable onPress={() => setProposed({ ...proposed, areas: proposed.areas.map((x, j) => (j === i ? { ...x, keep: !x.keep } : x)) })} accessibilityRole="checkbox" accessibilityState={{ checked: a.keep }} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                      <Ionicons name={a.keep ? 'checkbox' : 'square-outline'} size={20} color={a.keep ? colors.text : colors.textMuted} />
                      <View style={{ flex: 1 }}>
                        <Text variant="body" color={a.keep ? 'text' : 'textMuted'}>
                          {a.area}
                        </Text>
                        {a.basis ? (
                          <Text variant="caption" color="textMuted">
                            {a.basis}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                    {a.keep ? <Segmented options={levelOptions} value={a.level} onChange={(v) => setProposed({ ...proposed, areas: proposed.areas.map((x, j) => (j === i ? { ...x, level: v } : x)) })} /> : null}
                  </View>
                ))}
              </View>
            ) : null}
            {proposed.siblings.length ? (
              <View style={{ gap: spacing.sm }}>
                <Text variant="eyebrow" color="textMuted">
                  Also in {field.domain || 'the same domain'}
                </Text>
                {proposed.siblings.map((s, i) => (
                  <View key={s.discipline} style={{ paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm }}>
                    <Pressable onPress={() => setProposed({ ...proposed, siblings: proposed.siblings.map((x, j) => (j === i ? { ...x, keep: !x.keep } : x)) })} accessibilityRole="checkbox" accessibilityState={{ checked: s.keep }} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                      <Ionicons name={s.keep ? 'checkbox' : 'square-outline'} size={20} color={s.keep ? colors.text : colors.textMuted} />
                      <View style={{ flex: 1 }}>
                        <Text variant="body" color={s.keep ? 'text' : 'textMuted'}>
                          {s.discipline}
                        </Text>
                        {s.basis ? (
                          <Text variant="caption" color="textMuted">
                            {s.basis}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                    {s.keep ? <Segmented options={levelOptions} value={s.level} onChange={(v) => setProposed({ ...proposed, siblings: proposed.siblings.map((x, j) => (j === i ? { ...x, level: v } : x)) })} /> : null}
                  </View>
                ))}
              </View>
            ) : null}
            <View style={{ gap: spacing.sm }}>
              <Text variant="eyebrow" color="textMuted">
                {field.field} itself
              </Text>
              <Text variant="body">{proposed.basis || field.basis || 'As you described it.'}</Text>
              {field.verified_level ? (
                <Text variant="caption" color="textMuted">
                  {stageName(field.verified_level)}, shown in a check; that stands.
                </Text>
              ) : (
                <Segmented options={levelOptions} value={proposed.level} onChange={(v) => setProposed({ ...proposed, level: v })} />
              )}
            </View>
            <Button label="Save to the map" onPress={confirm} loading={busy === 'Saving'} />
            <Pressable onPress={() => setProposed(null)} style={{ alignSelf: 'center', padding: spacing.sm }}>
              <Text variant="caption" color="textMuted">
                Back to the questions
              </Text>
            </Pressable>
          </>
        ) : questions ? (
          <>
            <Text variant="body" color="textMuted">
              A few questions in the terms {field.field} uses, so the map can show its parts. Skip any you like.
            </Text>
            {questions.map((q, i) => (
              <View key={i} style={{ gap: spacing.sm }}>
                <Text variant="bodyStrong">{q.q}</Text>
                {q.options.length ? <Chips options={[...q.options, OTHER]} value={picked[i]} onChange={(v) => setPicked(picked.map((p, j) => (j === i ? v : p)))} multi={q.multi} other={OTHER} /> : null}
                {!q.options.length || picked[i].includes(OTHER) ? (
                  <TextField label="In your own words" value={typed[i]} onChangeText={(v) => setTyped(typed.map((t, j) => (j === i ? v : t)))} placeholder="A line is enough" />
                ) : null}
              </View>
            ))}
            <Button label="See what this adds" onPress={apply} disabled={!answered} loading={busy === 'Working out what this adds'} />
          </>
        ) : null}
      </View>
    </Screen>
  );
}
