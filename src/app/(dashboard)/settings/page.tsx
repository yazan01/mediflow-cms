"use client";

import { useState, useEffect } from "react";

type Section = "clinic" | "security" | "notifications" | "billing" | "integrations";

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
};

const DEFAULT: Settings = {
  clinicName: "", licenseNumber: "", phone: "", email: "", address: "",
  taxId: "", currency: "USD", timezone: "Asia/Amman", taxRate: 7,
  invoicePrefix: "INV", paymentTerms: 30, sessionTimeout: 480,
  passwordMinLength: 8, require2FA: false,
};

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<Section>("clinic");
  const [form, setForm] = useState<Settings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setForm({ ...DEFAULT, ...d }); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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

  const sections = [
    { key: "clinic",        label: "Clinic Profile",   icon: "local_hospital" },
    { key: "security",      label: "Security & Auth",  icon: "security" },
    { key: "notifications", label: "Notifications",    icon: "notifications" },
    { key: "billing",       label: "Billing Config",   icon: "payments" },
    { key: "integrations",  label: "Integrations",     icon: "cable" },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1e]">System Settings</h1>
          <p className="text-sm text-[#74777f] mt-0.5">Configure clinic-wide preferences and system behavior</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="flex items-center gap-2 bg-[#002045] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 shadow-sm disabled:opacity-60"
        >
          {saving ? (
            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>Saving…</>
          ) : saveStatus === "saved" ? (
            <><span className="material-symbols-outlined text-[18px]">check_circle</span>Saved!</>
          ) : saveStatus === "error" ? (
            <><span className="material-symbols-outlined text-[18px]">error</span>Error — retry</>
          ) : (
            <><span className="material-symbols-outlined text-[18px]">save</span>Save Changes</>
          )}
        </button>
      </div>

      <div className="flex gap-6">
        {/* Sidebar nav */}
        <div className="w-56 flex-shrink-0">
          <nav className="bg-white rounded-xl border border-[#e3e2e6] overflow-hidden">
            {sections.map((s) => (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left text-sm transition-colors border-b border-[#e3e2e6] last:border-b-0 ${
                  activeSection === s.key
                    ? "bg-[#d3e4ff]/30 text-[#1960a3] font-semibold border-l-4 border-l-[#1960a3]"
                    : "text-[#43474e] hover:bg-[#f4f3f7]"
                }`}
              >
                <span className={`material-symbols-outlined text-[20px] ${activeSection === s.key ? "text-[#1960a3]" : "text-[#74777f]"}`}>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6">
          {loading ? (
            <div className="bg-white rounded-xl border border-[#e3e2e6] p-12 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {activeSection === "clinic" && (
                <SettingsCard title="Clinic Profile" desc="Basic information displayed on invoices, reports, and patient communications">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label="Clinic Name"><input className="input-field" value={form.clinicName} onChange={(e) => set("clinicName", e.target.value)} placeholder="Al-Shifa Medical Center" /></Field>
                    <Field label="License Number"><input className="input-field" value={form.licenseNumber} onChange={(e) => set("licenseNumber", e.target.value)} placeholder="MH-2024-XXXXX" /></Field>
                    <Field label="Phone"><input className="input-field" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+962 6 000 0000" /></Field>
                    <Field label="Email"><input type="email" className="input-field" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="info@clinic.com" /></Field>
                    <Field label="Address" full><textarea className="input-field resize-none" rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Street address, city, country" /></Field>
                    <Field label="Tax ID"><input className="input-field" value={form.taxId} onChange={(e) => set("taxId", e.target.value)} placeholder="TIN number" /></Field>
                    <Field label="Currency">
                      <select className="input-field" value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                        <option value="USD">USD — US Dollar</option>
                        <option value="JOD">JOD — Jordanian Dinar</option>
                        <option value="SAR">SAR — Saudi Riyal</option>
                        <option value="AED">AED — UAE Dirham</option>
                      </select>
                    </Field>
                    <Field label="Time Zone">
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
                <SettingsCard title="Security & Authentication" desc="Password policies, session management, and access controls">
                  <div className="space-y-5">
                    <Toggle label="Two-Factor Authentication (2FA)" desc="Require 2FA for all users on login" checked={form.require2FA} onChange={(v) => set("require2FA", v)} />
                    <Toggle label="Account Lockout" desc="Lock account after 5 failed login attempts for 15 minutes" checked defaultChecked />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                      <Field label="Session Timeout (minutes)"><input type="number" className="input-field" value={form.sessionTimeout} min={5} max={480} onChange={(e) => set("sessionTimeout", Number(e.target.value))} /></Field>
                      <Field label="Password Min Length"><input type="number" className="input-field" value={form.passwordMinLength} min={8} max={32} onChange={(e) => set("passwordMinLength", Number(e.target.value))} /></Field>
                    </div>
                  </div>
                </SettingsCard>
              )}

              {activeSection === "notifications" && (
                <SettingsCard title="Notifications & Alerts" desc="Configure how and when the system sends notifications">
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <Field label="SMS Gateway Provider"><select className="input-field"><option value="">Not configured</option><option>Twilio</option><option>Local Gateway</option><option>Infobip</option></select></Field>
                      <Field label="SMS API Key"><input type="password" className="input-field" placeholder="Enter API key" /></Field>
                      <Field label="Email Provider"><select className="input-field"><option>SMTP</option><option>SendGrid</option><option>Mailgun</option></select></Field>
                      <Field label="SMTP Host"><input className="input-field" placeholder="smtp.example.com" /></Field>
                    </div>
                    <div className="pt-2 space-y-4">
                      <h3 className="text-sm font-semibold text-[#43474e] uppercase tracking-wider">Notification Triggers</h3>
                      <Toggle label="Appointment Reminders" desc="Send SMS/email 24h and 2h before appointment" defaultChecked />
                      <Toggle label="Lab Critical Values" desc="Alert ordering physician when critical lab values are flagged" defaultChecked />
                      <Toggle label="Low Stock Alerts" desc="Notify pharmacist when medication falls below minimum stock" defaultChecked />
                      <Toggle label="Invoice Overdue Alerts" desc="Send reminders for overdue invoices" defaultChecked />
                      <Toggle label="Leave Request Notifications" desc="Notify HR officers of pending leave requests" defaultChecked />
                    </div>
                  </div>
                </SettingsCard>
              )}

              {activeSection === "billing" && (
                <SettingsCard title="Billing Configuration" desc="Tax rates, invoice numbering, and payment settings">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label="Default Tax Rate (%)"><input type="number" className="input-field" value={form.taxRate} min={0} max={100} step={0.5} onChange={(e) => set("taxRate", Number(e.target.value))} /></Field>
                    <Field label="Invoice Prefix"><input className="input-field" value={form.invoicePrefix} onChange={(e) => set("invoicePrefix", e.target.value)} /></Field>
                    <Field label="Payment Terms (days)"><input type="number" className="input-field" value={form.paymentTerms} onChange={(e) => set("paymentTerms", Number(e.target.value))} /></Field>
                  </div>
                  <div className="pt-4 space-y-4">
                    <h3 className="text-sm font-semibold text-[#43474e] uppercase tracking-wider">Payment Methods</h3>
                    <Toggle label="Cash" defaultChecked />
                    <Toggle label="Credit / Debit Card" defaultChecked />
                    <Toggle label="Insurance" defaultChecked />
                    <Toggle label="Bank Transfer" defaultChecked />
                    <Toggle label="Mobile Payment" />
                  </div>
                </SettingsCard>
              )}

              {activeSection === "integrations" && (
                <div className="space-y-4">
                  {[
                    { icon: "sms",         label: "SMS Gateway",       desc: "Twilio / local SMS provider for patient alerts",   status: "Not configured", ok: false },
                    { icon: "email",       label: "Email Server",      desc: "SMTP or SendGrid for email notifications",         status: "Not configured", ok: false },
                    { icon: "payments",    label: "Payment Gateway",   desc: "Stripe or local payment processor",                 status: "Not configured", ok: false },
                    { icon: "health_and_safety", label: "Insurance Portal", desc: "HL7 / REST integration with insurance providers", status: "Phase 2",     ok: null },
                    { icon: "biotech",     label: "Lab Analyzers",     desc: "HL7 v2.x / FHIR interface with lab equipment",     status: "Phase 2",       ok: null },
                    { icon: "image_search",label: "PACS System",       desc: "DICOM integration for radiology images",            status: "Phase 3",       ok: null },
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
                          Configure
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
