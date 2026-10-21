import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Button, Screen, Segmented, Text, TextField } from '@/src/components/ui';
import { fmtDate } from '@/src/engine/core';
import { useProfile } from '@/src/features/profile';
import { useSession, type Confidence, type Grade } from '@/src/features/session/useSession';
import { useInvalidateSubject, useLiveSubjects, type LiveSubject } from '@/src/features/subjects';
import { useTheme } from '@/src/theme';

const CONF: { value: Confidence; label: string }[] = [
  { value: 'sure', label: 'Sure' },
  { value: 'unsure', label: 'Unsure' },
  { value: 'guess', label: 'Guessing' },
];

export default function SessionRoute() {
  const { subjectId, topicId } = useLocalSearchParams<{ subjectId: string; topicId?: string }>();
  const { profile } = useProfile();
  const { subjects, loading } = useLiveSubjects(profile);
  const subj = subjects.find((s) => s.id === subjectId);
  const [frozen] = useState<{ subj: LiveSubject | null }>({ subj: null });
  // The session mutates one subject object for its whole life; a refetch
  // must not swap it from under the engine, so the first loaded copy is kept.
  if (subj && !frozen.subj) frozen.subj = subj;
  const live = frozen.subj;

  if (!live) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {loading ? <ActivityIndicator /> : <Text color="textMuted">Subject not found.</Text>}
        </View>
      </Screen>
    );
  }
  const tid = topicId || live.plan.topics[0]?.id;
  if (!tid) return null;
  return <SessionScreen subj={live} topicId={tid} retention={Number(profile?.retention ?? 0.9)} />;
}

function SessionScreen({ subj, topicId, retention }: { subj: LiveSubject; topicId: string; retention: number }) {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const invalidate = useInvalidateSubject();
  const S = useSession(subj, topicId, retention, invalidate);
  const { s, topic, currentItem } = S;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/learn'));

  const stepLabel: Record<string, string> = {
    warm: 'Warm-up',
    learn: 'Learn',
    recall: 'Recall, from memory',
    practice: 'Practise',
    done: 'Done',
  };

  return (
    <Screen scroll width="reading">
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="eyebrow" color="textMuted">
            {subj.plan.title} · {stepLabel[s.step]}
          </Text>
          <Text variant="title">{topic.title}</Text>
        </View>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} style={{ padding: 4 }}>
          <Ionicons name="close" size={22} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={{ marginTop: spacing.xl, flex: 1 }}>
        {s.error ? (
          <Notice tone="danger" text={s.error} />
        ) : null}

        {s.step === 'warm' ? <WarmStep S={S} /> : null}
        {s.step === 'learn' && s.lesson ? <LearnStep S={S} /> : null}
        {s.step === 'recall' ? <RecallStep S={S} /> : null}
        {s.step === 'practice' ? <PracticeStep S={S} item={currentItem} /> : null}
        {s.step === 'done' ? <DoneStep S={S} onClose={() => router.replace('/learn')} /> : null}
      </View>
    </Screen>
  );
}

type SessionApi = ReturnType<typeof useSession>;

// ---------- pieces ----------

