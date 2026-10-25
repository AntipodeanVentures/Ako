import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Button, Dictate, Text, TextField } from '@/src/components/ui';
import type { Card, Lesson, Topic } from '@/src/engine/types';
import { aiErrorCopy, callJson, callStream } from '@/src/features/ai/client';
import type { LiveSubject } from '@/src/features/subjects';
import { useTheme } from '@/src/theme';

// Teaching the idea back to a model student, on the day the topic's first card comes due: the end of that
// review run. A day on, with the lesson out of sight, explaining is retrieval; minutes after the lesson it was a
// second telling. Three exchanges is plenty. The student's brief is the cached lesson when the server still has
// it, otherwise the topic's cards.

type Msg = { role: 'user' | 'assistant'; content: string };

type Props = { subj: LiveSubject; topic: Topic; onDone: (turns: number) => void };

function serialisable(subj: LiveSubject) {
  const { dirtyCards: _d, ...rest } = subj;
  return rest;
}

function digestFromCards(topic: Topic, cards: Card[]) {
  const mine = cards.filter((c) => c.topicId === topic.id);
  const concepts = Array.from(new Set(mine.map((c) => (c as { conceptName?: string }).conceptName).filter(Boolean))) as string[];
  return {
    concepts: concepts.length ? concepts : [topic.title],
    sections: [{ heading: 'Key points', paragraphs: mine.map((c) => `${c.front} ${c.back}`), points: [] }],
    bridge: '',
    recallAnswer: topic.summary,
  };
}

export function TeachBack({ subj, topic, onDone }: Props) {
  const { spacing, colors, radius } = useTheme();
  const [chat, setChat] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const turns = chat.filter((m) => m.role === 'user').length;
  const digest = useRef<Partial<Lesson> | null>(null);

  useEffect(() => {
    let live = true;
    callJson<{ lesson: Lesson | null }>('lesson', { kind: 'cached', subject: serialisable(subj), topicId: topic.id })
      .then((r) => {
        if (!live) return;
        const l = r?.lesson;
        digest.current = l ? { concepts: l.concepts, sections: l.sections, bridge: l.bridge, recallAnswer: l.recallAnswer } : digestFromCards(topic, subj.cards ?? []);
      })
      .catch(() => { if (live) digest.current = digestFromCards(topic, subj.cards ?? []); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const messages: Msg[] = [...chat, { role: 'user', content: text }];
    setChat(messages);
    setInput('');
    setDraft('');
    setBusy(true);
    setError(null);
    try {
      const r = await callStream<{ text: string }>(
        'tutor',
        { subject: serialisable(subj), topicId: topic.id, lesson: digest.current ?? digestFromCards(topic, subj.cards ?? []), mode: 'student', scenario: null, messages },
        { onText: (full) => setDraft(full) },
      );
      setChat([...messages, { role: 'assistant', content: r.text }]);
      setDraft('');
    } catch (e) {
      setChat(chat);
      setInput(text);
      setDraft('');
      setError(aiErrorCopy(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: spacing.xl }}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="eyebrow" color="textMuted">
          One more thing
        </Text>
        <Text variant="prose">Explain {topic.title.toLowerCase()} to someone new.</Text>
        <Text variant="body" color="textMuted">
          You learned it yesterday; a curious beginner is listening. Say what it is about in your own words and they will ask questions. Three exchanges is plenty.
        </Text>
      </View>
      <View style={{ gap: spacing.md }}>
        {chat.map((m, i) => (
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
        {draft ? (
          <View style={{ alignSelf: 'flex-start', maxWidth: '88%', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }}>
            <Text variant="body">{draft}</Text>
          </View>
        ) : busy ? (
          <View style={{ alignSelf: 'flex-start', padding: spacing.md }}>
            <ActivityIndicator size="small" />
          </View>
        ) : null}
        {error ? (
          <Text variant="caption" color="danger">
            {error}
          </Text>
        ) : null}
        <TextField label="" value={input} onChangeText={setInput} placeholder={chat.length ? 'Your reply' : 'Start explaining'} multiline style={{ minHeight: 72, textAlignVertical: 'top' }} editable={!busy} />
        <Dictate value={input} onChangeText={setInput} />
        <Button label="Send" onPress={() => void send()} loading={busy} disabled={!input.trim()} />
      </View>
      <View style={{ gap: spacing.md }}>
        {turns >= 2 ? <Button label="Done teaching" variant="secondary" onPress={() => onDone(turns)} /> : null}
        <Pressable onPress={() => onDone(0)} style={{ alignSelf: 'center', padding: spacing.sm }} accessibilityRole="button">
          <Text variant="caption" color="textMuted">
            Not today
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
