import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { deleteKnowItem, deletePriorField, fetchKnowItems, fetchPriorFields, saveKnowItems, savePriorFields, updatePriorField, type NewKnowItem, type NewPriorField } from './api';
import type { PriorFieldRow } from '@/src/types/database';

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

export function usePriorFields() {
  return useQuery({ queryKey: ['prior_fields'], queryFn: fetchPriorFields });
}

export function useSavePriorFields(profileId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fields, existing }: { fields: NewPriorField[]; existing: PriorFieldRow[] }) => savePriorFields(profileId as string, fields, existing),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prior_fields'] }),
  });
}

export function useUpdatePriorField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...update }: { id: string } & Parameters<typeof updatePriorField>[1]) => updatePriorField(id, update),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prior_fields'] }),
  });
}

export function useDeletePriorField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePriorField(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prior_fields'] }),
  });
}
