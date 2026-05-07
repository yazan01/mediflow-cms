"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

type Section = "clinic" | "security" | "notifications" | "billing" | "integrations" | "branches";

type Settings = {
  clinicName: string;
  licenseNumber: string;
  phone: string;
  email: string;
  address: string;
  taxId: string;
  currency: string;
  timezone: string;
  taxRate: number;
  invoicePrefix: string;
  paymentTerms: number;
  sessionTimeout: number;
  passwordMinLength: number;
  require2FA: boolean;
  notifApptReminders: boolean;
  notifLabCritical: boolean;
  notifLowStock: boolean;
  notifOverdueInvoice: boolean;
  notifLeave: boolean;
};

type Branch = {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  timezone: string;
  isActive: boolean;
  createdAt: string;
};

const DEFAULT: Settings = {
  clinicName: "", licenseNumber: "", phone: "", email: "", address: "",
  taxId: "", currency: "USD", timezone: "Asia/Amman", taxRate: 7,
  invoicePrefix: "INV", paymentTerms: 30, sessionTimeout: 480,
  passwordMinLength: 8, require2FA: false,
  notifApptReminders: true, notifLabCritical: true, notifLowStock: true,
  notifOverdueInvoice: true, notifLeave: true,
};

const BRANCH_DEFAULT = { name: "", code: "", address: "", phone: "", email: "", timezone: "Asia/Amman" };

