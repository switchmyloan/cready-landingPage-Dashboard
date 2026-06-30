import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../custom-hooks/useAuth";
import creadyLogo from "../../assets/cready.webp";

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });

  // ─── Mouse-tracked effects ───
  // Cursor position drives the spotlight gradient on the bg AND a subtle
  // 3D tilt on the card. Stored in refs so we can update raw style props
  // every frame without triggering React re-renders (perf-friendly).
  const cardRef = useRef(null);
  const spotlightRef = useRef(null);

  useEffect(() => {
    const onMove = (e) => {
      const x = e.clientX;
      const y = e.clientY;
      const w = window.innerWidth;
      const h = window.innerHeight;

      // 1) Spotlight follows the cursor via CSS custom props
      if (spotlightRef.current) {
        spotlightRef.current.style.setProperty('--x', `${x}px`);
        spotlightRef.current.style.setProperty('--y', `${y}px`);
      }

      // 2) Card tilt — subtle parallax (max 5deg) based on cursor position
      //    relative to card center. Mouse-over the card flattens to 0 so
      //    inputs/buttons stay easy to click without weird perspective.
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        const isOver =
          x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
        if (isOver) {
          cardRef.current.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg)`;
        } else {
          const dx = (x - w / 2) / (w / 2);   // -1 .. 1
          const dy = (y - h / 2) / (h / 2);
          const rotY = dx * 5;
          const rotX = -dy * 5;
          cardRef.current.style.transform = `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
        }
      }
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // const dummyUsers = [
  //   {
  //     id: 1,
  //     name: "Admin User",
  //     email: "admin@switchmyloan.in",
  //     password: "Cready@2026",
  //     role: "admin",
  //   },
  //   {
  //     id: 2,
  //     name: "Super Admin",
  //     email: "super@switchmyloan.in",
  //     password: "SuperrCready@2027",
  //     role: "super-admin",
  //   },
  //   {
  //     id: 3,
  //     name: "KB Admin",
  //     email: "kb@cready.in",
  //     password: "KBAdmin@2026",
  //     role: "kb-admin",
  //   },
  //   {
  //     id: 3,
  //     name: "KB Admin Mumbai",
  //     email: "kb-mumbai@cready.in",
  //     password: "KBadmin@2026",
  //     role: "kb-mumbai",
  //   },
  //   {
  //     id: 4,
  //     name: "KB Admin Banglore",
  //     email: "kb-banglore@cready.in",
  //     password: "KbBanglore@2026",
  //     role: "kb-banglore",
  //   },
  //   {
  //     id: 5,
  //     name: "MV Admin",
  //     email: "mvadmin@switchmyloan.in",
  //     password: "MVAdmin@2026",
  //     role: "mv-admin",
  //   },
  //   {
  //     id: 6,
  //     name: "MV Page",
  //     email: "mvpage@switchmyloan.in",
  //     password: "MVPage@2026",
  //     role: "mv-page",
  //   },
  //   {
  //     id: 7,
  //     name: "MV Page Admin",
  //     email: "creadypageadmin@switchmyloan.in",
  //     password: "CreadyPageAdmin@2026",
  //     role: "mv-page-admin",
  //   },
  //   {
  //     id: 8,
  //     name: "Short Page Admin",
  //     email: "shortpageadmin@switchmyloan.in",
  //     password: "ShortPageAdmin@2026",
  //     role: "short-page-admin",
  //   },
  // ];


  const dummyUsers = [
  {
    id: 1,
    name: "Admin User",
    email: "admin@switchmyloan.in",
    password: "Adm!n#SML2026$X",
    role: "admin",
  },
  {
    id: 2,
    name: "Super Admin",
    email: "super@switchmyloan.in",
    password: "Sup3r#SML2027!Zq",
    role: "super-admin",
  },
  {
    id: 3,
    name: "KB Admin",
    email: "kb@cready.in",
    password: "KB@Cr3ady!2026#R",
    role: "kb-admin",
  },
  {
    id: 3,
    name: "KB Admin Mumbai",
    email: "kb-mumbai@cready.in",
    password: "KBmum#Cr3ady!26$M",
    role: "kb-mumbai",
  },
  {
    id: 4,
    name: "KB Admin Banglore",
    email: "kb-banglore@cready.in",
    password: "KBblr#Cr3ady!26$B",
    role: "kb-banglore",
  },
  {
    id: 5,
    name: "MV Admin",
    email: "mvadmin@switchmyloan.in",
    password: "MVAdm!n#SML2026$V",
    role: "mv-admin",
  },
  {
    id: 6,
    name: "MV Page",
    email: "mvpage@switchmyloan.in",
    password: "MVp@ge#SML2026!W",
    role: "mv-page",
  },
  {
    id: 7,
    name: "MV Page Admin",
    email: "creadypageadmin@switchmyloan.in",
    password: "MVpgAdm!n#Cr3ady26",
    role: "mv-page-admin",
  },
  {
    id: 8,
    name: "Short Page Admin",
    email: "shortpageadmin@switchmyloan.in",
    password: "Sh0rt#Pg!Adm2026$S",
    role: "short-page-admin",
  },
  {
    id: 9,
    name: "Management",
    email: "management@cready.in",
    password: "Mgmt#Cr3ady!2026$M",
    role: "management",
  },
  {
    id: 10,
    name: "Marketing",
    email: "marketing@cready.in",
    password: "Mrkt#Cr3ady!2026$C",
    role: "marketing",
  },
  // High-ticket call-center agent — restricted to High Ticket → Offer Leads,
  // User Track and Selected Lenders only (see roles in routes.js).
  {
    id: 11,
    name: "Call Center",
    email: "callcenter@cready.in",
    password: "CallCntr#Cr3ady!2026$H",
    role: "call-center",
  },
  // Salary-segmented call-center agents — each sees ONLY Offer Leads, filtered to
  // their monthly-income band with loan amount >= ₹1,00,000. The band is enforced
  // in OfferLeads.jsx (CALL_CENTER_SALARY_BANDS).
  {
    id: 12,
    name: "Call Center (25K–50K)",
    email: "callcenter1@cready.in",
    password: "CallCntr1#Cr3ady!26$L",
    role: "call-center-40-65",
  },
  {
    id: 13,
    name: "Call Center (50K+)",
      email: "callcenter2@cready.in",
      password: "CallCntr2#Cr3ady!26$H",
    role: "call-center-65plus",
  },
  // Campaign team — sees only the Campaign page (a Cready RPM replica).
  {
    id: 14,
    name: "Campaign Team",
    email: "campaign@cready.in",
    password: "Camp@ign#Cr3ady!2026$T",
    role: "campaign-team",
  },
];

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ email: true, password: true });

    if (!formData.email || !formData.password) {
      setError("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    setError("");

    // Simulate network delay for a realistic feel
    await new Promise((r) => setTimeout(r, 800));

    const email = formData.email.trim().toLowerCase();
    const password = formData.password.trim();

    const foundUser = dummyUsers.find(
      (u) => u.email.toLowerCase() === email && u.password === password
    );

    if (foundUser) {
      const token = "dummy_token_" + foundUser.role;
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
      } else {
        navigate("/");
      }
    } else {
      setError("Invalid email or password. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen px-4 overflow-hidden bg-gradient-to-br from-slate-50 via-purple-50/40 to-indigo-50/40">
      {/* ─── BACKGROUND LAYERS — light luxe ─── */}
      <div className="pointer-events-none absolute -top-32 -left-24 w-[32rem] h-[32rem] rounded-full bg-purple-300/30 blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
      <div className="pointer-events-none absolute -bottom-32 -right-24 w-[32rem] h-[32rem] rounded-full bg-indigo-300/30 blur-3xl animate-pulse" style={{ animationDuration: '8s', animationDelay: '1s' }} />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[36rem] h-[36rem] rounded-full bg-violet-200/30 blur-3xl" />

      {/* Spotlight gradient from top */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[40vh] bg-gradient-to-b from-purple-200/30 via-transparent to-transparent" />

      {/* Subtle grid pattern — faint on light */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(76,29,149,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(76,29,149,0.6) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
        }}
      />

      {/* Tiny twinkling dots — subtle on light */}
      <div className="pointer-events-none absolute inset-0">
        {[
          { top: '12%', left: '18%', delay: '0s'   },
          { top: '22%', left: '78%', delay: '0.4s' },
          { top: '45%', left: '8%',  delay: '0.8s' },
          { top: '68%', left: '88%', delay: '1.2s' },
          { top: '82%', left: '32%', delay: '1.6s' },
          { top: '35%', left: '55%', delay: '2.0s' },
          { top: '78%', left: '62%', delay: '2.4s' },
          { top: '18%', left: '40%', delay: '0.6s' },
        ].map((s, i) => (
          <span
            key={i}
            className="absolute w-1 h-1 rounded-full bg-purple-500 animate-pulse"
            style={{ top: s.top, left: s.left, animationDelay: s.delay, animationDuration: '3s', opacity: 0.35 }}
          />
        ))}
      </div>

      {/* ─── Cursor-tracked spotlight — radial glow follows the cursor ─── */}
      <div
        ref={spotlightRef}
        className="pointer-events-none absolute inset-0"
        style={{
          '--x': '50%',
          '--y': '50%',
          background: 'radial-gradient(600px circle at var(--x) var(--y), rgba(168,85,247,0.10), transparent 50%)',
          transition: 'background 0.1s ease-out',
        }}
      />

      {/* ─── Floating glass shards — slow drifting geometric shapes ─── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {[
          { top: '15%', left: '12%', size: 'w-12 h-12', rotate: 12,  duration: '14s' },
          { top: '70%', left: '85%', size: 'w-16 h-16', rotate: -22, duration: '18s' },
          { top: '50%', left: '90%', size: 'w-8 h-8',   rotate: 35,  duration: '12s' },
          { top: '85%', left: '15%', size: 'w-10 h-10', rotate: -10, duration: '16s' },
        ].map((s, i) => (
          <div
            key={i}
            className={`absolute ${s.size} rounded-2xl border border-purple-300/30 bg-gradient-to-br from-white/40 to-purple-100/20 backdrop-blur-sm`}
            style={{
              top: s.top,
              left: s.left,
              transform: `rotate(${s.rotate}deg)`,
              animation: `float ${s.duration} ease-in-out infinite`,
              animationDelay: `${i * 0.6}s`,
            }}
          />
        ))}
      </div>

      {/* ─── CARD WRAPPER (with rotating conic glow + 3D tilt) ─── */}
      <div
        ref={cardRef}
        className="relative w-full max-w-md mx-4 z-10 transition-transform duration-200 ease-out"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Conic gradient glow ring */}
        <div
          className="absolute -inset-[1.5px] rounded-3xl opacity-70 blur-[2px]"
          style={{
            background: 'conic-gradient(from 0deg, transparent 0%, #a855f7 22%, #6366f1 38%, transparent 55%, transparent 100%)',
            animation: 'spin 6s linear infinite',
          }}
        />

        {/* Glassmorphism card — light luxe variant */}
        <div className="relative z-10 bg-white/85 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-purple-500/15 border border-white/80 p-8 space-y-6">
          {/* Top accent stripe */}
          <span className="absolute top-0 left-8 right-8 h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent" />

          {/* ─── BRAND HEADER ─── */}
          <div className="flex flex-col items-center text-center">
            {/* Brand logo with orbiting dots (no glow halo / drop-shadow) */}
            <div className="relative mb-4">
              {/* Orbiting dots — 3 satellites circle the logo on an invisible
                  90px orbit, each rotated 120° apart. Each dot is positioned
                  via its own orbit wrapper so the parent rotates and the dot
                  stays the same size (counter-rotates not needed since they
                  are symmetric circles). */}
              <div className="absolute inset-0 pointer-events-none" style={{ animation: 'orbit-spin 8s linear infinite' }}>
                <span className="absolute left-1/2 -top-3 -translate-x-1/2 w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
              </div>
              <div className="absolute inset-0 pointer-events-none" style={{ animation: 'orbit-spin 8s linear infinite', animationDelay: '-2.7s' }}>
                <span className="absolute left-1/2 -top-3 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-violet-500 shadow-[0_0_6px_rgba(139,92,246,0.8)]" />
              </div>
              <div className="absolute inset-0 pointer-events-none" style={{ animation: 'orbit-spin 8s linear infinite', animationDelay: '-5.3s' }}>
                <span className="absolute left-1/2 -top-3 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.8)]" />
              </div>

              <div className="relative px-1">
                <img
                  src={creadyLogo}
                  alt="Cready"
                  className="h-12 w-auto"
                />
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mb-3 rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/70">
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-emerald-500" />
              </span>
              <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-emerald-700">Cready Portal</span>
            </span>

            {/* Title with animated gradient sweep — the gradient endpoints
                shift left-to-right via background-position keyframes, giving
                the text a slow shimmer that draws the eye without flashing. */}
            <h1
              className="text-[28px] font-bold tracking-tight bg-clip-text text-transparent"
              style={{
                backgroundImage: 'linear-gradient(90deg, #111827, #6b21a8, #4338ca, #6b21a8, #111827)',
                backgroundSize: '200% 100%',
                animation: 'gradient-sweep 5s ease-in-out infinite',
              }}
            >
              Welcome Back
            </h1>
            <p className="mt-1.5 text-[13px] text-gray-500">Sign in to continue to your workspace</p>
          </div>

          {/* ─── ERROR ALERT ─── */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-50 to-red-50 border border-rose-200 px-3 py-2.5 text-rose-700 text-[12.5px] font-medium animate-[shake_0.4s_ease-in-out] shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          {/* ─── FORM ─── */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-[11.5px] font-semibold text-gray-600 tracking-[0.08em] uppercase">Email</label>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 group-focus-within:text-purple-600 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
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
                  className={`w-full rounded-xl border bg-white/70 py-2.5 pl-10 pr-4 text-[13px] text-gray-900 outline-none transition-all duration-200 focus:ring-2 focus:ring-purple-200 focus:border-purple-500 focus:bg-white placeholder-gray-400 ${
                    emailError ? "border-rose-300 focus:ring-rose-200 focus:border-rose-500" : "border-gray-200"
                  }`}
                />
              </div>
              {emailError && <p className="text-[11px] text-rose-600 font-medium">{emailError}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-[11.5px] font-semibold text-gray-600 tracking-[0.08em] uppercase">Password</label>
                <button type="button" className="text-[11px] font-semibold text-purple-600 hover:text-purple-800 transition">
                  Forgot?
                </button>
              </div>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 group-focus-within:text-purple-600 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
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
                  className={`w-full rounded-xl border bg-white/70 py-2.5 pl-10 pr-12 text-[13px] text-gray-900 outline-none transition-all duration-200 focus:ring-2 focus:ring-purple-200 focus:border-purple-500 focus:bg-white placeholder-gray-400 ${
                    passwordError ? "border-rose-300 focus:ring-rose-200 focus:border-rose-500" : "border-gray-200"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-purple-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                      <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </div>
              {passwordError && <p className="text-[11px] text-rose-600 font-medium">{passwordError}</p>}
            </div>

            {/* Submit — gradient button with glow + sliding shine */}
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full rounded-xl py-3 text-[13.5px] font-bold text-white tracking-wide overflow-hidden transition-all duration-200 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mt-2 shadow-lg shadow-purple-500/40 hover:shadow-xl hover:shadow-purple-500/50"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 group-hover:from-purple-700 group-hover:via-violet-700 group-hover:to-indigo-700 transition-colors" />
              {/* Sliding shine on hover */}
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <span className="relative flex items-center justify-center gap-2">
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Signing in…
                  </>
                ) : (
                  <>Sign In <span className="text-[15px]">→</span></>
                )}
              </span>
            </button>
          </form>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase text-gray-500">
              <svg className="w-3 h-3 text-purple-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              256-bit Encrypted
            </span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0s' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '0.15s' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0.3s' }} />
            </div>
          </div>
        </div>

        {/* Brand footer below card */}
        <p className="text-center mt-5 text-[11.5px] text-gray-500">
          © {new Date().getFullYear()} <span className="font-bold bg-gradient-to-r from-purple-700 to-indigo-700 bg-clip-text text-transparent">Cready</span> · All rights reserved
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        /* Orbiting dot rotation — invisible orbit, dot positioned at top */
        @keyframes orbit-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        /* Slow background-position shift for the title gradient sweep */
        @keyframes gradient-sweep {
          0%, 100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
        /* Floating glass shards — gentle up/down + slight rotation drift */
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(var(--rot, 0deg)); }
          50%      { transform: translateY(-20px) rotate(calc(var(--rot, 0deg) + 8deg)); }
        }
      `}</style>
    </div>
  );
}

export default LoginPage;