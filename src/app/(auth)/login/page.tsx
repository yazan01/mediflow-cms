"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"credentials" | "2fa">("credentials");
  const [otp, setOtp] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Login failed");
      if (data.requires2FA) {
        setStep("2fa");
      } else {
        router.push("/");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handle2FA(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Invalid OTP");
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "OTP verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-[#faf9fd]">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#002045] flex-col justify-between p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-[#1960a3] transform translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-[#adc7f7] transform -translate-x-1/2 translate-y-1/2"></div>
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/20">
              <span className="material-symbols-outlined text-white text-2xl">local_hospital</span>
            </div>
            <div>
              <h1 className="text-white text-2xl font-bold">MediFlow CMS</h1>
              <p className="text-[#86a0cd] text-sm">Clinic Management System</p>
            </div>
          </div>
        </div>

        {/* Tagline */}
        <div className="relative z-10">
          <h2 className="text-white text-4xl font-bold leading-tight mb-4">
            Clinical Excellence,<br />
            <span className="text-[#adc7f7]">Digitally Powered</span>
          </h2>
          <p className="text-[#86a0cd] text-lg leading-relaxed mb-10">
            A comprehensive ERP platform for modern medical clinics — managing patients, appointments, EMR, billing, pharmacy, HR, and accounting in one integrated system.
          </p>

          {/* Feature chips */}
          <div className="flex flex-wrap gap-3">
            {["Patient Management", "EMR", "Billing", "Pharmacy", "HR & Payroll", "Analytics"].map((f) => (
              <span
                key={f}
                className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-full text-sm text-[#d6e3ff] font-medium"
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-[#74777f] text-xs">
            © {new Date().getFullYear()} MediFlow CMS. All rights reserved. | HIPAA Compliant
          </p>
        </div>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-[#002045] rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-xl">local_hospital</span>
            </div>
            <h1 className="text-[#002045] text-xl font-bold">MediFlow CMS</h1>
          </div>

          {step === "credentials" ? (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-[#1a1c1e] mb-2">Welcome back</h2>
                <p className="text-[#74777f] text-sm">Sign in to your clinic portal to continue</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-[#ffdad6] border border-[#ba1a1a]/20 rounded-lg">
                    <span className="material-symbols-outlined text-[#ba1a1a] text-[18px]">error</span>
                    <p className="text-sm text-[#93000a]">{error}</p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#74777f] text-[18px]">
                      mail
                    </span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white border border-[#c4c6cf] rounded-lg py-3 pl-10 pr-4 text-sm text-[#1a1c1e] placeholder:text-[#74777f] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20 focus:border-[#1960a3] transition-all"
                      placeholder="your@clinic.com"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider">
                      Password
                    </label>
                    <a href="/forgot-password" className="text-xs text-[#1960a3] hover:underline font-medium">
                      Forgot password?
                    </a>
                  </div>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#74777f] text-[18px]">
                      lock
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white border border-[#c4c6cf] rounded-lg py-3 pl-10 pr-12 text-sm text-[#1a1c1e] placeholder:text-[#74777f] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20 focus:border-[#1960a3] transition-all"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#74777f] hover:text-[#43474e]"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="remember"
                    type="checkbox"
                    className="w-4 h-4 rounded border-[#c4c6cf] text-[#1960a3] focus:ring-[#1960a3]"
                  />
                  <label htmlFor="remember" className="text-sm text-[#43474e]">
                    Keep me signed in for 30 days
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#002045] text-white py-3 rounded-lg font-semibold text-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(0,32,69,0.3)]"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </>
                  )}
                </button>
              </form>

              {/* Security badge */}
              <div className="mt-8 flex items-center justify-center gap-6 text-xs text-[#74777f]">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-[#319795]">verified_user</span>
                  SSL Secured
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-[#319795]">lock</span>
                  AES-256 Encrypted
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-[#319795]">policy</span>
                  HIPAA Compliant
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="mb-8">
                <div className="w-14 h-14 bg-[#d3e4ff] rounded-2xl flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-[#1960a3] text-2xl">phonelink_lock</span>
                </div>
                <h2 className="text-2xl font-bold text-[#1a1c1e] mb-2">Two-Factor Verification</h2>
                <p className="text-[#74777f] text-sm">
                  Enter the 6-digit OTP sent to your registered phone or authenticator app.
                </p>
              </div>

              <form onSubmit={handle2FA} className="space-y-5">
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-[#ffdad6] border border-[#ba1a1a]/20 rounded-lg">
                    <span className="material-symbols-outlined text-[#ba1a1a] text-[18px]">error</span>
                    <p className="text-sm text-[#93000a]">{error}</p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider mb-2">
                    OTP Code
                  </label>
                  <input
                    type="text"
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full bg-white border border-[#c4c6cf] rounded-lg py-4 px-4 text-center text-2xl font-bold tracking-[0.5em] text-[#1a1c1e] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20 focus:border-[#1960a3] transition-all"
                    placeholder="000000"
                    maxLength={6}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className="w-full bg-[#002045] text-white py-3 rounded-lg font-semibold text-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      Verifying...
                    </>
                  ) : (
                    "Verify & Continue"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setStep("credentials")}
                  className="w-full text-[#74777f] text-sm hover:text-[#1a1c1e] transition-colors"
                >
                  ← Back to login
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
