import type { Database } from '../lib/database.types';
import { requireSupabase } from '../lib/supabase';

export type SiteRow = Database['public']['Tables']['sites']['Row'];
export type NewSite = Omit<
  Database['public']['Tables']['sites']['Insert'],
  'id' | 'created_at' | 'updated_at'
>;

export async function listSites() {
  const { data, error } = await requireSupabase()
    .from('sites')
    .select('*')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

// Site setup is admin-only under the migration's RLS policies.
export async function createSite(site: NewSite) {
  const { data, error } = await requireSupabase()
    .from('sites')
    .insert(site)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
