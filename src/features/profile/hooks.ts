import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { deleteKnowItem, fetchKnowItems, saveKnowItems, type NewKnowItem } from './api';

export function useKnowItems() {
  return useQuery({ queryKey: ['know_items'], queryFn: fetchKnowItems });
}

export function useSaveKnowItems(profileId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: NewKnowItem[]) => saveKnowItems(profileId as string, items),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['know_items'] }),
  });
}

export function useDeleteKnowItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteKnowItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['know_items'] }),
  });
}
