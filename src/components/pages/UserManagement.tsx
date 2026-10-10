import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Users, CalendarClock, Shield, X } from 'lucide-react';
import { isAdminUser, PAGE_ACCESS_OPTIONS } from '../../utils/accessControl';

const ROLES = ['ADMIN', 'EMPLOYEE', 'READ_ONLY'];
const ALL_PAGE_IDS: string[] = PAGE_ACCESS_OPTIONS.flatMap(section => section.pages.map(page => page.id));

const ROLE_INFO: Record<string, { label: string; cls: string; desc: string }> = {
  'ADMIN': {
    label: 'ADMIN (Full Power)',
    cls: 'text-red-400 border-red-700 bg-red-950/20',
    desc: 'Full system access — create, edit, delete sites, billing, telemetry, and manage system users.'
  },
  'EMPLOYEE': {
    label: 'EMPLOYEE (Data Entry Only)',
    cls: 'text-emerald-400 border-emerald-700 bg-emerald-950/20',
    desc: 'Can log measurements, bills, and haulage trips. Strictly no permission to edit or delete existing records.'
  },
  'READ_ONLY': {
    label: 'READ_ONLY (View Only)',
    cls: 'text-slate-400 border-slate-600 bg-slate-900/20',
    desc: 'View-only access — observe reports, telemetry, and live balances without data entry or editing capabilities.'
  },
};

