import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Ladder, Screen, Segmented, Skeleton, Text, TextField } from '@/src/components/ui';
import { STAGES } from '@/src/engine/ladder';
import { dueCards, nextTopic, sittingMinutes } from '@/src/engine/progress';
import type { StageId, Topic } from '@/src/engine/types';
import { useProfile } from '@/src/features/profile';
import { useDeleteSubject, useLiveSubjects, useUpdateSubject, type LiveSubject } from '@/src/features/subjects';
import { aimLine, isArchived, subjectEvidence, subjectLine } from '@/src/features/subjects/summary';
import { useTheme } from '@/src/theme';

// A subject's own page: where it stands and the evidence for that, what it
// is for (the goal and the brief the plan was written from), the things to
// do next, and its settings. The Path tab is the plan; this is the subject.
export default function SubjectRoute() {
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const { profile } = useProfile();
  const { subjects, loading } = useLiveSubjects(profile);
  const router = useRouter();
  const subj = subjects.find((s) => s.id === subjectId);
  if (!subj) {
    return (
      <Screen scroll>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} style={{ alignSelf: 'flex-start', padding: 4 }}>
          <Ionicons name="arrow-back" size={22} />
        </Pressable>
        {loading ? (
          <View style={{ gap: 12, marginTop: 24 }}>
            <Skeleton height={30} width="60%" />
            <Skeleton height={8} />
            <Skeleton height={20} width="80%" />
          </View>
        ) : (
          <NotFound onBack={() => (router.canGoBack() ? router.back() : router.replace('/map'))} />
        )}
      </Screen>
    );
  }
  return <SubjectScreen subj={subj} />;
}

function NotFound({ onBack }: { onBack: () => void }) {
  const { spacing } = useTheme();
  return (
    <View style={{ marginTop: spacing.xxl, gap: spacing.md }}>
      <Text variant="heading">This subject is no longer here</Text>
      <Text variant="body" color="textMuted">
        It may have been deleted on another device.
      </Text>
      <Button label="Back to the map" onPress={onBack} fullWidth={false} variant="secondary" />
    </View>
  );
}

const AIMS = STAGES.slice(1).map((s) => ({ value: s.id as StageId, label: s.name }));
const SLOTS = [5, 15, 30, 45] as const;

