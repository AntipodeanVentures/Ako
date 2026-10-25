import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Screen } from '@/src/components/ui';
import { dueCards } from '@/src/engine/progress';
import type { Card } from '@/src/engine/types';
import { useProfile } from '@/src/features/profile';
import { useLiveSubjects } from '@/src/features/subjects';
import { REVIEW_CAP } from '@/src/features/subjects/summary';
import { ReviewRun, orderReviews, type ReviewItem } from '@/src/screens/ReviewRun';

// Due cards across every subject, gathered once when the screen opens (a refetch must not reshuffle the run),
// most at risk first and capped; the run itself lives in src/screens/ReviewRun.tsx.
export default function ReviewRoute() {
  const { profile } = useProfile();
  const { subjects, loading } = useLiveSubjects(profile);
  const retention = Number(profile?.retention ?? 0.9);
  const [frozen] = useState<{ items: ReviewItem[] | null; total: number }>({ items: null, total: 0 });
  if (!frozen.items && subjects.length && !loading) {
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
  return <ReviewRun items={frozen.items} total={frozen.total} retention={retention} title={subjects[0]?.plan.title ?? ''} />;
}
