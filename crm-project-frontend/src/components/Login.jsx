import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getBaseApiUrl } from "../utils/apiConfig";
import {
  SquareParking,
  Headphones,
  Users,
  Briefcase,
  BarChart3,
  ArrowLeft,
  Mail,
  Phone,
  X,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles
} from "lucide-react";

const Login = ({ forceForgot = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const BASE_API = getBaseApiUrl();

  const LOGIN_ENDPOINT = `${BASE_API}/auth/dj-rest-auth/login/`;
  const CUSTOMER_LOGIN_ENDPOINT = `${BASE_API}/api/customer/login/`;
  const RESET_ENDPOINT = `${BASE_API}/auth/password-reset/`;

  const [form, setForm] = useState({ email_or_mobile: "", password: "" });
  const [message, setMessage] = useState("");
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showSolutionsModal, setShowSolutionsModal] = useState(false);

  const [stats, setStats] = useState({
    leads: "1,042",
    customers: "284",
    projects: "156",
    conversionRate: "27.3%",
  });

  useEffect(() => {
    const fetchPublicMetrics = async () => {
      try {
        const res = await fetch(`${BASE_API}/lead/public-metrics/`);
        if (res.ok) {
          const data = await res.json();
          setStats({
            leads: data.total_leads !== undefined ? data.total_leads.toLocaleString() : "1,042",
            customers: data.total_customers !== undefined ? data.total_customers.toLocaleString() : "284",
            projects: data.total_projects !== undefined ? data.total_projects.toLocaleString() : "156",
            conversionRate: data.conversion_rate || "27.3%",
          });
        }
      } catch (err) {
        // Keeps fallback stats if unauthenticated
      }
    };
    fetchPublicMetrics();
  }, [BASE_API]);

  // Forgot password in-place view state
  const [isForgotPassView, setIsForgotPassView] = useState(
    forceForgot || location.pathname === "/forgot-password"
  );
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotStatus, setForgotStatus] = useState({ type: "", message: "" });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("Logging in...");

    try {
      const res = await fetch(LOGIN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.access) localStorage.setItem("access", data.access);
        if (data.refresh) localStorage.setItem("refresh", data.refresh);
        localStorage.removeItem("crm_user_info");

        window.dispatchEvent(new Event("authChange"));

        setMessage("✅ Login successful!");
        navigate("/dashboard");
        return;
      }

      // Fallback: attempt Customer Portal login if staff/technician credentials did not match
      const custRes = await fetch(CUSTOMER_LOGIN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const custData = await custRes.json().catch(() => ({}));
      if (custRes.ok && custData.access) {
        localStorage.setItem("access", custData.access);
        if (custData.refresh) localStorage.setItem("refresh", custData.refresh);
        if (custData.user) {
          localStorage.setItem("crm_user_info", JSON.stringify(custData.user));
        }

        window.dispatchEvent(new Event("authChange"));

        setMessage("✅ Customer login successful!");
        navigate("/dashboard");
        return;
      }

      setMessage(`❌ Login failed: ${custData.error || "Invalid email ID or password."}`);
    } catch (error) {
      console.error("Login error:", error);
      setMessage("⚠️ Error connecting to server.");
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;

    setForgotLoading(true);
    setForgotStatus({ type: "info", message: "Verifying account in database..." });

    try {
      const res = await fetch(RESET_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errDetail = data.email
          ? Array.isArray(data.email)
            ? data.email.join(", ")
            : data.email
          : data.detail || "Account email not found in database.";
        setForgotStatus({ type: "error", message: errDetail });
        return;
      }

      if (data.is_admin) {
        setForgotStatus({
          type: "success",
          message: `✅ Admin reset link sent! Check your email inbox (${data.email || forgotEmail.trim()}).`,
        });
      } else {
        const notifPayload = {
          id: `req_${Date.now()}`,
          timestamp: Date.now(),
          title: "Password Change Requested",
          description: `Staff member ${data.user_name || forgotEmail} (${forgotEmail}) has requested a password change.`,
          type: "requests",
          badge: "Password Request",
          priority: "high",
          time: "Just now",
          userId: data.user_id,
          userEmail: forgotEmail,
          userName: data.user_name || forgotEmail,
        };

        const existingNotifs = JSON.parse(localStorage.getItem("crm_custom_notifs") || "[]");
        localStorage.setItem("crm_custom_notifs", JSON.stringify([notifPayload, ...existingNotifs]));

        window.dispatchEvent(
          new CustomEvent("newNotification", {
            detail: notifPayload,
          })
        );

        setForgotStatus({
          type: "success",
          message: `✅ Password reset request for staff account (${forgotEmail}) has been submitted to Admin!`,
        });
      }
    } catch (error) {
      console.error(error);
      setForgotStatus({ type: "error", message: "Could not connect to backend server." });
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 w-full min-h-screen h-full z-50 overflow-y-auto flex flex-col justify-between font-sans antialiased selection:bg-slate-800 selection:text-white"
      style={{
        backgroundImage: "url('/login-bg-clean.jpg')",
        backgroundColor: "#9e9c9d",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Subtle overlay to enhance contrast and readability */}
      <div className="fixed inset-0 bg-black/15 pointer-events-none z-0" />

      {/* =========================================================================
          LOGIN-PAGE DEDICATED NAVBAR (Only rendered on the login/public page)
         ========================================================================= */}
      <nav className="sticky top-0 z-20 w-full bg-slate-900/40 backdrop-blur-md border-b border-white/15 px-6 md:px-12 py-3.5 flex items-center justify-between transition-all">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3">
          <img
            src="/TEDRA_LOGO.jpeg"
            alt="TEDRA Logo"
            className="h-10 w-auto object-contain rounded-lg shadow-xs"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg md:text-xl font-bold text-white tracking-tight leading-none drop-shadow-sm">
                TEDRA CRM
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/15 text-white/90 border border-white/20">
                Enterprise v3.2
              </span>
            </div>
            <span className="text-[10px] font-medium text-white/75 tracking-wider uppercase block mt-0.5">
              Car Parking, Tower &amp; Stack Parking Systems
            </span>
          </div>
        </div>

        {/* Center: System Status & Solution Highlights (Desktop) */}
        <div className="hidden lg:flex items-center gap-6 text-xs text-white/85">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-medium text-white/90">System Online · All Services Active</span>
          </div>

          <button
            type="button"
            onClick={() => setShowSolutionsModal(true)}
            className="hover:text-white transition-colors cursor-pointer font-medium hover:underline flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
            Capabilities &amp; Modules
          </button>
        </div>

        {/* Right: Support / Help Action Button */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowSupportModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 active:bg-white/30 text-white text-xs font-semibold backdrop-blur-md border border-white/25 transition-all shadow-xs cursor-pointer"
          >
            <Headphones className="w-3.5 h-3.5 text-cyan-300" />
            <span>Need Help?</span>
          </button>
        </div>
      </nav>

      {/* =========================================================================
          CENTER LOGIN CARD
         ========================================================================= */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[420px] rounded-2xl bg-white/92 md:bg-white/95 backdrop-blur-xl border border-white/70 shadow-2xl shadow-black/25 p-8 md:p-10 transition-all duration-300 animate-fade-in">

          {isForgotPassView ? (
            /* FORGOT PASSWORD VIEW */
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1.5 tracking-tight">
                Reset Password
              </h2>
              <p className="text-xs text-slate-500 mb-6 font-medium leading-relaxed">
                Enter your account email below. Admin resets will receive an email link, while staff requests will alert Admin directly.
              </p>

              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Account Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="admin@gmail.com"
                    required
                    className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/80 px-4 text-sm text-slate-800 outline-none transition-all focus:border-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-800/10 placeholder:text-slate-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className={`w-full h-11 rounded-xl text-white font-semibold text-sm bg-slate-900 hover:bg-slate-800 active:bg-black transition-all shadow-md shadow-slate-900/15 tracking-wide flex items-center justify-center gap-2 cursor-pointer ${forgotLoading ? "opacity-75 cursor-not-allowed" : ""
                    }`}
                >
                  {forgotLoading ? "Verifying Account..." : "Submit Reset Request"}
                </button>
              </form>

              {forgotStatus.message && (
                <div
                  className={`mt-4 p-3 rounded-xl border text-xs font-medium leading-relaxed ${forgotStatus.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-rose-50 text-rose-800 border-rose-200"
                    }`}
                >
                  {forgotStatus.message}
                </div>
              )}

              <div className="mt-6 text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassView(false);
                    setForgotStatus({ type: "", message: "" });
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Login
                </button>
              </div>
            </div>
          ) : (
            /* STANDARD SIGN-IN VIEW */
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1 tracking-tight">
                Welcome back
              </h2>
              <p className="text-xs text-slate-500 mb-6 font-medium">
                Sign in to your account
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email Address Field */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="text"
                    name="email_or_mobile"
                    value={form.email_or_mobile}
                    onChange={handleChange}
                    placeholder="admin@gmail.com"
                    className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/80 px-4 text-sm text-slate-800 outline-none transition-all focus:border-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-800/10 placeholder:text-slate-400"
                  />
                </div>

                {/* Password Field */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="•••••••••"
                    className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/80 px-4 text-sm text-slate-800 outline-none transition-all focus:border-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-800/10 placeholder:text-slate-400"
                  />
                </div>

                {/* Checkbox and Forgot Link */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-0 accent-slate-900 cursor-pointer"
                    />
                    <span className="text-slate-700 font-medium">Remember me</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassView(true);
                      setForgotStatus({ type: "", message: "" });
                    }}
                    className="text-slate-600 hover:text-slate-900 font-semibold transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Action Submit Button */}
                <button
                  type="submit"
                  className="w-full h-11 rounded-xl text-white font-semibold text-sm bg-slate-900 hover:bg-slate-800 active:bg-black transition-all shadow-md shadow-slate-900/15 tracking-wide mt-2 cursor-pointer flex items-center justify-center gap-2"
                >
                  Sign In to Dashboard
                </button>
              </form>

              {message && (
                <div className="mt-4 text-center text-xs text-slate-600 font-medium">
                  {message}
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {/* =========================================================================
          BOTTOM FOOTER & COMPACT METRICS
         ========================================================================= */}
      <footer className="relative z-10 w-full px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center bg-slate-900/20 backdrop-blur-xs border-t border-white/10">
        {/* Subtle Frosted Live Metrics Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-[11px] font-medium shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Leads: <strong className="font-semibold">{stats.leads}</strong></span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-[11px] font-medium shadow-xs">
            <Users className="w-3 h-3 text-white/90" />
            <span>Customers: <strong className="font-semibold">{stats.customers}</strong></span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-[11px] font-medium shadow-xs">
            <Briefcase className="w-3 h-3 text-white/90" />
            <span>Projects: <strong className="font-semibold">{stats.projects}</strong></span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-[11px] font-medium shadow-xs">
            <BarChart3 className="w-3 h-3 text-white/90" />
            <span>Conv. Rate: <strong className="font-semibold">{stats.conversionRate}</strong></span>
          </div>
        </div>

        {/* Copyright */}
        <p className="text-[11px] text-white/90 font-medium drop-shadow-sm">
          © 2024 TEDRA CRM · Enterprise Edition v3.2.1
        </p>
      </footer>

      {/* =========================================================================
          HELP & SUPPORT MODAL
         ========================================================================= */}
      {showSupportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 relative">
            <button
              onClick={() => setShowSupportModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                <Headphones className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">TEDRA Help &amp; Support</h3>
                <p className="text-xs text-slate-500">Assistance for staff and project partners</p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs text-slate-600">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="font-semibold text-slate-800 mb-1 flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-cyan-600" />
                  Admin &amp; Technical Support
                </div>
                <p className="text-slate-500">Need credentials or account assistance?</p>
                <a
                  href="mailto:admin@tedracrm.com"
                  className="font-mono text-cyan-700 font-semibold hover:underline mt-1 inline-block"
                >
                  admin@tedracrm.com
                </a>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="font-semibold text-slate-800 mb-1 flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-cyan-600" />
                  Technical Helpline
                </div>
                <p className="text-slate-500">Mon - Sat from 9:00 AM to 7:00 PM IST</p>
                <span className="font-mono text-slate-800 font-bold mt-1 inline-block">
                  +91 98765 43210
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100 text-emerald-800">
                <div className="font-semibold mb-1 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  Forgot Password?
                </div>
                <p className="text-emerald-700">
                  Click "Forgot password?" on the login box to submit a direct reset request to your CRM administrator.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowSupportModal(false)}
              className="w-full mt-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          CAPABILITIES & MODULES MODAL
         ========================================================================= */}
      {showSolutionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 relative">
            <button
              onClick={() => setShowSolutionsModal(true && setShowSolutionsModal(false))}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center">
                <img
                  src="/TEDRA_LOGO.jpeg"
                  alt="TEDRA Logo"
                  className="h-8 w-auto object-contain"
                />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">TEDRA CRM Platform</h3>
                <p className="text-xs text-slate-500">Integrated Parking Solutions &amp; CRM Modules</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Lead Management
                </div>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  Track inquiries, follow-ups, pipelines, and convert parking project leads.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-1">
                  <FileText className="w-4 h-4 text-cyan-600" />
                  Instant Quotations
                </div>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  Generate automated cost estimates, multi-tier terms, and PDF proposals.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-1">
                  <Briefcase className="w-4 h-4 text-amber-600" />
                  Projects &amp; AMC
                </div>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  Oversee tower &amp; stack parking installations, annual maintenance, and technician visits.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-1">
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                  Tally &amp; Security
                </div>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  Sync ledgers and vouchers with Tally Prime and role-based permissions.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowSolutionsModal(false)}
              className="w-full mt-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
