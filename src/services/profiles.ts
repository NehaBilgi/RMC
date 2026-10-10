import type { Database } from '../lib/database.types';
import { requireSupabase } from '../lib/supabase';

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export async function listCompanyProfiles() {
  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('*')
    .order('username');
  if (error) throw error;
  return data ?? [];
}

export async function inviteCompanyUser(input: {
  email: string;
  username: string;
  role: 'ADMIN' | 'EMPLOYEE' | 'READ_ONLY';
  pageAccess: string[];
}) {
  const { data, error } = await requireSupabase()
    .functions
    .invoke('admin-create-user', { body: input });
  if (error) throw error;
  return data as { userId: string; email: string; invited: boolean };
}
