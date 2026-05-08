"use client";

import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

type Section = "clinic" | "security" | "notifications" | "billing" | "branches" | "clinics" | "smtp" | "integrations" | "history";

type Settings = {
  clinicName: string; licenseNumber: string; phone: string; email: string;
  address: string; taxId: string; currency: string; timezone: string;
  taxRate: number; invoicePrefix: string; paymentTerms: number;
  sessionTimeout: number; passwordMinLength: number; require2FA: boolean;
  notifApptReminders: boolean; notifLabCritical: boolean; notifLowStock: boolean;
  notifOverdueInvoice: boolean; notifLeave: boolean;
};

type Branch = {
  id: string; name: string; code: string; description: string;
  country: string; city: string; address: string; phone: string;
  email: string; timezone: string; isActive: boolean; createdAt: string;
};

type BranchSetting = {
  currency: string; timezone: string; taxRate: number; invoicePrefix: string;
  paymentTerms: number; language: string; workingHoursStart: string;
  workingHoursEnd: string; workingDays: number[]; emergencyContact: string;
};

type ClinicRow = {
  id: string; branchId: string; name: string; code: string;
  description: string; clinicType: string; colorTheme: string;
  capacity: number; apptDurationMin: number; queueEnabled: boolean;
  onlineBooking: boolean; status: string; sortOrder: number;
};

type SmtpForm = {
  host: string; port: number; useTLS: boolean; username: string;
  password: string; fromName: string; fromEmail: string; isActive: boolean;
};

type HistoryEntry = {
  id: string; field: string; category: string;
  oldValue: string; newValue: string; changedAt: string; changedBy: string;
};

const DEFAULT_SETTINGS: Settings = {
  clinicName: "", licenseNumber: "", phone: "", email: "", address: "",
  taxId: "", currency: "USD", timezone: "Asia/Amman", taxRate: 7,
  invoicePrefix: "INV", paymentTerms: 30, sessionTimeout: 480,
  passwordMinLength: 8, require2FA: false,
  notifApptReminders: true, notifLabCritical: true, notifLowStock: true,
  notifOverdueInvoice: true, notifLeave: true,
};

const DEFAULT_BRANCH_FORM = { name: "", code: "", description: "", country: "", city: "", address: "", phone: "", email: "", timezone: "Asia/Amman" };

const DEFAULT_SMTP: SmtpForm = { host: "", port: 587, useTLS: true, username: "", password: "", fromName: "", fromEmail: "", isActive: false };

const DEFAULT_BRANCH_SETTING: BranchSetting = {
  currency: "USD", timezone: "Asia/Amman", taxRate: 0, invoicePrefix: "INV",
  paymentTerms: 30, language: "en", workingHoursStart: "08:00",
  workingHoursEnd: "17:00", workingDays: [0, 1, 2, 3, 4], emergencyContact: "",
};