function UserForm({
  initial,
  onSave,
  onClose,
  currentUserId
}: {
  initial?: any;
  onSave: (r: any) => void;
  onClose: () => void;
  currentUserId?: string;
}) {
  const [f, setF] = useState({
    username: initial?.username || '',
    role: initial?.role === 'SUPER_ADMIN' ? 'ADMIN' : (initial?.role || 'EMPLOYEE'),
    active: initial?.active ?? true,
    expires_at: initial?.expires_at || '',
    password: '',
    pageAccess: Array.isArray(initial?.pageAccess)
      ? initial.pageAccess
      : (initial?.id ? ALL_PAGE_IDS : ['dashboard'])
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));

  React.useEffect(() => {
    if (initial?.expires_at) {
      const d = new Date(initial.expires_at);
      const offset = d.getTimezoneOffset() * 60000;
      const formatted = (new Date(d.getTime() - offset)).toISOString().slice(0, 16);
      set('expires_at', formatted);
    }
  }, [initial]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.username?.trim()) {
      alert('Username required');
      return;
    }
    if (!initial?.id && !f.password) {
      alert('Password required for new users');
      return;
    }
    setSaving(true);
    try {
      const payload: any = { 
        ...f,
        name: f.username.trim(),
        pageAccess: f.role === 'ADMIN' ? [...ALL_PAGE_IDS] : f.pageAccess.filter((id: string) => ALL_PAGE_IDS.includes(id))
      };
      if (!payload.password) delete payload.password;
      if (!payload.expires_at || payload.expires_at.trim() === '') payload.expires_at = null;

      const savedUsers = JSON.parse(localStorage.getItem('concrete360_users') || '[]');
      let updatedUsers = [];
      if (initial?.id) {
        updatedUsers = savedUsers.map((u: any) => u.id === initial.id ? { ...u, ...payload } : u);
      } else {
        const newUser = { id: `u-${Date.now()}`, ...payload, created_at: new Date().toISOString() };
        updatedUsers = [newUser, ...savedUsers];
      }
      localStorage.setItem('concrete360_users', JSON.stringify(updatedUsers));
      try {
        const activeUser = JSON.parse(sessionStorage.getItem('concrete360_user') || 'null');
        if (activeUser?.username?.toLowerCase() === f.username.trim().toLowerCase()) {
          sessionStorage.setItem('concrete360_user', JSON.stringify({ ...activeUser, ...payload }));
        }
      } catch {}
      window.dispatchEvent(new Event('concrete360_user_updated'));
      onSave(payload);
    } catch (err: any) {
      alert(err.message || 'Error saving user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 text-xs font-mono">
      <div>
        <label className="block text-slate-300 font-bold mb-1">Username *</label>
        <input
          type="text"
          required
          value={f.username}
          onChange={e => set('username', e.target.value)}
          placeholder="adminbilgi"
          className="w-full px-3 py-2.5 bg-[#162032] border border-[#1E293B] rounded-xl text-white outline-none font-sans text-sm focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-slate-300 font-bold mb-1">
          {initial?.id ? 'New Password (leave blank to keep)' : 'Password *'}
        </label>
        <input
          type="password"
          value={f.password}
          onChange={e => set('password', e.target.value)}
          placeholder="Min 6 characters"
          className="w-full px-3 py-2.5 bg-[#162032] border border-[#1E293B] rounded-xl text-white outline-none font-sans text-sm focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-slate-300 font-bold mb-1">Access Role *</label>
        <select
          value={f.role}
          onChange={e => set('role', e.target.value)}
          className="w-full px-3 py-2.5 bg-[#162032] border border-[#1E293B] rounded-xl text-amber-300 font-bold outline-none cursor-pointer text-xs focus:border-blue-500"
        >
          <option value="ADMIN">ADMIN — Full Power (Edit & Delete Allowed)</option>
          <option value="EMPLOYEE">EMPLOYEE — Data Entry Only (No Edit / Delete Power)</option>
          <option value="READ_ONLY">READ_ONLY — View Only (No Entry, Edit or Delete)</option>
        </select>
      </div>

      <fieldset className="rounded-xl border border-[#1E293B] p-3 space-y-3">
        <legend className="px-1 text-slate-300 font-bold">Page Access</legend>
        <p className="text-[10px] text-slate-500">
          {f.role === 'ADMIN'
            ? 'Admins can access every page. Page selection applies to employee and read-only accounts.'
            : 'Select the pages this user can open. Editing and deleting records, and User Management, remain admin-only.'}
        </p>
        <div className="max-h-44 overflow-y-auto space-y-3 pr-1">
          {PAGE_ACCESS_OPTIONS.map(section => (
            <div key={section.section}>
              <p className="mb-1.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                {section.section}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {section.pages.map(page => (
                  <label key={page.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-slate-300 hover:bg-[#162032] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={f.role === 'ADMIN' || f.pageAccess.includes(page.id)}
                      disabled={f.role === 'ADMIN'}
                      onChange={e => set('pageAccess', e.target.checked
                        ? [...f.pageAccess, page.id]
                        : f.pageAccess.filter((id: string) => id !== page.id))}
                      className="accent-blue-600"
                    />
                    <span>{page.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="block text-slate-300 font-bold mb-1">Account Validity Expiry (Optional)</label>
        <input
          type="datetime-local"
          value={f.expires_at || ''}
          onChange={e => set('expires_at', e.target.value)}
          className="w-full px-3 py-2.5 bg-[#162032] border border-[#1E293B] rounded-xl text-white outline-none cursor-pointer focus:border-blue-500"
        />
        <span className="text-[10px] text-slate-500 block mt-1">Leave blank for permanent worker credentials.</span>
      </div>

      {initial?.id && initial.id !== currentUserId && (
        <div>
          <label className="block text-slate-300 font-bold mb-1">Status</label>
          <select
            value={String(f.active)}
            onChange={e => set('active', e.target.value === 'true')}
            className="w-full px-3 py-2.5 bg-[#162032] border border-[#1E293B] rounded-xl text-white outline-none cursor-pointer text-xs focus:border-blue-500"
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-3 border-t border-[#1E293B]">
        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white cursor-pointer text-xs">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer text-xs transition">
          {saving ? 'Saving…' : (initial?.id ? 'Update User' : 'Create User')}
        </button>
      </div>
    </form>
  );
}

export function UserManagement() {
  const [users, setUsers] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('concrete360_users');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: 'u-1', name: 'adminbilgi', username: 'adminbilgi', role: 'ADMIN', active: true, expires_at: null, created_at: '2026-08-01T10:00:00Z' }
    ];
  });

  const [editing, setEditing] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    try {
      const saved = localStorage.getItem('concrete360_users');
      if (saved) setUsers(JSON.parse(saved));
    } catch {}
  };

  const del = (id: string) => {
    if (!confirm('Delete this user?')) return;
    const updated = users.filter(u => u.id !== id);
    setUsers(updated);
    localStorage.setItem('concrete360_users', JSON.stringify(updated));
  };

  const close = () => { setShowForm(false); setEditing(null); };

  let adminSession = false;
  try {
    adminSession = isAdminUser(JSON.parse(sessionStorage.getItem('concrete360_user') || 'null'));
  } catch {}

  if (!adminSession) {
    return (
      <div className="rounded-2xl border border-[#1E293B] bg-[#0B1220] p-6 text-sm text-slate-400">
        User Management is available to administrators only.
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans text-slate-100">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white">User Management</h1>
            <p className="text-xs text-slate-400">Configure administrative access, staff data entry, and audit privileges.</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-600/30 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add User</span>
        </button>
      </div>

      {/* Role Explanations */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {ROLES.map(role => (
          <div key={role} className={`border rounded-2xl p-4 bg-[#0B1220] ${ROLE_INFO[role]?.cls || 'border-[#1E293B]'}`}>
            <p className={`text-xs font-black mb-1 uppercase ${ROLE_INFO[role]?.cls.split(' ')[0]}`}>
              {ROLE_INFO[role]?.label}
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed font-mono">
              {ROLE_INFO[role]?.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Users Table */}
      <div className="bg-[#0B1220] border border-[#1E293B] rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-[#1E293B] flex justify-between items-center bg-[#080d19]/80">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">System Users</h3>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{users.length} users registered</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#070c18] border-b border-[#1E293B] text-[10px] font-extrabold uppercase text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Username</th>
                <th className="px-5 py-3.5">Access Role</th>
                <th className="px-5 py-3.5">Page Access</th>
                <th className="px-5 py-3.5">Account Expiry</th>
                <th className="px-5 py-3.5">Created</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]/60 text-slate-200">
              {users.map(u => {
                const normalizedRole = u.role === 'SUPER_ADMIN' ? 'ADMIN' : (u.role || 'EMPLOYEE');
                return (
                  <tr key={u.id} className="hover:bg-[#121c33]/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-white">{u.username}</span>
                      {u.username === 'adminbilgi' && <span className="ml-2 text-[10px] text-blue-400 font-bold">(you)</span>}
                      {!u.active && <span className="ml-2 text-[10px] text-rose-400 font-bold">(inactive)</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] font-bold border px-2.5 py-0.5 rounded-lg uppercase ${ROLE_INFO[normalizedRole]?.cls || 'text-slate-400 border-slate-600'}`}>
                        {normalizedRole}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 text-[10px]">
                      {normalizedRole === 'ADMIN'
                        ? 'All pages'
                        : Array.isArray(u.pageAccess)
                          ? `${u.pageAccess.length} page${u.pageAccess.length === 1 ? '' : 's'}`
                          : 'All pages (legacy)'}
                    </td>
                    <td className="px-5 py-3.5">
                      {u.expires_at ? (
                        <div className="flex items-center gap-1.5">
                          <CalendarClock size={13} className={new Date() > new Date(u.expires_at) ? "text-rose-400" : "text-amber-400"} />
                          <span className={`text-xs ${new Date() > new Date(u.expires_at) ? "text-rose-400 font-bold line-through" : "text-slate-300"}`}>
                            {new Date(u.expires_at).toLocaleDateString()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-bold">Permanent Access</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 text-[11px]">{new Date(u.created_at || Date.now()).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => { setEditing(u); setShowForm(true); }} className="p-1.5 rounded-lg bg-[#121c2f] hover:bg-blue-600/20 text-slate-400 hover:text-blue-400 cursor-pointer transition">
                          <Edit2 size={13} />
                        </button>
                        {u.username !== 'adminbilgi' && (
                          <button onClick={() => del(u.id)} className="p-1.5 rounded-lg bg-[#121c2f] hover:bg-rose-600/20 text-slate-400 hover:text-rose-400 cursor-pointer transition">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-[#121927] border border-[#1E293B] rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#1E293B] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-400" />
                <span>{editing ? 'Edit User Credentials' : 'Add New System User'}</span>
              </h3>
              <button onClick={close} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <UserForm initial={editing} onSave={() => { close(); load(); }} onClose={close} />
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
