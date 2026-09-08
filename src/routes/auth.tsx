import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Info, UserCheck } from "lucide-react";

const searchSchema = z.object({
  mode: z.enum(["login", "register", "forgot"]).catch("login"),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  beforeLoad: async ({ search }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Redirect logged-in users to their correct dashboard
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      const userRoles = (roleData || []).map((r: any) => r.role);
      const metaRole = user.user_metadata?.['role'];
      const allUserRoles = new Set([...userRoles, metaRole].filter(Boolean));

      let target = search.redirect;
      if (!target || target === '/my-swift-move' || target === '/my-barakah' || target === '/' || target.includes('/auth')) {
        if (allUserRoles.has('swift_dispatcher') || allUserRoles.has('dispatcher')) {
          target = '/dispatcher';
        } else if (allUserRoles.has('administrator') || allUserRoles.has('admin') || allUserRoles.has('swift_manager')) {
          target = '/admin';
        } else if (allUserRoles.has('driver') || allUserRoles.has('dispatch_rider')) {
          target = '/drive';
        } else {
          target = '/my-swift-move';
        }
      }
      throw redirect({ to: target as any });
    }
  },
  head: () => ({
    meta: [
      { title: `Login or Register — SwiftMove` },
      { name: "description", content: "Access your SwiftMove account." },
    ],
  }),
  component: AuthPage,
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

const registerSchema = loginSchema.extend({
  fullName: z.string().trim().min(2, "Enter your full name").max(100),
  phone: z
    .string()
    .trim()
    .min(7, "Phone number is required")
    .regex(/^\+?[0-9\s-]{7,20}$/, "Enter a valid phone number"),
  location: z.string().trim().min(2, "Location is required").max(120),
  consent: z.boolean().refine((v) => v === true, "Please accept the terms to continue"),
});

function AuthPage() {
  const { mode, redirect: redirectParam } = Route.useSearch();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    location: "",
    password: "",
    consent: false,
  });

  function setMode(m: "login" | "register" | "forgot") {
    navigate({ to: "/auth", search: { mode: m, redirect: redirectParam }, replace: true });
  }

  async function handleGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      }
    });
    if (error) toast.error("Google sign-in failed. Please try again.");
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email: form.email, password: form.password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your details.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) {
      setBusy(false);
      return void toast.error(error.message || "Invalid email or password.");
    }
    
    // Fetch user roles
    const user = data.user;
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    const userRoles = (roleData || []).map((r: any) => r.role);
    const metaRole = user.user_metadata?.['role'];
    const allUserRoles = new Set([...userRoles, metaRole].filter(Boolean));
    
    setBusy(false);
    toast.success("Welcome back!");
    
    // Determine redirect path
    let target = redirectParam;
    if (!target || target === '/my-swift-move' || target === '/my-barakah' || target === '/' || target.includes('/auth')) {
      if (allUserRoles.has('swift_dispatcher') || allUserRoles.has('dispatcher')) {
        target = '/dispatcher';
      } else if (allUserRoles.has('administrator') || allUserRoles.has('admin') || allUserRoles.has('swift_manager')) {
        target = '/admin';
      } else if (allUserRoles.has('driver') || allUserRoles.has('dispatch_rider')) {
        target = '/drive';
      } else {
        target = '/my-swift-move';
      }
    }
    navigate({ to: target as any });
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your details.");
      return;
    }
    setBusy(true);
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: parsed.data.fullName,
          phone: parsed.data.phone,
          location: parsed.data.location,
          role: "registered_user",
          consent_given: true,
        },
      },
    });
    if (error) {
      setBusy(false);
      return void toast.error(error.message);
    }

    // Ensure phone is written to the profiles table immediately
    // (the Supabase trigger may create the profile but not always include phone)
    if (signUpData?.user?.id) {
      await supabase.from('profiles').upsert({
        user_id: signUpData.user.id,
        full_name: parsed.data.fullName,
        phone: parsed.data.phone,
      } as any, { onConflict: 'user_id' }).then(() => {});
    }

    setBusy(false);
    setRegistered(true);
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    const email = form.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return void toast.error("Enter a valid email address.");
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success("If that email is registered, a reset link is on its way.");
    setMode("login");
  }

  const inputCls =
    "mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all";

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 py-16 text-slate-100">
      <div className="w-full max-w-md text-center mb-8">
        <div className="inline-flex p-3 bg-blue-600/10 rounded-2xl text-blue-500 mb-4 border border-blue-500/20">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          {mode === "register" ? "Create Customer Account" : mode === "forgot" ? "Reset password" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          {mode === "register"
            ? "Sign up to book rides, schedule dispatches, and access Barakah services."
            : mode === "forgot"
              ? "We'll email you a secure reset link."
              : "Access the Barakah & SwiftMove platform."}
        </p>
      </div>

      {registered ? (
        <div className="w-full max-w-md bg-slate-900/50 border border-slate-800/80 rounded-2xl p-8 text-center backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-white">Check your email</h2>
          <p className="mt-2 text-sm text-slate-400">
            We've sent a confirmation link to <strong className="text-white">{form.email}</strong>. Click it to
            activate your account, then sign in.
          </p>
          <button
            onClick={() => {
              setRegistered(false);
              setMode("login");
            }}
            className="mt-6 w-full rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20"
          >
            Back to sign in
          </button>
        </div>
      ) : (
        <div className="w-full max-w-md bg-slate-900/50 border border-slate-800/80 rounded-2xl p-8 backdrop-blur-sm shadow-xl">
          {mode !== "forgot" && (
            <>
              <button
                onClick={handleGoogle}
                className="w-full flex items-center justify-center gap-3 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
              <div className="my-5 flex items-center gap-3 text-xs text-slate-500">
                <span className="h-px flex-1 bg-slate-800" /> or with email{" "}
                <span className="h-px flex-1 bg-slate-800" />
              </div>
            </>
          )}

          <form
            onSubmit={
              mode === "register" ? handleRegister : mode === "forgot" ? handleForgot : handleLogin
            }
            className="space-y-4"
          >
            {mode === "register" && (
              <>
                <div>
                  <label htmlFor="fullName" className="text-sm font-medium text-slate-300">Full name</label>
                  <input id="fullName" className={inputCls} value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })} required maxLength={100} />
                </div>
                <div>
                  <label htmlFor="phone" className="text-sm font-medium text-slate-300">Phone number <span className="text-red-400">*</span></label>
                  <input id="phone" className={inputCls} value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })} required maxLength={20} placeholder="e.g. +234 801 234 5678" />
                </div>
                <div>
                  <label htmlFor="location" className="text-sm font-medium text-slate-300">Location <span className="text-red-400">*</span></label>
                  <input id="location" className={inputCls} value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })} required maxLength={120} placeholder="City, State" />
                </div>
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                  <UserCheck className="h-4 w-4 shrink-0" />
                  <span>Account Type: <strong>Customer / Passenger</strong></span>
                </div>
              </>
            )}
            <div>
              <label htmlFor="email" className="text-sm font-medium text-slate-300">Email Address</label>
              <input id="email" type="email" className={inputCls} value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} required maxLength={255} />
            </div>
            {mode !== "forgot" && (
              <div>
                <label htmlFor="password" className="text-sm font-medium text-slate-300">Password</label>
                <div className="relative mt-1">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className={`${inputCls} pr-10`}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    minLength={6}
                    maxLength={72}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
            {mode === "register" && (
              <label className="flex items-start gap-2.5 text-xs text-slate-400 mt-2 select-none">
                <input type="checkbox" className="mt-1 accent-blue-600" checked={form.consent}
                  onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
                <span>I consent to Barakah and SwiftMove storing my details to provide services.</span>
              </label>
            )}
            <button
              type="submit"
              disabled={busy}
              className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
            >
              {busy
                ? "Please wait..."
                : mode === "register"
                  ? "Create Customer Account"
                  : mode === "forgot"
                    ? "Send reset link"
                    : "Sign In"}
            </button>
          </form>

          {mode === "register" && (
            <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/40 p-3.5 text-xs text-slate-400 flex items-start gap-2.5">
              <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong className="text-slate-300">Looking to join as a driver or dispatch rider?</strong> Drivers and dispatch riders are onboarded exclusively by administrators via the admin dashboard. Please contact dispatch support to register your vehicle.
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap justify-between gap-2 text-xs">
            {mode !== "login" && (
              <button onClick={() => setMode("login")} className="text-blue-400 hover:text-blue-300 hover:underline">
                Sign in instead
              </button>
            )}
            {mode !== "register" && (
              <button onClick={() => setMode("register")} className="text-blue-400 hover:text-blue-300 hover:underline">
                Create an account
              </button>
            )}
            {mode === "login" && (
              <button onClick={() => setMode("forgot")} className="text-slate-400 hover:text-slate-300 hover:underline">
                Forgot password?
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}