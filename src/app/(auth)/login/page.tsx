"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function LoginPage() {
  const router = useRouter();
  const { t, lang, setLang } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"credentials" | "2fa">("credentials");
  const [otp, setOtp] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.auth.loginFailed);
      if (data.requires2FA) {
        setStep("2fa");
      } else {
        router.push("/");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.auth.loginFailed);
    } finally {
      setLoading(false);
    }
  }

  async function handle2FA(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.auth.invalidOtp);
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.auth.otpFailed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-[#faf9fd]">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#002045] flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-[#1960a3] transform translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-[#adc7f7] transform -translate-x-1/2 translate-y-1/2"></div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/20">
              <span className="material-symbols-outlined text-white text-2xl">local_hospital</span>
            </div>
            <div>
              <h1 className="text-white text-2xl font-bold">{t.nav.brandName}</h1>
              <p className="text-[#86a0cd] text-sm">{t.auth.subtitle}</p>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <h2 className="text-white text-4xl font-bold leading-tight mb-4">
            {t.auth.tagline}<br />
            <span className="text-[#adc7f7]">{t.auth.tagline2}</span>
          </h2>
          <p className="text-[#86a0cd] text-lg leading-relaxed mb-10">{t.auth.desc}</p>
          <div className="flex flex-wrap gap-3">
            {t.auth.features.map((f) => (
              <span key={f} className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-full text-sm text-[#d6e3ff] font-medium">
                {f}
              </span>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-[#74777f] text-xs">{t.auth.copyright}</p>
        </div>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Language toggle */}
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setLang(lang === "en" ? "ar" : "en")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-[#43474e] hover:bg-[#f4f3f7] transition-colors border border-[#e3e2e6]"
            >
              <span className="material-symbols-outlined text-[16px] text-[#74777f]">language</span>
              {lang === "en" ? "العربية" : "English"}
            </button>
          </div>

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-[#002045] rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-xl">local_hospital</span>
            </div>
            <h1 className="text-[#002045] text-xl font-bold">{t.nav.brandName}</h1>
          </div>

          {step === "credentials" ? (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-[#1a1c1e] mb-2">{t.auth.welcomeBack}</h2>
                <p className="text-[#74777f] text-sm">{t.auth.signInDesc}</p>
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
                    {t.auth.emailLabel}
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-[#74777f] text-[18px]">mail</span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white border border-[#c4c6cf] rounded-lg py-3 ps-10 pe-4 text-sm text-[#1a1c1e] placeholder:text-[#74777f] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20 focus:border-[#1960a3] transition-all"
                      placeholder={t.auth.emailPlaceholder}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-[#43474e] uppercase tracking-wider">
                      {t.auth.passwordLabel}
                    </label>
                    <a href="/forgot-password" className="text-xs text-[#1960a3] hover:underline font-medium">
                      {t.auth.forgotPassword}
                    </a>
                  </div>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-[#74777f] text-[18px]">lock</span>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white border border-[#c4c6cf] rounded-lg py-3 ps-10 pe-12 text-sm text-[#1a1c1e] placeholder:text-[#74777f] focus:outline-none focus:ring-2 focus:ring-[#1960a3]/20 focus:border-[#1960a3] transition-all"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute end-3 top-1/2 -translate-y-1/2 text-[#74777f] hover:text-[#43474e]"
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
                    {t.auth.keepSignedIn}
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
                      {t.auth.signingIn}
                    </>
                  ) : (
                    <>
                      {t.auth.signIn}
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 flex items-center justify-center gap-6 text-xs text-[#74777f]">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-[#319795]">verified_user</span>
                  {t.auth.sslSecured}
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-[#319795]">lock</span>
                  {t.auth.encrypted}
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-[#319795]">policy</span>
                  {t.auth.hipaa}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="mb-8">
                <div className="w-14 h-14 bg-[#d3e4ff] rounded-2xl flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-[#1960a3] text-2xl">phonelink_lock</span>
                </div>
                <h2 className="text-2xl font-bold text-[#1a1c1e] mb-2">{t.auth.otpTitle}</h2>
                <p className="text-[#74777f] text-sm">{t.auth.otpDesc}</p>
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
                    {t.auth.otpLabel}
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
                      {t.auth.verifying}
                    </>
                  ) : (
                    t.auth.verify
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setStep("credentials")}
                  className="w-full text-[#74777f] text-sm hover:text-[#1a1c1e] transition-colors"
                >
                  {t.auth.backToLogin}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
