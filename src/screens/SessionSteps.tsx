import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Button, Chips, Segmented, Text, TextField } from '@/src/components/ui';
import { fmtDate } from '@/src/engine/core';
import { stepOrder } from '@/src/engine/session';
import type { useSession, Confidence, Grade } from '@/src/features/session/useSession';
import { useTheme } from '@/src/theme';

// The steps of one topic's sitting, as pure views over the session api: warm-up, lesson, drill, recall,
// practice, teach-back, role-play, done. app/(app)/session/[subjectId].tsx wires them to useSession; the
// dev preview renders them from fixture state so the lesson screens can be checked without an account.

export type SessionApi = ReturnType<typeof useSession>;

const CONF: { value: Confidence; label: string }[] = [
  { value: 'sure', label: 'Sure' },
  { value: 'unsure', label: 'Unsure' },
  { value: 'guess', label: 'Guessing' },
];


// ---------- pieces ----------

// Where the sitting is: the steps in order, the current one in ink, the ones done in grey, the ones to come fainter.
// A resumed sitting says so, with a way to start the topic over.
export function StepStrip({ S }: { S: SessionApi }) {
  const { s, L, topic } = S;
  const { spacing } = useTheme();
  const steps = (stepOrder(L, topic) as { key: string; label: string }[]).filter((x) => x.key !== 'done');
  const cur = s.step === 'warm' ? 'attempt' : s.step;
  const idx = steps.findIndex((x) => x.key === cur);
  if (s.step === 'done') return null;
  return (
    <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }} accessibilityLabel={`Step ${idx + 1} of ${steps.length}: ${steps[idx]?.label ?? ''}`}>
        {steps.map((st, i) => (
          <View key={st.key} style={{ flexDirection: 'row', alignItems: 'center', opacity: i > idx ? 0.55 : 1 }}>
            <Text variant={i === idx ? 'bodyStrong' : 'caption'} color={i === idx ? 'text' : 'textMuted'} style={i === idx ? { fontSize: 13, lineHeight: 18 } : undefined}>
              {st.label}
            </Text>
            {i < steps.length - 1 ? (
              <Text variant="caption" color="textMuted">
                {'  ·  '}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
      {S.resumed ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Text variant="caption" color="textMuted">
            Picked up where you left off.
          </Text>
          <Pressable onPress={S.restart} hitSlop={8} accessibilityRole="button">
            <Text variant="caption" color="text">
              Start over
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function Waiting({ label, detail }: { label: string; detail?: string }) {
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

export function Notice({ tone, text }: { tone: 'danger' | 'muted'; text: string }) {
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
export function FeedbackBlock({ grade }: { grade: Grade }) {
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

export function Section({ title, children }: { title: string; children: ReactNode }) {
  const { spacing, colors } = useTheme();
  return (
    <View style={{ gap: spacing.sm, paddingTop: spacing.xl, marginTop: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border }}>
      <Text variant="heading">{title}</Text>
      {children}
    </View>
  );
}

export function Footer({ children }: { children: ReactNode }) {
  const { spacing } = useTheme();
  return <View style={{ marginTop: spacing.xxl, gap: spacing.md }}>{children}</View>;
}

// ---------- steps ----------

export function WarmStep({ S }: { S: SessionApi }) {
  const { s, L } = S;
  const { spacing } = useTheme();
  // One question at a time; the marked answers come back together.
  const [idx, setIdx] = useState(0);
  // Skipped, or no warm-up could be written: only the lesson is awaited now.
  if (!s.warm || (L.checked && !s.warmGrades)) {
    if (s.lesson && s.warm) return <Button label="Continue to the lesson" onPress={S.toLearn} />;
    if (s.error) return <Button label="Try again" onPress={S.retryLesson} />;
    return <Waiting label={s.busy || (s.warm ? 'Writing your lesson' : 'Writing your warm-up')} detail={s.lessonProgress.sections ? `${s.lessonProgress.sections} sections so far` : undefined} />;
  }
  const marked = Boolean(s.warmGrades);
  const qs = s.warm.questions;
  const n = qs.length;
  const i = Math.min(idx, n - 1);
  const q = qs[i];
  const last = i >= n - 1;
  const answered = s.warmAnswers.some((a) => a.trim());
  return (
    <View style={{ gap: spacing.xl }}>
      {s.warm.hook ? <Text variant="body">{s.warm.hook}</Text> : null}
      {!marked ? (
        <>
          <Text variant="caption" color="textMuted">
            {n === 1 ? 'One quick question before the lesson.' : 'Two quick questions before the lesson.'} Guessing is fine; a wrong guess helps the right answer stick.
          </Text>
          <View style={{ gap: spacing.md }}>
            {n > 1 ? (
              <Text variant="eyebrow" color="textMuted">
                {i + 1} of {n}
              </Text>
            ) : null}
            <Text variant="prose">{q.q}</Text>
            {q.type === 'choice' && q.options?.length ? (
              <Chips options={q.options} value={s.warmAnswers[i] ? [s.warmAnswers[i]] : []} onChange={(v) => S.setWarmAnswer(i, v[0] ?? '')} />
            ) : (
              <TextField
                label=""
                value={s.warmAnswers[i]}
                onChangeText={(t) => S.setWarmAnswer(i, t)}
                placeholder="A sentence, in your own words"
                multiline
                style={{ minHeight: 72, textAlignVertical: 'top' }}
              />
            )}
          </View>
          <Footer>
            {!last ? (
              <Button label="Next" onPress={() => setIdx(i + 1)} />
            ) : (
              <Button label={n === 1 ? 'Check my answer' : 'Check my answers'} onPress={S.checkWarm} loading={s.busy === 'Marking'} disabled={!answered} />
            )}
            <Pressable onPress={S.skipWarm} style={{ alignSelf: 'center', padding: spacing.sm }}>
              <Text variant="caption" color="textMuted">
                I don&apos;t know yet, go to the lesson
              </Text>
            </Pressable>
          </Footer>
        </>
      ) : (
        <>
          {qs.map((wq, j) => (
            <View key={j} style={{ gap: spacing.xs }}>
              <Text variant="bodyStrong">{wq.q}</Text>
              <Text variant="body" color="textMuted">
                {s.warmAnswers[j] || '(left blank)'}
              </Text>
              {s.warmGrades?.[j] ? <FeedbackBlock grade={s.warmGrades[j]} /> : null}
            </View>
          ))}
          <Footer>
            {s.lesson ? (
              <Button label="Continue to the lesson" onPress={S.toLearn} />
            ) : s.error ? (
              <Button label="Try again" onPress={S.retryLesson} />
            ) : (
              <Waiting label="Writing your lesson" detail={s.lessonProgress.sections ? `${s.lessonProgress.sections} sections so far` : 'Nearly there'} />
            )}
          </Footer>
        </>
      )}
    </View>
  );
}

export function LearnStep({ S }: { S: SessionApi }) {
  const { s } = S;
  const { spacing, colors } = useTheme();
  const L = s.lesson!;
  const [cmpOpen, setCmpOpen] = useState(false);
  const [gapsOpen, setGapsOpen] = useState(false);
  // The learner writes something before each reveal: comparing two cases and completing the missing steps work
  // because the learner produces the principle or the step, not because they read it. Ungraded; a skip is allowed.
  const [cmpText, setCmpText] = useState('');
  const [gapsText, setGapsText] = useState('');
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
            <View style={{ gap: spacing.sm }}>
              {cmpText.trim() ? (
                <Text variant="caption" color="textMuted">
                  You said: {cmpText.trim()}
                </Text>
              ) : null}
              <Text variant="body" color="textMuted">
                {cmp.answer}
              </Text>
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              <TextField label="Your answer, in a line" value={cmpText} onChangeText={setCmpText} placeholder="What they share, and what makes the difference" multiline style={{ minHeight: 56, textAlignVertical: 'top' }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
                <Button label="Show the principle" variant="secondary" onPress={() => setCmpOpen(true)} disabled={cmpText.trim().length < 3} />
                <Pressable onPress={() => setCmpOpen(true)} hitSlop={8}>
                  <Text variant="caption" color="textMuted">
                    Skip
                  </Text>
                </Pressable>
              </View>
            </View>
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
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              <TextField label="Your turn: the missing steps" value={gapsText} onChangeText={setGapsText} placeholder="What happens at the hidden steps, and why" multiline style={{ minHeight: 56, textAlignVertical: 'top' }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
                <Button label="Show the missing steps" variant="secondary" onPress={() => setGapsOpen(true)} disabled={gapsText.trim().length < 3} />
                <Pressable onPress={() => setGapsOpen(true)} hitSlop={8}>
                  <Text variant="caption" color="textMuted">
                    Skip
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          {worked.gaps?.length && gapsOpen && gapsText.trim() ? (
            <Text variant="caption" color="textMuted">
              You said: {gapsText.trim()}
            </Text>
          ) : null}
          {worked.answer && (gapsOpen || !worked.gaps?.length) ? (
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

export function RecallStep({ S }: { S: SessionApi }) {
  const { s, L } = S;
  const { spacing } = useTheme();
  const item = L.rec.items[s.recIdx];
  // The questions are written from the lesson text while it is read; they are nearly always ready by now.
  if (!s.questionsReady) {
    return s.questionsError ? (
      <View style={{ gap: spacing.lg }}>
        <Notice tone="danger" text={s.questionsError} />
        <Button label="Try again" onPress={S.retryLesson} />
      </View>
    ) : (
      <Waiting label="Writing your questions" detail="From what the lesson taught" />
    );
  }
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

export function PracticeStep({ S, item }: { S: SessionApi; item: Record<string, unknown> | null }) {
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

export function DoneStep({ S, onClose }: { S: SessionApi; onClose: () => void }) {
  const { s } = S;
  const { spacing, colors, radius } = useTheme();
  const sum = s.summary;
  return (
    <View style={{ gap: spacing.xl }}>
      <Text variant="prose">
        {sum && !sum.mastered ? 'Not yet. It comes back tomorrow.' : sum?.motorPending ? 'Learned. Now practise it.' : 'Learned.'}
      </Text>
      {sum ? (
        <View>
          <Row label="Practice" value={`${sum.correct} of ${sum.asked} right`} />
          {sum.sure ? <Row label="Sure of" value={`${sum.sure}, right on ${sum.sureRight}`} /> : null}
          {sum.roleplay ? <Row label="Role-play" value={`${Math.round(sum.roleplay.mean * 100)}% of the criteria`} /> : null}
          {sum.taught ? <Row label="Taught back" value="Yes" /> : null}
          <Row label="Cards for review" value={String(sum.added)} />
          {sum.firstDue ? <Row label="First review" value={fmtDate(sum.firstDue)} /> : null}
          <Row label="Time" value={`${sum.minutes} min`} last />
        </View>
      ) : null}
      <Text variant="body" color="textMuted">
        {sum && !sum.mastered
          ? sum.roleplay
            ? 'The role-play did not yet meet enough of the criteria. The topic is offered again next session, with the debrief to hand.'
            : 'Practice did not reach the mark: three fully right, including a harder one. The topic is offered again next session in a simpler form, and its cards are already in review.'
          : sum?.motorPending
            ? 'The topic stays in practice until you log a session away from the screen where every check passed.'
            : 'It counts as evidence once the reviews hold up over the coming days, so come back when the cards are due.'}
      </Text>
      {s.revision?.length ? (
        <View style={{ gap: spacing.sm, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md }}>
          <Text variant="bodyStrong">Your path has changed</Text>
          {s.revision.map((n, i) => (
            <Text key={i} variant="body" color="textMuted">
              {n.why || `${n.op === 'insert' ? 'Added' : n.op === 'remove' ? 'Removed' : n.op === 'move' ? 'Moved' : 'Refocused'}: ${n.title}`}
            </Text>
          ))}
        </View>
      ) : null}
      <Footer>
        {s.busy === 'Saving' ? <Waiting label="Saving" /> : <Button label="Back to today" onPress={onClose} />}
      </Footer>
      <View style={{ height: 1, backgroundColor: colors.border, opacity: 0 }} />
    </View>
  );
}

export function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
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

export function DrillStep({ S }: { S: SessionApi }) {
  const { s } = S;
  const { spacing } = useTheme();
  const d = s.lesson!.drill!;
  return (
    <View>
      <Text variant="body" color="textMuted">
        This one is learned by doing. Read it now, do it later today, and come back to log how it went.
      </Text>
      <Section title="Steps">
        {d.steps.map((st, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Text variant="body" color="textMuted" style={{ width: 22 }}>
              {i + 1}.
            </Text>
            <Text variant="body" style={{ flex: 1 }}>
              {st}
            </Text>
          </View>
        ))}
        {d.dose ? (
          <Text variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>
            {d.dose}
          </Text>
        ) : null}
      </Section>
      {d.checks?.length ? (
        <Section title="A good repetition">
          {d.checks.map((c, i) => (
            <Text key={i} variant="body">
              {c}
            </Text>
          ))}
        </Section>
      ) : null}
      {d.cues?.length ? (
        <Section title="Think about">
          {d.cues.map((c, i) => (
            <Text key={i} variant="body">
              {c}
            </Text>
          ))}
          {d.feedback ? (
            <Text variant="caption" color="textMuted">
              {d.feedback}
            </Text>
          ) : null}
        </Section>
      ) : null}
      {d.imagery ? (
        <Section title="Sixty seconds in your head">
          <Text variant="body">{d.imagery}</Text>
        </Section>
      ) : null}
      {d.safety ? (
        <Section title="Safety">
          <Text variant="body">{d.safety}</Text>
        </Section>
      ) : null}
      <Footer>
        <Button label="Got it. Check my understanding" onPress={S.toRecall} />
      </Footer>
    </View>
  );
}

export function ChatThread({ S, placeholder }: { S: SessionApi; placeholder: string }) {
  const { s } = S;
  const { spacing, colors, radius } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      {s.chat.map((m, i) => (
        <View
          key={i}
          style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '88%',
            padding: spacing.md,
            borderRadius: radius.md,
            backgroundColor: m.role === 'user' ? colors.primaryMuted : 'transparent',
            borderWidth: m.role === 'user' ? 0 : 1,
            borderColor: colors.border,
          }}
        >
          <Text variant="body">{m.content}</Text>
        </View>
      ))}
      {s.chatDraft ? (
        <View style={{ alignSelf: 'flex-start', maxWidth: '88%', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }}>
          <Text variant="body">{s.chatDraft}</Text>
        </View>
      ) : s.busy === 'Replying' ? (
        <View style={{ alignSelf: 'flex-start', padding: spacing.md }}>
          <ActivityIndicator size="small" />
        </View>
      ) : null}
      <TextField
        label=""
        value={s.chatInput}
        onChangeText={S.setChatInput}
        placeholder={placeholder}
        multiline
        style={{ minHeight: 72, textAlignVertical: 'top' }}
        editable={!s.busy}
      />
      <Button label="Send" onPress={S.sendChat} loading={s.busy === 'Replying'} disabled={!s.chatInput.trim()} />
    </View>
  );
}

export function TeachStep({ S }: { S: SessionApi }) {
  const { s } = S;
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.xl }}>
      <Text variant="prose">Explain it to someone new.</Text>
      <Text variant="body" color="textMuted">
        A curious beginner is listening. Say what the topic is about in your own words; they will ask questions. Three exchanges is plenty. Explaining is one of the surest ways to make it stick.
      </Text>
      <ChatThread S={S} placeholder={s.chat.length ? 'Your reply' : 'Start explaining'} />
      <Footer>
        {s.chatTurns >= 2 ? (
          <Button label="Done teaching" onPress={() => S.finish({ taught: true })} />
        ) : (
          <Pressable onPress={() => S.finish({ taught: false })} style={{ alignSelf: 'center', padding: spacing.sm }}>
            <Text variant="caption" color="textMuted">
              Skip this today
            </Text>
          </Pressable>
        )}
      </Footer>
    </View>
  );
}

export function RoleplayStep({ S }: { S: SessionApi }) {
  const { s } = S;
  const { spacing, colors } = useTheme();
  const sc = s.lesson!.scenario!;
  if (s.debrief) {
    const d = s.debrief;
    return (
      <View style={{ gap: spacing.xl }}>
        <Text variant="prose">{Math.round(d.mean * 100)}% of what a skilled person would do.</Text>
        <View>
          {sc.criteria.map((c, i) => {
            const sc2 = d.scores[i] ?? 0;
            const tone = sc2 >= 1 ? colors.accent : sc2 > 0 ? colors.warning : colors.danger;
            return (
              <View key={i} style={{ flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
                <View style={{ width: 3, backgroundColor: tone, borderRadius: 2 }} />
                <Text variant="body" style={{ flex: 1 }}>
                  {c}
                </Text>
                <Text variant="caption" style={{ color: tone }}>
                  {sc2 >= 1 ? 'Yes' : sc2 > 0 ? 'Partly' : 'No'}
                </Text>
              </View>
            );
          })}
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border }} />
        </View>
        <Text variant="body">{d.feedback}</Text>
        <Footer>
          <Button label="Finish" onPress={() => S.finish()} />
        </Footer>
      </View>
    );
  }
  return (
    <View style={{ gap: spacing.xl }}>
      <View style={{ gap: spacing.sm }}>
        <Text variant="body">{sc.setting}</Text>
        <Text variant="body" color="textMuted">
          You are {sc.yourRole}. Your goal: {sc.goal}
        </Text>
        <Text variant="caption" color="textMuted">
          Say {'"pause"'} if you need a hint.
        </Text>
      </View>
      <ChatThread S={S} placeholder="Your line" />
      <Footer>
        <Button
          label="End and debrief"
          variant="secondary"
          onPress={S.endRoleplay}
          loading={s.busy === 'Debriefing'}
          disabled={s.chatTurns < 2}
        />
      </Footer>
    </View>
  );
}