function Waiting({ label, detail }: { label: string; detail?: string }) {
  const { spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
      <ActivityIndicator size="small" />
      <View style={{ gap: 2 }}>
        <Text variant="bodyStrong">{label}</Text>
        {detail ? (
          <Text variant="caption" color="textMuted">
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Notice({ tone, text }: { tone: 'danger' | 'muted'; text: string }) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      style={{
        borderLeftWidth: 3,
        borderLeftColor: tone === 'danger' ? colors.danger : colors.border,
        paddingLeft: spacing.md,
        paddingVertical: spacing.xs,
        marginBottom: spacing.lg,
        borderRadius: radius.sm / 2,
      }}
    >
      <Text variant="body" color={tone === 'danger' ? 'danger' : 'textMuted'}>
        {text}
      </Text>
    </View>
  );
}

// Marked feedback: a coloured rule for the score, the grader's sentences beside it.
function FeedbackBlock({ grade }: { grade: Grade }) {
  const { colors, spacing } = useTheme();
  const tone = grade.score >= 1 ? colors.accent : grade.score > 0 ? colors.warning : colors.danger;
  const label = grade.score >= 1 ? 'Right' : grade.score > 0 ? 'Partly' : 'Not yet';
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
      <View style={{ width: 3, backgroundColor: tone, borderRadius: 2 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="caption" style={{ color: tone }}>
          {label}
        </Text>
        {grade.feedback ? <Text variant="body">{grade.feedback}</Text> : null}
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { spacing, colors } = useTheme();
  return (
    <View style={{ gap: spacing.sm, paddingTop: spacing.xl, marginTop: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border }}>
      <Text variant="heading">{title}</Text>
      {children}
    </View>
  );
}

function Footer({ children }: { children: ReactNode }) {
  const { spacing } = useTheme();
  return <View style={{ marginTop: spacing.xxl, gap: spacing.md }}>{children}</View>;
}

// ---------- steps ----------

function WarmStep({ S }: { S: SessionApi }) {
  const { s } = S;
  const { spacing } = useTheme();
  if (!s.warm) return <Waiting label={s.busy || 'Writing your warm-up'} />;
  const marked = Boolean(s.warmGrades);
  return (
    <View style={{ gap: spacing.xl }}>
      <Text variant="prose">{s.warm.hook}</Text>
      <Text variant="body" color="textMuted">
        Before the lesson, two questions. Guesses are welcome; a wrong first attempt helps the right answer stick.
      </Text>
      {s.warm.questions.map((q, i) => (
        <View key={i} style={{ gap: spacing.sm }}>
          <Text variant="bodyStrong">{q.q}</Text>
          {marked ? (
            <>
              <Text variant="body" color="textMuted">
                {s.warmAnswers[i] || '(left blank)'}
              </Text>
              {s.warmGrades?.[i] ? <FeedbackBlock grade={s.warmGrades[i]} /> : null}
            </>
          ) : (
            <TextField
              label=""
              value={s.warmAnswers[i]}
              onChangeText={(t) => S.setWarmAnswer(i, t)}
              placeholder="A sentence or two, in your own words"
              multiline
              style={{ minHeight: 72, textAlignVertical: 'top' }}
            />
          )}
        </View>
      ))}
      <Footer>
        {!marked ? (
          <>
            <Button label="Check my answers" onPress={S.checkWarm} loading={s.busy === 'Marking'} disabled={!s.warmAnswers.some((a) => a.trim())} />
            <Pressable onPress={S.skipWarm} style={{ alignSelf: 'center', padding: spacing.sm }}>
              <Text variant="caption" color="textMuted">
                I don&apos;t know yet, go to the lesson
              </Text>
            </Pressable>
          </>
        ) : s.lesson ? (
          <Button label="Continue to the lesson" onPress={S.toLearn} />
        ) : (
          <Waiting label="Writing your lesson" detail={s.lessonProgress.sections ? `${s.lessonProgress.sections} sections so far` : 'Starting from your answers'} />
        )}
      </Footer>
    </View>
  );
}

function LearnStep({ S }: { S: SessionApi }) {
  const { s } = S;
  const { spacing, colors } = useTheme();
  const L = s.lesson!;
  const [cmpOpen, setCmpOpen] = useState(false);
  const [gapsOpen, setGapsOpen] = useState(false);
  const cmp = L.compare;
  const worked = L.workedExample;
  return (
    <View>
      {L.bridge ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="eyebrow" color="textMuted">
            Building on what you know
          </Text>
          <Text variant="prose">{L.bridge}</Text>
        </View>
      ) : null}

      {cmp && cmp.a ? (
        <Section title="Two cases">
          <Text variant="body">{cmp.a}</Text>
          <Text variant="body">{cmp.b}</Text>
          <Text variant="bodyStrong" style={{ marginTop: spacing.sm }}>
            {cmp.question}
          </Text>
          {cmpOpen ? (
            <Text variant="body" color="textMuted">
              {cmp.answer}
            </Text>
          ) : (
            <Pressable onPress={() => setCmpOpen(true)} style={{ alignSelf: 'flex-start' }}>
              <Text variant="bodyStrong">Think, then show the principle</Text>
            </Pressable>
          )}
        </Section>
      ) : null}

      {L.sections.map((sec, i) => (
        <Section key={i} title={sec.heading}>
          {sec.paragraphs.map((p, j) => (
            <Text key={j} variant="body">
              {p}
            </Text>
          ))}
          {sec.points?.length ? (
            <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
              {sec.points.map((pt, j) => (
                <View key={j} style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Text variant="body" color="textMuted">
                    –
                  </Text>
                  <Text variant="body" style={{ flex: 1 }}>
                    {pt}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </Section>
      ))}

      {worked && worked.steps?.length ? (
        <Section title="Worked example">
          {worked.problem ? <Text variant="bodyStrong">{worked.problem}</Text> : null}
          {worked.steps.map((st, i) => {
            const hidden = worked.gaps?.includes(i) && !gapsOpen;
            return (
              <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Text variant="body" color="textMuted" style={{ width: 22 }}>
                  {i + 1}.
                </Text>
                <Text variant="body" color={hidden ? 'textMuted' : 'text'} style={{ flex: 1 }}>
                  {hidden ? 'Your turn: what is this step?' : st}
                </Text>
              </View>
            );
          })}
          {worked.gaps?.length && !gapsOpen ? (
            <Pressable onPress={() => setGapsOpen(true)} style={{ alignSelf: 'flex-start' }}>
              <Text variant="bodyStrong">Show the missing steps</Text>
            </Pressable>
          ) : null}
          {worked.answer ? (
            <Text variant="body" color="textMuted">
              {worked.answer}
            </Text>
          ) : null}
        </Section>
      ) : null}

      {L.mistakes?.length ? (
        <Section title="Common mistakes">
          {L.mistakes.map((m, i) => (
            <Text key={i} variant="body">
              {m}
            </Text>
          ))}
        </Section>
      ) : null}

      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.xl }} />
      <Footer>
        <Button label="I've read it. Test me" onPress={S.toRecall} />
      </Footer>
    </View>
  );
}

function RecallStep({ S }: { S: SessionApi }) {
  const { s, L } = S;
  const { spacing } = useTheme();
  const item = L.rec.items[s.recIdx];
  if (!item) return null;
  const marked = Boolean(s.recResult);
  return (
    <View style={{ gap: spacing.xl }}>
      <Text variant="prose">{item.prompt}</Text>
      {marked ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="body" color="textMuted">
            {s.recText || '(left blank)'}
          </Text>
          <FeedbackBlock grade={s.recResult as Grade} />
          <Text variant="caption" color="textMuted" style={{ marginTop: spacing.sm }}>
            A model answer: {item.answer}
          </Text>
        </View>
      ) : (
        <>
          <TextField
            label="Your answer"
            value={s.recText}
            onChangeText={S.setRecText}
            placeholder="In your own words"
            multiline
            style={{ minHeight: 96, textAlignVertical: 'top' }}
          />
          <View style={{ gap: spacing.sm }}>
            <Text variant="caption" color="textMuted">
              How sure are you?
            </Text>
            <Segmented options={CONF} value={s.recConf} onChange={S.setRecConf} />
          </View>
        </>
      )}
      <Footer>
        {marked ? (
          <Button label={s.recIdx + 1 < L.rec.items.length ? 'Next' : 'On to practice'} onPress={S.nextRecall} />
        ) : (
          <Button label="Check" onPress={S.checkRecall} loading={s.busy === 'Marking'} disabled={!s.recText.trim() || !s.recConf} />
        )}
      </Footer>
    </View>
  );
}

function PracticeStep({ S, item }: { S: SessionApi; item: Record<string, unknown> | null }) {
  const { s, L } = S;
  const { spacing, colors, radius } = useTheme();
  if (s.busy === 'Writing more practice') return <Waiting label="Writing more practice" detail="A few more at your level" />;
  if (!item) return <Waiting label={s.busy || 'Finishing'} />;
  const q = item as { type: 'mcq' | 'short'; prompt: string; options?: string[]; answer: number | string; explanation?: string; difficulty: number };
  const marked = Boolean(s.pracResult);
  const P = L.prac;
  return (
    <View style={{ gap: spacing.xl }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" color="textMuted">
          {P.asked.length + 1} of {P.items.length}
          {P.re ? ' · again' : ''}
        </Text>
        <Text variant="caption" color="accent">
          {P.correct} right
        </Text>
      </View>
      <Text variant="prose">{q.prompt}</Text>

      {q.type === 'mcq' ? (
        <View style={{ gap: spacing.sm }}>
          {(q.options || []).map((opt, i) => {
            const picked = s.pracPicked === i;
            const isAnswer = marked && i === q.answer;
            const wrongPick = marked && picked && !isAnswer;
            return (
              <Pressable
                key={i}
                disabled={marked}
                onPress={() => S.setPracPicked(i)}
                accessibilityRole="radio"
                accessibilityState={{ selected: picked }}
                style={{
                  padding: spacing.lg,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: isAnswer ? colors.accent : wrongPick ? colors.danger : picked ? colors.primary : colors.border,
                  backgroundColor: isAnswer ? colors.accentMuted : picked && !marked ? colors.primaryMuted : colors.surface,
                }}
              >
                <Text variant="body">{opt}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : marked ? (
        <Text variant="body" color="textMuted">
          {s.pracText || '(left blank)'}
        </Text>
      ) : (
        <TextField
          label="Your answer"
          value={s.pracText}
          onChangeText={S.setPracText}
          placeholder="In your own words"
          multiline
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />
      )}

      {marked ? (
        <FeedbackBlock grade={s.pracResult as Grade} />
      ) : (
        <View style={{ gap: spacing.sm }}>
          <Text variant="caption" color="textMuted">
            How sure are you?
          </Text>
          <Segmented options={CONF} value={s.pracConf} onChange={S.setPracConf} />
        </View>
      )}

      <Footer>
        {marked ? (
          <Button label="Next" onPress={S.nextPractice} />
        ) : (
          <Button
            label="Check"
            onPress={S.checkPractice}
            loading={s.busy === 'Marking'}
            disabled={!s.pracConf || (q.type === 'mcq' ? s.pracPicked == null : !s.pracText.trim())}
          />
        )}
      </Footer>
    </View>
  );
}

function DoneStep({ S, onClose }: { S: SessionApi; onClose: () => void }) {
  const { s } = S;
  const { spacing, colors } = useTheme();
  const sum = s.summary;
  return (
    <View style={{ gap: spacing.xl }}>
      <Text variant="prose">Learned.</Text>
      {sum ? (
        <View>
          <Row label="Practice" value={`${sum.correct} of ${sum.asked} right`} />
          <Row label="Cards for review" value={String(sum.added)} />
          {sum.firstDue ? <Row label="First review" value={fmtDate(sum.firstDue)} /> : null}
          <Row label="Time" value={`${sum.minutes} min`} last />
        </View>
      ) : null}
      <Text variant="body" color="textMuted">
        It counts as evidence once the reviews hold up over the coming days, so come back when the cards are due.
      </Text>
      <Footer>
        {s.busy === 'Saving' ? <Waiting label="Saving" /> : <Button label="Back to today" onPress={onClose} />}
      </Footer>
      <View style={{ height: 1, backgroundColor: colors.border, opacity: 0 }} />
    </View>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { spacing, colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        borderTopWidth: 1,
        borderBottomWidth: last ? 1 : 0,
        borderColor: colors.border,
      }}
    >
      <Text variant="body" color="textMuted">
        {label}
      </Text>
      <Text variant="bodyStrong">{value}</Text>
    </View>
  );
}
