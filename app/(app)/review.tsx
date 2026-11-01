import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Missing, Screen } from '@/src/components/ui';
import { dueCards } from '@/src/engine/progress';
import type { Card } from '@/src/engine/types';
import { useProfile } from '@/src/features/profile';
import { useLiveSubjects } from '@/src/features/subjects';
import { REVIEW_CAP, liveSubjects } from '@/src/features/subjects/summary';
import { ReviewRun, orderReviews, type ReviewItem } from '@/src/screens/ReviewRun';

// Due cards across every subject, gathered once when the screen opens (a refetch must not reshuffle the run),
// most at risk first and capped; the run itself lives in src/screens/ReviewRun.tsx.
export default function ReviewRoute() {
  const { profile } = useProfile();
  const all = useLiveSubjects(profile);
  // Subjects put away keep their cards but do not add to the day's reviews.
  const subjects = liveSubjects(all.subjects);
  const loading = all.loading;
  const retention = Number(profile?.retention ?? 0.9);
  const [frozen] = useState<{ items: ReviewItem[] | null; total: number }>({ items: null, total: 0 });
  if (!frozen.items && !loading) {
    const items: ReviewItem[] = [];
    for (const s of subjects) for (const c of dueCards(s.cards ?? []) as Card[]) items.push({ subj: s, card: c });
    frozen.total = items.length;
    frozen.items = orderReviews(items, retention).slice(0, REVIEW_CAP);
  }
  if (!frozen.items) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }
  if (!frozen.items.length) {
    return <Missing title="Nothing to review" body="Reviews appear here as cards fall due. Learn a topic and its cards come round over the following days." />;
  }
  return <ReviewRun items={frozen.items} total={frozen.total} retention={retention} title={subjects[0]?.plan.title ?? ''} />;
}