export default function SettingsPage() {
  const { t } = useLanguage();
  const [activeSection, setActiveSection] = useState<Section>("clinic");
  const [form, setForm] = useState<Settings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

  // Branches state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchModal, setBranchModal] = useState<"add" | "edit" | null>(null);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchForm, setBranchForm] = useState(BRANCH_DEFAULT);
  const [branchSaving, setBranchSaving] = useState(false);
  const [branchError, setBranchError] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setForm({ ...DEFAULT, ...d }); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeSection === "branches") loadBranches();
  }, [activeSection]);

  function loadBranches() {
    setBranchesLoading(true);
    fetch("/api/branches")
      .then((r) => r.ok ? r.json() : [])
      .then(setBranches)
      .catch(() => setBranches([]))
      .finally(() => setBranchesLoading(false));
  }

  function set<K extends keyof Settings>(key: K, val: Settings[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveStatus("idle");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setSaveStatus(res.ok ? "saved" : "error");
      if (res.ok) setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }

  function openAddBranch() {
    setBranchForm(BRANCH_DEFAULT);
    setEditingBranch(null);
    setBranchError("");
    setBranchModal("add");
  }

  function openEditBranch(b: Branch) {
    setBranchForm({ name: b.name, code: b.code, address: b.address, phone: b.phone, email: b.email, timezone: b.timezone || "Asia/Amman" });
    setEditingBranch(b);
    setBranchError("");
    setBranchModal("edit");
  }

  async function saveBranch() {
    if (!branchForm.name.trim() || !branchForm.code.trim()) {
      setBranchError(t.settings.branchRequired);
      return;
    }
    setBranchSaving(true);
    setBranchError("");
    try {
      const url = branchModal === "edit" && editingBranch ? `/api/branches/${editingBranch.id}` : "/api/branches";
      const method = branchModal === "edit" ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(branchForm),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setBranchError(err.detail || t.settings.branchSaveFailed);
        return;
      }
      setBranchModal(null);
      loadBranches();
    } catch {
      setBranchError(t.settings.networkError);
    } finally {
      setBranchSaving(false);
    }
  }

  async function toggleBranchActive(b: Branch) {
    await fetch(`/api/branches/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !b.isActive }),
    });
    loadBranches();
  }

  const s = t.settings;

  const sections = [
    { key: "clinic",        label: s.clinicProfile,   icon: "local_hospital" },
    { key: "security",      label: s.securityAuth,    icon: "security" },
    { key: "notifications", label: s.notifications,   icon: "notifications" },
    { key: "billing",       label: s.billingConfig,   icon: "payments" },
    { key: "branches",      label: s.branches,        icon: "account_tree" },
    { key: "integrations",  label: s.integrations,    icon: "cable" },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1e]">{s.title}</h1>
          <p className="text-sm text-[#74777f] mt-0.5">{s.subtitle}</p>
        </div>
        {activeSection !== "branches" && (
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 shadow-sm disabled:opacity-60"
          >
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>{s.saving}</>
            ) : saveStatus === "saved" ? (
              <><span className="material-symbols-outlined text-[18px]">check_circle</span>{s.saved}</>
            ) : saveStatus === "error" ? (
              <><span className="material-symbols-outlined text-[18px]">error</span>{s.errorRetry}</>
            ) : (
              <><span className="material-symbols-outlined text-[18px]">save</span>{s.saveChanges}</>
            )}
          </button>
        )}
        {activeSection === "branches" && (
          <button
            onClick={openAddBranch}
            className="flex items-center gap-2 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            {s.addBranch}
          </button>
        )}
      </div>

      <div className="flex gap-6">
        {/* Sidebar nav */}
        <div className="w-56 flex-shrink-0">
          <nav className="bg-white rounded-xl border border-[#e3e2e6] overflow-hidden">
            {sections.map((sec) => (
              <button
                key={sec.key}
                onClick={() => setActiveSection(sec.key as Section)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left text-sm transition-colors border-b border-[#e3e2e6] last:border-b-0 ${
                  activeSection === sec.key
                    ? "bg-[#d3e4ff]/30 text-[#1960a3] font-semibold border-l-4 border-l-[#1960a3]"
                    : "text-[#43474e] hover:bg-[#f4f3f7]"
                }`}
              >
                <span className={`material-symbols-outlined text-[20px] ${activeSection === sec.key ? "text-[#1960a3]" : "text-[#74777f]"}`}>{sec.icon}</span>
                {sec.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6">
          {loading && activeSection !== "branches" ? (
            <div className="bg-white rounded-xl border border-[#e3e2e6] p-12 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {activeSection === "clinic" && (
                <SettingsCard title={s.clinicProfileTitle} desc={s.clinicProfileDesc}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label={s.clinicName}><input className="input-field" value={form.clinicName} onChange={(e) => set("clinicName", e.target.value)} placeholder="Al-Shifa Medical Center" /></Field>
                    <Field label={s.licenseNumber}><input className="input-field" value={form.licenseNumber} onChange={(e) => set("licenseNumber", e.target.value)} placeholder="MH-2024-XXXXX" /></Field>
                    <Field label={s.phone}><input className="input-field" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+962 6 000 0000" /></Field>
                    <Field label={s.email}><input type="email" className="input-field" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="info@clinic.com" /></Field>
                    <Field label={s.address} full><textarea className="input-field resize-none" rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Street address, city, country" /></Field>
                    <Field label={s.taxId}><input className="input-field" value={form.taxId} onChange={(e) => set("taxId", e.target.value)} placeholder="TIN number" /></Field>
                    <Field label={s.currency}>
                      <select className="input-field" value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                        <option value="USD">USD — US Dollar</option>
                        <option value="JOD">JOD — Jordanian Dinar</option>
                        <option value="SAR">SAR — Saudi Riyal</option>
                        <option value="AED">AED — UAE Dirham</option>
                      </select>
                    </Field>
                    <Field label={s.timezone}>
                      <select className="input-field" value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
                        <option value="Asia/Amman">Asia/Amman (GMT+3)</option>
                        <option value="Asia/Riyadh">Asia/Riyadh (GMT+3)</option>
                        <option value="Asia/Dubai">Asia/Dubai (GMT+4)</option>
                        <option value="UTC">UTC</option>
                      </select>
                    </Field>
                  </div>
                </SettingsCard>
              )}

              {activeSection === "security" && (
                <SettingsCard title={s.securityTitle} desc={s.securityDesc}>
                  <div className="space-y-5">
                    <Toggle label={s.twoFactor} desc={s.twoFactorDesc} checked={form.require2FA} onChange={(v) => set("require2FA", v)} />
                    <Toggle label={s.accountLockout} desc={s.accountLockoutDesc} checked defaultChecked />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                      <Field label={s.sessionTimeout}><input type="number" className="input-field" value={form.sessionTimeout} min={5} max={480} onChange={(e) => set("sessionTimeout", Number(e.target.value))} /></Field>
                      <Field label={s.passwordMinLength}><input type="number" className="input-field" value={form.passwordMinLength} min={8} max={32} onChange={(e) => set("passwordMinLength", Number(e.target.value))} /></Field>
                    </div>
                  </div>
                </SettingsCard>
              )}

              {activeSection === "notifications" && (
                <SettingsCard title={s.notificationsTitle} desc={s.notificationsDesc}>
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <Field label={s.smsGateway}><select className="input-field"><option value="">{s.notConfigured}</option><option>Twilio</option><option>Local Gateway</option><option>Infobip</option></select></Field>
                      <Field label={s.smsApiKey}><input type="password" className="input-field" placeholder={s.enterApiKey} /></Field>
                      <Field label={s.emailProvider}><select className="input-field"><option>SMTP</option><option>SendGrid</option><option>Mailgun</option></select></Field>
                      <Field label={s.smtpHost}><input className="input-field" placeholder="smtp.example.com" /></Field>
                    </div>
                    <div className="pt-2 space-y-4">
                      <h3 className="text-sm font-semibold text-[#43474e] uppercase tracking-wider">{s.notifTriggers}</h3>
                      <Toggle label={s.apptReminders} desc={s.apptRemindersDesc} checked={form.notifApptReminders} onChange={(v) => set("notifApptReminders", v)} />
                      <Toggle label={s.labCritical} desc={s.labCriticalDesc} checked={form.notifLabCritical} onChange={(v) => set("notifLabCritical", v)} />
                      <Toggle label={s.lowStockAlert} desc={s.lowStockAlertDesc} checked={form.notifLowStock} onChange={(v) => set("notifLowStock", v)} />
                      <Toggle label={s.overdueInvoice} desc={s.overdueInvoiceDesc} checked={form.notifOverdueInvoice} onChange={(v) => set("notifOverdueInvoice", v)} />
                      <Toggle label={s.leaveNotif} desc={s.leaveNotifDesc} checked={form.notifLeave} onChange={(v) => set("notifLeave", v)} />
                    </div>
                  </div>
                </SettingsCard>
              )}

              {activeSection === "billing" && (
                <SettingsCard title={s.billingTitle} desc={s.billingDesc}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label={s.taxRate}><input type="number" className="input-field" value={form.taxRate} min={0} max={100} step={0.5} onChange={(e) => set("taxRate", Number(e.target.value))} /></Field>
                    <Field label={s.invoicePrefix}><input className="input-field" value={form.invoicePrefix} onChange={(e) => set("invoicePrefix", e.target.value)} /></Field>
                    <Field label={s.paymentTerms}><input type="number" className="input-field" value={form.paymentTerms} onChange={(e) => set("paymentTerms", Number(e.target.value))} /></Field>
                  </div>
                  <div className="pt-4 space-y-4">
                    <h3 className="text-sm font-semibold text-[#43474e] uppercase tracking-wider">{s.paymentMethods}</h3>
                    <Toggle label={s.cash} defaultChecked />
                    <Toggle label={s.card} defaultChecked />
                    <Toggle label={s.insurance} defaultChecked />
                    <Toggle label={s.bankTransfer} defaultChecked />
                    <Toggle label={s.mobilePayment} />
                  </div>
                </SettingsCard>
              )}

              {activeSection === "branches" && (
                <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
                  <div className="p-5 border-b border-[#e3e2e6]">
                    <h2 className="text-base font-semibold text-[#1a1c1e]">{s.branchesTitle}</h2>
                    <p className="text-xs text-[#74777f] mt-0.5">{s.branchesDesc}</p>
                  </div>
                  {branchesLoading ? (
                    <div className="p-12 flex items-center justify-center">
                      <div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin"></div>
                    </div>
                  ) : branches.length === 0 ? (
                    <div className="p-12 flex flex-col items-center gap-3">
                      <span className="material-symbols-outlined text-[48px] text-[#c4c6cf]">account_tree</span>
                      <p className="text-sm font-semibold text-[#43474e]">{s.noBranches}</p>
                      <p className="text-xs text-[#74777f]">{s.noBranchesDesc}</p>
                      <button onClick={openAddBranch} className="mt-2 btn-primary text-sm px-4 py-2">
                        <span className="material-symbols-outlined text-[16px]">add</span>
                        {s.addBranch}
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[#f8f7fb]">
                            <th className="table-header">{s.branchName}</th>
                            <th className="table-header">{s.branchCode}</th>
                            <th className="table-header">{s.branchPhone}</th>
                            <th className="table-header">{s.branchEmail}</th>
                            <th className="table-header">{s.branchTimezone}</th>
                            <th className="table-header">{t.common.status}</th>
                            <th className="table-header">{t.common.actions}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {branches.map((b) => (
                            <tr key={b.id} className="table-row">
                              <td className="table-cell">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-lg bg-[#d3e4ff] flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[#1960a3] text-[16px]">account_tree</span>
                                  </div>
                                  <div>
                                    <p className="font-medium text-[#1a1c1e]">{b.name}</p>
                                    {b.address && <p className="text-xs text-[#74777f] truncate max-w-[180px]">{b.address}</p>}
                                  </div>
                                </div>
                              </td>
                              <td className="table-cell"><span className="font-mono text-xs bg-[#f4f3f7] px-2 py-0.5 rounded">{b.code}</span></td>
                              <td className="table-cell text-[#74777f]">{b.phone || "—"}</td>
                              <td className="table-cell text-[#74777f]">{b.email || "—"}</td>
                              <td className="table-cell text-[#74777f] text-xs">{b.timezone || "—"}</td>
                              <td className="table-cell">
                                <span className={`badge ${b.isActive ? "bg-[#ccfbf1] text-[#0d9488]" : "bg-[#f4f3f7] text-[#74777f]"}`}>
                                  {b.isActive ? s.branchActive : s.branchInactive}
                                </span>
                              </td>
                              <td className="table-cell">
                                <div className="flex items-center gap-1">
                                  <button onClick={() => openEditBranch(b)} className="p-1.5 hover:bg-[#f4f3f7] rounded-lg transition-colors" title={s.editBranch}>
                                    <span className="material-symbols-outlined text-[#74777f] text-[16px]">edit</span>
                                  </button>
                                  <button onClick={() => toggleBranchActive(b)} className="p-1.5 hover:bg-[#f4f3f7] rounded-lg transition-colors" title={b.isActive ? s.deactivateBranch : s.activateBranch}>
                                    <span className={`material-symbols-outlined text-[16px] ${b.isActive ? "text-[#d97706]" : "text-[#0d9488]"}`}>{b.isActive ? "toggle_off" : "toggle_on"}</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeSection === "integrations" && (
                <div className="space-y-4">
                  {[
                    { icon: "sms",               label: s.smsGatewayLabel,      desc: s.smsGatewayDesc,      status: s.notConfigured, ok: false },
                    { icon: "email",              label: s.emailServerLabel,     desc: s.emailServerDesc,     status: s.notConfigured, ok: false },
                    { icon: "payments",           label: s.paymentGatewayLabel,  desc: s.paymentGatewayDesc,  status: s.notConfigured, ok: false },
                    { icon: "health_and_safety",  label: s.insurancePortalLabel, desc: s.insurancePortalDesc, status: s.phase2,        ok: null },
                    { icon: "biotech",            label: s.labAnalyzersLabel,    desc: s.labAnalyzersDesc,    status: s.phase2,        ok: null },
                    { icon: "image_search",       label: s.pacsLabel,            desc: s.pacsDesc,            status: s.phase3,        ok: null },
                  ].map((intg) => (
                    <div key={intg.label} className="bg-white rounded-xl border border-[#e3e2e6] p-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-[#f4f3f7] rounded-xl"><span className="material-symbols-outlined text-[#74777f] text-[22px]">{intg.icon}</span></div>
                        <div>
                          <p className="text-sm font-semibold text-[#1a1c1e]">{intg.label}</p>
                          <p className="text-xs text-[#74777f]">{intg.desc}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-semibold ${intg.ok === false ? "text-[#d97706]" : "text-[#74777f]"}`}>{intg.status}</span>
                        <button className="flex items-center gap-1 border border-[#c4c6cf] bg-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#f4f3f7] transition-colors">
                          <span className="material-symbols-outlined text-[14px]">settings</span>
                          {s.configure}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Branch Modal */}
      {branchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setBranchModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-[#e3e2e6]">
              <h2 className="text-lg font-bold text-[#1a1c1e]">
                {branchModal === "add" ? s.addBranch : s.editBranch}
              </h2>
              <button onClick={() => setBranchModal(null)} className="p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors">
                <span className="material-symbols-outlined text-[#74777f]">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {branchError && (
                <div className="bg-[#ffdad6] text-[#ba1a1a] text-sm px-4 py-2.5 rounded-lg">{branchError}</div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.branchName} *</label>
                  <input className="input-field" placeholder="Main Branch" value={branchForm.name} onChange={(e) => setBranchForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.branchCode} *</label>
                  <input className="input-field font-mono" placeholder="MAIN" value={branchForm.code} onChange={(e) => setBranchForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
                  <p className="text-xs text-[#74777f] mt-1">{s.branchCodeHint}</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.branchPhone}</label>
                  <input className="input-field" placeholder="+962 6 000 0000" value={branchForm.phone} onChange={(e) => setBranchForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.branchEmail}</label>
                  <input type="email" className="input-field" placeholder="branch@clinic.com" value={branchForm.email} onChange={(e) => setBranchForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.branchAddress}</label>
                  <textarea className="input-field resize-none" rows={2} placeholder="Street, City, Country" value={branchForm.address} onChange={(e) => setBranchForm(f => ({ ...f, address: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.branchTimezone}</label>
                  <select className="input-field" value={branchForm.timezone} onChange={(e) => setBranchForm(f => ({ ...f, timezone: e.target.value }))}>
                    <option value="Asia/Amman">Asia/Amman (GMT+3)</option>
                    <option value="Asia/Riyadh">Asia/Riyadh (GMT+3)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GMT+4)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#e3e2e6]">
              <button onClick={() => setBranchModal(null)} className="btn-secondary px-4 py-2 text-sm">{t.common.cancel}</button>
              <button onClick={saveBranch} disabled={branchSaving} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
                {branchSaving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"></span> : t.common.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsCard({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
      <div className="mb-5 pb-4 border-b border-[#e3e2e6]">
        <h2 className="text-base font-semibold text-[#1a1c1e]">{title}</h2>
        <p className="text-xs text-[#74777f] mt-0.5">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Toggle({
  label, desc, checked, onChange, defaultChecked,
}: {
  label: string; desc?: string;
  checked?: boolean; onChange?: (v: boolean) => void;
  defaultChecked?: boolean;
}) {
  const [localChecked, setLocalChecked] = useState(defaultChecked ?? false);
  const isControlled = checked !== undefined;
  const isOn = isControlled ? checked : localChecked;

  function toggle() {
    if (isControlled) onChange?.(!checked);
    else setLocalChecked((v) => !v);
  }

  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-[#1a1c1e]">{label}</p>
        {desc && <p className="text-xs text-[#74777f]">{desc}</p>}
      </div>
      <button
        onClick={toggle}
        className={`relative w-11 h-6 rounded-full transition-colors ${isOn ? "bg-[#002045]" : "bg-[#c4c6cf]"}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isOn ? "translate-x-5" : "translate-x-0.5"}`}></span>
      </button>
    </div>
  );
}