export function SubjectScreen({ subj }: { subj: LiveSubject }) {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const update = useUpdateSubject();
  const remove = useDeleteSubject();
  const line = subjectLine(subj);
  const aim = aimLine(subj);
  const ev = subjectEvidence(subj);
  const due = dueCards(subj.cards ?? []).length;
  const next = nextTopic(subj) as Topic | null;
  const started = line.reached >= 0 || line.progress > 0;
  const archived = isArchived(subj);
  const goal = String(subj.intake.why || '');
  const brief = String(subj.intake.context || '');
  const cur = STAGES[line.current];
  const def = subj.plan.stages.find((s) => s.id === cur.id);

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(line.title);
  const [goalText, setGoalText] = useState(goal);
  const [briefText, setBriefText] = useState(brief);
  const [target, setTarget] = useState<StageId>(String(subj.intake.target || 's3') as StageId);
  const [minutes, setMinutes] = useState<number>(Number(subj.intake.minutes) || 15);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveSettings = async () => {
    setError(null);
    try {
      const name = title.trim() || subj.plan.title;
      // The plan's own title is what every screen shows, so it moves with the row's.
      await update.mutateAsync({
        id: subj.id,
        title: name,
        plan: { ...subj.plan, title: name },
        intake: { ...subj.intake, why: goalText.trim(), context: briefText.trim(), target, minutes, hours: Math.max(1, Math.round((minutes * 6) / 60)) },
      });
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Check your connection and try again.');
    }
  };

  const setArchived = async (on: boolean) => {
    setError(null);
    try {
      await update.mutateAsync({ id: subj.id, stats: { ...subj.stats, archived: on } });
      if (on) router.replace('/map');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Check your connection and try again.');
    }
  };

  const deleteForGood = async () => {
    setError(null);
    try {
      await remove.mutateAsync(subj.id);
      router.replace('/map');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete. Check your connection and try again.');
    }
  };

  return (
    <Screen scroll>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/map'))} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        {!editing ? (
          <Pressable onPress={() => setEditing(true)} accessibilityRole="button" hitSlop={8} style={{ padding: 4 }}>
            <Text variant="caption" color="textMuted">
              Settings
            </Text>
          </Pressable>
        ) : null}
      </View>

      {editing ? (
        <View style={{ marginTop: spacing.xl, gap: spacing.xl }}>
          <Text variant="title">Settings</Text>
          <TextField label="Name" value={title} onChangeText={setTitle} />
          <TextField label="What it is for" value={goalText} onChangeText={setGoalText} multiline style={{ minHeight: 64, textAlignVertical: 'top' }} placeholder="The use this subject serves" />
          <View style={{ gap: spacing.xs }}>
            <TextField
              label="Brief for the tutor"
              value={briefText}
              onChangeText={setBriefText}
              multiline
              maxLength={2000}
              style={{ minHeight: 120, textAlignVertical: 'top' }}
              placeholder="The project or situation it is for, the numbers you work to, how you want to be taught."
            />
            <Text variant="caption" color="textMuted">
              Every lesson and example is pitched to this. Changes apply to lessons from now on; the topics already planned stay as they are.
            </Text>
          </View>
          <View style={{ gap: spacing.sm }}>
            <Text variant="bodyStrong">Aim for</Text>
            <Segmented options={AIMS} value={target} onChange={setTarget} wrap />
            <Text variant="caption" color="textMuted">
              Moving the aim changes the expected dates. The levels above your old aim are planned when you reach them.
            </Text>
          </View>
          <View style={{ gap: spacing.sm }}>
            <Text variant="bodyStrong">Time on most days</Text>
            <Segmented options={SLOTS.map((m) => ({ value: String(m), label: `${m} min` }))} value={String(minutes)} onChange={(v) => setMinutes(Number(v))} />
          </View>
          {error ? (
            <Text variant="caption" color="danger">
              {error}
            </Text>
          ) : null}
          <Button label="Save" onPress={saveSettings} loading={update.isPending} />
          <Pressable onPress={() => { setEditing(false); setTitle(line.title); setGoalText(goal); setBriefText(brief); }} style={{ alignSelf: 'center', padding: spacing.sm }}>
            <Text variant="caption" color="textMuted">
              Cancel
            </Text>
          </Pressable>

          <View style={{ marginTop: spacing.xl, paddingTop: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.md }}>
            {!archived ? (
              <>
                <Button label="Put this subject away" variant="secondary" onPress={() => setArchived(true)} loading={update.isPending} />
                <Text variant="caption" color="textMuted">
                  It leaves the Learn screen and its reviews stop. Everything is kept; bring it back from the You tab.
                </Text>
              </>
            ) : (
              <Button label="Bring this subject back" variant="secondary" onPress={() => setArchived(false)} loading={update.isPending} />
            )}
            {!confirmDelete ? (
              <Pressable onPress={() => setConfirmDelete(true)} style={{ alignSelf: 'center', padding: spacing.sm }}>
                <Text variant="caption" color="textMuted">
                  Delete this subject
                </Text>
              </Pressable>
            ) : (
              <View style={{ gap: spacing.sm, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md }}>
                <Text variant="bodyStrong">Delete {line.title}?</Text>
                <Text variant="body" color="textMuted">
                  Its plan, progress and {subj.cards?.length ?? 0} cards go at once. There is no undo.
                </Text>
                <Button label="Delete" variant="danger" onPress={deleteForGood} loading={remove.isPending} />
                <Pressable onPress={() => setConfirmDelete(false)} style={{ alignSelf: 'center', padding: spacing.sm }}>
                  <Text variant="caption" color="textMuted">
                    Keep it
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      ) : (
        <>
          <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
            {archived ? (
              <Text variant="eyebrow" color="textMuted">
                Put away
              </Text>
            ) : null}
            <Text variant="title">{line.title}</Text>
            {goal ? <Text variant="body">{goal}</Text> : null}
          </View>

          <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
            <Ladder reached={line.reached} current={line.current} progress={line.progress} labels height={8} />
            <Text variant="heading" color={started ? 'accent' : 'text'} style={{ marginTop: spacing.sm }}>
              {line.position}
            </Text>
            {def?.means ? (
              <Text variant="body" color="textMuted">
                {def.means}
              </Text>
            ) : null}
            {aim ? (
              <Text variant="caption" color="textMuted">
                Aiming for {aim.name}, {aim.when}.
              </Text>
            ) : null}
          </View>

          {!archived ? (
            <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
              {due > 0 ? (
                <Button label={`Review ${due} ${due === 1 ? 'card' : 'cards'}`} onPress={() => router.push('/review')} />
              ) : null}
              {next ? (
                <View style={{ gap: spacing.xs }}>
                  <Button
                    label={due > 0 ? 'Then the next topic' : 'Start the next topic'}
                    variant={due > 0 ? 'secondary' : 'primary'}
                    onPress={() => router.push({ pathname: '/session/[subjectId]', params: { subjectId: subj.id, topicId: next.id } })}
                  />
                  <Text variant="caption" color="textMuted" center>
                    {next.title} · about {sittingMinutes(subj, next) as number} min
                  </Text>
                </View>
              ) : null}
              <Button label="See the whole path" variant="secondary" onPress={() => router.push({ pathname: '/path', params: { subjectId: subj.id } })} />
            </View>
          ) : (
            <View style={{ marginTop: spacing.xl }}>
              <Button label="Bring this subject back" onPress={() => setArchived(false)} loading={update.isPending} />
            </View>
          )}

          <View style={{ marginTop: spacing.xxl, paddingTop: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm }}>
            <Text variant="eyebrow" color="textMuted">
              Evidence
            </Text>
            <Stat label="Topics learned" value={`${ev.learned} of ${ev.total}`} />
            <Stat label="Held up over days" value={ev.learned ? `${ev.secure} of ${ev.learned}` : 'none yet'} hint="A topic counts as secure after it has been recalled on three separate days." />
            <Stat label="Reviews recalled" value={ev.recall == null ? 'not enough reviews yet' : `${Math.round(ev.recall * 100)}%`} hint="Over the last four weeks, once there are ten." />
            <Stat
              label="Your own predictions"
              value={ev.calibration == null ? 'not enough yet' : Math.abs(ev.calibration) < 0.1 ? 'about right' : ev.calibration > 0 ? 'running high' : 'running low'}
              hint="How your guess at what you would remember compares with what you did."
            />
          </View>

          {brief ? (
            <View style={{ marginTop: spacing.xxl, paddingTop: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm }}>
              <Text variant="eyebrow" color="textMuted">
                Brief for the tutor
              </Text>
              <Text variant="body" color="textMuted">
                {brief}
              </Text>
            </View>
          ) : null}

          {error ? (
            <Text variant="caption" color="danger" style={{ marginTop: spacing.lg }}>
              {error}
            </Text>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const { spacing, colors } = useTheme();
  return (
    <View style={{ paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, gap: 2 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
        <Text variant="body" color="textMuted">
          {label}
        </Text>
        <Text variant="bodyStrong" style={{ flexShrink: 1, textAlign: 'right' }}>
          {value}
        </Text>
      </View>
      {hint ? (
        <Text variant="caption" color="textMuted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
