"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { apiFetch } from "@/lib/hooks/useDataFetch";

type Section = "clinic" | "security" | "notifications" | "billing" | "branches" | "clinics" | "smtp" | "whatsapp" | "sms" | "payment" | "features" | "apikeys" | "templates" | "integrations" | "history" | "health" | "insurance";

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

type WaConfig = {
  phoneNumberId: string; wabaId: string; accessToken: string; appSecret: string;
  webhookVerifyToken: string; phoneNumber: string; displayName: string;
  isVerified: boolean; isActive: boolean; autoReplyEnabled: boolean;
  businessHoursOnly: boolean; aiReplyEnabled: boolean;
};

type WaTemplate = {
  id: string; name: string; category: string; language: string; bodyText: string; isActive: boolean;
};

type SmsConfig = {
  provider: string; apiKey: string; apiSecret: string; fromNumber: string; dailyLimit: number; isActive: boolean;
};

type PaymentConfig = {
  provider: string; publicKey: string; secretKeyMasked: string; webhookSecretMasked: string;
  currency: string; testMode: boolean; isActive: boolean;
};

type FeatureFlag = {
  id: string; key: string; description: string; isEnabled: boolean; updatedAt: string | null;
};

type ApiKey = {
  id: string; name: string; keyPrefix: string; branchId: string | null; scopes: string[];
  isActive: boolean; lastUsedAt: string | null; expiresAt: string | null; createdAt: string | null;
  key?: string;
};

type NotifTemplate = {
  id: string; branchId: string | null; eventType: string; channel: string;
  subject: string; body: string; variables: string[]; language: string;
  isActive: boolean; isDefault: boolean; updatedAt: string | null;
};

