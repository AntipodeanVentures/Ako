import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchMyRecord, issueRecord, revokeRecord } from './api';
import type { RecordData } from './build';

export function useMyRecord(enabled = true) {
  return useQuery({ queryKey: ['record'], queryFn: fetchMyRecord, enabled });
}

export function useIssueRecord(profileId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RecordData) => issueRecord(profileId as string, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['record'] }),
  });
}

export function useRevokeRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => revokeRecord(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['record'] }),
  });
}
