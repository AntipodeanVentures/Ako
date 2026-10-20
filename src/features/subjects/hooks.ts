import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createSubject,
  deleteSubject,
  fetchStageState,
  fetchSubjects,
  fetchTopicState,
  type NewSubject,
} from './api';

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
