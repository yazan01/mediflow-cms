"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type FormData = {
  name: string; dob: string; gender: string; nationality: string; nationalId: string;
  phone: string; email: string; address: string;
  bloodType: string; allergies: string; chronicConditions: string;
  emergencyContactName: string; emergencyContactPhone: string;
  insuranceProvider: string; insurancePolicyNo: string; insuranceExpiry: string;
};

const EMPTY: FormData = {
  name: "", dob: "", gender: "", nationality: "", nationalId: "",
  phone: "", email: "", address: "",
  bloodType: "", allergies: "", chronicConditions: "",
  emergencyContactName: "", emergencyContactPhone: "",
  insuranceProvider: "", insurancePolicyNo: "", insuranceExpiry: "",
};

export default function NewPatientPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"personal" | "clinical" | "insurance">("personal");

  function update(field: keyof FormData, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body = {
        ...form,
        allergies: form.allergies.split(",").map((s) => s.trim()).filter(Boolean),
        chronicConditions: form.chronicConditions.split(",").map((s) => s.trim()).filter(Boolean),
      };
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Registration failed");
      router.push(`/patients/${data.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  const tabs = [
    { key: "personal", label: "Personal Info", icon: "person" },
    { key: "clinical", label: "Clinical Info", icon: "medical_information" },
    { key: "insurance", label: "Insurance", icon: "health_and_safety" },
  ] as const;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/patients"
          className="p-2 hover:bg-[#f4f3f7] rounded-lg transition-colors text-[#74777f] hover:text-[#1a1c1e]"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1e]">Register New Patient</h1>
          <p className="text-sm text-[#74777f] mt-0.5">Fill in all required information to create the patient record</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-[#ffdad6] border border-[#ba1a1a]/20 rounded-xl">
          <span className="material-symbols-outlined text-[#ba1a1a]">error</span>
          <p className="text-sm text-[#93000a]">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-[#f4f3f7] rounded-xl mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab.key
                  ? "bg-white text-[#1960a3] shadow-sm"
                  : "text-[#74777f] hover:text-[#1a1c1e]"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-[#e3e2e6] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
          {/* Personal Info Tab */}
          {activeTab === "personal" && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-[#1a1c1e] pb-3 border-b border-[#e3e2e6]">Personal Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label="Full Name *" required>
                  <input required value={form.name} onChange={(e) => update("name", e.target.value)}
                    className="input-field" placeholder="First and last name" />
                </Field>
                <Field label="Date of Birth *" required>
                  <input required type="date" value={form.dob} onChange={(e) => update("dob", e.target.value)}
                    className="input-field" />
                </Field>
                <Field label="Gender *" required>
                  <select required value={form.gender} onChange={(e) => update("gender", e.target.value)}
                    className="input-field">
                    <option value="">Select gender</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                  </select>
                </Field>
                <Field label="Nationality">
                  <input value={form.nationality} onChange={(e) => update("nationality", e.target.value)}
                    className="input-field" placeholder="e.g. Jordanian" />
                </Field>
                <Field label="National ID / Passport">
                  <input value={form.nationalId} onChange={(e) => update("nationalId", e.target.value)}
                    className="input-field" placeholder="ID or passport number" />
                </Field>
                <Field label="Phone Number *" required>
                  <input required type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)}
                    className="input-field" placeholder="+962 79 000 0000" />
                </Field>
                <Field label="Email Address">
                  <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)}
                    className="input-field" placeholder="patient@email.com" />
                </Field>
                <Field label="Address">
                  <input value={form.address} onChange={(e) => update("address", e.target.value)}
                    className="input-field" placeholder="Street, city, country" />
                </Field>
              </div>

              <div className="pt-4 border-t border-[#e3e2e6]">
                <h3 className="text-sm font-semibold text-[#43474e] mb-4">Emergency Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field label="Contact Name">
                    <input value={form.emergencyContactName} onChange={(e) => update("emergencyContactName", e.target.value)}
                      className="input-field" placeholder="Full name" />
                  </Field>
                  <Field label="Contact Phone">
                    <input type="tel" value={form.emergencyContactPhone} onChange={(e) => update("emergencyContactPhone", e.target.value)}
                      className="input-field" placeholder="+962 79 000 0000" />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {/* Clinical Info Tab */}
          {activeTab === "clinical" && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-[#1a1c1e] pb-3 border-b border-[#e3e2e6]">Clinical Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label="Blood Type">
                  <select value={form.bloodType} onChange={(e) => update("bloodType", e.target.value)} className="input-field">
                    <option value="">Unknown</option>
                    {["A_POS","A_NEG","B_POS","B_NEG","AB_POS","AB_NEG","O_POS","O_NEG"].map((b) => (
                      <option key={b} value={b}>
                        {b.replace("_POS", "+").replace("_NEG", "−").replace("_", "")}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Known Allergies">
                <textarea
                  value={form.allergies}
                  onChange={(e) => update("allergies", e.target.value)}
                  className="input-field resize-none"
                  rows={3}
                  placeholder="Enter allergies separated by commas (e.g. Penicillin, Sulfa, Aspirin)"
                />
                <p className="text-xs text-[#74777f] mt-1">Separate multiple allergies with commas</p>
              </Field>
              <Field label="Chronic Conditions">
                <textarea
                  value={form.chronicConditions}
                  onChange={(e) => update("chronicConditions", e.target.value)}
                  className="input-field resize-none"
                  rows={3}
                  placeholder="e.g. Hypertension, Type 2 Diabetes, Asthma"
                />
                <p className="text-xs text-[#74777f] mt-1">Separate multiple conditions with commas</p>
              </Field>
            </div>
          )}

          {/* Insurance Tab */}
          {activeTab === "insurance" && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-[#1a1c1e] pb-3 border-b border-[#e3e2e6]">Insurance Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label="Insurance Provider">
                  <input value={form.insuranceProvider} onChange={(e) => update("insuranceProvider", e.target.value)}
                    className="input-field" placeholder="e.g. CIGNA, AXA, BUPA" />
                </Field>
                <Field label="Policy Number">
                  <input value={form.insurancePolicyNo} onChange={(e) => update("insurancePolicyNo", e.target.value)}
                    className="input-field" placeholder="Policy or member ID" />
                </Field>
                <Field label="Coverage Expiry Date">
                  <input type="date" value={form.insuranceExpiry} onChange={(e) => update("insuranceExpiry", e.target.value)}
                    className="input-field" />
                </Field>
              </div>

              <div className="p-4 bg-[#eff6ff] border border-[#1960a3]/20 rounded-xl flex gap-3">
                <span className="material-symbols-outlined text-[#1960a3] text-[20px] flex-shrink-0">info</span>
                <p className="text-sm text-[#1a1c1e]">
                  Insurance details can be updated later from the patient profile. Leave blank if the patient is self-paying.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Tab navigation */}
        <div className="flex items-center justify-between mt-6">
          <div className="flex items-center gap-2">
            {activeTab !== "personal" && (
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === "insurance" ? "clinical" : "personal")}
                className="flex items-center gap-2 border border-[#c4c6cf] bg-white text-[#1a1c1e] px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Previous
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/patients"
              className="border border-[#c4c6cf] bg-white text-[#1a1c1e] px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#f4f3f7] transition-colors"
            >
              Cancel
            </Link>
            {activeTab !== "insurance" ? (
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === "personal" ? "clinical" : "insurance")}
                className="flex items-center gap-2 bg-[#1960a3] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Next
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 bg-[#002045] text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 shadow-sm"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Registering...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">person_add</span>
                    Register Patient
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-1.5">
        {label} {required && <span className="text-[#ba1a1a]">*</span>}
      </label>
      {children}
    </div>
  );
}
