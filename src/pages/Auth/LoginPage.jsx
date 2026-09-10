import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../custom-hooks/useAuth";
import Api from "../../api-services/api";
import creadyLogo from "../../assets/cready.webp";

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // Sign-in animation state machine: idle → checking → granted
  const [phase, setPhase] = useState("idle");
  const busy = phase !== "idle";
  const [touched, setTouched] = useState({ email: false, password: false });

  // ─── Cursor-tracked spotlight on the branded panel ───
  // The radial glow follows the cursor via CSS custom props updated in a ref
  // so we never trigger React re-renders on every mousemove (perf-friendly).
  const spotlightRef = useRef(null);

  useEffect(() => {
    const onMove = (e) => {
      if (spotlightRef.current) {
        const rect = spotlightRef.current.getBoundingClientRect();
        spotlightRef.current.style.setProperty("--x", `${e.clientX - rect.left}px`);
        spotlightRef.current.style.setProperty("--y", `${e.clientY - rect.top}px`);
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // The roster used to live here — every account, and until recently every
  // password, shipped inside this bundle. The server owns it now, so the page
  // carries nothing: no emails, no names, no roles. It was already unused, but
  // still handed anyone who opened the login page the full staff list and who
  // holds which role, which is a free head start for phishing.


  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError("");
  };

  const handleBlur = (e) => {
    setTouched({ ...touched, [e.target.name]: true });
  };

  const emailError =
    touched.email && formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)
      ? "Please enter a valid email address"
      : "";

  const passwordError =
    touched.password && !formData.password ? "Password is required" : "";

  // ── Phone + OTP login ──────────────────────────────────────────────────
  // A second way in, not a replacement: the email form is untouched, because the
  // whole call-centre floor signs in with it every morning. Currently enabled for
  // one account server-side; everyone else gets a clear "not enabled" message
  // rather than a silent failure.
  const [mode, setMode] = useState("email");        // "email" | "phone"
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [hashedOtp, setHashedOtp] = useState("");   // server's sealed OTP handle
  const [otpSent, setOtpSent] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);
  // Seconds until "Resend OTP" becomes available. Starts at 30 on every send,
  // so a resend cannot be hammered — each press costs a real SMS, and the SMS
  // provider rate-limits too.
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    // setTimeout, not setInterval: one tick is scheduled per render and cleaned
    // up with it, so leaving the page mid-countdown cannot leave a timer running.
    const id = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const sendPhoneOtp = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setError("");
    const p = phone.replace(/\D/g, "").slice(-10);
    if (p.length !== 10) { setError("Enter a valid 10-digit mobile number."); return; }
    setPhoneBusy(true);
    try {
      const res = await Api().post("/auth/phone/send-otp", { phone: p }, { skipAdminAppend: true });
      const h = res?.data?.data?.hashedOtp;
      if (!h) throw new Error("No OTP session returned");
      setHashedOtp(h);
      setOtpSent(true);
      setOtp("");        // a fresh code means the old one in the box is stale
      setResendIn(30);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not send OTP. Please try again.");
    } finally {
      setPhoneBusy(false);
    }
  };

  const verifyPhoneOtp = async (e) => {
    e.preventDefault();
    setError("");
    const code = otp.replace(/\D/g, "");
    if (code.length < 4) { setError("Enter the OTP you received."); return; }
    setPhoneBusy(true);
    try {
      const res = await Api().post(
        "/auth/phone/verify-otp",
        { phone: phone.replace(/\D/g, "").slice(-10), otp: code, hashedOtp },
        { skipAdminAppend: true },
      );
      const token = res?.data?.data?.token;
      const user = res?.data?.data?.user;
      if (!token || !user) throw new Error("Malformed response");
      setPhase("granted");
      await new Promise((r) => setTimeout(r, 700));
      completeLogin(token, user);
    } catch (err) {
      setError(err?.response?.data?.message || "Invalid OTP. Please try again.");
      setPhoneBusy(false);
    }
  };

  // Where a signed-in user lands, and the only place the session is stored.
  // Extracted so phone-OTP login ends up in exactly the same state as password
  // login — one path to keep correct instead of two that drift.
  const completeLogin = (token, foundUser) => {
      login(token, foundUser);
        if (foundUser.role === "kb-admin") {
          navigate("/kb-success-leads");
        } else if (foundUser.role === "kb-mumbai") {
          navigate("/kb-mumbai-success-leads");
        } else if (foundUser.role === "kb-banglore") {
          navigate("/kb-banglore-success-leads");
        } else if (foundUser.role === "mv-admin") {
          navigate("/mv-success-leads");
        } else if (foundUser.role === "mv-page") {
          navigate("/offer-leads");
        } else if (foundUser.role === "mv-page-admin") {
          navigate("/offer-leads-analytics");
        } else if (foundUser.role === "short-page-admin") {
          navigate("/short-offer-leads-analytics");
        } else if (foundUser.role === "management") {
          navigate("/disbursal-dashboard");
        } else if (foundUser.role === "marketing") {
          navigate("/offer-leads-analytics");
        } else if (
          foundUser.role === "call-center" ||
          foundUser.role === "call-center-40-65" ||
          foundUser.role === "call-center-65plus"
        ) {
          navigate("/offer-leads");
        } else if (foundUser.role === "campaign-team") {
          navigate("/campaign");
        } else if (foundUser.role === "dev") {
          navigate("/disbursal-dashboard");
        } else if (foundUser.role == "super-admin") {
          navigate("/disbursal-dashboard");
        } else {
          navigate("/");
        }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ email: true, password: true });

    if (!formData.email || !formData.password) {
      setError("Please fill in all fields");
      return;
    }

    setPhase("checking");
    setError("");

    // Phase 1 — "verifying" beat while the padlock shakes.
    await new Promise((r) => setTimeout(r, 1100));

    const email = formData.email.trim().toLowerCase();
    const password = formData.password.trim();

    // The SERVER decides who is logged in.
    //
    // This used to be a find() over a roster in this file, comparing
    // password)` — the whole roster, passwords in plain text, shipped inside this
    // bundle and compared in the browser. Anyone could read every password from
    // View Source without logging in, and the API trusted a token that was just
    // the string "dummy_token_" + role.
    let foundUser;
    let token;
    try {
      const res = await Api().post("/auth/login", { email, password }, { skipAdminAppend: true });
      token = res?.data?.data?.token;
      foundUser = res?.data?.data?.user;
      if (!token || !foundUser) throw new Error("Malformed login response");
    } catch (err) {
      const status = err?.response?.status;
      setError(
        status === 401
          ? "Invalid email or password. Please try again."
          : "Could not reach the server. Please try again."
      );
      setPhase("idle");
      return;
    }

    // Phase 2 — success celebration: lock pops open → checkmark burst.
    setPhase("granted");
    await new Promise((r) => setTimeout(r, 1000));

    completeLogin(token, foundUser);
  };

  // Feature highlights shown on the branded panel
  const features = [
    {
      title: "Unified Lead Dashboard",
      desc: "Track every lead, offer and disbursal in one place.",
      icon: (
        <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
      ),
    },
    {
      title: "Real-time Analytics",
      desc: "Live conversion metrics and performance insights.",
      icon: (
        <path d="M3 3v18h18v-2H5V3H3zm14.5 4L13 11.5l-3-3L6 12.5 7.5 14l2.5-2.5 3 3L19 8.5 17.5 7z" />
      ),
    },
    {
      title: "Role-based Access",
      desc: "Every team sees only what's relevant to them.",
      icon: (
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      ),
    },
  ];

  return (
    <div className="flex min-h-screen bg-white">
      {/* ══════════════ LEFT — BRANDED PANEL (lg+) ══════════════ */}
      <div
        ref={spotlightRef}
        className="relative hidden lg:flex lg:w-1/2 flex-col justify-between overflow-hidden p-12 xl:p-16 text-white"
        style={{
          background:
            "linear-gradient(135deg, #4c1d95 0%, #6d28d9 45%, #4338ca 100%)",
        }}
      >
        {/* Cursor spotlight */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            "--x": "50%",
            "--y": "50%",
            background:
              "radial-gradient(600px circle at var(--x) var(--y), rgba(255,255,255,0.10), transparent 45%)",
          }}
        />

        {/* Decorative blurred orbs */}
        <div className="pointer-events-none absolute -top-24 -left-16 w-96 h-96 rounded-full bg-fuchsia-500/30 blur-3xl animate-pulse" style={{ animationDuration: "7s" }} />
        <div className="pointer-events-none absolute -bottom-28 -right-10 w-96 h-96 rounded-full bg-indigo-400/30 blur-3xl animate-pulse" style={{ animationDuration: "9s", animationDelay: "1s" }} />

        {/* Faint grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse at 30% 20%, black 20%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse at 30% 20%, black 20%, transparent 70%)",
          }}
        />

        {/* Floating glass shards */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {[
            { top: "18%", left: "70%", size: "w-16 h-16", rotate: 12, duration: "16s" },
            { top: "62%", left: "18%", size: "w-12 h-12", rotate: -18, duration: "19s" },
            { top: "80%", left: "72%", size: "w-10 h-10", rotate: 26, duration: "14s" },
          ].map((s, i) => (
            <div
              key={i}
              className={`absolute ${s.size} rounded-2xl border border-white/20 bg-white/5 backdrop-blur-sm`}
              style={{
                top: s.top,
                left: s.left,
                transform: `rotate(${s.rotate}deg)`,
                animation: `float ${s.duration} ease-in-out infinite`,
                animationDelay: `${i * 0.7}s`,
              }}
            />
          ))}
        </div>

        {/* ─── Top: brand ─── */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex items-center justify-center rounded-2xl bg-white px-4 py-2.5 shadow-lg shadow-black/10">
            <img src={creadyLogo} alt="Cready" className="h-7 w-auto" />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/20 px-3 py-1 backdrop-blur-sm">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-300 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-emerald-400" />
            </span>
            <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-white/90">
              Cready Portal
            </span>
          </span>
        </div>

        {/* ─── Middle: headline + features ─── */}
        <div className="relative z-10 max-w-xl">
          <h2 className="text-[30px] xl:text-[34px] font-extrabold leading-[1.2] tracking-tight">
            <span className="block whitespace-nowrap">Your entire landing workflow,</span>
            <span className="block whitespace-nowrap">
              in one{" "}
              <span className="bg-gradient-to-r from-fuchsia-200 to-violet-100 bg-clip-text text-transparent">
                powerful workspace.
              </span>
            </span>
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">
            Sign in to manage leads, track disbursals and unlock real-time
            insights across every Cready channel.
          </p>

          <ul className="mt-10 space-y-5">
            {features.map((f, i) => (
              <li key={i} className="flex items-start gap-4">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 border border-white/20 backdrop-blur-sm">
                  <svg className="h-5 w-5 text-fuchsia-100" viewBox="0 0 24 24" fill="currentColor">
                    {f.icon}
                  </svg>
                </span>
                <div>
                  <p className="text-[14.5px] font-semibold text-white">{f.title}</p>
                  <p className="text-[13px] text-white/60">{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* ─── Bottom: trust footer ─── */}
        <div className="relative z-10 flex items-center gap-2 text-white/60">
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          <span className="text-[11.5px] font-medium tracking-wide">
            Secure access · Cready internal portal
          </span>
        </div>
      </div>

      {/* ══════════════ RIGHT — SIGN-IN FORM ══════════════ */}
      <div className="relative flex w-full lg:w-1/2 items-center justify-center px-6 py-10 sm:px-10 bg-gradient-to-br from-slate-50 via-purple-50/40 to-indigo-50/30">
        {/* Soft ambient glow (mobile-friendly) */}
        <div className="pointer-events-none absolute -top-24 right-0 w-72 h-72 rounded-full bg-purple-200/40 blur-3xl lg:hidden" />

        <div className="relative w-full max-w-sm">
          {/* Mobile brand (hidden on lg — shown in left panel there) */}
          <div className="mb-8 flex flex-col items-center lg:hidden">
            <img src={creadyLogo} alt="Cready" className="h-10 w-auto" />
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-[30px] font-bold tracking-tight text-gray-900">
              Welcome back 👋
            </h1>
            <p className="mt-1.5 text-[14px] text-gray-500">
              Sign in to continue to your workspace.
            </p>
          </div>

          {/* Error alert */}
          {error && (
            <div className="mb-5 flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-50 to-red-50 border border-rose-200 px-3.5 py-3 text-rose-700 text-[13px] font-medium animate-[shake_0.4s_ease-in-out] shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          {/* Email / Phone switch.
              Email stays the default and the first tab: the whole floor signs in
              that way every morning, and phone login is enabled for one account
              while it is being proven out. */}
          <div className="mb-5 inline-flex w-full rounded-xl bg-gray-100 p-1">
            {[
              { k: "email", label: "Email & Password" },
              { k: "phone", label: "Login with Phone" },
            ].map(({ k, label }) => (
              <button
                key={k}
                type="button"
                onClick={() => { setMode(k); setError(""); setOtpSent(false); setOtp(""); }}
                className={`flex-1 rounded-lg px-3 py-2 text-[12.5px] font-semibold transition ${
                  mode === k ? "bg-white text-purple-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "phone" ? (
            <form onSubmit={otpSent ? verifyPhoneOtp : sendPhoneOtp} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="phone" className="block text-[12px] font-semibold text-gray-700">
                  Mobile number
                </label>
                <input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={10}
                  value={phone}
                  // Locked once the OTP is out: changing the number underneath a
                  // live OTP would verify a code against the wrong account.
                  disabled={otpSent}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10-digit mobile number"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[14px] outline-none transition focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100 disabled:opacity-60"
                />
              </div>

              {otpSent && (
                <div className="space-y-1.5">
                  <label htmlFor="otp" className="block text-[12px] font-semibold text-gray-700">
                    Enter OTP
                  </label>
                  <input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6-digit code"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[14px] tracking-[0.3em] outline-none transition focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100"
                  />
                  <div className="flex items-center justify-between pt-0.5">
                    <button
                      type="button"
                      onClick={() => { setOtpSent(false); setOtp(""); setError(""); setResendIn(0); }}
                      className="text-[11.5px] font-medium text-purple-600 hover:underline"
                    >
                      Change number
                    </button>

                    {resendIn > 0 ? (
                      <span className="text-[11.5px] text-gray-400 tabular-nums">
                        Resend OTP in {resendIn}s
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => sendPhoneOtp()}
                        disabled={phoneBusy}
                        className="text-[11.5px] font-semibold text-purple-600 hover:underline disabled:opacity-50 disabled:no-underline"
                      >
                        Resend OTP
                      </button>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-[12.5px] font-medium text-red-600">{error}</p>
              )}

              <button
                type="submit"
                disabled={phoneBusy}
                className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 px-4 py-3 text-[14px] font-semibold text-white shadow-lg transition hover:from-purple-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {phoneBusy ? "Please wait…" : otpSent ? "Verify & Sign In" : "Send OTP"}
              </button>
            </form>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-[12px] font-semibold text-gray-700">
                Email address
              </label>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400 group-focus-within:text-purple-600 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px]" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                </span>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@cready.in"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full rounded-xl border bg-white py-3 pl-11 pr-4 text-[14px] text-gray-900 outline-none transition-all duration-200 focus:ring-4 focus:ring-purple-100 focus:border-purple-500 placeholder-gray-400 ${
                    emailError ? "border-rose-300 focus:ring-rose-100 focus:border-rose-500" : "border-gray-200 hover:border-gray-300"
                  }`}
                />
              </div>
              {emailError && <p className="text-[11.5px] text-rose-600 font-medium">{emailError}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-[12px] font-semibold text-gray-700">
                Password
              </label>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400 group-focus-within:text-purple-600 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px]" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </span>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full rounded-xl border bg-white py-3 pl-11 pr-12 text-[14px] text-gray-900 outline-none transition-all duration-200 focus:ring-4 focus:ring-purple-100 focus:border-purple-500 placeholder-gray-400 ${
                    passwordError ? "border-rose-300 focus:ring-rose-100 focus:border-rose-500" : "border-gray-200 hover:border-gray-300"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-purple-600 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px]" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                      <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px]" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </div>
              {passwordError && <p className="text-[11.5px] text-rose-600 font-medium">{passwordError}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={busy}
              className="group relative w-full rounded-xl py-3.5 text-[14px] font-bold text-white tracking-wide overflow-hidden transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed shadow-lg shadow-purple-500/40 hover:shadow-xl hover:shadow-purple-500/50"
            >
              {/* Base purple gradient */}
              <span className="absolute inset-0 bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 group-hover:from-purple-700 group-hover:via-violet-700 group-hover:to-indigo-700 transition-colors" />

              {/* Success wash — fades in on grant */}
              <span
                className={`absolute inset-0 bg-gradient-to-r from-emerald-500 to-green-600 transition-opacity duration-300 ${
                  phase === "granted" ? "opacity-100" : "opacity-0"
                }`}
              />

              {/* Sliding shine — only when idle */}
              {phase === "idle" && (
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              )}

              {/* Verifying: subtle darkening + moving light sweep */}
              {phase === "checking" && (
                <>
                  <span className="absolute inset-0 bg-black/10" />
                  <span className="absolute inset-0 overflow-hidden">
                    <span className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-[sweep_1.1s_linear_infinite]" />
                  </span>
                </>
              )}

              <span className="relative flex items-center justify-center gap-2">
                {phase === "idle" && (
                  <>
                    Sign In <span className="text-[16px] transition-transform group-hover:translate-x-0.5">→</span>
                  </>
                )}

                {phase === "checking" && (
                  /* Padlock shaking while credentials are verified */
                  <span
                    className="relative flex h-8 w-8 items-center justify-center"
                    style={{ animation: "lockShake 0.5s ease-in-out infinite" }}
                  >
                    <span className="absolute h-11 w-11 rounded-full bg-white/30 blur-md animate-[lockGlow_1.4s_ease-in-out_infinite]" />
                    <svg className="relative h-8 w-8" viewBox="0 0 24 24" fill="none">
                      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                      <rect x="5" y="10" width="14" height="10" rx="2.6" fill="currentColor" />
                      <circle cx="12" cy="14.3" r="1.5" fill="#6d28d9" />
                      <rect x="11.25" y="14.6" width="1.5" height="3.2" rx="0.75" fill="#6d28d9" />
                    </svg>
                  </span>
                )}

                {phase === "granted" && (
                  <>
                    {/* Unlocked padlock morphs open + a checkmark burst */}
                    <span className="relative flex h-8 w-8 items-center justify-center">
                      {/* Expanding ring burst */}
                      <span className="absolute h-8 w-8 rounded-full border-2 border-white/80 animate-[burst_0.7s_ease-out_forwards]" />
                      <svg className="relative h-8 w-8" viewBox="0 0 24 24" fill="none">
                        {/* Shackle sprung fully open */}
                        <path
                          d="M8 10V7a4 4 0 0 1 8 0v3"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          fill="none"
                          style={{ transformOrigin: "16px 10px", transform: "rotate(-42deg)" }}
                        />
                        <rect x="5" y="10" width="14" height="10" rx="2.6" fill="currentColor" />
                        {/* Checkmark drawn inside the body */}
                        <path
                          d="M8.5 15l2.2 2.2 4.3-4.6"
                          stroke="#059669"
                          strokeWidth="2.1"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                          style={{ strokeDasharray: 16, strokeDashoffset: 16, animation: "checkDraw 0.45s 0.15s ease-out forwards" }}
                        />
                      </svg>
                    </span>
                    <span>Access granted</span>
                  </>
                )}
              </span>
            </button>
          </form>
          )}

          {/* Footer */}
          <div className="mt-8 flex items-center justify-center gap-1.5 text-[11.5px] text-gray-400">
            <svg className="w-3.5 h-3.5 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <span>
              © {new Date().getFullYear()}{" "}
              <span className="font-bold bg-gradient-to-r from-purple-700 to-indigo-700 bg-clip-text text-transparent">
                Cready
              </span>{" "}
              · All rights reserved
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(var(--rot, 0deg)); }
          50%      { transform: translateY(-18px) rotate(calc(var(--rot, 0deg) + 8deg)); }
        }
        /* Light sweep across the button while authenticating */
        @keyframes sweep {
          0%   { transform: translateX(0); }
          100% { transform: translateX(400%); }
        }
        /* Padlock shaking left-right while "verifying" */
        @keyframes lockShake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          20%      { transform: translateX(-2px) rotate(-5deg); }
          40%      { transform: translateX(2px) rotate(5deg); }
          60%      { transform: translateX(-1.5px) rotate(-3deg); }
          80%      { transform: translateX(1.5px) rotate(3deg); }
        }
        /* Soft glow pulse behind the padlock */
        @keyframes lockGlow {
          0%, 100% { opacity: 0.2; transform: scale(0.85); }
          50%      { opacity: 0.55; transform: scale(1.1); }
        }
        /* Expanding ring burst on "access granted" */
        @keyframes burst {
          0%   { transform: scale(0.5); opacity: 0.9; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        /* Checkmark stroke draw-in */
        @keyframes checkDraw {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
}

export default LoginPage;
