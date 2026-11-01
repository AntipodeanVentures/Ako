import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createSubject,
  deleteSubject,
  fetchStageState,
  fetchSubjects,
  fetchTopicState,
  updateSubject,
  type NewSubject,
} from './api';
import type { SubjectRow } from '@/src/types/database';

export function useSubjects() {
  return useQuery({ queryKey: ['subjects'], queryFn: fetchSubjects });
}

export function useTopicState(subjectId: string | undefined) {
  return useQuery({
    queryKey: ['topic_state', subjectId],
    enabled: Boolean(subjectId),
    queryFn: () => fetchTopicState(subjectId as string),
  });
}

export function useStageState(subjectId: string | undefined) {
  return useQuery({
    queryKey: ['stage_state', subjectId],
    enabled: Boolean(subjectId),
    queryFn: () => fetchStageState(subjectId as string),
  });
}

export function useCreateSubject(profileId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (subject: NewSubject) => createSubject(profileId as string, subject),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subjects'] }),
  });
}

export function useDeleteSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSubject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subjects'] }),
  });
}

// The subject's own settings: its name, what it is for, the aim and the daily
// slot (all in intake), and whether it is archived (in stats, where the
// planner also reads it so an archived subject no longer counts as "covered
// elsewhere").
export function useUpdateSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...update }: { id: string } & Partial<Pick<SubjectRow, 'title' | 'intake' | 'plan' | 'stats'>>) => updateSubject(id, update),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subjects'] }),
  });
}
