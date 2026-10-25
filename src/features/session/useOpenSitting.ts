import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import type { LiveSubject } from '@/src/features/subjects';

import { clearSitting, openSittings, type Sitting } from './sitting';

export type OpenSitting = { subjectId: string; topicId: string; title: string; step: string };

// The newest sitting left unfinished on this device, for a subject that still
// exists and a topic not since learned; re-read whenever the Learn tab is
// shown, so it disappears the moment the sitting is finished.
export function useOpenSitting(subjects: LiveSubject[]): OpenSitting | null {
  const [open, setOpen] = useState<OpenSitting | null>(null);
  const ids = subjects.map((s) => s.id).join(',');
  useFocusEffect(
    useCallback(() => {
      let live = true;
      openSittings().then((all) => {
        if (!live) return;
        let found: OpenSitting | null = null;
        for (const snap of all) {
          const subj = subjects.find((s) => s.id === snap.subjectId);
          const state = subj?.topicState[snap.topicId] as { status?: string } | undefined;
          const topic = subj?.plan.topics.find((t) => t.id === snap.topicId);
          if (!subj || !topic || state?.status === 'mastered' || state?.status === 'known') {
            if (subj) void clearSitting(snap.subjectId, snap.topicId);
            continue;
          }
          if (!found) found = pick(snap);
        }
        setOpen(found);
      });
      return () => { live = false; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ids]),
  );
  return open;
}

const pick = (s: Sitting): OpenSitting => ({ subjectId: s.subjectId, topicId: s.topicId, title: s.title, step: s.step });
