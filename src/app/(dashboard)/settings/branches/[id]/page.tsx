"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/LanguageContext";

type Tab = "profile" | "settings" | "branding" | "appointments" | "clinics" | "whatsapp" | "sms" | "payment" | "audit";

type Branch = {
  id: string; name: string; code: string; description: string;
  country: string; city: string; address: string; phone: string;
  email: string; timezone: string; isActive: boolean;
  logo: string; primaryColor: string; invoiceFooter: string;
};

type Branding = { logo: string; primaryColor: string; invoiceFooter: string };

type ApptConfig = {
  workingDays: string[]; startTime: string; endTime: string;
  slotDurationMin: number; bufferMin: number; maxDailyAppointments: number;
  bookingWindowDays: number; autoConfirm: boolean;
};

type AuditEntry = {
  id: string; action: string; module: string; userName: string;
  entityId: string | null; ipAddress: string | null; timestamp: string;
};

type BranchSetting = {
  currency: string; timezone: string; taxRate: number; invoicePrefix: string;
  paymentTerms: number; language: string; workingHoursStart: string;
  workingHoursEnd: string; workingDays: number[]; emergencyContact: string;
};

type Clinic = {
  id: string; name: string; code: string; description: string; clinicType: string;
  colorTheme: string; capacity: number; apptDurationMin: number;
  queueEnabled: boolean; onlineBooking: boolean; status: string;
};

type WaConfig = {
  phoneNumberId: string; wabaId: string; accessToken: string; appSecret: string;
  webhookVerifyToken: string; phoneNumber: string; displayName: string;
  isVerified: boolean; isActive: boolean; autoReplyEnabled: boolean;
  businessHoursOnly: boolean; aiReplyEnabled: boolean;
};

type WaEvent = {
  id: string; eventType: string; fromNumber: string | null; processed: boolean; createdAt: string;
};

type SmsConfig = {
  provider: string; apiKey: string; apiSecret: string; fromNumber: string; dailyLimit: number; isActive: boolean;
};

type PaymentConfig = {
  provider: string; publicKey: string; secretKeyMasked: string; webhookSecretMasked: string;
  currency: string; testMode: boolean; isActive: boolean;
};

const DEFAULT_BRANDING: Branding = { logo: "", primaryColor: "#1960a3", invoiceFooter: "" };
const DEFAULT_APPT: ApptConfig = {
  workingDays: ["MON", "TUE", "WED", "THU", "FRI"], startTime: "08:00", endTime: "17:00",
  slotDurationMin: 30, bufferMin: 5, maxDailyAppointments: 50, bookingWindowDays: 30, autoConfirm: false,
};
const WEEK_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const DEFAULT_BRANCH_SETTING: BranchSetting = {
  currency: "USD", timezone: "Asia/Amman", taxRate: 0, invoicePrefix: "INV",
  paymentTerms: 30, language: "en", workingHoursStart: "08:00",
  workingHoursEnd: "17:00", workingDays: [0, 1, 2, 3, 4], emergencyContact: "",
};

const DEFAULT_WA: WaConfig = {
  phoneNumberId: "", wabaId: "", accessToken: "", appSecret: "",
  webhookVerifyToken: "", phoneNumber: "", displayName: "",
  isVerified: false, isActive: false, autoReplyEnabled: false,
  businessHoursOnly: false, aiReplyEnabled: false,
};

const DEFAULT_SMS: SmsConfig = { provider: "twilio", apiKey: "", apiSecret: "", fromNumber: "", dailyLimit: 200, isActive: false };

const DEFAULT_PAYMENT: PaymentConfig = {
  provider: "stripe", publicKey: "", secretKeyMasked: "", webhookSecretMasked: "",
  currency: "USD", testMode: true, isActive: false,
};

const DAY_KEYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CLINIC_TYPES = ["general", "dental", "radiology", "laboratory", "dermatology", "cardiology", "orthopedics", "pediatrics", "ophthalmology", "other"];
const SMS_PROVIDERS = ["twilio", "vonage", "aws_sns", "infobip", "custom"];
const PAYMENT_PROVIDERS = ["stripe", "tap", "payfort", "hesabe", "telr", "paypal", "custom"];

