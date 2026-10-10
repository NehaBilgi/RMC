import type { Json } from '../lib/database.types';
import { requireSupabase } from '../lib/supabase';

export interface AppRecord<T = Json> {
  id: string;
  company_id: string;
  site_id: string | null;
  page_id: string;
  record_type: string;
  data: T;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export async function listRecords<T = Json>(pageId: string, siteId?: string) {
  const client = requireSupabase();
  let query = client
    .from('app_records')
    .select('*')
    .eq('page_id', pageId)
    .order('created_at', { ascending: false });
  if (siteId) query = query.eq('site_id', siteId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AppRecord<T>[];
}

export async function createRecord<T>(
  input: { pageId: string; recordType: string; data: T; siteId?: string | null },
  companyId: string
) {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('Sign in before creating a record.');

  const { data, error } = await client
    .from('app_records')
    .insert({
      company_id: companyId,
      site_id: input.siteId ?? null,
      page_id: input.pageId,
      record_type: input.recordType,
      data: input.data as unknown as Json,
      created_by: authData.user.id
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as AppRecord<T>;
}

// Database RLS allows updates and deletes only for ADMIN/SUPER_ADMIN.
// Non-admin calls are rejected even if a client UI were modified.
export async function updateRecord<T>(id: string, dataValue: T) {
  const { data, error } = await requireSupabase()
    .from('app_records')
    .update({ data: dataValue as unknown as Json })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as AppRecord<T>;
}

export async function deleteRecord(id: string) {
  const { error } = await requireSupabase()
    .from('app_records')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
