import React, { useState, useEffect } from 'react';
import { Building, Edit2, Save, X, Check, Landmark, Phone } from 'lucide-react';
import { getSessionUser, isAdminUser, canCreateRecords } from '../../utils/accessControl';
import { supabase } from '../../lib/supabase';
import { cloudStorage } from '../../services/cloudStorage';

export const CompanyDetailsModule: React.FC = () => {
  const sessionUser = getSessionUser();
  const canEditCompany = isAdminUser(sessionUser) || canCreateRecords(sessionUser);
  const [isEditing, setIsEditing] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [companyData, setCompanyData] = useState({
    name: 'BILGI BUILDCON RMC',
    gstin: '29ABWFM2721J1ZA',
    address: 'SY NO 118/13 AINAPUR GRAM BURNAPUR ROAD, VIJAYAPURA-586104',
    division: 'Commercial Ready-Mix Concrete Batching & Supply Division',
    phonePrimary: '',
    phoneSecondary: '',
    bankName: 'KOTAK MAHINDRA BANK',
    accountName: 'M/s MOHAMMED JAFAR BASHEER AHMED BILGI',
    accountNo: '9449817122',
    ifscSwift: 'KKBK0008234',
    branch: 'KOTAK MAHINDRA BANK LTD GROUND FLOOR, JALNAGAR, VIJAYAPURA-586101'
  });

  const loadData = async () => {
    try {
      const raw = localStorage.getItem('concrete360_company_profile');
      const backupPhonesRaw = localStorage.getItem('concrete360_company_phones');
      const parsed = raw ? JSON.parse(raw) : {};
      const backupPhones = backupPhonesRaw ? JSON.parse(backupPhonesRaw) : {};

      const initialPrimary =
        parsed.phonePrimary ||
        parsed.phone_primary ||
        backupPhones.phonePrimary ||
        '';
      const initialSecondary =
        parsed.phoneSecondary ||
        parsed.phone_secondary ||
        backupPhones.phoneSecondary ||
        '';

      setCompanyData(prev => ({
        ...prev,
        ...parsed,
        phonePrimary: initialPrimary || prev.phonePrimary,
        phoneSecondary: initialSecondary || prev.phoneSecondary
      }));

      if (supabase) {
        const { data } = await (supabase as any)
          .from('company_profile')
          .select('*')
          .eq('id', 'primary_company')
          .maybeSingle();

        if (data) {
          const latestBackupRaw = localStorage.getItem('concrete360_company_phones');
          const latestBackup = latestBackupRaw ? JSON.parse(latestBackupRaw) : {};

          const resolvedPrimary =
            data.phone_primary ||
            latestBackup.phonePrimary ||
            initialPrimary ||
            '';
          const resolvedSecondary =
            data.phone_secondary ||
            latestBackup.phoneSecondary ||
            initialSecondary ||
            '';

          const merged = {
            name: data.name || 'BILGI BUILDCON RMC',
            gstin: data.gstin || '',
            address: data.address || '',
            division: data.division || 'Commercial Ready-Mix Concrete Batching & Supply Division',
            phonePrimary: resolvedPrimary,
            phoneSecondary: resolvedSecondary,
            bankName: data.bank_name || '',
            accountName: data.account_name || '',
            accountNo: data.account_no || '',
            ifscSwift: data.ifsc_swift || '',
            branch: data.branch || ''
          };

          setCompanyData(merged);
          localStorage.setItem('concrete360_company_profile', JSON.stringify(merged));
        }
      }
    } catch {}
  };

  useEffect(() => {
    void loadData();

    const onSync = () => void loadData();
    window.addEventListener('concrete360_cloud_synced', onSync);
    window.addEventListener('storage', onSync);
    return () => {
      window.removeEventListener('concrete360_cloud_synced', onSync);
      window.removeEventListener('storage', onSync);
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditCompany) return;

    const cleanedData = {
      ...companyData,
      phonePrimary: companyData.phonePrimary.trim(),
      phoneSecondary: companyData.phoneSecondary.trim()
    };

    try {
      localStorage.setItem('concrete360_company_profile', JSON.stringify(cleanedData));
      localStorage.setItem(
        'concrete360_company_phones',
        JSON.stringify({
          phonePrimary: cleanedData.phonePrimary,
          phoneSecondary: cleanedData.phoneSecondary
        })
      );

      if (supabase) {
        const { error } = await (supabase as any).from('company_profile').upsert(
          {
            id: 'primary_company',
            name: cleanedData.name,
            gstin: cleanedData.gstin,
            address: cleanedData.address,
            division: cleanedData.division,
            phone_primary: cleanedData.phonePrimary || null,
            phone_secondary: cleanedData.phoneSecondary || null,
            bank_name: cleanedData.bankName,
            account_name: cleanedData.accountName,
            account_no: cleanedData.accountNo,
            ifsc_swift: cleanedData.ifscSwift,
            branch: cleanedData.branch,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'id' }
        );

        // Fallback upsert without phone columns if schema migration hasn't been run yet
        if (error) {
          await (supabase as any).from('company_profile').upsert(
            {
              id: 'primary_company',
              name: cleanedData.name,
              gstin: cleanedData.gstin,
              address: cleanedData.address,
              division: cleanedData.division,
              bank_name: cleanedData.bankName,
              account_name: cleanedData.accountName,
              account_no: cleanedData.accountNo,
              ifsc_swift: cleanedData.ifscSwift,
              branch: cleanedData.branch,
              updated_at: new Date().toISOString()
            },
            { onConflict: 'id' }
          );
        }

        await cloudStorage.pullFromCloud();
        localStorage.setItem('concrete360_company_profile', JSON.stringify(cleanedData));
      }

      setCompanyData(cleanedData);
      window.dispatchEvent(new Event('concrete360_company_profile_updated'));
      setSavedSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch {
      setCompanyData(cleanedData);
      setIsEditing(false);
    }
  };

  return (
    <div className="space-y-6 font-sans text-slate-100 w-full max-w-full">
      {/* Top Header & Edit Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2.5 py-0.5 rounded-full">
            CORPORATE PROFILE
          </span>
          <h2 className="text-xl font-black text-white mt-1">Company Details & Tax Identifiers</h2>
        </div>

        {!isEditing && canEditCompany ? (
          <button
            onClick={() => setIsEditing(true)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer transition active:scale-95 shrink-0 font-mono"
          >
            <Edit2 className="w-4 h-4" />
            <span>Edit Company Details</span>
          </button>
        ) : isEditing ? (
          <button
            onClick={() => setIsEditing(false)}
            className="px-5 py-2.5 bg-[#121c2d] hover:bg-[#1a263d] text-slate-300 font-bold text-xs rounded-xl border border-[#1b273d] flex items-center justify-center gap-2 cursor-pointer transition shrink-0 font-mono"
          >
            <X className="w-4 h-4" />
            <span>Cancel</span>
          </button>
        ) : (
          <span className="text-xs text-slate-500">View only</span>
        )}
      </div>

      {savedSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-2xl text-xs font-mono flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>Company profile & bank details successfully updated and synchronized!</span>
        </div>
      )}

      {!isEditing ? (
        <div className="space-y-6">
          {/* Main Card */}
          <div className="bg-[#0b1322] border border-[#1b273d] p-8 rounded-3xl shadow-2xl space-y-6">
            <div className="flex items-center gap-3 border-b border-[#1b273d] pb-4">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">{companyData.name}</h3>
                <p className="text-xs text-slate-400 font-mono">{companyData.division}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
              <div className="p-5 bg-[#070d1a] border border-[#1b273d] rounded-2xl space-y-1 sm:col-span-2">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Corporate GSTIN</span>
                <div className="text-cyan-400 font-extrabold text-sm">{companyData.gstin}</div>
              </div>

              <div className={`p-5 bg-[#070d1a] border border-[#1b273d] rounded-2xl space-y-1 ${!companyData.phoneSecondary ? 'sm:col-span-2' : ''}`}>
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5">
                  <Phone className="w-3 h-3 text-blue-400" />
                  <span>Company Contact Number {companyData.phoneSecondary ? '1' : ''}</span>
                </span>
                <div className="text-white font-bold text-sm">
                  {companyData.phonePrimary || 'Not Added'}
                </div>
              </div>

              {companyData.phoneSecondary && (
                <div className="p-5 bg-[#070d1a] border border-[#1b273d] rounded-2xl space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-blue-400" />
                    <span>Company Contact Number 2</span>
                  </span>
                  <div className="text-white font-bold text-sm">
                    {companyData.phoneSecondary}
                  </div>
                </div>
              )}

              <div className="sm:col-span-2 p-5 bg-[#070d1a] border border-[#1b273d] rounded-2xl space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Corporate Office Address</span>
                <div className="text-white font-medium text-sm">{companyData.address}</div>
              </div>
            </div>
          </div>

          {/* Bank Details Card */}
          <div className="bg-[#0b1322] border border-[#1b273d] p-8 rounded-3xl shadow-2xl space-y-6">
            <div className="flex items-center gap-3 border-b border-[#1b273d] pb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Bank Remittance Details</h3>
                <p className="text-xs text-slate-400 font-mono">Displayed on invoices for customer payments and wire transfers.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
              <div className="p-5 bg-[#070d1a] border border-[#1b273d] rounded-2xl space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Bank Name</span>
                <div className="text-white font-bold text-sm">{companyData.bankName}</div>
              </div>

              <div className="p-5 bg-[#070d1a] border border-[#1b273d] rounded-2xl space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Account Holder Name</span>
                <div className="text-white font-bold text-sm">{companyData.accountName}</div>
              </div>

              <div className="p-5 bg-[#070d1a] border border-[#1b273d] rounded-2xl space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Account Number</span>
                <div className="text-cyan-400 font-extrabold text-sm">{companyData.accountNo}</div>
              </div>

              <div className="p-5 bg-[#070d1a] border border-[#1b273d] rounded-2xl space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">IFSC / Swift Code</span>
                <div className="text-white font-bold text-sm">{companyData.ifscSwift}</div>
              </div>

              <div className="sm:col-span-2 p-5 bg-[#070d1a] border border-[#1b273d] rounded-2xl space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Branch Location</span>
                <div className="text-white font-medium text-sm">{companyData.branch}</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSave} className="bg-[#0b1322] border border-[#1b273d] p-8 rounded-3xl shadow-2xl space-y-5 font-mono text-xs">
          <h3 className="text-sm font-black text-white uppercase tracking-wider font-sans border-b border-[#1b273d] pb-3">
            Edit Corporate Organization Profile & Bank Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold uppercase tracking-wider text-[10px]">Company Name</label>
              <input
                type="text"
                value={companyData.name}
                onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
                className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-white font-bold outline-none focus:border-blue-500"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold uppercase tracking-wider text-[10px]">Corporate GSTIN</label>
              <input
                type="text"
                value={companyData.gstin}
                onChange={(e) => setCompanyData({ ...companyData, gstin: e.target.value })}
                className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-cyan-400 font-bold outline-none focus:border-blue-500"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold uppercase tracking-wider text-[10px]">Company Number 1 (Primary)</label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={companyData.phonePrimary}
                onChange={(e) => setCompanyData({ ...companyData, phonePrimary: e.target.value })}
                className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-white font-bold outline-none focus:border-blue-500"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold uppercase tracking-wider text-[10px]">
                Company Number 2 <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <input
                type="tel"
                placeholder="+91 98765 43211"
                value={companyData.phoneSecondary}
                onChange={(e) => setCompanyData({ ...companyData, phoneSecondary: e.target.value })}
                className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-white font-bold outline-none focus:border-blue-500"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-slate-300 font-bold uppercase tracking-wider text-[10px]">Corporate Office Address</label>
              <input
                type="text"
                value={companyData.address}
                onChange={(e) => setCompanyData({ ...companyData, address: e.target.value })}
                className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-white font-bold outline-none focus:border-blue-500"
                required
              />
            </div>

            <div className="space-y-1.5 pt-4 border-t border-[#1b273d] sm:col-span-2">
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Bank Account Remittance Info</h4>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold uppercase tracking-wider text-[10px]">Bank Name</label>
              <input
                type="text"
                value={companyData.bankName}
                onChange={(e) => setCompanyData({ ...companyData, bankName: e.target.value })}
                className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-white font-bold outline-none focus:border-blue-500"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold uppercase tracking-wider text-[10px]">Account Holder Name</label>
              <input
                type="text"
                value={companyData.accountName}
                onChange={(e) => setCompanyData({ ...companyData, accountName: e.target.value })}
                className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-white font-bold outline-none focus:border-blue-500"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold uppercase tracking-wider text-[10px]">Account Number</label>
              <input
                type="text"
                value={companyData.accountNo}
                onChange={(e) => setCompanyData({ ...companyData, accountNo: e.target.value })}
                className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-cyan-400 font-bold outline-none focus:border-blue-500"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold uppercase tracking-wider text-[10px]">IFSC / Swift Code</label>
              <input
                type="text"
                value={companyData.ifscSwift}
                onChange={(e) => setCompanyData({ ...companyData, ifscSwift: e.target.value })}
                className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-white font-bold outline-none focus:border-blue-500"
                required
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-slate-300 font-bold uppercase tracking-wider text-[10px]">Branch Location</label>
              <input
                type="text"
                value={companyData.branch}
                onChange={(e) => setCompanyData({ ...companyData, branch: e.target.value })}
                className="w-full px-4 py-3 bg-[#070d1a] border border-[#1b273d] rounded-xl text-white font-bold outline-none focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#1b273d]">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-5 py-3 bg-[#070d1a] hover:bg-[#121c2d] text-slate-300 font-bold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 cursor-pointer flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>Save Company Profile</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default CompanyDetailsModule;