export default function BranchDetailPage() {
  const { t } = useLanguage();
  const s = t.settings;
  const { id: branchId } = useParams<{ id: string }>();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [branch, setBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile
  const [profileForm, setProfileForm] = useState({ name: "", code: "", description: "", country: "", city: "", address: "", phone: "", email: "", timezone: "Asia/Amman" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileStatus, setProfileStatus] = useState<"idle" | "saved" | "error">("idle");

  // Settings
  const [setting, setSetting] = useState<BranchSetting>(DEFAULT_BRANCH_SETTING);
  const [settingLoading, setSettingLoading] = useState(false);
  const [settingSaving, setSettingSaving] = useState(false);
  const [settingStatus, setSettingStatus] = useState<"idle" | "saved" | "error">("idle");

  // Clinics
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [clinicsLoading, setClinicsLoading] = useState(false);
  const [clinicModal, setClinicModal] = useState<"add" | "edit" | null>(null);
  const [editingClinic, setEditingClinic] = useState<Clinic | null>(null);
  const [clinicForm, setClinicForm] = useState({ name: "", code: "", description: "", clinicType: "general", colorTheme: "#1960a3", capacity: 10, apptDurationMin: 20, queueEnabled: true, onlineBooking: true });
  const [clinicSaving, setClinicSaving] = useState(false);
  const [clinicError, setClinicError] = useState("");

  // WhatsApp
  const [wa, setWa] = useState<WaConfig>(DEFAULT_WA);
  const [waLoading, setWaLoading] = useState(false);
  const [waSaving, setWaSaving] = useState(false);
  const [waStatus, setWaStatus] = useState<"idle" | "saved" | "error">("idle");
  const [waTestNumber, setWaTestNumber] = useState("");
  const [waTestMsg, setWaTestMsg] = useState("");
  const [waTesting, setWaTesting] = useState(false);
  const [waEvents, setWaEvents] = useState<WaEvent[]>([]);
  const [waEventsLoading, setWaEventsLoading] = useState(false);

  // SMS
  const [sms, setSms] = useState<SmsConfig>(DEFAULT_SMS);
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsSaving, setSmsSaving] = useState(false);
  const [smsStatus, setSmsStatus] = useState<"idle" | "saved" | "error">("idle");

  // Payment
  const [payment, setPayment] = useState<PaymentConfig>(DEFAULT_PAYMENT);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "saved" | "error">("idle");
  const [paymentSecretKey, setPaymentSecretKey] = useState("");
  const [paymentWebhookSecret, setPaymentWebhookSecret] = useState("");

  // Branding
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);
  const [brandingLoading, setBrandingLoading] = useState(false);
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [brandingStatus, setBrandingStatus] = useState<"idle" | "saved" | "error">("idle");

  // Appointment config
  const [appt, setAppt] = useState<ApptConfig>(DEFAULT_APPT);
  const [apptLoading, setApptLoading] = useState(false);
  const [apptSaving, setApptSaving] = useState(false);
  const [apptStatus, setApptStatus] = useState<"idle" | "saved" | "error">("idle");

  // Audit log
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Meta sync
  const [waSyncing, setWaSyncing] = useState(false);
  const [waSyncMsg, setWaSyncMsg] = useState("");

  // ── Load branch ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!branchId) return;
    setLoading(true);
    fetch(`/api/branches/${branchId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) {
          setBranch(d);
          setProfileForm({
            name: d.name || "", code: d.code || "", description: d.description || "",
            country: d.country || "", city: d.city || "", address: d.address || "",
            phone: d.phone || "", email: d.email || "", timezone: d.timezone || "Asia/Amman",
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [branchId]);

  // ── Load on tab switch ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!branchId) return;
    if (activeTab === "settings") loadSetting();
    if (activeTab === "branding") loadBranding();
    if (activeTab === "appointments") loadAppt();
    if (activeTab === "clinics") loadClinics();
    if (activeTab === "whatsapp") { loadWa(); loadWaEvents(); }
    if (activeTab === "sms") loadSms();
    if (activeTab === "payment") loadPayment();
    if (activeTab === "audit") loadAuditLogs();
  }, [activeTab, branchId]);

  function loadSetting() {
    setSettingLoading(true);
    fetch(`/api/branches/${branchId}/settings`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setSetting({ ...DEFAULT_BRANCH_SETTING, ...d }); })
      .catch(() => {})
      .finally(() => setSettingLoading(false));
  }

  function loadClinics() {
    setClinicsLoading(true);
    fetch(`/api/branches/${branchId}/clinics`)
      .then((r) => r.ok ? r.json() : [])
      .then(setClinics)
      .catch(() => setClinics([]))
      .finally(() => setClinicsLoading(false));
  }

  function loadWa() {
    setWaLoading(true);
    fetch(`/api/settings/whatsapp/${branchId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setWa({ ...DEFAULT_WA, ...d }); })
      .catch(() => {})
      .finally(() => setWaLoading(false));
  }

  function loadWaEvents() {
    setWaEventsLoading(true);
    fetch(`/api/settings/whatsapp/${branchId}/webhook-events`)
      .then((r) => r.ok ? r.json() : [])
      .then(setWaEvents)
      .catch(() => setWaEvents([]))
      .finally(() => setWaEventsLoading(false));
  }

  function loadSms() {
    setSmsLoading(true);
    fetch(`/api/settings/sms/${branchId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setSms({ ...DEFAULT_SMS, ...d, apiKey: "", apiSecret: "" }); })
      .catch(() => {})
      .finally(() => setSmsLoading(false));
  }

  function loadPayment() {
    setPaymentLoading(true);
    fetch(`/api/settings/payment/${branchId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setPayment(d); })
      .catch(() => {})
      .finally(() => setPaymentLoading(false));
  }

  function loadBranding() {
    setBrandingLoading(true);
    fetch(`/api/branches/${branchId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setBranding({ logo: d.logo || "", primaryColor: d.primaryColor || "#1960a3", invoiceFooter: d.invoiceFooter || "" }); })
      .catch(() => {})
      .finally(() => setBrandingLoading(false));
  }

  function loadAppt() {
    setApptLoading(true);
    fetch(`/api/settings/appointment-config/${branchId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setAppt({ ...DEFAULT_APPT, ...d }); })
      .catch(() => {})
      .finally(() => setApptLoading(false));
  }

  function loadAuditLogs() {
    setAuditLoading(true);
    fetch(`/api/audit?entityId=${branchId}&pageSize=50`)
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((d) => setAuditLogs(d.data || []))
      .catch(() => setAuditLogs([]))
      .finally(() => setAuditLoading(false));
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function saveProfile() {
    setProfileSaving(true); setProfileStatus("idle");
    try {
      const res = await fetch(`/api/branches/${branchId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profileForm),
      });
      setProfileStatus(res.ok ? "saved" : "error");
      if (res.ok) {
        const updated: Branch = await res.json();
        setBranch(updated);
        setTimeout(() => setProfileStatus("idle"), 3000);
      }
    } catch { setProfileStatus("error"); }
    finally { setProfileSaving(false); }
  }

  async function saveSetting() {
    setSettingSaving(true); setSettingStatus("idle");
    try {
      const res = await fetch(`/api/branches/${branchId}/settings`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(setting),
      });
      setSettingStatus(res.ok ? "saved" : "error");
      if (res.ok) setTimeout(() => setSettingStatus("idle"), 3000);
    } catch { setSettingStatus("error"); }
    finally { setSettingSaving(false); }
  }

  async function saveClinic() {
    if (!clinicForm.name.trim() || !clinicForm.code.trim()) { setClinicError(s.clinicRequired); return; }
    setClinicSaving(true); setClinicError("");
    try {
      const url = clinicModal === "edit" && editingClinic ? `/api/clinics/${editingClinic.id}` : `/api/branches/${branchId}/clinics`;
      const method = clinicModal === "edit" ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(clinicForm) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); setClinicError(err.detail || s.clinicSaveFailed); return; }
      setClinicModal(null); loadClinics();
    } catch { setClinicError(s.networkError); }
    finally { setClinicSaving(false); }
  }

  async function toggleClinicStatus(c: Clinic) {
    const newStatus = c.status === "active" ? "inactive" : "active";
    await fetch(`/api/clinics/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
    loadClinics();
  }

  async function saveWa() {
    setWaSaving(true); setWaStatus("idle");
    try {
      const res = await fetch(`/api/settings/whatsapp/${branchId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(wa),
      });
      setWaStatus(res.ok ? "saved" : "error");
      if (res.ok) setTimeout(() => setWaStatus("idle"), 3000);
    } catch { setWaStatus("error"); }
    finally { setWaSaving(false); }
  }

  async function testWa() {
    if (!waTestNumber.trim()) return;
    setWaTesting(true); setWaTestMsg("");
    try {
      const res = await fetch(`/api/settings/whatsapp/${branchId}/test`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toNumber: waTestNumber, message: "MediFlow test message" }),
      });
      setWaTestMsg(res.ok ? s.waTestSuccess : s.waTestFailed);
    } catch { setWaTestMsg(s.waTestFailed); }
    finally { setWaTesting(false); }
  }

  async function saveSms() {
    setSmsSaving(true); setSmsStatus("idle");
    const body: Record<string, unknown> = { ...sms };
    if (!body.apiKey) delete body.apiKey;
    if (!body.apiSecret) delete body.apiSecret;
    try {
      const res = await fetch(`/api/settings/sms/${branchId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setSmsStatus(res.ok ? "saved" : "error");
      if (res.ok) setTimeout(() => setSmsStatus("idle"), 3000);
    } catch { setSmsStatus("error"); }
    finally { setSmsSaving(false); }
  }

  async function savePayment() {
    setPaymentSaving(true); setPaymentStatus("idle");
    const body: Record<string, unknown> = { provider: payment.provider, publicKey: payment.publicKey, currency: payment.currency, testMode: payment.testMode, isActive: payment.isActive };
    if (paymentSecretKey) body.secretKey = paymentSecretKey;
    if (paymentWebhookSecret) body.webhookSecret = paymentWebhookSecret;
    try {
      const res = await fetch(`/api/settings/payment/${branchId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setPaymentStatus(res.ok ? "saved" : "error");
      if (res.ok) { setTimeout(() => setPaymentStatus("idle"), 3000); setPaymentSecretKey(""); setPaymentWebhookSecret(""); }
    } catch { setPaymentStatus("error"); }
    finally { setPaymentSaving(false); }
  }

  async function saveBranding() {
    setBrandingSaving(true); setBrandingStatus("idle");
    try {
      const res = await fetch(`/api/branches/${branchId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(branding),
      });
      setBrandingStatus(res.ok ? "saved" : "error");
      if (res.ok) setTimeout(() => setBrandingStatus("idle"), 3000);
    } catch { setBrandingStatus("error"); }
    finally { setBrandingSaving(false); }
  }

  async function saveAppt() {
    setApptSaving(true); setApptStatus("idle");
    try {
      const res = await fetch(`/api/settings/appointment-config/${branchId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(appt),
      });
      setApptStatus(res.ok ? "saved" : "error");
      if (res.ok) setTimeout(() => setApptStatus("idle"), 3000);
    } catch { setApptStatus("error"); }
    finally { setApptSaving(false); }
  }

  async function syncMetaTemplates() {
    setWaSyncing(true); setWaSyncMsg("");
    try {
      const res = await fetch(`/api/settings/whatsapp/${branchId}/sync-templates`, { method: "POST" });
      const d = res.ok ? await res.json() : null;
      setWaSyncMsg(d ? `${s.waSyncSuccess} (${d.synced})` : s.waSyncFailed);
    } catch { setWaSyncMsg(s.waSyncFailed); }
    finally { setWaSyncing(false); }
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────────

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "profile",      label: s.branchProfile,      icon: "business" },
    { key: "settings",     label: s.branchSettings,     icon: "tune" },
    { key: "branding",     label: s.branding,           icon: "palette" },
    { key: "appointments", label: s.apptConfig,         icon: "event" },
    { key: "clinics",      label: s.clinics,            icon: "medical_services" },
    { key: "whatsapp",     label: s.whatsapp,           icon: "chat" },
    { key: "sms",          label: s.smsGatewayConfig,  icon: "sms" },
    { key: "payment",      label: s.paymentConfig,      icon: "credit_card" },
    { key: "audit",        label: s.branchAudit,        icon: "history" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" />
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="flex flex-col items-center gap-4 h-64 justify-center">
        <span className="material-symbols-outlined text-[48px] text-[#c4c6cf]">account_tree</span>
        <p className="text-sm text-[#74777f]">{s.noBranches}</p>
        <button onClick={() => router.push("/settings")} className="btn-secondary text-sm px-4 py-2">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>{t.common.back}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/settings")} className="p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors" aria-label={t.common.back}>
            <span className="material-symbols-outlined text-[#74777f]">arrow_back</span>
          </button>
          <div className="w-10 h-10 rounded-xl bg-[#d3e4ff] flex items-center justify-center">
            <span className="material-symbols-outlined text-[#1960a3] text-[20px]">account_tree</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#1a1c1e]">{branch.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-xs bg-[#f4f3f7] px-2 py-0.5 rounded text-[#74777f]">{branch.code}</span>
              {[branch.city, branch.country].filter(Boolean).join(", ") && (
                <span className="text-xs text-[#74777f]">{[branch.city, branch.country].filter(Boolean).join(", ")}</span>
              )}
              <span className={`badge text-[10px] ${branch.isActive ? "bg-[#ccfbf1] text-[#0d9488]" : "bg-[#f4f3f7] text-[#74777f]"}`}>
                {branch.isActive ? s.branchActive : s.branchInactive}
              </span>
            </div>
          </div>
        </div>
        <p className="text-xs text-[#74777f] self-center">{s.branchDetailTitle}</p>
      </div>

      {/* Tab bar */}
      <div className="bg-white rounded-xl border border-[#e3e2e6] overflow-x-auto no-scrollbar">
        <div className="flex min-w-max">
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                activeTab === tab.key
                  ? "border-b-[#1960a3] text-[#1960a3] bg-[#d3e4ff]/20"
                  : "border-b-transparent text-[#74777f] hover:text-[#43474e] hover:bg-[#f4f3f7]"
              }`}>
              <span className={`material-symbols-outlined text-[18px] ${activeTab === tab.key ? "text-[#1960a3]" : "text-[#74777f]"}`}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Profile tab ── */}
      {activeTab === "profile" && (
        <Card title={s.branchProfile} action={
          <SaveButton saving={profileSaving} status={profileStatus} onSave={saveProfile} t={t} s={s} />
        }>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label={`${s.branchName} *`}>
              <input className="input-field" value={profileForm.name} onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label={`${s.branchCode} *`}>
              <input className="input-field font-mono" value={profileForm.code} onChange={e => setProfileForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
              <p className="text-xs text-[#74777f] mt-1">{s.branchCodeHint}</p>
            </Field>
            <Field label={s.branchPhone}>
              <input className="input-field" value={profileForm.phone} placeholder="+962 6 000 0000" onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} />
            </Field>
            <Field label={s.branchEmail}>
              <input type="email" className="input-field" value={profileForm.email} onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))} />
            </Field>
            <Field label={s.branchCountry}>
              <input className="input-field" value={profileForm.country} onChange={e => setProfileForm(f => ({ ...f, country: e.target.value }))} />
            </Field>
            <Field label={s.branchCity}>
              <input className="input-field" value={profileForm.city} onChange={e => setProfileForm(f => ({ ...f, city: e.target.value }))} />
            </Field>
            <Field label={s.branchTimezone} full>
              <select className="select-field" value={profileForm.timezone} onChange={e => setProfileForm(f => ({ ...f, timezone: e.target.value }))}>
                <option value="Asia/Amman">Asia/Amman (GMT+3)</option>
                <option value="Asia/Riyadh">Asia/Riyadh (GMT+3)</option>
                <option value="Asia/Dubai">Asia/Dubai (GMT+4)</option>
                <option value="Asia/Kuwait">Asia/Kuwait (GMT+3)</option>
                <option value="Africa/Cairo">Africa/Cairo (GMT+2)</option>
                <option value="UTC">UTC</option>
              </select>
            </Field>
            <Field label={s.branchDescription} full>
              <textarea className="input-field resize-none" rows={2} value={profileForm.description} onChange={e => setProfileForm(f => ({ ...f, description: e.target.value }))} />
            </Field>
            <Field label={s.branchAddress} full>
              <textarea className="input-field resize-none" rows={2} value={profileForm.address} onChange={e => setProfileForm(f => ({ ...f, address: e.target.value }))} />
            </Field>
          </div>
        </Card>
      )}

      {/* ── Settings tab ── */}
      {activeTab === "settings" && (
        <Card title={s.branchSettings} desc={s.branchSettingsDesc} action={
          <SaveButton saving={settingSaving} status={settingStatus} onSave={saveSetting} t={t} s={s} />
        }>
          {settingLoading ? <Spinner /> : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Field label={s.currency}>
                <select className="select-field" value={setting.currency} onChange={e => setSetting(f => ({ ...f, currency: e.target.value }))}>
                  {["USD","JOD","SAR","AED","KWD","EGP"].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label={s.timezone}>
                <select className="select-field" value={setting.timezone} onChange={e => setSetting(f => ({ ...f, timezone: e.target.value }))}>
                  <option value="Asia/Amman">Asia/Amman</option>
                  <option value="Asia/Riyadh">Asia/Riyadh</option>
                  <option value="Asia/Dubai">Asia/Dubai</option>
                  <option value="Africa/Cairo">Africa/Cairo</option>
                  <option value="UTC">UTC</option>
                </select>
              </Field>
              <Field label={s.taxRate}>
                <input type="number" className="input-field" value={setting.taxRate} min={0} max={100} step={0.5}
                  onChange={e => setSetting(f => ({ ...f, taxRate: Number(e.target.value) }))} />
              </Field>
              <Field label={s.invoicePrefix}>
                <input className="input-field font-mono" value={setting.invoicePrefix}
                  onChange={e => setSetting(f => ({ ...f, invoicePrefix: e.target.value.toUpperCase() }))} />
              </Field>
              <Field label={s.branchWorkingHoursStart}>
                <input type="time" className="input-field" value={setting.workingHoursStart}
                  onChange={e => setSetting(f => ({ ...f, workingHoursStart: e.target.value }))} />
              </Field>
              <Field label={s.branchWorkingHoursEnd}>
                <input type="time" className="input-field" value={setting.workingHoursEnd}
                  onChange={e => setSetting(f => ({ ...f, workingHoursEnd: e.target.value }))} />
              </Field>
              <Field label={s.branchEmergencyContact} full>
                <input className="input-field" value={setting.emergencyContact}
                  onChange={e => setSetting(f => ({ ...f, emergencyContact: e.target.value }))} />
              </Field>
              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-2">{s.branchWorkingDays}</label>
                <div className="flex gap-2 flex-wrap">
                  {DAY_KEYS.map((day, i) => {
                    const active = setting.workingDays.includes(i);
                    return (
                      <button key={i} type="button" onClick={() => setSetting(f => ({
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
        </Card>
      )}

      {/* ── Clinics tab ── */}
      {activeTab === "clinics" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { setClinicModal("add"); setClinicForm({ name: "", code: "", description: "", clinicType: "general", colorTheme: "#1960a3", capacity: 10, apptDurationMin: 20, queueEnabled: true, onlineBooking: true }); setEditingClinic(null); setClinicError(""); }}
              className="btn-primary text-sm px-4 py-2">
              <span className="material-symbols-outlined text-[16px]">add</span>{s.addClinic}
            </button>
          </div>
          <div className="bg-white rounded-xl border border-[#e3e2e6] overflow-hidden">
            {clinicsLoading ? (
              <div className="p-12 flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" /></div>
            ) : clinics.length === 0 ? (
              <div className="p-12 flex flex-col items-center gap-3">
                <span className="material-symbols-outlined text-[48px] text-[#c4c6cf]">medical_services</span>
                <p className="text-sm text-[#74777f]">{s.noClinics}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
                {clinics.map((c) => (
                  <div key={c.id} className="border border-[#e3e2e6] rounded-xl p-4 group hover:border-[#1960a3]/40 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: c.colorTheme }} />
                        <div>
                          <p className="text-sm font-semibold text-[#1a1c1e]">{c.name}</p>
                          <p className="text-xs text-[#74777f]">{c.code} · {c.clinicType}</p>
                        </div>
                      </div>
                      <span className={`badge text-[10px] flex-shrink-0 ${c.status === "active" ? "bg-[#ccfbf1] text-[#0d9488]" : "bg-[#f4f3f7] text-[#74777f]"}`}>
                        {c.status === "active" ? s.clinicActive : s.clinicInactive}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-1 text-[11px] text-[#74777f]">
                      <span><span className="material-symbols-outlined text-[12px] align-middle">group</span> {c.capacity}/day</span>
                      <span><span className="material-symbols-outlined text-[12px] align-middle">schedule</span> {c.apptDurationMin}min</span>
                    </div>
                    <div className="mt-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingClinic(c); setClinicForm({ name: c.name, code: c.code, description: c.description || "", clinicType: c.clinicType, colorTheme: c.colorTheme, capacity: c.capacity, apptDurationMin: c.apptDurationMin, queueEnabled: c.queueEnabled, onlineBooking: c.onlineBooking }); setClinicError(""); setClinicModal("edit"); }}
                        className="flex-1 btn-secondary text-xs py-1.5">{t.common.edit}</button>
                      <button onClick={() => toggleClinicStatus(c)}
                        className={`flex-1 text-xs py-1.5 rounded-lg font-semibold border transition-colors ${c.status === "active" ? "border-[#d97706] text-[#d97706] hover:bg-[#fff7ed]" : "border-[#0d9488] text-[#0d9488] hover:bg-[#ccfbf1]"}`}>
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

      {/* ── WhatsApp tab ── */}
      {activeTab === "whatsapp" && (
        <div className="space-y-5">
          <Card title={s.whatsappTitle} desc={s.whatsappDesc} action={
            <SaveButton saving={waSaving} status={waStatus} onSave={saveWa} t={t} s={s} />
          }>
            {waLoading ? <Spinner /> : (
              <div className="space-y-5">
                <div className="flex items-center gap-4">
                  <Toggle label={s.waActive} checked={wa.isActive} onChange={v => setWa(f => ({ ...f, isActive: v }))} />
                  {wa.isVerified
                    ? <span className="badge bg-[#ccfbf1] text-[#0d9488]">{s.waVerified}</span>
                    : <span className="badge bg-[#fff7ed] text-[#d97706]">{s.waNotVerified}</span>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field label={s.waPhoneNumberId}><input className="input-field font-mono text-xs" value={wa.phoneNumberId} onChange={e => setWa(f => ({ ...f, phoneNumberId: e.target.value }))} /></Field>
                  <Field label={s.waWabaId}><input className="input-field font-mono text-xs" value={wa.wabaId} onChange={e => setWa(f => ({ ...f, wabaId: e.target.value }))} /></Field>
                  <Field label={s.waPhoneNumber}><input className="input-field" value={wa.phoneNumber} onChange={e => setWa(f => ({ ...f, phoneNumber: e.target.value }))} /></Field>
                  <Field label={s.waDisplayName}><input className="input-field" value={wa.displayName} onChange={e => setWa(f => ({ ...f, displayName: e.target.value }))} /></Field>
                  <Field label={s.waAccessToken} full><input type="password" className="input-field font-mono text-xs" value={wa.accessToken} onChange={e => setWa(f => ({ ...f, accessToken: e.target.value }))} /></Field>
                  <Field label={s.waAppSecret}><input type="password" className="input-field font-mono text-xs" value={wa.appSecret} onChange={e => setWa(f => ({ ...f, appSecret: e.target.value }))} /></Field>
                  <Field label={s.waWebhookToken}><input className="input-field font-mono text-xs" value={wa.webhookVerifyToken} onChange={e => setWa(f => ({ ...f, webhookVerifyToken: e.target.value }))} /></Field>
                </div>
                <div className="space-y-3 pt-2 border-t border-[#e3e2e6]">
                  <Toggle label={s.waAutoReply} checked={wa.autoReplyEnabled} onChange={v => setWa(f => ({ ...f, autoReplyEnabled: v }))} />
                  <Toggle label={s.waBusinessHours} checked={wa.businessHoursOnly} onChange={v => setWa(f => ({ ...f, businessHoursOnly: v }))} />
                  <Toggle label={s.waAiReply} checked={wa.aiReplyEnabled} onChange={v => setWa(f => ({ ...f, aiReplyEnabled: v }))} />
                </div>
                {/* Test send */}
                <div className="bg-[#f8f7fb] rounded-xl p-4 mt-4">
                  <p className="text-sm font-semibold text-[#43474e] mb-3">{s.waTestSend}</p>
                  <div className="flex gap-3">
                    <input className="input-field flex-1" value={waTestNumber} placeholder={s.waTestNumber} onChange={e => setWaTestNumber(e.target.value)} />
                    <button onClick={testWa} disabled={waTesting || !waTestNumber.trim()} className="btn-secondary text-sm px-4 disabled:opacity-60 flex items-center gap-2 whitespace-nowrap">
                      {waTesting ? <SpinnerDark /> : <span className="material-symbols-outlined text-[16px]">send</span>}{s.waTestSend}
                    </button>
                  </div>
                  {waTestMsg && <p className={`text-xs mt-2 font-semibold ${waTestMsg === s.waTestSuccess ? "text-[#0d9488]" : "text-[#ba1a1a]"}`}>{waTestMsg}</p>}
                </div>
              </div>
            )}
          </Card>

          {/* Meta template sync */}
          <div className="bg-white rounded-xl border border-[#e3e2e6] p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#1a1c1e]">{s.waSyncTemplates}</p>
              <p className="text-xs text-[#74777f] mt-0.5">{s.waSyncTemplatesDesc}</p>
              {waSyncMsg && <p className={`text-xs mt-1 font-semibold ${waSyncMsg.includes(s.waSyncFailed) ? "text-[#ba1a1a]" : "text-[#0d9488]"}`}>{waSyncMsg}</p>}
            </div>
            <button onClick={syncMetaTemplates} disabled={waSyncing} className="btn-secondary text-sm px-4 py-2 disabled:opacity-60 flex items-center gap-2 whitespace-nowrap flex-shrink-0">
              {waSyncing ? <SpinnerDark /> : <span className="material-symbols-outlined text-[16px]">sync</span>}{s.waSyncTemplates}
            </button>
          </div>

          {/* Webhook event log */}
          <div className="bg-white rounded-xl border border-[#e3e2e6] overflow-hidden">
            <div className="p-5 border-b border-[#e3e2e6] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#1a1c1e]">{s.webhookEvents}</h3>
                <p className="text-xs text-[#74777f] mt-0.5">{s.webhookEventsDesc}</p>
              </div>
              <button onClick={loadWaEvents} className="p-2 hover:bg-[#f4f3f7] rounded-lg" aria-label={t.common.retry}>
                <span className="material-symbols-outlined text-[#74777f] text-[18px]">refresh</span>
              </button>
            </div>
            {waEventsLoading ? (
              <div className="p-8 flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" /></div>
            ) : waEvents.length === 0 ? (
              <div className="p-8 flex flex-col items-center gap-2">
                <span className="material-symbols-outlined text-[36px] text-[#c4c6cf]">webhook</span>
                <p className="text-xs text-[#74777f]">{s.noWebhookEvents}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-[#f8f7fb]">
                    <th className="table-header">{s.waEventType}</th>
                    <th className="table-header">{s.waFromNumber}</th>
                    <th className="table-header">{t.common.status}</th>
                    <th className="table-header">{t.common.date}</th>
                  </tr></thead>
                  <tbody>
                    {waEvents.map(ev => (
                      <tr key={ev.id} className="table-row">
                        <td className="table-cell"><span className="font-mono text-xs bg-[#f4f3f7] px-2 py-0.5 rounded">{ev.eventType}</span></td>
                        <td className="table-cell text-[#74777f] text-xs">{ev.fromNumber || t.common.na}</td>
                        <td className="table-cell">
                          <span className={`badge text-[10px] ${ev.processed ? "bg-[#ccfbf1] text-[#0d9488]" : "bg-[#fff7ed] text-[#d97706]"}`}>
                            {ev.processed ? s.webhookProcessed : s.webhookPending}
                          </span>
                        </td>
                        <td className="table-cell text-[#74777f] text-xs whitespace-nowrap">{ev.createdAt ? new Date(ev.createdAt).toLocaleString() : t.common.na}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SMS tab ── */}
      {activeTab === "sms" && (
        <Card title={s.smsGatewayConfigTitle} desc={s.smsGatewayConfigDesc} action={
          <SaveButton saving={smsSaving} status={smsStatus} onSave={saveSms} t={t} s={s} />
        }>
          {smsLoading ? <Spinner /> : (
            <div className="space-y-5">
              <Toggle label={t.common.active} checked={sms.isActive} onChange={v => setSms(f => ({ ...f, isActive: v }))} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label={s.smsProvider}>
                  <select className="select-field" value={sms.provider} onChange={e => setSms(f => ({ ...f, provider: e.target.value }))}>
                    {SMS_PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label={s.smsDailyLimit}>
                  <input type="number" className="input-field" value={sms.dailyLimit} min={1} onChange={e => setSms(f => ({ ...f, dailyLimit: Number(e.target.value) }))} />
                </Field>
                <Field label={s.smsCfgApiKey}>
                  <input type="password" className="input-field" value={sms.apiKey} onChange={e => setSms(f => ({ ...f, apiKey: e.target.value }))} />
                </Field>
                <Field label={s.smsCfgApiSecret}>
                  <input type="password" className="input-field" value={sms.apiSecret} onChange={e => setSms(f => ({ ...f, apiSecret: e.target.value }))} />
                </Field>
                <Field label={s.smsFromNumber}>
                  <input className="input-field" value={sms.fromNumber} placeholder="+12015551234" onChange={e => setSms(f => ({ ...f, fromNumber: e.target.value }))} />
                </Field>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── Payment tab ── */}
      {activeTab === "payment" && (
        <Card title={s.paymentConfigTitle} desc={s.paymentConfigDesc} action={
          <SaveButton saving={paymentSaving} status={paymentStatus} onSave={savePayment} t={t} s={s} />
        }>
          {paymentLoading ? <Spinner /> : (
            <div className="space-y-5">
              <div className="flex gap-5 flex-wrap">
                <Toggle label={s.paymentTestMode} checked={payment.testMode} onChange={v => setPayment(f => ({ ...f, testMode: v }))} />
                <Toggle label={t.common.active} checked={payment.isActive} onChange={v => setPayment(f => ({ ...f, isActive: v }))} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label={s.paymentProvider}>
                  <select className="select-field" value={payment.provider} onChange={e => setPayment(f => ({ ...f, provider: e.target.value }))}>
                    {PAYMENT_PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label={s.currency}>
                  <select className="select-field" value={payment.currency} onChange={e => setPayment(f => ({ ...f, currency: e.target.value }))}>
                    {["USD","JOD","SAR","AED","KWD","EGP"].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label={s.paymentPublicKey} full>
                  <input className="input-field font-mono text-xs" value={payment.publicKey} onChange={e => setPayment(f => ({ ...f, publicKey: e.target.value }))} />
                </Field>
                <Field label={s.paymentSecretKey}>
                  <input type="password" className="input-field" value={paymentSecretKey} placeholder={payment.secretKeyMasked || "••••"} onChange={e => setPaymentSecretKey(e.target.value)} />
                </Field>
                <Field label={s.paymentWebhookSecret}>
                  <input type="password" className="input-field" value={paymentWebhookSecret} placeholder={payment.webhookSecretMasked || "••••"} onChange={e => setPaymentWebhookSecret(e.target.value)} />
                </Field>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── Branding tab ── */}
      {activeTab === "branding" && (
        <Card title={s.brandingTitle} desc={s.brandingDesc} action={
          <SaveButton saving={brandingSaving} status={brandingStatus} onSave={saveBranding} t={t} s={s} />
        }>
          {brandingLoading ? <Spinner /> : (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-2">{s.brandLogo}</label>
                <p className="text-xs text-[#74777f] mb-3">{s.brandLogoHint}</p>
                <div className="flex items-center gap-4">
                  {branding.logo
                    ? <img src={branding.logo} alt="logo" className="h-16 object-contain border border-[#e3e2e6] rounded-lg p-2 bg-white" />
                    : <div className="h-16 w-32 bg-[#f4f3f7] rounded-lg border border-dashed border-[#c4c6cf] flex items-center justify-center"><span className="material-symbols-outlined text-[#c4c6cf]">image</span></div>
                  }
                  <div className="flex flex-col gap-2">
                    <input type="file" accept="image/png,image/svg+xml" className="hidden" id="logo-upload"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 200 * 1024) { alert("Max 200 KB"); return; }
                        const reader = new FileReader();
                        reader.onload = ev => setBranding(b => ({ ...b, logo: ev.target?.result as string }));
                        reader.readAsDataURL(file);
                      }} />
                    <label htmlFor="logo-upload" className="btn-secondary text-xs px-3 py-1.5 cursor-pointer">{t.common.add}</label>
                    {branding.logo && <button onClick={() => setBranding(b => ({ ...b, logo: "" }))} className="text-xs text-[#ba1a1a] hover:underline">{s.brandRemoveLogo}</button>}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.brandPrimaryColor}</label>
                  <div className="flex items-center gap-3">
                    <input type="color" className="w-10 h-10 rounded-lg border border-[#c4c6cf] cursor-pointer" value={branding.primaryColor}
                      onChange={e => setBranding(b => ({ ...b, primaryColor: e.target.value }))} />
                    <span className="font-mono text-sm text-[#43474e]">{branding.primaryColor}</span>
                    <div className="w-8 h-8 rounded-full border border-[#e3e2e6]" style={{ backgroundColor: branding.primaryColor }} />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.brandInvoiceFooter}</label>
                <textarea className="input-field resize-none w-full" rows={3} value={branding.invoiceFooter}
                  placeholder="e.g. Thank you for choosing our clinic. For enquiries call +962 6 000 0000."
                  onChange={e => setBranding(b => ({ ...b, invoiceFooter: e.target.value }))} />
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── Appointments tab ── */}
      {activeTab === "appointments" && (
        <Card title={s.apptConfigTitle} desc={s.apptConfigDesc} action={
          <SaveButton saving={apptSaving} status={apptStatus} onSave={saveAppt} t={t} s={s} />
        }>
          {apptLoading ? <Spinner /> : (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-2">{s.apptWorkingDays}</label>
                <div className="flex gap-2 flex-wrap">
                  {WEEK_DAYS.map(d => {
                    const on = appt.workingDays.includes(d);
                    return (
                      <button key={d} type="button" onClick={() => setAppt(a => ({
                        ...a, workingDays: on ? a.workingDays.filter(x => x !== d) : [...a.workingDays, d],
                      }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${on ? "bg-[#002045] text-white" : "bg-[#f4f3f7] text-[#74777f] hover:bg-[#e3e2e6]"}`}>
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.apptStartTime}</label>
                  <input type="time" className="input-field" value={appt.startTime} onChange={e => setAppt(a => ({ ...a, startTime: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.apptEndTime}</label>
                  <input type="time" className="input-field" value={appt.endTime} onChange={e => setAppt(a => ({ ...a, endTime: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.apptSlotDuration}</label>
                  <input type="number" className="input-field" value={appt.slotDurationMin} min={5} max={120}
                    onChange={e => setAppt(a => ({ ...a, slotDurationMin: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.apptBuffer}</label>
                  <input type="number" className="input-field" value={appt.bufferMin} min={0} max={60}
                    onChange={e => setAppt(a => ({ ...a, bufferMin: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.apptMaxDaily}</label>
                  <input type="number" className="input-field" value={appt.maxDailyAppointments} min={1}
                    onChange={e => setAppt(a => ({ ...a, maxDailyAppointments: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.apptBookingWindow}</label>
                  <input type="number" className="input-field" value={appt.bookingWindowDays} min={1} max={365}
                    onChange={e => setAppt(a => ({ ...a, bookingWindowDays: Number(e.target.value) }))} />
                </div>
              </div>
              <Toggle label={s.apptAutoConfirm} checked={appt.autoConfirm} onChange={v => setAppt(a => ({ ...a, autoConfirm: v }))} />
            </div>
          )}
        </Card>
      )}

      {/* ── Audit tab ── */}
      {activeTab === "audit" && (
        <div className="bg-white rounded-xl border border-[#e3e2e6] overflow-hidden">
          <div className="p-5 border-b border-[#e3e2e6] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#1a1c1e]">{s.branchAudit}</h3>
              <p className="text-xs text-[#74777f] mt-0.5">{s.branchAuditDesc}</p>
            </div>
            <button onClick={loadAuditLogs} className="p-2 hover:bg-[#f4f3f7] rounded-lg" aria-label={t.common.retry}>
              <span className="material-symbols-outlined text-[#74777f] text-[18px]">refresh</span>
            </button>
          </div>
          {auditLoading ? (
            <div className="p-10 flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" /></div>
          ) : auditLogs.length === 0 ? (
            <div className="p-10 flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-[40px] text-[#c4c6cf]">history</span>
              <p className="text-sm text-[#74777f]">{s.noBranchAuditLogs}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-[#f8f7fb]">
                  <th className="table-header">{t.audit.action}</th>
                  <th className="table-header">{t.audit.module}</th>
                  <th className="table-header">{t.audit.user}</th>
                  <th className="table-header">{t.audit.ipAddress}</th>
                  <th className="table-header">{t.audit.timestamp}</th>
                </tr></thead>
                <tbody>
                  {auditLogs.map(log => (
                    <tr key={log.id} className="table-row">
                      <td className="table-cell"><span className="font-mono text-xs bg-[#f4f3f7] px-2 py-0.5 rounded">{log.action}</span></td>
                      <td className="table-cell text-[#74777f] text-xs">{log.module}</td>
                      <td className="table-cell text-[#74777f] text-xs">{log.userName || t.common.na}</td>
                      <td className="table-cell text-[#74777f] text-xs font-mono">{log.ipAddress || t.common.na}</td>
                      <td className="table-cell text-[#74777f] text-xs whitespace-nowrap">{log.timestamp ? new Date(log.timestamp).toLocaleString() : t.common.na}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Clinic Modal ── */}
      {clinicModal && (
        <div role="dialog" aria-modal="true" aria-labelledby="clinic-modal-title" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setClinicModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-[#e3e2e6]">
              <h2 id="clinic-modal-title" className="text-lg font-bold text-[#1a1c1e]">{clinicModal === "add" ? s.addClinic : s.editClinic}</h2>
              <button onClick={() => setClinicModal(null)} aria-label={t.common.close} className="p-2 hover:bg-[#f4f3f7] rounded-lg"><span className="material-symbols-outlined text-[#74777f]">close</span></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {clinicError && <div className="bg-[#ffdad6] text-[#ba1a1a] text-sm px-4 py-2.5 rounded-lg">{clinicError}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.clinicName} *</label>
                  <input className="input-field" value={clinicForm.name} onChange={e => setClinicForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.clinicCode} *</label>
                  <input className="input-field font-mono" value={clinicForm.code} onChange={e => setClinicForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.clinicType}</label>
                  <select className="select-field" value={clinicForm.clinicType} onChange={e => setClinicForm(f => ({ ...f, clinicType: e.target.value }))}>
                    {CLINIC_TYPES.map(ct => <option key={ct} value={ct}>{(s.clinicTypes as Record<string, string>)[ct] || ct}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.clinicCapacity}</label>
                  <input type="number" className="input-field" value={clinicForm.capacity} min={1} onChange={e => setClinicForm(f => ({ ...f, capacity: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.clinicApptDuration}</label>
                  <input type="number" className="input-field" value={clinicForm.apptDurationMin} min={5} onChange={e => setClinicForm(f => ({ ...f, apptDurationMin: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.clinicColor}</label>
                  <div className="flex items-center gap-2">
                    <input type="color" className="w-10 h-10 rounded-lg border border-[#c4c6cf] cursor-pointer" value={clinicForm.colorTheme} onChange={e => setClinicForm(f => ({ ...f, colorTheme: e.target.value }))} />
                    <span className="text-xs font-mono text-[#74777f]">{clinicForm.colorTheme}</span>
                  </div>
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
                {clinicSaving ? <SpinnerWhite /> : null}{t.common.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Card({ title, desc, children, action }: { title: string; desc?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
      <div className="flex items-start justify-between mb-5 pb-4 border-b border-[#e3e2e6]">
        <div>
          <h2 className="text-base font-semibold text-[#1a1c1e]">{title}</h2>
          {desc && <p className="text-xs text-[#74777f] mt-0.5">{desc}</p>}
        </div>
        {action}
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

function Toggle({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <p className="text-sm font-medium text-[#1a1c1e]">{label}</p>
        {desc && <p className="text-xs text-[#74777f]">{desc}</p>}
      </div>
      <button onClick={() => onChange(!checked)} className={`relative w-11 h-6 rounded-full transition-colors ms-4 flex-shrink-0 ${checked ? "bg-[#002045]" : "bg-[#c4c6cf]"}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

function SaveButton({ saving, status, onSave, t, s }: {
  saving: boolean; status: "idle" | "saved" | "error"; onSave: () => void;
  t: ReturnType<typeof useLanguage>["t"]; s: ReturnType<typeof useLanguage>["t"]["settings"];
}) {
  return (
    <div className="flex items-center gap-3 flex-shrink-0">
      {status === "saved" && <span className="text-xs text-[#0d9488] font-semibold">{s.saved}</span>}
      {status === "error" && <span className="text-xs text-[#ba1a1a] font-semibold">{s.errorRetry}</span>}
      <button onClick={onSave} disabled={saving} className="btn-primary text-sm px-4 py-2 disabled:opacity-60 flex items-center gap-2">
        {saving ? <SpinnerWhite /> : <span className="material-symbols-outlined text-[16px]">save</span>}{t.common.save}
      </button>
    </div>
  );
}

function Spinner() {
  return <div className="flex items-center justify-center h-20"><div className="w-6 h-6 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" /></div>;
}

function SpinnerWhite() {
  return <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />;
}

function SpinnerDark() {
  return <span className="w-4 h-4 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin inline-block" />;
}
