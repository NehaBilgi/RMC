import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const allowedPages = new Set([
  'dashboard', 'ongoing_site', 'billing', 'total_bill', 'site_tests', 'trips',
  'material_category', 'transit_mixer', 'concrete_pumps', 'mix_design',
  'site_report', 'measurements', 'company_details',
]);
const allowedRoles = new Set(['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE', 'READ_ONLY']);

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405);

  const authorization = request.headers.get('Authorization');
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!authorization || !url || !anonKey || !serviceRoleKey) {
    return respond({ error: 'Missing authorization or server configuration.' }, 401);
  }

  const token = authorization.replace(/^Bearer\s+/i, '');
  const callerClient = createClient(url, anonKey);
  const { data: callerData, error: callerError } = await callerClient.auth.getUser(token);
  if (callerError || !callerData.user) return respond({ error: 'Sign in is required.' }, 401);

  const adminClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: actor, error: actorError } = await adminClient
    .from('profiles')
    .select('company_id, role, active')
    .eq('id', callerData.user.id)
    .single();
  if (actorError || !actor?.active || !['ADMIN', 'SUPER_ADMIN'].includes(actor.role)) {
    return respond({ error: 'Only active company admins can invite users.' }, 403);
  }

  let input: {
    email?: string;
    username?: string;
    role?: string;
    pageAccess?: string[];
  };
  try {
    input = await request.json();
  } catch {
    return respond({ error: 'Request body must be valid JSON.' }, 400);
  }

  const email = String(input.email || '').trim().toLowerCase();
  const username = String(input.username || '').trim();
  const role = String(input.role || 'READ_ONLY').toUpperCase();
  const pageAccess = Array.isArray(input.pageAccess)
    ? [...new Set(input.pageAccess.map(String))]
    : [];
  if (!email || !email.includes('@') || !username) {
    return respond({ error: 'A valid email and username are required.' }, 400);
  }
  if (!allowedRoles.has(role) || pageAccess.some((page) => !allowedPages.has(page))) {
    return respond({ error: 'Role or page access selection is invalid.' }, 400);
  }
  if (role === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN') {
    return respond({ error: 'Only a super admin can create another super admin.' }, 403);
  }

  const { data: invited, error: inviteError } = await adminClient.auth.admin
    .inviteUserByEmail(email, {
      data: { username },
    });
  if (inviteError || !invited.user) {
    return respond({ error: inviteError?.message || 'Unable to send invitation.' }, 400);
  }

  const profile = {
    id: invited.user.id,
    company_id: actor.company_id,
    username,
    role,
    page_access: role === 'ADMIN' || role === 'SUPER_ADMIN' ? [...allowedPages] : pageAccess,
    active: true,
  };
  const { error: profileError } = await adminClient.from('profiles').insert(profile);
  if (profileError) {
    await adminClient.auth.admin.deleteUser(invited.user.id);
    return respond({ error: `Invitation created but profile setup failed: ${profileError.message}` }, 500);
  }

  return respond({ userId: invited.user.id, email, invited: true }, 201);
});
