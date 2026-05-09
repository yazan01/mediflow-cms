"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

const fadeSlide = {
  hidden:  { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.45, ease, delay: i * 0.07 },
  }),
  exit: { opacity: 0, y: -10, transition: { duration: 0.2, ease: "easeIn" as const } },
};

const FEATURES = [
  { icon: "groups",          label: "Patient Management"    },
  { icon: "event_available", label: "Smart Scheduling"      },
  { icon: "receipt_long",    label: "Billing & Invoicing"   },
  { icon: "labs",            label: "Lab & Radiology"       },
  { icon: "monitoring",      label: "Analytics & Reports"   },
  { icon: "shield_locked",   label: "HIPAA Compliant"       },
];

export default function LoginPage() {
  const router = useRouter();
  const { t, lang, setLang } = useLanguage();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [step, setStep]         = useState<"creds" | "2fa">("creds");
  const [otp, setOtp]           = useState("");
  const [mounted, setMounted]   = useState(false);

  useEffect(() => { setMounted(true); }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(""); setLoading(true);
    try {
      const res  = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.auth.loginFailed);
      if (data.requires2FA) setStep("2fa");
      else router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.auth.loginFailed);
    } finally {
      setLoading(false);
    }
  }

  async function handle2FA(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(""); setLoading(true);
    try {
      const res  = await fetch("/api/auth/verify-otp", {
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

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex bg-[var(--bg)]" style={{ fontFamily: "var(--font-ui)" }}>

      {/* ── Left branding panel ──────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[52%] flex-col relative overflow-hidden"
        style={{
          background: "linear-gradient(160deg, #001529 0%, #002045 40%, #003570 75%, #004a8c 100%)",
        }}
      >
        {/* Animated background shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-[480px] h-[480px] rounded-full opacity-[0.07]"
            style={{ background: "radial-gradient(circle, #4da3ff 0%, transparent 70%)" }} />
          <div className="absolute -bottom-32 -left-32 w-[520px] h-[520px] rounded-full opacity-[0.06]"
            style={{ background: "radial-gradient(circle, #2dd4bf 0%, transparent 70%)" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-[0.04]"
            style={{ background: "radial-gradient(circle, #60a5fa 0%, transparent 60%)" }} />
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full p-12">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
            className="flex items-center gap-3"
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 100%)",
                border: "1px solid rgba(255,255,255,0.2)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}
            >
              <span
                className="material-symbols-outlined text-white"
                style={{ fontSize: 26, fontVariationSettings: `'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24` }}
              >
                health_and_safety
              </span>
            </div>
            <div>
              <p className="text-white font-bold text-[18px] tracking-[-0.01em]">{t.nav.brandName}</p>
              <p className="text-[13px]" style={{ color: "rgba(173,199,247,0.8)" }}>Healthcare Management Platform</p>
            </div>
          </motion.div>

          {/* Hero text */}
          <div className="flex-1 flex flex-col justify-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease, delay: 0.15 }}
            >
              <p className="text-[13px] font-semibold tracking-[0.12em] uppercase mb-4"
                style={{ color: "rgba(77,163,255,0.85)" }}>
                Enterprise ERP
              </p>
              <h2 className="text-white font-extrabold leading-[1.1] tracking-[-0.03em] mb-6"
                style={{ fontSize: "clamp(32px, 3.5vw, 46px)" }}>
                {t.auth.tagline}<br />
                <span style={{
                  background: "linear-gradient(90deg, #7dd3fc 0%, #2dd4bf 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}>
                  {t.auth.tagline2}
                </span>
              </h2>
              <p className="text-[15px] leading-relaxed max-w-sm" style={{ color: "rgba(173,199,247,0.78)" }}>
                {t.auth.desc}
              </p>
            </motion.div>

            {/* Feature chips */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease, delay: 0.3 }}
              className="grid grid-cols-2 gap-2.5 mt-10 max-w-sm"
            >
              {FEATURES.map((f, i) => (
                <motion.div
                  key={f.label}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, ease, delay: 0.35 + i * 0.06 }}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <span
                    className="material-symbols-outlined flex-shrink-0"
                    style={{ fontSize: 16, color: "#7dd3fc", fontVariationSettings: `'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24` }}
                  >
                    {f.icon}
                  </span>
                  <span className="text-[12.5px] font-semibold" style={{ color: "rgba(214,227,255,0.9)" }}>
                    {f.label}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="flex items-center justify-between pt-6 border-t"
            style={{ borderColor: "rgba(255,255,255,0.08)" }}
          >
            <p className="text-[11px]" style={{ color: "rgba(173,199,247,0.5)" }}>
              {t.auth.copyright}
            </p>
            <div className="flex items-center gap-4 text-[11px]" style={{ color: "rgba(173,199,247,0.5)" }}>
              <span>Privacy</span>
              <span>Security</span>
              <span>Support</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Right form panel ─────────────────────────────── */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-8 py-5">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "var(--brand)" }}
            >
              <span
                className="material-symbols-outlined text-white"
                style={{ fontSize: 20, fontVariationSettings: `'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24` }}
              >
                health_and_safety
              </span>
            </div>
            <span className="font-bold text-[16px]" style={{ color: "var(--txt1)" }}>{t.nav.brandName}</span>
          </div>
          <div className="hidden lg:block" />

          {/* Language toggle */}
          <button
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-150 hover:shadow-sm"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border2)",
              color: "var(--txt2)",
              boxShadow: "var(--sh-xs)",
            }}
          >
            <span className="material-symbols-outlined text-[var(--txt3)]" style={{ fontSize: 16 }}>language</span>
            {lang === "en" ? "العربية" : "English"}
          </button>
        </div>

        {/* Form container */}
        <div className="flex-1 flex items-center justify-center px-8 pb-8">
          <div className="w-full max-w-[400px]">
            <AnimatePresence mode="wait">
              {step === "creds" ? (
                <motion.div
                  key="creds"
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={fadeSlide}
                  custom={0}
                >
                  {/* Header */}
                  <motion.div variants={fadeSlide} custom={0} className="mb-8">
                    <h1 className="font-extrabold tracking-[-0.025em] mb-2" style={{ fontSize: 28, color: "var(--txt1)" }}>
                      {t.auth.welcomeBack}
                    </h1>
                    <p style={{ fontSize: 14, color: "var(--txt3)" }}>{t.auth.signInDesc}</p>
                  </motion.div>

                  <form onSubmit={handleLogin} className="space-y-4">
                    {/* Error */}
                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.97, y: -6 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.97 }}
                          transition={{ duration: 0.2 }}
                          className="flex items-center gap-2.5 p-3.5 rounded-xl"
                          style={{
                            background: "var(--err-soft)",
                            border: "1px solid var(--err-line)",
                          }}
                        >
                          <span className="material-symbols-outlined flex-shrink-0"
                            style={{ fontSize: 18, color: "var(--err)", fontVariationSettings: `'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24` }}>
                            error
                          </span>
                          <p className="text-sm font-medium" style={{ color: "var(--err)" }}>{error}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Email */}
                    <motion.div variants={fadeSlide} custom={1}>
                      <label className="form-label">{t.auth.emailLabel}</label>
                      <div className="input-group">
                        <span className="material-symbols-outlined input-icon input-icon-start">mail</span>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="input-field"
                          placeholder={t.auth.emailPlaceholder}
                          autoComplete="email"
                        />
                      </div>
                    </motion.div>

                    {/* Password */}
                    <motion.div variants={fadeSlide} custom={2}>
                      <div className="flex items-center justify-between mb-2">
                        <label className="form-label" style={{ margin: 0 }}>{t.auth.passwordLabel}</label>
                        <a
                          href="/forgot-password"
                          className="text-xs font-semibold hover:underline"
                          style={{ color: "var(--blue)" }}
                        >
                          {t.auth.forgotPassword}
                        </a>
                      </div>
                      <div className="input-group">
                        <span className="material-symbols-outlined input-icon input-icon-start">lock</span>
                        <input
                          type={showPw ? "text" : "password"}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="input-field has-end-icon"
                          placeholder="••••••••"
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw((v) => !v)}
                          className="input-icon input-icon-end cursor-pointer hover:text-[var(--txt1)] transition-colors"
                          tabIndex={-1}
                          aria-label={showPw ? "Hide password" : "Show password"}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                            {showPw ? "visibility_off" : "visibility"}
                          </span>
                        </button>
                      </div>
                    </motion.div>

                    {/* Remember */}
                    <motion.div variants={fadeSlide} custom={3} className="flex items-center gap-2.5">
                      <input
                        id="remember"
                        type="checkbox"
                        className="w-4 h-4 rounded accent-[var(--blue)]"
                      />
                      <label htmlFor="remember" className="text-sm cursor-pointer" style={{ color: "var(--txt2)" }}>
                        {t.auth.keepSignedIn}
                      </label>
                    </motion.div>

                    {/* Submit */}
                    <motion.div variants={fadeSlide} custom={4}>
                      <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-full justify-center py-3 text-base"
                      >
                        {loading ? (
                          <>
                            <span className="spinner spinner-sm border-white/30" style={{ borderTopColor: "white" }} />
                            {t.auth.signingIn}
                          </>
                        ) : (
                          <>
                            {t.auth.signIn}
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
                          </>
                        )}
                      </button>
                    </motion.div>
                  </form>

                  {/* Trust badges */}
                  <motion.div
                    variants={fadeSlide}
                    custom={5}
                    className="flex items-center justify-center gap-6 mt-8 pt-6"
                    style={{ borderTop: "1px solid var(--border)" }}
                  >
                    {[
                      { icon: "verified_user", label: t.auth.sslSecured  },
                      { icon: "lock",          label: t.auth.encrypted   },
                      { icon: "policy",        label: t.auth.hipaa       },
                    ].map((b) => (
                      <div key={b.label} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--txt4)" }}>
                        <span className="material-symbols-outlined"
                          style={{ fontSize: 14, color: "var(--teal)", fontVariationSettings: `'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24` }}>
                          {b.icon}
                        </span>
                        {b.label}
                      </div>
                    ))}
                  </motion.div>
                </motion.div>
              ) : (
                /* ── 2FA step ── */
                <motion.div
                  key="2fa"
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={fadeSlide}
                  custom={0}
                >
                  {/* Icon */}
                  <motion.div variants={fadeSlide} custom={0} className="mb-6">
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                      style={{
                        background: "var(--blue-bg)",
                        border: "1px solid var(--blue-soft)",
                        boxShadow: "var(--sh-glow-blue)",
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: 28, color: "var(--blue)",
                          fontVariationSettings: `'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
                        }}
                      >
                        phonelink_lock
                      </span>
                    </div>
                    <h1 className="font-extrabold tracking-[-0.025em] mb-2" style={{ fontSize: 26, color: "var(--txt1)" }}>
                      {t.auth.otpTitle}
                    </h1>
                    <p style={{ fontSize: 14, color: "var(--txt3)" }}>{t.auth.otpDesc}</p>
                  </motion.div>

                  <form onSubmit={handle2FA} className="space-y-4">
                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.97 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.97 }}
                          className="flex items-center gap-2.5 p-3.5 rounded-xl"
                          style={{ background: "var(--err-soft)", border: "1px solid var(--err-line)" }}
                        >
                          <span className="material-symbols-outlined flex-shrink-0"
                            style={{ fontSize: 18, color: "var(--err)", fontVariationSettings: `'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24` }}>
                            error
                          </span>
                          <p className="text-sm font-medium" style={{ color: "var(--err)" }}>{error}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <motion.div variants={fadeSlide} custom={1}>
                      <label className="form-label">{t.auth.otpLabel}</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        required
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        className="input-field text-center text-[28px] font-black tracking-[0.6em] py-4"
                        style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.6em" }}
                        placeholder="000000"
                        maxLength={6}
                        autoFocus
                      />
                    </motion.div>

                    {/* Progress dots */}
                    <motion.div variants={fadeSlide} custom={2} className="flex justify-center gap-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className="w-2.5 h-2.5 rounded-full transition-all duration-150"
                          style={{
                            background: i < otp.length ? "var(--blue)" : "var(--surface3)",
                            transform: i < otp.length ? "scale(1.2)" : "scale(1)",
                          }}
                        />
                      ))}
                    </motion.div>

                    <motion.div variants={fadeSlide} custom={3}>
                      <button
                        type="submit"
                        disabled={loading || otp.length < 6}
                        className="btn-primary w-full justify-center py-3 text-base"
                      >
                        {loading ? (
                          <>
                            <span className="spinner spinner-sm" style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "white" }} />
                            {t.auth.verifying}
                          </>
                        ) : t.auth.verify}
                      </button>
                    </motion.div>

                    <motion.div variants={fadeSlide} custom={4}>
                      <button
                        type="button"
                        onClick={() => { setStep("creds"); setOtp(""); setError(""); }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors rounded-xl hover:bg-[var(--hover)]"
                        style={{ color: "var(--txt3)" }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
                        {t.auth.backToLogin}
                      </button>
                    </motion.div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