const CLINIC_TYPES = ["general", "dental", "radiology", "laboratory", "dermatology", "cardiology", "orthopedics", "pediatrics", "ophthalmology", "other"];
const DAY_KEYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function SettingsPage() {
  const { t } = useLanguage();
  const s = t.settings;

  const [activeSection, setActiveSection] = useState<Section>("clinic");
  const [form, setForm] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

  // Branches
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchModal, setBranchModal] = useState<"add" | "edit" | null>(null);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchForm, setBranchForm] = useState(DEFAULT_BRANCH_FORM);
  const [branchSaving, setBranchSaving] = useState(false);
  const [branchError, setBranchError] = useState("");

  // Branch settings inline panel
  const [branchSettingsId, setBranchSettingsId] = useState<string | null>(null);
  const [branchSetting, setBranchSetting] = useState<BranchSetting>(DEFAULT_BRANCH_SETTING);
  const [branchSettingLoading, setBranchSettingLoading] = useState(false);
  const [branchSettingSaving, setBranchSettingSaving] = useState(false);
  const [branchSettingStatus, setBranchSettingStatus] = useState<"idle" | "saved" | "error">("idle");

  // Clinics
  const [clinicBranchId, setClinicBranchId] = useState<string>("");
  const [clinics, setClinics] = useState<ClinicRow[]>([]);
  const [clinicsLoading, setClinicsLoading] = useState(false);
  const [clinicModal, setClinicModal] = useState<"add" | "edit" | null>(null);
  const [editingClinic, setEditingClinic] = useState<ClinicRow | null>(null);
  const [clinicForm, setClinicForm] = useState({ name: "", code: "", description: "", clinicType: "general", colorTheme: "#1960a3", capacity: 10, apptDurationMin: 20, queueEnabled: true, onlineBooking: true });
  const [clinicSaving, setClinicSaving] = useState(false);
  const [clinicError, setClinicError] = useState("");

  // SMTP
  const [smtp, setSmtp] = useState<SmtpForm>(DEFAULT_SMTP);
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState<"idle" | "saved" | "error">("idle");
  const [smtpTestEmail, setSmtpTestEmail] = useState("");
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpTestMsg, setSmtpTestMsg] = useState("");

  // History
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── Loaders ──────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setForm({ ...DEFAULT_SETTINGS, ...d }); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadBranches = useCallback(() => {
    setBranchesLoading(true);
    fetch("/api/branches")
      .then((r) => r.ok ? r.json() : [])
      .then((data: Branch[]) => {
        setBranches(data);
        if (data.length > 0 && !clinicBranchId) setClinicBranchId(data[0].id);
      })
      .catch(() => setBranches([]))
      .finally(() => setBranchesLoading(false));
  }, [clinicBranchId]);

  useEffect(() => {
    if (activeSection === "branches" || activeSection === "clinics") loadBranches();
    if (activeSection === "smtp") loadSmtp();
    if (activeSection === "history") loadHistory();
  }, [activeSection]);

  useEffect(() => {
    if (activeSection === "clinics" && clinicBranchId) loadClinics(clinicBranchId);
  }, [activeSection, clinicBranchId]);

  function loadSmtp() {
    setSmtpLoading(true);
    fetch("/api/settings/smtp")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setSmtp({ ...DEFAULT_SMTP, ...d, password: "" }); })
      .catch(() => {})
      .finally(() => setSmtpLoading(false));
  }

  function loadHistory() {
    setHistoryLoading(true);
    fetch("/api/settings/history")
      .then((r) => r.ok ? r.json() : [])
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }

  function loadClinics(branchId: string) {
    setClinicsLoading(true);
    fetch(`/api/branches/${branchId}/clinics`)
      .then((r) => r.ok ? r.json() : [])
      .then(setClinics)
      .catch(() => setClinics([]))
      .finally(() => setClinicsLoading(false));
  }

  function loadBranchSetting(branchId: string) {
    setBranchSettingLoading(true);
    fetch(`/api/branches/${branchId}/settings`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setBranchSetting({ ...DEFAULT_BRANCH_SETTING, ...d }); })
      .catch(() => {})
      .finally(() => setBranchSettingLoading(false));
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  function set<K extends keyof Settings>(key: K, val: Settings[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSave() {
    setSaving(true); setSaveStatus("idle");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setSaveStatus(res.ok ? "saved" : "error");
      if (res.ok) setTimeout(() => setSaveStatus("idle"), 3000);
    } catch { setSaveStatus("error"); }
    finally { setSaving(false); }
  }

  function openAddBranch() {
    setBranchForm(DEFAULT_BRANCH_FORM);
    setEditingBranch(null); setBranchError(""); setBranchModal("add");
  }
  function openEditBranch(b: Branch) {
    setBranchForm({ name: b.name, code: b.code, description: b.description || "", country: b.country || "", city: b.city || "", address: b.address, phone: b.phone, email: b.email, timezone: b.timezone || "Asia/Amman" });
    setEditingBranch(b); setBranchError(""); setBranchModal("edit");
  }

  async function saveBranch() {
    if (!branchForm.name.trim() || !branchForm.code.trim()) { setBranchError(s.branchRequired); return; }
    setBranchSaving(true); setBranchError("");
    try {
      const url = branchModal === "edit" && editingBranch ? `/api/branches/${editingBranch.id}` : "/api/branches";
      const method = branchModal === "edit" ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(branchForm) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); setBranchError(err.detail || s.branchSaveFailed); return; }
      setBranchModal(null); loadBranches();
    } catch { setBranchError(s.networkError); }
    finally { setBranchSaving(false); }
  }

  async function toggleBranchActive(b: Branch) {
    await fetch(`/api/branches/${b.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !b.isActive }) });
    loadBranches();
  }

  function openBranchSettings(branchId: string) {
    setBranchSettingsId(branchId); loadBranchSetting(branchId);
  }

  async function saveBranchSetting() {
    if (!branchSettingsId) return;
    setBranchSettingSaving(true); setBranchSettingStatus("idle");
    try {
      const res = await fetch(`/api/branches/${branchSettingsId}/settings`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(branchSetting),
      });
      setBranchSettingStatus(res.ok ? "saved" : "error");
      if (res.ok) setTimeout(() => setBranchSettingStatus("idle"), 3000);
    } catch { setBranchSettingStatus("error"); }
    finally { setBranchSettingSaving(false); }
  }

  function openAddClinic() {
    setClinicForm({ name: "", code: "", description: "", clinicType: "general", colorTheme: "#1960a3", capacity: 10, apptDurationMin: 20, queueEnabled: true, onlineBooking: true });
    setEditingClinic(null); setClinicError(""); setClinicModal("add");
  }
  function openEditClinic(c: ClinicRow) {
    setClinicForm({ name: c.name, code: c.code, description: c.description || "", clinicType: c.clinicType, colorTheme: c.colorTheme, capacity: c.capacity, apptDurationMin: c.apptDurationMin, queueEnabled: c.queueEnabled, onlineBooking: c.onlineBooking });
    setEditingClinic(c); setClinicError(""); setClinicModal("edit");
  }

  async function saveClinic() {
    if (!clinicForm.name.trim() || !clinicForm.code.trim()) { setClinicError(s.clinicRequired); return; }
    setClinicSaving(true); setClinicError("");
    try {
      const url = clinicModal === "edit" && editingClinic ? `/api/clinics/${editingClinic.id}` : `/api/branches/${clinicBranchId}/clinics`;
      const method = clinicModal === "edit" ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(clinicForm) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); setClinicError(err.detail || s.clinicSaveFailed); return; }
      setClinicModal(null); loadClinics(clinicBranchId);
    } catch { setClinicError(s.networkError); }
    finally { setClinicSaving(false); }
  }

  async function toggleClinicStatus(c: ClinicRow) {
    const newStatus = c.status === "active" ? "inactive" : "active";
    await fetch(`/api/clinics/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
    loadClinics(clinicBranchId);
  }

  async function handleSmtpSave() {
    setSmtpSaving(true); setSmtpStatus("idle");
    const body: Record<string, unknown> = { ...smtp };
    if (!body.password) delete body.password;
    try {
      const res = await fetch("/api/settings/smtp", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setSmtpStatus(res.ok ? "saved" : "error");
      if (res.ok) setTimeout(() => setSmtpStatus("idle"), 3000);
    } catch { setSmtpStatus("error"); }
    finally { setSmtpSaving(false); }
  }

  async function handleSmtpTest() {
    if (!smtpTestEmail.trim()) return;
    setSmtpTesting(true); setSmtpTestMsg("");
    try {
      const res = await fetch("/api/settings/smtp/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toEmail: smtpTestEmail }) });
      setSmtpTestMsg(res.ok ? s.smtpTestSuccess : s.smtpTestFailed);
    } catch { setSmtpTestMsg(s.smtpTestFailed); }
    finally { setSmtpTesting(false); }
  }

  // ── Nav sections ─────────────────────────────────────────────────────────

  const sections = [
    { key: "clinic",        label: s.clinicProfile,   icon: "local_hospital" },
    { key: "security",      label: s.securityAuth,    icon: "security" },
    { key: "notifications", label: s.notifications,   icon: "notifications" },
    { key: "billing",       label: s.billingConfig,   icon: "payments" },
    { key: "branches",      label: s.branches,        icon: "account_tree" },
    { key: "clinics",       label: s.clinics,         icon: "medical_services" },
    { key: "smtp",          label: s.smtpConfig,      icon: "email" },
    { key: "integrations",  label: s.integrations,    icon: "cable" },
    { key: "history",       label: s.settingsHistory, icon: "history" },
  ] as const;

  const showGlobalSave = !["branches", "clinics", "smtp", "integrations", "history"].includes(activeSection);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1e]">{s.title}</h1>
          <p className="text-sm text-[#74777f] mt-0.5">{s.subtitle}</p>
        </div>
        {showGlobalSave && (
          <button onClick={handleSave} disabled={saving || loading}
            className="flex items-center gap-2 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 shadow-sm disabled:opacity-60">
            {saving
              ? <><Spinner />{s.saving}</>
              : saveStatus === "saved"
                ? <><span className="material-symbols-outlined text-[18px]">check_circle</span>{s.saved}</>
                : saveStatus === "error"
                  ? <><span className="material-symbols-outlined text-[18px]">error</span>{s.errorRetry}</>
                  : <><span className="material-symbols-outlined text-[18px]">save</span>{s.saveChanges}</>}
          </button>
        )}
        {activeSection === "branches" && (
          <button onClick={openAddBranch} className="flex items-center gap-2 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 shadow-sm">
            <span className="material-symbols-outlined text-[18px]">add</span>{s.addBranch}
          </button>
        )}
        {activeSection === "clinics" && (
          <button onClick={openAddClinic} disabled={!clinicBranchId} className="flex items-center gap-2 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 shadow-sm disabled:opacity-40">
            <span className="material-symbols-outlined text-[18px]">add</span>{s.addClinic}
          </button>
        )}
      </div>

      <div className="flex gap-6">
        {/* Sidebar nav */}
        <div className="w-56 flex-shrink-0">
          <nav className="bg-white rounded-xl border border-[#e3e2e6] overflow-hidden">
            {sections.map((sec) => (
              <button key={sec.key} onClick={() => setActiveSection(sec.key as Section)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left text-sm transition-colors border-b border-[#e3e2e6] last:border-b-0 ${
                  activeSection === sec.key
                    ? "bg-[#d3e4ff]/30 text-[#1960a3] font-semibold border-s-4 border-s-[#1960a3]"
                    : "text-[#43474e] hover:bg-[#f4f3f7]"
                }`}>
                <span className={`material-symbols-outlined text-[20px] ${activeSection === sec.key ? "text-[#1960a3]" : "text-[#74777f]"}`}>{sec.icon}</span>
                {sec.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-6">
          {loading && showGlobalSave ? (
            <div className="bg-white rounded-xl border border-[#e3e2e6] p-12 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {/* ── Clinic Profile ── */}
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
                      <select className="select-field" value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                        <option value="USD">USD — US Dollar</option>
                        <option value="JOD">JOD — Jordanian Dinar</option>
                        <option value="SAR">SAR — Saudi Riyal</option>
                        <option value="AED">AED — UAE Dirham</option>
                        <option value="KWD">KWD — Kuwaiti Dinar</option>
                        <option value="EGP">EGP — Egyptian Pound</option>
                      </select>
                    </Field>
                    <Field label={s.timezone}>
                      <select className="select-field" value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
                        <option value="Asia/Amman">Asia/Amman (GMT+3)</option>
                        <option value="Asia/Riyadh">Asia/Riyadh (GMT+3)</option>
                        <option value="Asia/Dubai">Asia/Dubai (GMT+4)</option>
                        <option value="Asia/Kuwait">Asia/Kuwait (GMT+3)</option>
                        <option value="Africa/Cairo">Africa/Cairo (GMT+2)</option>
                        <option value="UTC">UTC</option>
                      </select>
                    </Field>
                  </div>
                </SettingsCard>
              )}

              {/* ── Security ── */}
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

              {/* ── Notifications ── */}
              {activeSection === "notifications" && (
                <SettingsCard title={s.notificationsTitle} desc={s.notificationsDesc}>
                  <div className="space-y-5">
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

              {/* ── Billing ── */}
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

              {/* ── Branches ── */}
              {activeSection === "branches" && (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
                    <div className="p-5 border-b border-[#e3e2e6]">
                      <h2 className="text-base font-semibold text-[#1a1c1e]">{s.branchesTitle}</h2>
                      <p className="text-xs text-[#74777f] mt-0.5">{s.branchesDesc}</p>
                    </div>
                    {branchesLoading ? (
                      <div className="p-12 flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" /></div>
                    ) : branches.length === 0 ? (
                      <div className="p-12 flex flex-col items-center gap-3">
                        <span className="material-symbols-outlined text-[48px] text-[#c4c6cf]">account_tree</span>
                        <p className="text-sm font-semibold text-[#43474e]">{s.noBranches}</p>
                        <p className="text-xs text-[#74777f]">{s.noBranchesDesc}</p>
                        <button onClick={openAddBranch} className="mt-2 btn-primary text-sm px-4 py-2">
                          <span className="material-symbols-outlined text-[16px]">add</span>{s.addBranch}
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
                              <th className="table-header">{s.branchCity}</th>
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
                                      {b.description && <p className="text-xs text-[#74777f] truncate max-w-[200px]">{b.description}</p>}
                                    </div>
                                  </div>
                                </td>
                                <td className="table-cell"><span className="font-mono text-xs bg-[#f4f3f7] px-2 py-0.5 rounded">{b.code}</span></td>
                                <td className="table-cell text-[#74777f]">{b.phone || "—"}</td>
                                <td className="table-cell text-[#74777f] text-xs">{[b.city, b.country].filter(Boolean).join(", ") || "—"}</td>
                                <td className="table-cell">
                                  <span className={`badge ${b.isActive ? "bg-[#ccfbf1] text-[#0d9488]" : "bg-[#f4f3f7] text-[#74777f]"}`}>
                                    {b.isActive ? s.branchActive : s.branchInactive}
                                  </span>
                                </td>
                                <td className="table-cell">
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => openEditBranch(b)} className="p-1.5 hover:bg-[#f4f3f7] rounded-lg" aria-label={s.editBranch} title={s.editBranch}>
                                      <span className="material-symbols-outlined text-[#74777f] text-[16px]">edit</span>
                                    </button>
                                    <button onClick={() => openBranchSettings(branchSettingsId === b.id ? null! : b.id)} className="p-1.5 hover:bg-[#f4f3f7] rounded-lg" aria-label={s.branchSettings} title={s.branchSettings}>
                                      <span className={`material-symbols-outlined text-[16px] ${branchSettingsId === b.id ? "text-[#1960a3]" : "text-[#74777f]"}`}>tune</span>
                                    </button>
                                    <button onClick={() => toggleBranchActive(b)} className="p-1.5 hover:bg-[#f4f3f7] rounded-lg" aria-label={b.isActive ? s.deactivateBranch : s.activateBranch} title={b.isActive ? s.deactivateBranch : s.activateBranch}>
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

                  {/* Branch settings inline panel */}
                  {branchSettingsId && (
                    <div className="bg-white rounded-xl border border-[#1960a3]/30 shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-6">
                      <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#e3e2e6]">
                        <div>
                          <h3 className="text-base font-semibold text-[#1a1c1e]">{s.branchSettings}</h3>
                          <p className="text-xs text-[#74777f] mt-0.5">{s.branchSettingsDesc}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {branchSettingStatus === "saved" && <span className="text-xs text-[#0d9488] font-semibold">{s.branchSettingsSaved}</span>}
                          {branchSettingStatus === "error" && <span className="text-xs text-[#ba1a1a] font-semibold">{s.branchSettingsFailed}</span>}
                          <button onClick={saveBranchSetting} disabled={branchSettingSaving}
                            className="btn-primary text-sm px-4 py-2 disabled:opacity-60 flex items-center gap-2">
                            {branchSettingSaving ? <Spinner /> : <span className="material-symbols-outlined text-[16px]">save</span>}
                            {t.common.save}
                          </button>
                          <button onClick={() => setBranchSettingsId(null)} className="p-2 hover:bg-[#f4f3f7] rounded-lg" aria-label={t.common.close}>
                            <span className="material-symbols-outlined text-[#74777f]">close</span>
                          </button>
                        </div>
                      </div>
                      {branchSettingLoading ? (
                        <div className="flex items-center justify-center h-20"><div className="w-6 h-6 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" /></div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                          <Field label={s.currency}>
                            <select className="select-field" value={branchSetting.currency} onChange={e => setBranchSetting(f => ({ ...f, currency: e.target.value }))}>
                              {["USD","JOD","SAR","AED","KWD","EGP"].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </Field>
                          <Field label={s.timezone}>
                            <select className="select-field" value={branchSetting.timezone} onChange={e => setBranchSetting(f => ({ ...f, timezone: e.target.value }))}>
                              <option value="Asia/Amman">Asia/Amman</option>
                              <option value="Asia/Riyadh">Asia/Riyadh</option>
                              <option value="Asia/Dubai">Asia/Dubai</option>
                              <option value="Africa/Cairo">Africa/Cairo</option>
                              <option value="UTC">UTC</option>
                            </select>
                          </Field>
                          <Field label={s.taxRate}>
                            <input type="number" className="input-field" value={branchSetting.taxRate} min={0} max={100} step={0.5}
                              onChange={e => setBranchSetting(f => ({ ...f, taxRate: Number(e.target.value) }))} />
                          </Field>
                          <Field label={s.invoicePrefix}>
                            <input className="input-field font-mono" value={branchSetting.invoicePrefix}
                              onChange={e => setBranchSetting(f => ({ ...f, invoicePrefix: e.target.value.toUpperCase() }))} />
                          </Field>
                          <Field label={s.branchWorkingHoursStart}>
                            <input type="time" className="input-field" value={branchSetting.workingHoursStart}
                              onChange={e => setBranchSetting(f => ({ ...f, workingHoursStart: e.target.value }))} />
                          </Field>
                          <Field label={s.branchWorkingHoursEnd}>
                            <input type="time" className="input-field" value={branchSetting.workingHoursEnd}
                              onChange={e => setBranchSetting(f => ({ ...f, workingHoursEnd: e.target.value }))} />
                          </Field>
                          <Field label={s.branchEmergencyContact} full>
                            <input className="input-field" value={branchSetting.emergencyContact} placeholder="+962 6 000 0000"
                              onChange={e => setBranchSetting(f => ({ ...f, emergencyContact: e.target.value }))} />
                          </Field>
                          <div className="md:col-span-3">
                            <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-2">{s.branchWorkingDays}</label>
                            <div className="flex gap-2 flex-wrap">
                              {DAY_KEYS.map((day, i) => {
                                const active = branchSetting.workingDays.includes(i);
                                return (
                                  <button key={i} type="button" onClick={() => setBranchSetting(f => ({
                                    ...f,
                                    workingDays: active ? f.workingDays.filter(d => d !== i) : [...f.workingDays, i].sort(),
                                  }))}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${active ? "bg-[#002045] text-white" : "bg-[#f4f3f7] text-[#74777f] hover:bg-[#e3e2e6]"}`}>
                                    {day}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Clinics ── */}
              {activeSection === "clinics" && (
                <div className="space-y-4">
                  {/* Branch selector */}
                  {branches.length > 1 && (
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-semibold text-[#43474e]">{s.clinicBranch}:</label>
                      <select className="select-field w-56" value={clinicBranchId} onChange={e => { setClinicBranchId(e.target.value); loadClinics(e.target.value); }}>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
                    <div className="p-5 border-b border-[#e3e2e6]">
                      <h2 className="text-base font-semibold text-[#1a1c1e]">{s.clinicsTitle}</h2>
                      <p className="text-xs text-[#74777f] mt-0.5">{s.clinicsDesc}</p>
                    </div>
                    {clinicsLoading ? (
                      <div className="p-12 flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" /></div>
                    ) : !clinicBranchId ? (
                      <div className="p-12 text-center text-sm text-[#74777f]">{s.noBranches}</div>
                    ) : clinics.length === 0 ? (
                      <div className="p-12 flex flex-col items-center gap-3">
                        <span className="material-symbols-outlined text-[48px] text-[#c4c6cf]">medical_services</span>
                        <p className="text-sm font-semibold text-[#43474e]">{s.noClinics}</p>
                        <p className="text-xs text-[#74777f]">{s.noClinicsDesc}</p>
                        <button onClick={openAddClinic} className="mt-2 btn-primary text-sm px-4 py-2">
                          <span className="material-symbols-outlined text-[16px]">add</span>{s.addClinic}
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
                        {clinics.map((c) => (
                          <div key={c.id} className="border border-[#e3e2e6] rounded-xl p-4 relative group hover:border-[#1960a3]/40 transition-colors">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-8 rounded-full" style={{ backgroundColor: c.colorTheme }} />
                                <div>
                                  <p className="text-sm font-semibold text-[#1a1c1e]">{c.name}</p>
                                  <p className="text-xs text-[#74777f]">{c.code} · {c.clinicType}</p>
                                </div>
                              </div>
                              <span className={`badge text-[10px] ${c.status === "active" ? "bg-[#ccfbf1] text-[#0d9488]" : c.status === "maintenance" ? "bg-[#fff7ed] text-[#d97706]" : "bg-[#f4f3f7] text-[#74777f]"}`}>
                                {c.status === "active" ? s.clinicActive : c.status === "maintenance" ? s.clinicMaintenance : s.clinicInactive}
                              </span>
                            </div>
                            {c.description && <p className="text-xs text-[#74777f] mt-2 line-clamp-2">{c.description}</p>}
                            <div className="mt-3 grid grid-cols-2 gap-1 text-[11px] text-[#74777f]">
                              <span><span className="material-symbols-outlined text-[12px] align-middle">group</span> {c.capacity} / day</span>
                              <span><span className="material-symbols-outlined text-[12px] align-middle">schedule</span> {c.apptDurationMin} min</span>
                              {c.queueEnabled && <span><span className="material-symbols-outlined text-[12px] align-middle text-[#0d9488]">queue</span> Queue on</span>}
                              {c.onlineBooking && <span><span className="material-symbols-outlined text-[12px] align-middle text-[#1960a3]">language</span> Online</span>}
                            </div>
                            <div className="mt-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openEditClinic(c)} className="flex-1 btn-secondary text-xs py-1.5">{t.common.edit}</button>
                              <button onClick={() => toggleClinicStatus(c)} className={`flex-1 text-xs py-1.5 rounded-lg font-semibold border transition-colors ${c.status === "active" ? "border-[#d97706] text-[#d97706] hover:bg-[#fff7ed]" : "border-[#0d9488] text-[#0d9488] hover:bg-[#ccfbf1]"}`}>
                                {c.status === "active" ? s.deactivateBranch : s.activateBranch}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── SMTP ── */}
              {activeSection === "smtp" && (
                <SettingsCard title={s.smtpConfigTitle} desc={s.smtpConfigDesc}>
                  {smtpLoading ? (
                    <div className="flex items-center justify-center h-20"><div className="w-6 h-6 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" /></div>
                  ) : (
                    <div className="space-y-6">
                      <Toggle label={s.smtpActive} checked={smtp.isActive} onChange={v => setSmtp(f => ({ ...f, isActive: v }))} />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <Field label={s.smtpHost}>
                          <input className="input-field" value={smtp.host} placeholder="smtp.gmail.com" onChange={e => setSmtp(f => ({ ...f, host: e.target.value }))} />
                        </Field>
                        <Field label={s.smtpPort}>
                          <input type="number" className="input-field" value={smtp.port} min={1} max={65535} onChange={e => setSmtp(f => ({ ...f, port: Number(e.target.value) }))} />
                        </Field>
                        <Field label={s.smtpUsername}>
                          <input className="input-field" value={smtp.username} placeholder="you@gmail.com" onChange={e => setSmtp(f => ({ ...f, username: e.target.value }))} />
                        </Field>
                        <Field label={s.smtpPassword}>
                          <input type="password" className="input-field" value={smtp.password} placeholder={s.smtpPasswordHint} onChange={e => setSmtp(f => ({ ...f, password: e.target.value }))} />
                        </Field>
                        <Field label={s.smtpFromName}>
                          <input className="input-field" value={smtp.fromName} placeholder="MediFlow CMS" onChange={e => setSmtp(f => ({ ...f, fromName: e.target.value }))} />
                        </Field>
                        <Field label={s.smtpFromEmail}>
                          <input type="email" className="input-field" value={smtp.fromEmail} placeholder="noreply@clinic.com" onChange={e => setSmtp(f => ({ ...f, fromEmail: e.target.value }))} />
                        </Field>
                      </div>
                      <Toggle label={s.smtpUseTLS} checked={smtp.useTLS} onChange={v => setSmtp(f => ({ ...f, useTLS: v }))} />

                      {/* Status & Save */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#e3e2e6]">
                        <div className="flex items-center gap-2">
                          {smtpStatus === "saved" && <span className="text-xs text-[#0d9488] font-semibold">{s.smtpSaved}</span>}
                          {smtpStatus === "error" && <span className="text-xs text-[#ba1a1a] font-semibold">{s.smtpSaveFailed}</span>}
                        </div>
                        <button onClick={handleSmtpSave} disabled={smtpSaving}
                          className="btn-primary text-sm px-4 py-2 disabled:opacity-60 flex items-center gap-2">
                          {smtpSaving ? <Spinner /> : <span className="material-symbols-outlined text-[16px]">save</span>}
                          {t.common.save}
                        </button>
                      </div>

                      {/* Test send */}
                      <div className="bg-[#f8f7fb] rounded-xl p-4">
                        <p className="text-sm font-semibold text-[#43474e] mb-3">{s.smtpTest}</p>
                        <div className="flex gap-3">
                          <input type="email" className="input-field flex-1" value={smtpTestEmail} placeholder={s.smtpTestTo} onChange={e => setSmtpTestEmail(e.target.value)} />
                          <button onClick={handleSmtpTest} disabled={smtpTesting || !smtpTestEmail.trim()}
                            className="btn-secondary text-sm px-4 py-2 disabled:opacity-60 flex items-center gap-2 whitespace-nowrap">
                            {smtpTesting ? <Spinner /> : <span className="material-symbols-outlined text-[16px]">send</span>}
                            {s.smtpTest}
                          </button>
                        </div>
                        {smtpTestMsg && (
                          <p className={`text-xs mt-2 font-semibold ${smtpTestMsg === s.smtpTestSuccess ? "text-[#0d9488]" : "text-[#ba1a1a]"}`}>{smtpTestMsg}</p>
                        )}
                      </div>
                    </div>
                  )}
                </SettingsCard>
              )}

              {/* ── Integrations ── */}
              {activeSection === "integrations" && (
                <div className="space-y-4">
                  {[
                    { icon: "chat",              label: s.smsGatewayLabel,      desc: s.smsGatewayDesc,      status: s.notConfigured, ok: false },
                    { icon: "payments",          label: s.paymentGatewayLabel,  desc: s.paymentGatewayDesc,  status: s.notConfigured, ok: false },
                    { icon: "health_and_safety", label: s.insurancePortalLabel, desc: s.insurancePortalDesc, status: s.phase2,        ok: null },
                    { icon: "biotech",           label: s.labAnalyzersLabel,    desc: s.labAnalyzersDesc,    status: s.phase2,        ok: null },
                    { icon: "image_search",      label: s.pacsLabel,            desc: s.pacsDesc,            status: s.phase3,        ok: null },
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
                          <span className="material-symbols-outlined text-[14px]">settings</span>{s.configure}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── History ── */}
              {activeSection === "history" && (
                <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
                  <div className="p-5 border-b border-[#e3e2e6]">
                    <h2 className="text-base font-semibold text-[#1a1c1e]">{s.settingsHistory}</h2>
                    <p className="text-xs text-[#74777f] mt-0.5">{s.settingsHistoryDesc}</p>
                  </div>
                  {historyLoading ? (
                    <div className="p-12 flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" /></div>
                  ) : history.length === 0 ? (
                    <div className="p-12 flex flex-col items-center gap-3">
                      <span className="material-symbols-outlined text-[48px] text-[#c4c6cf]">history</span>
                      <p className="text-sm text-[#74777f]">{s.noHistory}</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[#f8f7fb]">
                            <th className="table-header">{s.historyField}</th>
                            <th className="table-header">{s.historyOld}</th>
                            <th className="table-header">{s.historyNew}</th>
                            <th className="table-header">{s.historyAt}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((h) => (
                            <tr key={h.id} className="table-row">
                              <td className="table-cell"><span className="font-mono text-xs bg-[#f4f3f7] px-2 py-0.5 rounded">{h.field}</span></td>
                              <td className="table-cell text-[#74777f] text-xs max-w-[160px] truncate">{h.oldValue ?? "—"}</td>
                              <td className="table-cell text-[#1a1c1e] text-xs font-medium max-w-[160px] truncate">{h.newValue ?? "—"}</td>
                              <td className="table-cell text-[#74777f] text-xs whitespace-nowrap">{h.changedAt ? new Date(h.changedAt).toLocaleString() : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Branch Modal ── */}
      {branchModal && (
        <div role="dialog" aria-modal="true" aria-labelledby="branch-modal-title" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setBranchModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-[#e3e2e6]">
              <h2 id="branch-modal-title" className="text-lg font-bold text-[#1a1c1e]">{branchModal === "add" ? s.addBranch : s.editBranch}</h2>
              <button onClick={() => setBranchModal(null)} aria-label={t.common.close} className="p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors">
                <span className="material-symbols-outlined text-[#74777f]">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {branchError && <div className="bg-[#ffdad6] text-[#ba1a1a] text-sm px-4 py-2.5 rounded-lg">{branchError}</div>}
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
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.branchCountry}</label>
                  <input className="input-field" placeholder="Jordan" value={branchForm.country} onChange={(e) => setBranchForm(f => ({ ...f, country: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.branchCity}</label>
                  <input className="input-field" placeholder="Amman" value={branchForm.city} onChange={(e) => setBranchForm(f => ({ ...f, city: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.branchEmail}</label>
                  <input type="email" className="input-field" placeholder="branch@clinic.com" value={branchForm.email} onChange={(e) => setBranchForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.branchDescription}</label>
                  <textarea className="input-field resize-none" rows={2} placeholder="Brief description of this branch" value={branchForm.description} onChange={(e) => setBranchForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.branchAddress}</label>
                  <textarea className="input-field resize-none" rows={2} placeholder="Street, City, Country" value={branchForm.address} onChange={(e) => setBranchForm(f => ({ ...f, address: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.branchTimezone}</label>
                  <select className="select-field" value={branchForm.timezone} onChange={(e) => setBranchForm(f => ({ ...f, timezone: e.target.value }))}>
                    <option value="Asia/Amman">Asia/Amman (GMT+3)</option>
                    <option value="Asia/Riyadh">Asia/Riyadh (GMT+3)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GMT+4)</option>
                    <option value="Asia/Kuwait">Asia/Kuwait (GMT+3)</option>
                    <option value="Africa/Cairo">Africa/Cairo (GMT+2)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#e3e2e6]">
              <button onClick={() => setBranchModal(null)} className="btn-secondary px-4 py-2 text-sm">{t.common.cancel}</button>
              <button onClick={saveBranch} disabled={branchSaving} className="btn-primary px-4 py-2 text-sm disabled:opacity-60 flex items-center gap-2">
                {branchSaving ? <Spinner /> : null}{t.common.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Clinic Modal ── */}
      {clinicModal && (
        <div role="dialog" aria-modal="true" aria-labelledby="clinic-modal-title" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setClinicModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-[#e3e2e6]">
              <h2 id="clinic-modal-title" className="text-lg font-bold text-[#1a1c1e]">{clinicModal === "add" ? s.addClinic : s.editClinic}</h2>
              <button onClick={() => setClinicModal(null)} aria-label={t.common.close} className="p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors">
                <span className="material-symbols-outlined text-[#74777f]">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {clinicError && <div className="bg-[#ffdad6] text-[#ba1a1a] text-sm px-4 py-2.5 rounded-lg">{clinicError}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.clinicName} *</label>
                  <input className="input-field" placeholder="General Practice" value={clinicForm.name} onChange={e => setClinicForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.clinicCode} *</label>
                  <input className="input-field font-mono" placeholder="GEN" value={clinicForm.code} onChange={e => setClinicForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
                  <p className="text-xs text-[#74777f] mt-1">{s.clinicCodeHint}</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.clinicType}</label>
                  <select className="select-field" value={clinicForm.clinicType} onChange={e => setClinicForm(f => ({ ...f, clinicType: e.target.value }))}>
                    {CLINIC_TYPES.map(t => <option key={t} value={t}>{(s.clinicTypes as Record<string, string>)[t] || t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.clinicCapacity}</label>
                  <input type="number" className="input-field" value={clinicForm.capacity} min={1} max={500} onChange={e => setClinicForm(f => ({ ...f, capacity: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.clinicApptDuration}</label>
                  <input type="number" className="input-field" value={clinicForm.apptDurationMin} min={5} max={180} onChange={e => setClinicForm(f => ({ ...f, apptDurationMin: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.clinicColor}</label>
                  <div className="flex items-center gap-2">
                    <input type="color" className="w-10 h-10 rounded-lg border border-[#c4c6cf] cursor-pointer" value={clinicForm.colorTheme} onChange={e => setClinicForm(f => ({ ...f, colorTheme: e.target.value }))} />
                    <span className="text-xs text-[#74777f] font-mono">{clinicForm.colorTheme}</span>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.branchDescription}</label>
                  <textarea className="input-field resize-none" rows={2} value={clinicForm.description} onChange={e => setClinicForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="col-span-2 space-y-3 pt-2 border-t border-[#e3e2e6]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[#1a1c1e]">{s.clinicQueue}</span>
                    <button onClick={() => setClinicForm(f => ({ ...f, queueEnabled: !f.queueEnabled }))}
                      className={`relative w-11 h-6 rounded-full transition-colors ${clinicForm.queueEnabled ? "bg-[#002045]" : "bg-[#c4c6cf]"}`}>
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${clinicForm.queueEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[#1a1c1e]">{s.clinicOnlineBooking}</span>
                    <button onClick={() => setClinicForm(f => ({ ...f, onlineBooking: !f.onlineBooking }))}
                      className={`relative w-11 h-6 rounded-full transition-colors ${clinicForm.onlineBooking ? "bg-[#002045]" : "bg-[#c4c6cf]"}`}>
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${clinicForm.onlineBooking ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#e3e2e6]">
              <button onClick={() => setClinicModal(null)} className="btn-secondary px-4 py-2 text-sm">{t.common.cancel}</button>
              <button onClick={saveClinic} disabled={clinicSaving} className="btn-primary px-4 py-2 text-sm disabled:opacity-60 flex items-center gap-2">
                {clinicSaving ? <Spinner /> : null}{t.common.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

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

function Toggle({ label, desc, checked, onChange, defaultChecked }: {
  label: string; desc?: string; checked?: boolean; onChange?: (v: boolean) => void; defaultChecked?: boolean;
}) {
  const [local, setLocal] = useState(defaultChecked ?? false);
  const isControlled = checked !== undefined;
  const isOn = isControlled ? checked : local;
  function toggle() { if (isControlled) onChange?.(!checked); else setLocal(v => !v); }
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-[#1a1c1e]">{label}</p>
        {desc && <p className="text-xs text-[#74777f]">{desc}</p>}
      </div>
      <button onClick={toggle} className={`relative w-11 h-6 rounded-full transition-colors ${isOn ? "bg-[#002045]" : "bg-[#c4c6cf]"}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isOn ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

function Spinner() {
  return <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />;
}