type InsuranceProviderRow = {
  id: string; name: string; code: string | null; contactPhone: string | null;
  contactEmail: string | null; notes: string | null; isActive: boolean; createdAt: string | null;
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

const SMS_PROVIDERS = ["twilio", "vonage", "aws_sns", "infobip", "custom"];
const PAYMENT_PROVIDERS = ["stripe", "tap", "payfort", "hesabe", "telr", "paypal", "custom"];
const API_SCOPES = ["read:patients", "write:patients", "read:appointments", "write:appointments", "read:reports", "read:billing", "write:billing", "read:hr", "admin:full"];

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
  const router = useRouter();

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

  // WhatsApp
  const [waBranchId, setWaBranchId] = useState<string>("");
  const [wa, setWa] = useState<WaConfig>(DEFAULT_WA);
  const [waLoading, setWaLoading] = useState(false);
  const [waSaving, setWaSaving] = useState(false);
  const [waStatus, setWaStatus] = useState<"idle" | "saved" | "error">("idle");
  const [waTestNumber, setWaTestNumber] = useState("");
  const [waTestMsg, setWaTestMsg] = useState("");
  const [waTesting, setWaTesting] = useState(false);
  const [waTemplates, setWaTemplates] = useState<WaTemplate[]>([]);

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

  // Feature flags
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [flagsLoading, setFlagsLoading] = useState(false);
  const [flagToggling, setFlagToggling] = useState<string | null>(null);

  // API keys
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [apiKeyModal, setApiKeyModal] = useState(false);
  const [apiKeyForm, setApiKeyForm] = useState({ name: "", scopes: [] as string[], branchId: "", expiresAt: "" });
  const [apiKeyCreating, setApiKeyCreating] = useState(false);
  const [apiKeyCreated, setApiKeyCreated] = useState<ApiKey | null>(null);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);

  // Notification templates
  const [templates, setTemplates] = useState<NotifTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [tplFilter, setTplFilter] = useState({ eventType: "", channel: "" });
  const [tplEditing, setTplEditing] = useState<NotifTemplate | null>(null);
  const [tplSaving, setTplSaving] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGenerateMsg, setAiGenerateMsg] = useState("");

  // Branch health
  type HealthRow = { branchId: string; branchName: string; branchCode: string; staffCount: number; appointmentsLast30d: number; openInvoices: number; whatsappActive: boolean; smsActive: boolean; paymentActive: boolean; healthScore: number };
  const [healthData, setHealthData] = useState<HealthRow[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);

  // Audit retention
  const [retentionStats, setRetentionStats] = useState<{ totalLogs: number; oldestLog: string | null } | null>(null);
  const [retentionDays, setRetentionDays] = useState(90);
  const [purging, setPurging] = useState(false);
  const [purgedCount, setPurgedCount] = useState<number | null>(null);

  // Insurance providers
  const [insuranceProviders, setInsuranceProviders] = useState<InsuranceProviderRow[]>([]);
  const [insuranceLoading, setInsuranceLoading] = useState(false);
  const [insuranceModal, setInsuranceModal] = useState<"add" | "edit" | null>(null);
  const [editingProvider, setEditingProvider] = useState<InsuranceProviderRow | null>(null);
  const [providerForm, setProviderForm] = useState({ name: "", code: "", contactPhone: "", contactEmail: "", notes: "", isActive: true });
  const [providerSaving, setProviderSaving] = useState(false);
  const [providerError, setProviderError] = useState("");
  const [providerStatus, setProviderStatus] = useState<"idle" | "saved" | "deleted">("idle");

  // Nav accordion
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

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
    if (activeSection === "branches" || activeSection === "clinics" || activeSection === "whatsapp") loadBranches();
    if (activeSection === "smtp") loadSmtp();
    if (activeSection === "history") { loadHistory(); loadRetentionStats(); }
    if (activeSection === "sms") loadSms();
    if (activeSection === "payment") loadPayment();
    if (activeSection === "features") loadFlags();
    if (activeSection === "apikeys") loadApiKeys();
    if (activeSection === "templates") loadTemplates();
    if (activeSection === "health") loadHealth();
    if (activeSection === "insurance") loadInsuranceProviders();
  }, [activeSection]);

  useEffect(() => {
    if (activeSection === "clinics" && clinicBranchId) loadClinics(clinicBranchId);
  }, [activeSection, clinicBranchId]);

  useEffect(() => {
    if (activeSection === "whatsapp" && branches.length > 0 && !waBranchId) {
      const id = branches[0].id;
      setWaBranchId(id);
      loadWa(id);
    }
  }, [activeSection, branches]);

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

  function loadWa(branchId: string) {
    if (!branchId) return;
    setWaLoading(true);
    fetch(`/api/settings/whatsapp/${branchId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) { setWa({ ...DEFAULT_WA, ...d }); setWaTemplates(d.templates || []); }
      })
      .catch(() => {})
      .finally(() => setWaLoading(false));
  }

  function loadSms() {
    setSmsLoading(true);
    fetch("/api/settings/sms")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setSms({ ...DEFAULT_SMS, ...d, apiKey: "", apiSecret: "" }); })
      .catch(() => {})
      .finally(() => setSmsLoading(false));
  }

  function loadPayment() {
    setPaymentLoading(true);
    fetch("/api/settings/payment")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setPayment(d); })
      .catch(() => {})
      .finally(() => setPaymentLoading(false));
  }

  function loadFlags() {
    setFlagsLoading(true);
    fetch("/api/settings/features")
      .then((r) => r.ok ? r.json() : [])
      .then(setFlags)
      .catch(() => setFlags([]))
      .finally(() => setFlagsLoading(false));
  }

  function loadApiKeys() {
    setApiKeysLoading(true);
    fetch("/api/settings/api-keys")
      .then((r) => r.ok ? r.json() : [])
      .then(setApiKeys)
      .catch(() => setApiKeys([]))
      .finally(() => setApiKeysLoading(false));
  }

  function loadHealth() {
    setHealthLoading(true);
    fetch("/api/branches/health")
      .then((r) => r.ok ? r.json() : [])
      .then(setHealthData)
      .catch(() => setHealthData([]))
      .finally(() => setHealthLoading(false));
  }

  function loadInsuranceProviders() {
    setInsuranceLoading(true);
    fetch("/api/insurance-providers")
      .then((r) => r.ok ? r.json() : [])
      .then(setInsuranceProviders)
      .catch(() => setInsuranceProviders([]))
      .finally(() => setInsuranceLoading(false));
  }

  async function saveProvider() {
    if (!providerForm.name.trim()) return;
    setProviderSaving(true);
    setProviderError("");
    try {
      const isEdit = insuranceModal === "edit" && editingProvider;
      const url = isEdit ? `/api/insurance-providers/${editingProvider.id}` : "/api/insurance-providers";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...providerForm, code: providerForm.code || null }),
      });
      const data = await res.json();
      if (!res.ok) { setProviderError(data.detail ?? "Error saving provider"); return; }
      if (isEdit) {
        setInsuranceProviders((ps) => ps.map((p) => p.id === data.id ? data : p));
      } else {
        setInsuranceProviders((ps) => [...ps, data].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setInsuranceModal(null);
      setProviderStatus("saved");
      setTimeout(() => setProviderStatus("idle"), 3000);
    } catch {
      setProviderError(t.common.networkError);
    } finally {
      setProviderSaving(false);
    }
  }

  async function deleteProvider(id: string, name: string) {
    if (!confirm(s.confirmDeleteProvider)) return;
    await apiFetch(`/api/insurance-providers/${id}`, { method: "DELETE" });
    setInsuranceProviders((ps) => ps.filter((p) => p.id !== id));
    setProviderStatus("deleted");
    setTimeout(() => setProviderStatus("idle"), 3000);
  }

  function loadRetentionStats() {
    fetch("/api/audit/retention-stats")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setRetentionStats(d); })
      .catch(() => {});
  }

  async function handlePurge() {
    if (!confirm(s.purgeConfirm)) return;
    setPurging(true); setPurgedCount(null);
    try {
      const res = await fetch("/api/audit/archive", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ olderThanDays: retentionDays }),
      });
      if (res.ok) {
        const d = await res.json();
        setPurgedCount(d.deleted);
        loadRetentionStats();
      }
    } catch { /* silent */ }
    finally { setPurging(false); }
  }

  async function handleAiGenerate() {
    if (!tplEditing) return;
    setAiGenerating(true); setAiGenerateMsg("");
    try {
      const res = await fetch("/api/settings/notification-templates/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType: tplEditing.eventType, channel: tplEditing.channel, language: tplEditing.language }),
      });
      if (res.ok) {
        const d = await res.json();
        setTplEditing(tpl => tpl ? ({ ...tpl, body: d.body || tpl.body, subject: d.subject ?? tpl.subject }) : tpl);
        setAiGenerateMsg(s.aiGenerateSuccess);
      } else {
        const err = await res.json().catch(() => ({}));
        setAiGenerateMsg(err.detail || s.aiGenerateFailed);
      }
    } catch { setAiGenerateMsg(s.aiGenerateFailed); }
    finally { setAiGenerating(false); }
  }

  function loadTemplates(overrides?: { eventType?: string; channel?: string }) {
    setTemplatesLoading(true);
    const et = overrides?.eventType ?? tplFilter.eventType;
    const ch = overrides?.channel ?? tplFilter.channel;
    const params = new URLSearchParams();
    if (et) params.set("event_type", et);
    if (ch) params.set("channel", ch);
    const qs = params.toString();
    fetch(`/api/settings/notification-templates${qs ? `?${qs}` : ""}`)
      .then((r) => r.ok ? r.json() : [])
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setTemplatesLoading(false));
  }

  async function saveTplEdit() {
    if (!tplEditing) return;
    setTplSaving(true);
    try {
      const res = await fetch(`/api/settings/notification-templates/${tplEditing.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: tplEditing.subject, body: tplEditing.body, isActive: tplEditing.isActive }),
      });
      if (res.ok) { setTplEditing(null); loadTemplates(); }
    } catch { /* silent */ }
    finally { setTplSaving(false); }
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
    await apiFetch(`/api/branches/${b.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !b.isActive }) });
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
    await apiFetch(`/api/clinics/${c.id}`, { method: "PATCH", body: JSON.stringify({ status: newStatus }) });
    loadClinics(clinicBranchId);
  }

  async function handleSmtpSave() {
    setSmtpSaving(true); setSmtpStatus("idle");
    const body: Record<string, unknown> = { ...smtp };
    if (!body.password) delete body.password;
    try {
      await apiFetch("/api/settings/smtp", { method: "PATCH", body: JSON.stringify(body) });
      setSmtpStatus("saved");
      setTimeout(() => setSmtpStatus("idle"), 3000);
    } catch { setSmtpStatus("error"); }
    finally { setSmtpSaving(false); }
  }

  async function handleSmtpTest() {
    if (!smtpTestEmail.trim()) return;
    setSmtpTesting(true); setSmtpTestMsg("");
    try {
      await apiFetch("/api/settings/smtp/test", { method: "POST", body: JSON.stringify({ toEmail: smtpTestEmail }) });
      setSmtpTestMsg(s.smtpTestSuccess);
    } catch { setSmtpTestMsg(s.smtpTestFailed); }
    finally { setSmtpTesting(false); }
  }

  async function handleWaSave() {
    if (!waBranchId) return;
    setWaSaving(true); setWaStatus("idle");
    try {
      const res = await fetch(`/api/settings/whatsapp/${waBranchId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(wa),
      });
      setWaStatus(res.ok ? "saved" : "error");
      if (res.ok) setTimeout(() => setWaStatus("idle"), 3000);
    } catch { setWaStatus("error"); }
    finally { setWaSaving(false); }
  }

  async function handleWaTest() {
    if (!waBranchId || !waTestNumber.trim()) return;
    setWaTesting(true); setWaTestMsg("");
    try {
      const res = await fetch(`/api/settings/whatsapp/${waBranchId}/test`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toNumber: waTestNumber, message: "MediFlow test message" }),
      });
      setWaTestMsg(res.ok ? s.waTestSuccess : s.waTestFailed);
    } catch { setWaTestMsg(s.waTestFailed); }
    finally { setWaTesting(false); }
  }

  async function handleSmsSave() {
    setSmsSaving(true); setSmsStatus("idle");
    const body: Record<string, unknown> = { ...sms };
    if (!body.apiKey) delete body.apiKey;
    if (!body.apiSecret) delete body.apiSecret;
    try {
      await apiFetch("/api/settings/sms", { method: "PATCH", body: JSON.stringify(body) });
      setSmsStatus("saved");
      setTimeout(() => setSmsStatus("idle"), 3000);
    } catch { setSmsStatus("error"); }
    finally { setSmsSaving(false); }
  }

  async function handlePaymentSave() {
    setPaymentSaving(true); setPaymentStatus("idle");
    const body: Record<string, unknown> = { provider: payment.provider, publicKey: payment.publicKey, currency: payment.currency, testMode: payment.testMode, isActive: payment.isActive };
    if (paymentSecretKey) body.secretKey = paymentSecretKey;
    if (paymentWebhookSecret) body.webhookSecret = paymentWebhookSecret;
    try {
      await apiFetch("/api/settings/payment", { method: "PATCH", body: JSON.stringify(body) });
      setPaymentStatus("saved");
      setTimeout(() => setPaymentStatus("idle"), 3000); setPaymentSecretKey(""); setPaymentWebhookSecret("");
    } catch { setPaymentStatus("error"); }
    finally { setPaymentSaving(false); }
  }

  async function toggleFlag(flag: FeatureFlag) {
    setFlagToggling(flag.id);
    try {
      const res = await fetch(`/api/settings/features/${flag.key}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: !flag.isEnabled }),
      });
      if (res.ok) setFlags((fs) => fs.map((f) => f.id === flag.id ? { ...f, isEnabled: !f.isEnabled } : f));
    } catch { /* silent */ }
    finally { setFlagToggling(null); }
  }

  async function createApiKey() {
    if (!apiKeyForm.name.trim()) return;
    setApiKeyCreating(true);
    try {
      const body: Record<string, unknown> = { name: apiKeyForm.name, scopes: apiKeyForm.scopes };
      if (apiKeyForm.branchId) body.branchId = apiKeyForm.branchId;
      if (apiKeyForm.expiresAt) body.expiresAt = apiKeyForm.expiresAt;
      const data = await apiFetch<ApiKey>("/api/settings/api-keys", { method: "POST", body: JSON.stringify(body) });
      setApiKeyCreated(data);
      setApiKeyModal(false);
      setApiKeyForm({ name: "", scopes: [], branchId: "", expiresAt: "" });
      loadApiKeys();
    } catch { /* silent */ }
    finally { setApiKeyCreating(false); }
  }

  async function revokeApiKey(id: string) {
    await apiFetch(`/api/settings/api-keys/${id}`, { method: "DELETE" });
    setApiKeys((ks) => ks.filter((k) => k.id !== id));
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key).then(() => { setApiKeyCopied(true); setTimeout(() => setApiKeyCopied(false), 2000); });
  }

  // ── Nav sections (grouped accordion) ─────────────────────────────────────

  const navGroups = [
    { key: "general",       label: s.navGeneral,       items: [
      { key: "clinic",        label: s.clinicProfile,     icon: "local_hospital" },
      { key: "notifications", label: s.notifications,     icon: "notifications" },
      { key: "billing",       label: s.billingConfig,     icon: "payments" },
    ]},
    { key: "security",      label: s.navSecurity,      items: [
      { key: "security",      label: s.securityAuth,      icon: "security" },
      { key: "apikeys",       label: s.apiKeys,           icon: "key" },
    ]},
    { key: "organization",  label: s.navOrganization,  items: [
      { key: "branches",      label: s.branches,          icon: "account_tree" },
      { key: "clinics",       label: s.clinics,           icon: "medical_services" },
      { key: "insurance",     label: s.insuranceProviders, icon: "health_and_safety" },
      { key: "health",        label: s.branchHealth,      icon: "monitor_heart" },
    ]},
    { key: "integrations",  label: s.navIntegrations,  items: [
      { key: "smtp",          label: s.smtpConfig,        icon: "email" },
      { key: "whatsapp",      label: s.whatsapp,          icon: "chat" },
      { key: "sms",           label: s.smsGatewayConfig,  icon: "sms" },
      { key: "payment",       label: s.paymentConfig,     icon: "credit_card" },
      { key: "integrations",  label: s.integrations,      icon: "cable" },
    ]},
    { key: "system",        label: s.navSystem,        items: [
      { key: "features",      label: s.featureFlags,      icon: "toggle_on" },
      { key: "templates",     label: s.notifTemplates,    icon: "mail_outline" },
      { key: "history",       label: s.settingsHistory,   icon: "history" },
    ]},
  ] as const;

  const showGlobalSave = !["branches", "clinics", "smtp", "whatsapp", "sms", "payment", "features", "apikeys", "templates", "integrations", "history", "health", "insurance"].includes(activeSection);

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
        {activeSection === "apikeys" && (
          <button onClick={() => setApiKeyModal(true)} className="flex items-center gap-2 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 shadow-sm">
            <span className="material-symbols-outlined text-[18px]">add</span>{s.addApiKey}
          </button>
        )}
      </div>

      <div className="flex gap-6">
        {/* Sidebar nav — accordion groups */}
        <div className="w-56 flex-shrink-0">
          <nav className="bg-white rounded-xl border border-[#e3e2e6] overflow-hidden">
            {navGroups.map((group, gi) => {
              const collapsed = collapsedGroups.has(group.key);
              return (
                <div key={group.key} className={gi > 0 ? "border-t border-[#e3e2e6]" : ""}>
                  <button
                    onClick={() => setCollapsedGroups(prev => {
                      const next = new Set(prev);
                      next.has(group.key) ? next.delete(group.key) : next.add(group.key);
                      return next;
                    })}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-[#f8f7fb] transition-colors">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#74777f]">{group.label}</span>
                    <span className={`material-symbols-outlined text-[16px] text-[#c4c6cf] transition-transform ${collapsed ? "" : "rotate-180"}`}>expand_less</span>
                  </button>
                  {!collapsed && group.items.map((sec) => (
                    <button key={sec.key} onClick={() => setActiveSection(sec.key as Section)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors ${
                        activeSection === sec.key
                          ? "bg-[#d3e4ff]/30 text-[#1960a3] font-semibold border-s-4 border-s-[#1960a3]"
                          : "text-[#43474e] hover:bg-[#f4f3f7]"
                      }`}>
                      <span className={`material-symbols-outlined text-[18px] ${activeSection === sec.key ? "text-[#1960a3]" : "text-[#74777f]"}`}>{sec.icon}</span>
                      {sec.label}
                    </button>
                  ))}
                </div>
              );
            })}
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
                                    <button onClick={() => router.push(`/settings/branches/${b.id}`)} className="p-1.5 hover:bg-[#d3e4ff] rounded-lg" aria-label={s.openBranchDetail} title={s.openBranchDetail}>
                                      <span className="material-symbols-outlined text-[#1960a3] text-[16px]">open_in_new</span>
                                    </button>
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

              {/* ── WhatsApp ── */}
              {activeSection === "whatsapp" && (
                <div className="space-y-5">
                  {/* Branch selector */}
                  {branches.length > 0 && (
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-semibold text-[#43474e]">{s.waSelectBranch}:</label>
                      <select className="select-field w-56" value={waBranchId} onChange={e => { setWaBranchId(e.target.value); loadWa(e.target.value); }}>
                        <option value="">—</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                  )}
                  {!waBranchId ? (
                    <div className="bg-white rounded-xl border border-[#e3e2e6] p-12 flex flex-col items-center gap-3">
                      <span className="material-symbols-outlined text-[48px] text-[#c4c6cf]">chat</span>
                      <p className="text-sm text-[#74777f]">{s.waSelectBranch}</p>
                    </div>
                  ) : waLoading ? (
                    <div className="bg-white rounded-xl border border-[#e3e2e6] p-12 flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" /></div>
                  ) : (
                    <>
                      <SettingsCard title={s.whatsappTitle} desc={s.whatsappDesc}>
                        <div className="space-y-5">
                          <div className="flex items-center gap-3">
                            <Toggle label={s.waActive} checked={wa.isActive} onChange={v => setWa(f => ({ ...f, isActive: v }))} />
                            {wa.isVerified
                              ? <span className="badge bg-[#ccfbf1] text-[#0d9488]">{s.waVerified}</span>
                              : <span className="badge bg-[#fff7ed] text-[#d97706]">{s.waNotVerified}</span>}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <Field label={s.waPhoneNumberId}><input className="input-field font-mono text-xs" value={wa.phoneNumberId} onChange={e => setWa(f => ({ ...f, phoneNumberId: e.target.value }))} /></Field>
                            <Field label={s.waWabaId}><input className="input-field font-mono text-xs" value={wa.wabaId} onChange={e => setWa(f => ({ ...f, wabaId: e.target.value }))} /></Field>
                            <Field label={s.waPhoneNumber}><input className="input-field" value={wa.phoneNumber} placeholder="+962..." onChange={e => setWa(f => ({ ...f, phoneNumber: e.target.value }))} /></Field>
                            <Field label={s.waDisplayName}><input className="input-field" value={wa.displayName} onChange={e => setWa(f => ({ ...f, displayName: e.target.value }))} /></Field>
                            <Field label={s.waAccessToken} full><input className="input-field font-mono text-xs" value={wa.accessToken} type="password" placeholder="EAAxxxxx..." onChange={e => setWa(f => ({ ...f, accessToken: e.target.value }))} /></Field>
                            <Field label={s.waAppSecret}><input className="input-field font-mono text-xs" value={wa.appSecret} type="password" onChange={e => setWa(f => ({ ...f, appSecret: e.target.value }))} /></Field>
                            <Field label={s.waWebhookToken}><input className="input-field font-mono text-xs" value={wa.webhookVerifyToken} onChange={e => setWa(f => ({ ...f, webhookVerifyToken: e.target.value }))} /></Field>
                          </div>
                          <div className="space-y-3 pt-2 border-t border-[#e3e2e6]">
                            <Toggle label={s.waAutoReply} checked={wa.autoReplyEnabled} onChange={v => setWa(f => ({ ...f, autoReplyEnabled: v }))} />
                            <Toggle label={s.waBusinessHours} checked={wa.businessHoursOnly} onChange={v => setWa(f => ({ ...f, businessHoursOnly: v }))} />
                            <Toggle label={s.waAiReply} checked={wa.aiReplyEnabled} onChange={v => setWa(f => ({ ...f, aiReplyEnabled: v }))} />
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-[#e3e2e6]">
                            <div>
                              {waStatus === "saved" && <span className="text-xs text-[#0d9488] font-semibold">{s.waSaved}</span>}
                              {waStatus === "error" && <span className="text-xs text-[#ba1a1a] font-semibold">{s.waSaveFailed}</span>}
                            </div>
                            <button onClick={handleWaSave} disabled={waSaving} className="btn-primary text-sm px-4 py-2 disabled:opacity-60 flex items-center gap-2">
                              {waSaving ? <Spinner /> : <span className="material-symbols-outlined text-[16px]">save</span>}{t.common.save}
                            </button>
                          </div>
                          {/* Test send */}
                          <div className="bg-[#f8f7fb] rounded-xl p-4">
                            <p className="text-sm font-semibold text-[#43474e] mb-3">{s.waTestSend}</p>
                            <div className="flex gap-3">
                              <input className="input-field flex-1" value={waTestNumber} placeholder={s.waTestNumber} onChange={e => setWaTestNumber(e.target.value)} />
                              <button onClick={handleWaTest} disabled={waTesting || !waTestNumber.trim()} className="btn-secondary text-sm px-4 py-2 disabled:opacity-60 flex items-center gap-2 whitespace-nowrap">
                                {waTesting ? <Spinner /> : <span className="material-symbols-outlined text-[16px]">send</span>}{s.waTestSend}
                              </button>
                            </div>
                            {waTestMsg && <p className={`text-xs mt-2 font-semibold ${waTestMsg === s.waTestSuccess ? "text-[#0d9488]" : "text-[#ba1a1a]"}`}>{waTestMsg}</p>}
                          </div>
                        </div>
                      </SettingsCard>
                      {/* Templates */}
                      <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
                        <div className="p-5 border-b border-[#e3e2e6]">
                          <h2 className="text-base font-semibold text-[#1a1c1e]">{s.waTemplates}</h2>
                        </div>
                        {waTemplates.length === 0 ? (
                          <div className="p-8 flex flex-col items-center gap-2">
                            <span className="material-symbols-outlined text-[36px] text-[#c4c6cf]">chat_bubble</span>
                            <p className="text-sm text-[#74777f]">{s.waNoTemplates}</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead><tr className="bg-[#f8f7fb]">
                                <th className="table-header">{s.waTemplateName}</th>
                                <th className="table-header">{s.waCategory}</th>
                                <th className="table-header">{s.waLanguage}</th>
                                <th className="table-header">{t.common.status}</th>
                              </tr></thead>
                              <tbody>
                                {waTemplates.map(tpl => (
                                  <tr key={tpl.id} className="table-row">
                                    <td className="table-cell font-medium">{tpl.name}</td>
                                    <td className="table-cell text-[#74777f] text-xs">{tpl.category}</td>
                                    <td className="table-cell text-[#74777f] text-xs">{tpl.language}</td>
                                    <td className="table-cell"><span className={`badge ${tpl.isActive ? "bg-[#ccfbf1] text-[#0d9488]" : "bg-[#f4f3f7] text-[#74777f]"}`}>{tpl.isActive ? t.common.active : t.common.inactive}</span></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── SMS Gateway ── */}
              {activeSection === "sms" && (
                <SettingsCard title={s.smsGatewayConfigTitle} desc={s.smsGatewayConfigDesc}>
                  {smsLoading ? (
                    <div className="flex items-center justify-center h-20"><div className="w-6 h-6 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" /></div>
                  ) : (
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
                      <div className="flex items-center justify-between pt-2 border-t border-[#e3e2e6]">
                        <div>
                          {smsStatus === "saved" && <span className="text-xs text-[#0d9488] font-semibold">{s.smsSaved}</span>}
                          {smsStatus === "error" && <span className="text-xs text-[#ba1a1a] font-semibold">{s.smsSaveFailed}</span>}
                        </div>
                        <button onClick={handleSmsSave} disabled={smsSaving} className="btn-primary text-sm px-4 py-2 disabled:opacity-60 flex items-center gap-2">
                          {smsSaving ? <Spinner /> : <span className="material-symbols-outlined text-[16px]">save</span>}{t.common.save}
                        </button>
                      </div>
                    </div>
                  )}
                </SettingsCard>
              )}

              {/* ── Payment Gateway ── */}
              {activeSection === "payment" && (
                <SettingsCard title={s.paymentConfigTitle} desc={s.paymentConfigDesc}>
                  {paymentLoading ? (
                    <div className="flex items-center justify-center h-20"><div className="w-6 h-6 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" /></div>
                  ) : (
                    <div className="space-y-5">
                      <div className="flex gap-5">
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
                      <div className="flex items-center justify-between pt-2 border-t border-[#e3e2e6]">
                        <div>
                          {paymentStatus === "saved" && <span className="text-xs text-[#0d9488] font-semibold">{s.paymentSaved}</span>}
                          {paymentStatus === "error" && <span className="text-xs text-[#ba1a1a] font-semibold">{s.paymentSaveFailed}</span>}
                        </div>
                        <button onClick={handlePaymentSave} disabled={paymentSaving} className="btn-primary text-sm px-4 py-2 disabled:opacity-60 flex items-center gap-2">
                          {paymentSaving ? <Spinner /> : <span className="material-symbols-outlined text-[16px]">save</span>}{t.common.save}
                        </button>
                      </div>
                    </div>
                  )}
                </SettingsCard>
              )}

              {/* ── Feature Flags ── */}
              {activeSection === "features" && (
                <div>
                  <div className="mb-4">
                    <h2 className="text-base font-semibold text-[#1a1c1e]">{s.featureFlagsTitle}</h2>
                    <p className="text-xs text-[#74777f] mt-0.5">{s.featureFlagsDesc}</p>
                  </div>
                  {flagsLoading ? (
                    <div className="bg-white rounded-xl border border-[#e3e2e6] p-12 flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" /></div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {flags.map(flag => (
                        <div key={flag.id} className="bg-white rounded-xl border border-[#e3e2e6] p-4 flex items-start justify-between gap-3 shadow-[0_1px_6px_rgba(0,0,0,0.04)]">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[#1a1c1e] font-mono">{flag.key}</p>
                            <p className="text-xs text-[#74777f] mt-0.5 leading-relaxed">{flag.description}</p>
                            <span className={`mt-2 inline-block badge text-[10px] ${flag.isEnabled ? "bg-[#ccfbf1] text-[#0d9488]" : "bg-[#f4f3f7] text-[#74777f]"}`}>
                              {flag.isEnabled ? s.featureEnabled : s.featureDisabled}
                            </span>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={flag.isEnabled}
                            dir="ltr"
                            onClick={() => toggleFlag(flag)}
                            disabled={flagToggling === flag.id}
                            className={`relative w-11 h-6 rounded-full flex-shrink-0 mt-1 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1960a3] focus-visible:ring-offset-2 disabled:opacity-50 ${flag.isEnabled ? "bg-[#002045]" : "bg-[#c4c6cf]"}`}>
                            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${flag.isEnabled ? "translate-x-[1.375rem]" : "translate-x-0.5"}`} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── API Keys ── */}
              {activeSection === "apikeys" && (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
                    <div className="p-5 border-b border-[#e3e2e6]">
                      <h2 className="text-base font-semibold text-[#1a1c1e]">{s.apiKeysTitle}</h2>
                      <p className="text-xs text-[#74777f] mt-0.5">{s.apiKeysDesc}</p>
                    </div>
                    {apiKeysLoading ? (
                      <div className="p-12 flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" /></div>
                    ) : apiKeys.length === 0 ? (
                      <div className="p-12 flex flex-col items-center gap-3">
                        <span className="material-symbols-outlined text-[48px] text-[#c4c6cf]">key</span>
                        <p className="text-sm text-[#74777f]">{s.noApiKeys}</p>
                        <button onClick={() => setApiKeyModal(true)} className="mt-2 btn-primary text-sm px-4 py-2">
                          <span className="material-symbols-outlined text-[16px]">add</span>{s.addApiKey}
                        </button>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead><tr className="bg-[#f8f7fb]">
                            <th className="table-header">{s.apiKeyName}</th>
                            <th className="table-header">{s.apiKeyPrefix}</th>
                            <th className="table-header">{s.apiKeyScopes}</th>
                            <th className="table-header">{s.apiKeyLastUsed}</th>
                            <th className="table-header">{s.apiKeyExpiry}</th>
                            <th className="table-header">{t.common.actions}</th>
                          </tr></thead>
                          <tbody>
                            {apiKeys.map(k => (
                              <tr key={k.id} className="table-row">
                                <td className="table-cell font-medium">{k.name}</td>
                                <td className="table-cell"><span className="font-mono text-xs bg-[#f4f3f7] px-2 py-0.5 rounded">{k.keyPrefix}…</span></td>
                                <td className="table-cell"><div className="flex flex-wrap gap-1">{(k.scopes || []).map(sc => <span key={sc} className="badge bg-[#d3e4ff] text-[#1960a3] text-[10px]">{sc}</span>)}</div></td>
                                <td className="table-cell text-[#74777f] text-xs whitespace-nowrap">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : t.common.na}</td>
                                <td className="table-cell text-[#74777f] text-xs whitespace-nowrap">{k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : t.common.na}</td>
                                <td className="table-cell">
                                  <button onClick={() => revokeApiKey(k.id)} className="text-xs text-[#ba1a1a] hover:underline font-semibold">{s.apiKeyRevoke}</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Notification Templates ── */}
              {activeSection === "templates" && (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
                    <div className="p-5 border-b border-[#e3e2e6]">
                      <h2 className="text-base font-semibold text-[#1a1c1e]">{s.notifTemplatesTitle}</h2>
                      <p className="text-xs text-[#74777f] mt-0.5">{s.notifTemplatesDesc}</p>
                    </div>
                    {/* Filters */}
                    <div className="px-5 py-3 border-b border-[#e3e2e6] flex items-center gap-4 flex-wrap">
                      <select className="select-field w-48" value={tplFilter.eventType}
                        onChange={e => { const v = e.target.value; setTplFilter(f => ({ ...f, eventType: v })); loadTemplates({ eventType: v }); }}>
                        <option value="">{s.tplAllEvents}</option>
                        {["appointment_reminder","appointment_confirmation","appointment_cancellation","lab_results","payment_receipt","password_reset","welcome","low_stock","leave_approved","leave_rejected"].map(ev => (
                          <option key={ev} value={ev}>{ev.replace(/_/g, " ")}</option>
                        ))}
                      </select>
                      <select className="select-field w-36" value={tplFilter.channel}
                        onChange={e => { const v = e.target.value; setTplFilter(f => ({ ...f, channel: v })); loadTemplates({ channel: v }); }}>
                        <option value="">{s.tplAllChannels}</option>
                        <option value="email">Email</option>
                        <option value="sms">SMS</option>
                        <option value="whatsapp">WhatsApp</option>
                      </select>
                    </div>
                    {templatesLoading ? (
                      <div className="p-12 flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" /></div>
                    ) : templates.length === 0 ? (
                      <div className="p-12 flex flex-col items-center gap-3">
                        <span className="material-symbols-outlined text-[48px] text-[#c4c6cf]">mail_outline</span>
                        <p className="text-sm text-[#74777f]">{s.noNotifTemplates}</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead><tr className="bg-[#f8f7fb]">
                            <th className="table-header">{s.tplEventType}</th>
                            <th className="table-header">{s.tplChannel}</th>
                            <th className="table-header">{s.tplLanguage}</th>
                            <th className="table-header">{s.tplSubject}</th>
                            <th className="table-header">{t.common.status}</th>
                            <th className="table-header">{t.common.actions}</th>
                          </tr></thead>
                          <tbody>
                            {templates.map(tpl => (
                              <tr key={tpl.id} className="table-row">
                                <td className="table-cell"><span className="font-mono text-xs bg-[#f4f3f7] px-2 py-0.5 rounded">{tpl.eventType}</span></td>
                                <td className="table-cell">
                                  <span className={`badge text-[10px] ${tpl.channel === "email" ? "bg-[#d3e4ff] text-[#1960a3]" : tpl.channel === "sms" ? "bg-[#fff7ed] text-[#d97706]" : "bg-[#ccfbf1] text-[#0d9488]"}`}>
                                    {tpl.channel}
                                  </span>
                                </td>
                                <td className="table-cell text-[#74777f] text-xs">{tpl.language}</td>
                                <td className="table-cell text-[#74777f] text-xs max-w-[200px] truncate">{tpl.subject || t.common.na}</td>
                                <td className="table-cell">
                                  <span className={`badge text-[10px] ${tpl.isActive ? "bg-[#ccfbf1] text-[#0d9488]" : "bg-[#f4f3f7] text-[#74777f]"}`}>
                                    {tpl.isActive ? t.common.active : t.common.inactive}
                                  </span>
                                  {tpl.isDefault && <span className="ms-1 badge text-[10px] bg-[#d3e4ff] text-[#1960a3]">{s.tplDefault}</span>}
                                </td>
                                <td className="table-cell">
                                  <button onClick={() => setTplEditing({ ...tpl })} className="p-1.5 hover:bg-[#f4f3f7] rounded-lg" aria-label={t.common.edit}>
                                    <span className="material-symbols-outlined text-[#74777f] text-[16px]">edit</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Branch Health ── */}
              {activeSection === "health" && (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
                    <div className="p-5 border-b border-[#e3e2e6] flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-semibold text-[#1a1c1e]">{s.branchHealth}</h2>
                        <p className="text-xs text-[#74777f] mt-0.5">{s.branchHealthDesc}</p>
                      </div>
                      <button onClick={loadHealth} className="p-2 hover:bg-[#f4f3f7] rounded-lg" aria-label={t.common.retry}>
                        <span className="material-symbols-outlined text-[#74777f] text-[18px]">refresh</span>
                      </button>
                    </div>
                    {healthLoading ? (
                      <div className="p-12 flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" /></div>
                    ) : healthData.length === 0 ? (
                      <div className="p-12 flex flex-col items-center gap-3">
                        <span className="material-symbols-outlined text-[48px] text-[#c4c6cf]">monitor_heart</span>
                        <p className="text-sm text-[#74777f]">{s.noBranchHealthData}</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead><tr className="bg-[#f8f7fb]">
                            <th className="table-header">{s.branchName}</th>
                            <th className="table-header">{s.staffCount}</th>
                            <th className="table-header">{s.appointmentsLast30d}</th>
                            <th className="table-header">{s.openInvoices}</th>
                            <th className="table-header">WhatsApp</th>
                            <th className="table-header">SMS</th>
                            <th className="table-header">{s.paymentConfig}</th>
                            <th className="table-header">{s.healthScore}</th>
                          </tr></thead>
                          <tbody>
                            {healthData.map(row => (
                              <tr key={row.branchId} className="table-row">
                                <td className="table-cell">
                                  <p className="font-semibold text-[#1a1c1e]">{row.branchName}</p>
                                  <p className="text-[10px] font-mono text-[#74777f]">{row.branchCode}</p>
                                </td>
                                <td className="table-cell text-center text-[#74777f]">{row.staffCount}</td>
                                <td className="table-cell text-center text-[#74777f]">{row.appointmentsLast30d}</td>
                                <td className="table-cell text-center">
                                  <span className={row.openInvoices > 0 ? "text-[#d97706] font-semibold" : "text-[#74777f]"}>{row.openInvoices}</span>
                                </td>
                                <td className="table-cell text-center">
                                  <span className={`material-symbols-outlined text-[18px] ${row.whatsappActive ? "text-[#0d9488]" : "text-[#c4c6cf]"}`}>{row.whatsappActive ? "check_circle" : "cancel"}</span>
                                </td>
                                <td className="table-cell text-center">
                                  <span className={`material-symbols-outlined text-[18px] ${row.smsActive ? "text-[#0d9488]" : "text-[#c4c6cf]"}`}>{row.smsActive ? "check_circle" : "cancel"}</span>
                                </td>
                                <td className="table-cell text-center">
                                  <span className={`material-symbols-outlined text-[18px] ${row.paymentActive ? "text-[#0d9488]" : "text-[#c4c6cf]"}`}>{row.paymentActive ? "check_circle" : "cancel"}</span>
                                </td>
                                <td className="table-cell">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-[#f4f3f7] rounded-full h-2">
                                      <div className="h-2 rounded-full transition-all" style={{
                                        width: `${row.healthScore}%`,
                                        backgroundColor: row.healthScore >= 70 ? "#0d9488" : row.healthScore >= 40 ? "#d97706" : "#ba1a1a",
                                      }} />
                                    </div>
                                    <span className="text-xs font-bold text-[#1a1c1e] w-8 text-end">{row.healthScore}</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
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
                <div className="space-y-4">
                {/* Retention panel */}
                <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
                  <h2 className="text-base font-semibold text-[#1a1c1e] mb-1">{s.auditRetention}</h2>
                  <p className="text-xs text-[#74777f] mb-4">{s.auditRetentionDesc}</p>
                  {retentionStats && (
                    <div className="flex gap-6 mb-4">
                      <div><p className="text-[10px] text-[#74777f] uppercase tracking-wide">{s.totalLogs}</p><p className="text-xl font-bold text-[#1a1c1e]">{retentionStats.totalLogs.toLocaleString()}</p></div>
                      <div><p className="text-[10px] text-[#74777f] uppercase tracking-wide">{s.oldestLog}</p><p className="text-sm font-medium text-[#43474e]">{retentionStats.oldestLog ? new Date(retentionStats.oldestLog).toLocaleDateString() : "—"}</p></div>
                    </div>
                  )}
                  {purgedCount !== null && <p className="text-xs text-[#0d9488] font-semibold mb-3">{purgedCount} {s.purgedCount}</p>}
                  <div className="flex items-end gap-3 flex-wrap">
                    <div>
                      <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.purgeOlderThan}</label>
                      <input type="number" className="input-field w-32" value={retentionDays} min={30} max={3650}
                        onChange={e => setRetentionDays(Number(e.target.value))} />
                    </div>
                    <button onClick={handlePurge} disabled={purging}
                      className="btn-danger text-sm px-4 py-2 flex items-center gap-2 disabled:opacity-60 min-h-[44px]">
                      {purging ? <Spinner /> : <span className="material-symbols-outlined text-[16px]">delete_forever</span>}{s.purgeNow}
                    </button>
                  </div>
                </div>
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
                </div>
              )}

              {/* ── Insurance Providers ── */}
              {activeSection === "insurance" && (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
                    <div className="p-5 border-b border-[#e3e2e6] flex items-center justify-between gap-4">
                      <div>
                        <h2 className="text-base font-semibold text-[#1a1c1e]">{s.insuranceProvidersTitle}</h2>
                        <p className="text-xs text-[#74777f] mt-0.5">{s.insuranceProvidersDesc}</p>
                      </div>
                      <button
                        onClick={() => { setEditingProvider(null); setProviderForm({ name: "", code: "", contactPhone: "", contactEmail: "", notes: "", isActive: true }); setProviderError(""); setInsuranceModal("add"); }}
                        className="btn-primary text-sm px-3 py-2 shrink-0 flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">add</span>
                        {s.addInsuranceProvider}
                      </button>
                    </div>

                    {providerStatus === "saved" && <div className="px-5 py-2.5 bg-[#ccfbf1] text-[#0d9488] text-sm font-semibold">{s.providerSaved}</div>}
                    {providerStatus === "deleted" && <div className="px-5 py-2.5 bg-[#ffdad6] text-[#ba1a1a] text-sm font-semibold">{s.providerDeleted}</div>}

                    {insuranceLoading ? (
                      <div className="p-12 flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" /></div>
                    ) : insuranceProviders.length === 0 ? (
                      <div className="p-12 flex flex-col items-center gap-3">
                        <span className="material-symbols-outlined text-[48px] text-[#c4c6cf]">health_and_safety</span>
                        <p className="text-sm font-semibold text-[#74777f]">{s.noInsuranceProviders}</p>
                        <p className="text-xs text-[#74777f] text-center max-w-xs">{s.noInsuranceProvidersDesc}</p>
                        <button
                          onClick={() => { setProviderForm({ name: "", code: "", contactPhone: "", contactEmail: "", notes: "", isActive: true }); setProviderError(""); setInsuranceModal("add"); }}
                          className="mt-2 btn-primary text-sm px-4 py-2"
                        >
                          <span className="material-symbols-outlined text-[16px]">add</span>{s.addInsuranceProvider}
                        </button>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-[#f8f7fb]">
                              <th className="table-header">{s.insuranceProviderName}</th>
                              <th className="table-header">{s.insuranceProviderCode}</th>
                              <th className="table-header">{s.insuranceProviderPhone}</th>
                              <th className="table-header">{s.insuranceProviderEmail}</th>
                              <th className="table-header">{t.common.status}</th>
                              <th className="table-header">{t.common.actions}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {insuranceProviders.map((prov) => (
                              <tr key={prov.id} className="table-row">
                                <td className="table-cell font-semibold text-[#1a1c1e]">{prov.name}</td>
                                <td className="table-cell"><span className="font-mono text-xs bg-[#f4f3f7] px-2 py-0.5 rounded">{prov.code ?? "—"}</span></td>
                                <td className="table-cell text-[#74777f]">{prov.contactPhone ?? "—"}</td>
                                <td className="table-cell text-[#74777f]">{prov.contactEmail ?? "—"}</td>
                                <td className="table-cell">
                                  <span className={`badge text-[10px] ${prov.isActive ? "bg-[#ccfbf1] text-[#0d9488]" : "bg-[#f4f3f7] text-[#74777f]"}`}>
                                    {prov.isActive ? t.common.active : t.common.inactive}
                                  </span>
                                </td>
                                <td className="table-cell">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => { setEditingProvider(prov); setProviderForm({ name: prov.name, code: prov.code ?? "", contactPhone: prov.contactPhone ?? "", contactEmail: prov.contactEmail ?? "", notes: prov.notes ?? "", isActive: prov.isActive }); setProviderError(""); setInsuranceModal("edit"); }}
                                      className="p-1.5 rounded hover:bg-[#f4f3f7] text-[#74777f] hover:text-[#1960a3] transition-colors"
                                      aria-label={t.common.edit}
                                    >
                                      <span className="material-symbols-outlined text-[16px]">edit</span>
                                    </button>
                                    <button
                                      onClick={() => deleteProvider(prov.id, prov.name)}
                                      className="p-1.5 rounded hover:bg-[#ffdad6] text-[#74777f] hover:text-[#ba1a1a] transition-colors"
                                      aria-label={t.common.delete}
                                    >
                                      <span className="material-symbols-outlined text-[16px]">delete</span>
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

      {/* ── Template Edit Modal ── */}
      {tplEditing && (
        <div role="dialog" aria-modal="true" aria-labelledby="tpl-modal-title" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setTplEditing(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-[#e3e2e6]">
              <div>
                <h2 id="tpl-modal-title" className="text-lg font-bold text-[#1a1c1e]">{s.tplEdit}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-xs bg-[#f4f3f7] px-2 py-0.5 rounded">{tplEditing.eventType}</span>
                  <span className={`badge text-[10px] ${tplEditing.channel === "email" ? "bg-[#d3e4ff] text-[#1960a3]" : tplEditing.channel === "sms" ? "bg-[#fff7ed] text-[#d97706]" : "bg-[#ccfbf1] text-[#0d9488]"}`}>{tplEditing.channel}</span>
                  <span className="text-xs text-[#74777f]">{tplEditing.language}</span>
                </div>
              </div>
              <button onClick={() => { setTplEditing(null); setAiGenerateMsg(""); }} aria-label={t.common.close} className="p-2 hover:bg-[#f4f3f7] rounded-lg"><span className="material-symbols-outlined text-[#74777f]">close</span></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* AI Generate */}
              <div className="bg-[#f8f7fb] rounded-xl p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#43474e]">{s.aiGenerate}</p>
                  <p className="text-[11px] text-[#74777f]">{s.aiGenerateHint}</p>
                  {aiGenerateMsg && <p className={`text-[11px] mt-1 font-semibold ${aiGenerateMsg === s.aiGenerateSuccess ? "text-[#0d9488]" : "text-[#ba1a1a]"}`}>{aiGenerateMsg}</p>}
                </div>
                <button onClick={handleAiGenerate} disabled={aiGenerating}
                  className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5 whitespace-nowrap disabled:opacity-60 flex-shrink-0 min-h-[44px]">
                  {aiGenerating ? <Spinner /> : <span className="material-symbols-outlined text-[16px]">auto_awesome</span>}{aiGenerating ? s.aiGenerating : s.aiGenerate}
                </button>
              </div>
              {tplEditing.channel === "email" && (
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.tplSubject}</label>
                  <input className="input-field" value={tplEditing.subject} onChange={e => setTplEditing(tpl => tpl ? ({ ...tpl, subject: e.target.value }) : tpl)} />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.tplBody}</label>
                <textarea className="input-field resize-none font-mono text-xs" rows={10} value={tplEditing.body} onChange={e => setTplEditing(tpl => tpl ? ({ ...tpl, body: e.target.value }) : tpl)} />
              </div>
              {tplEditing.variables.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-2">{s.tplVariables}</p>
                  <div className="flex flex-wrap gap-1">
                    {tplEditing.variables.map(v => (
                      <code key={v} className="bg-[#f4f3f7] text-[#1960a3] text-[11px] px-2 py-0.5 rounded font-mono cursor-pointer hover:bg-[#d3e4ff]"
                        onClick={() => navigator.clipboard.writeText(`{{${v}}}`)}
                        title="Click to copy">
                        {`{{${v}}}`}
                      </code>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between py-2 border-t border-[#e3e2e6]">
                <span className="text-sm font-medium text-[#1a1c1e]">{t.common.active}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={tplEditing.isActive}
                  dir="ltr"
                  onClick={() => setTplEditing(tpl => tpl ? ({ ...tpl, isActive: !tpl.isActive }) : tpl)}
                  className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1960a3] focus-visible:ring-offset-2 ${tplEditing.isActive ? "bg-[#002045]" : "bg-[#c4c6cf]"}`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${tplEditing.isActive ? "translate-x-[1.375rem]" : "translate-x-0.5"}`} />
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#e3e2e6]">
              <button onClick={() => setTplEditing(null)} className="btn-secondary px-4 py-2 text-sm">{t.common.cancel}</button>
              <button onClick={saveTplEdit} disabled={tplSaving} className="btn-primary px-4 py-2 text-sm disabled:opacity-60 flex items-center gap-2">
                {tplSaving ? <Spinner /> : null}{t.common.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create API Key Modal ── */}
      {apiKeyModal && (
        <div role="dialog" aria-modal="true" aria-labelledby="apikey-modal-title" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setApiKeyModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-[#e3e2e6]">
              <h2 id="apikey-modal-title" className="text-lg font-bold text-[#1a1c1e]">{s.addApiKey}</h2>
              <button onClick={() => setApiKeyModal(false)} aria-label={t.common.close} className="p-2 hover:bg-[#f4f3f7] rounded-lg"><span className="material-symbols-outlined text-[#74777f]">close</span></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.apiKeyName} *</label>
                <input className="input-field" value={apiKeyForm.name} onChange={e => setApiKeyForm(f => ({ ...f, name: e.target.value }))} placeholder="My Integration Key" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.apiKeyBranch}</label>
                <select className="select-field" value={apiKeyForm.branchId} onChange={e => setApiKeyForm(f => ({ ...f, branchId: e.target.value }))}>
                  <option value="">{t.common.all}</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.apiKeyExpiry}</label>
                <input type="date" className="input-field" value={apiKeyForm.expiresAt} onChange={e => setApiKeyForm(f => ({ ...f, expiresAt: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-2">{s.apiKeyScopes}</label>
                <div className="grid grid-cols-2 gap-2">
                  {API_SCOPES.map(sc => {
                    const on = apiKeyForm.scopes.includes(sc);
                    return (
                      <button key={sc} type="button" onClick={() => setApiKeyForm(f => ({ ...f, scopes: on ? f.scopes.filter(s => s !== sc) : [...f.scopes, sc] }))}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium text-start transition-colors ${on ? "border-[#1960a3] bg-[#d3e4ff] text-[#1960a3]" : "border-[#e3e2e6] text-[#43474e] hover:bg-[#f4f3f7]"}`}>
                        <span className="material-symbols-outlined text-[14px]">{on ? "check_box" : "check_box_outline_blank"}</span>
                        {sc}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#e3e2e6]">
              <button onClick={() => setApiKeyModal(false)} className="btn-secondary px-4 py-2 text-sm">{t.common.cancel}</button>
              <button onClick={createApiKey} disabled={apiKeyCreating || !apiKeyForm.name.trim()} className="btn-primary px-4 py-2 text-sm disabled:opacity-60 flex items-center gap-2">
                {apiKeyCreating ? <Spinner /> : null}{t.common.create}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Show-once API Key Modal ── */}
      {apiKeyCreated && (
        <div role="dialog" aria-modal="true" aria-labelledby="apikey-created-title" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-[#e3e2e6]">
              <h2 id="apikey-created-title" className="text-lg font-bold text-[#1a1c1e]">{s.apiKeyCreated}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-[#fff7ed] border border-[#d97706] rounded-xl p-4 text-sm text-[#d97706] font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">warning</span>
                {s.apiKeyOnce}
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-[#f4f3f7] rounded-lg px-4 py-3 text-xs font-mono text-[#1a1c1e] break-all">{apiKeyCreated.key}</code>
                <button onClick={() => copyKey(apiKeyCreated.key!)} aria-label={s.apiKeyCopied} className="p-2.5 rounded-lg border border-[#e3e2e6] hover:bg-[#f4f3f7] transition-colors flex-shrink-0">
                  <span className="material-symbols-outlined text-[20px] text-[#1960a3]">{apiKeyCopied ? "check" : "content_copy"}</span>
                </button>
              </div>
              {apiKeyCopied && <p className="text-xs text-[#0d9488] font-semibold">{s.apiKeyCopied}</p>}
            </div>
            <div className="flex justify-end px-6 py-4 border-t border-[#e3e2e6]">
              <button onClick={() => setApiKeyCreated(null)} className="btn-primary px-6 py-2 text-sm">{t.common.close}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Insurance Provider Modal ── */}
      {insuranceModal && (
        <div role="dialog" aria-modal="true" aria-labelledby="provider-modal-title" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setInsuranceModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-[#e3e2e6]">
              <h2 id="provider-modal-title" className="text-lg font-bold text-[#1a1c1e]">
                {insuranceModal === "add" ? s.addInsuranceProvider : s.editInsuranceProvider}
              </h2>
              <button onClick={() => setInsuranceModal(null)} aria-label={t.common.close} className="p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors">
                <span className="material-symbols-outlined text-[#74777f]">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {providerError && <div className="bg-[#ffdad6] text-[#ba1a1a] text-sm px-4 py-2.5 rounded-lg">{providerError}</div>}
              <div>
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.insuranceProviderName} *</label>
                <input className="input-field" placeholder="e.g. CIGNA, AXA, BUPA" value={providerForm.name} onChange={(e) => setProviderForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.insuranceProviderCode}</label>
                <input className="input-field font-mono uppercase" placeholder="e.g. CIGNA" value={providerForm.code} onChange={(e) => setProviderForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.insuranceProviderPhone}</label>
                  <input className="input-field" placeholder="+962 6 000 0000" value={providerForm.contactPhone} onChange={(e) => setProviderForm(f => ({ ...f, contactPhone: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.insuranceProviderEmail}</label>
                  <input type="email" className="input-field" placeholder="claims@provider.com" value={providerForm.contactEmail} onChange={(e) => setProviderForm(f => ({ ...f, contactEmail: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">{s.insuranceProviderNotes}</label>
                <textarea className="input-field resize-none" rows={2} value={providerForm.notes} onChange={(e) => setProviderForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm font-semibold text-[#43474e]">{t.common.active}</span>
                <button
                  type="button" role="switch" aria-checked={providerForm.isActive} dir="ltr"
                  onClick={() => setProviderForm(f => ({ ...f, isActive: !f.isActive }))}
                  className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors duration-200 focus:outline-none ${providerForm.isActive ? "bg-[#002045]" : "bg-[#c4c6cf]"}`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${providerForm.isActive ? "translate-x-[1.375rem]" : "translate-x-0.5"}`} />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 pb-6">
              <button onClick={() => setInsuranceModal(null)} className="btn-secondary text-sm px-4 py-2">{t.common.cancel}</button>
              <button onClick={saveProvider} disabled={providerSaving || !providerForm.name.trim()} className="btn-primary text-sm px-4 py-2 disabled:opacity-60 flex items-center gap-2">
                {providerSaving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t.common.saving}</> : <>{t.common.save}</>}
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
                    <button type="button" role="switch" aria-checked={clinicForm.queueEnabled} dir="ltr"
                      onClick={() => setClinicForm(f => ({ ...f, queueEnabled: !f.queueEnabled }))}
                      className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1960a3] focus-visible:ring-offset-2 ${clinicForm.queueEnabled ? "bg-[#002045]" : "bg-[#c4c6cf]"}`}>
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${clinicForm.queueEnabled ? "translate-x-[1.375rem]" : "translate-x-0.5"}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[#1a1c1e]">{s.clinicOnlineBooking}</span>
                    <button type="button" role="switch" aria-checked={clinicForm.onlineBooking} dir="ltr"
                      onClick={() => setClinicForm(f => ({ ...f, onlineBooking: !f.onlineBooking }))}
                      className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1960a3] focus-visible:ring-offset-2 ${clinicForm.onlineBooking ? "bg-[#002045]" : "bg-[#c4c6cf]"}`}>
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${clinicForm.onlineBooking ? "translate-x-[1.375rem]" : "translate-x-0.5"}`} />
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
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        dir="ltr"
        onClick={toggle}
        className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1960a3] focus-visible:ring-offset-2 ${isOn ? "bg-[#002045]" : "bg-[#c4c6cf]"}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${isOn ? "translate-x-[1.375rem]" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

function Spinner() {
  return <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />;
}
