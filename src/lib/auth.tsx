"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { EMPLOYEES } from "./seed";
import { SessionUser, AccessRole } from "./access";
import { cloudEnabled, cloudLoad, cloudSave, cloudSubscribe } from "./cloud";

// Demo password for every account (shown on the login screen). In the real
// build this is replaced by per-user credentials checked on the server.
export const DEMO_PASSWORD = "rulethu";
const AUTH_KEY = "rulethu-auth-user";
const OVERRIDES_KEY = "rulethu-auth-overrides";

// Access role per employee id (everyone else is a department "member").
const ACCESS_OVERRIDES: Record<string, AccessRole> = {
  "E-001": "exec",      // CEO
  "E-002": "exec",      // CIO
  "E-004": "exec",      // COO
  "E-003": "exec",      // Risk & Compliance (oversight)
  "E-041": "admin",     // IT & Systems Lead — full admin
  "E-030": "approver",  // Finance Manager
  "E-040": "approver",  // HR & Admin Officer
};

const EMAIL_OVERRIDES: Record<string, string> = {
  "E-022": "research@rulethu.com",
  "E-030": "finance@rulethu.com",
  "E-031": "accounts@rulethu.com",
  "E-040": "hr@rulethu.com",
  "E-041": "admin@rulethu.com",
};

function displayName(name: string, role: string): string {
  return name === "Placement" ? role : name;
}

// Base accounts derived from the directory.
export const ACCOUNTS: SessionUser[] = EMPLOYEES.map((e) => ({
  id: e.id,
  name: displayName(e.name, e.role),
  role: e.role,
  department: e.department,
  email: (e.email ?? EMAIL_OVERRIDES[e.id] ?? `${e.id.toLowerCase()}@rulethu.com`).toLowerCase(),
  accessRole: ACCESS_OVERRIDES[e.id] ?? "member",
}));

interface Overrides {
  passwords: Record<string, string>;
  roles: Record<string, AccessRole>;
  names: Record<string, string>;
  added: SessionUser[];           // accounts an admin created (not in the seed directory)
}

export interface NewUser { name: string; email: string; department: string; role?: string; accessRole: AccessRole }

interface AuthCtx {
  user: SessionUser | null;
  hydrated: boolean;
  accounts: SessionUser[];
  isAdmin: boolean;
  login: (email: string, password: string) => { ok: boolean; error?: string };
  register: (email: string, fullName: string, password: string) => { ok: boolean; error?: string };
  loginAs: (id: string) => void;
  logout: () => void;
  changeMyPassword: (password: string) => void;
  // admin controls
  addUser: (u: NewUser) => { ok: boolean; error?: string };
  removeUser: (id: string) => void;
  isAdded: (id: string) => boolean;
  setPassword: (id: string, password: string) => void;
  resetPassword: (id: string) => void;        // back to DEMO_PASSWORD
  setAccessRole: (id: string, role: AccessRole) => void;
  passwordFor: (id: string) => string;        // demo visibility for the admin
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [overrides, setOverrides] = useState<Overrides>({ passwords: {}, roles: {}, names: {}, added: [] });
  const overridesRef = useRef(overrides);
  const suppressAuthSave = useRef(false);
  const authSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { overridesRef.current = overrides; }, [overrides]);

  const applyAuth = (a: Partial<Overrides>) =>
    setOverrides({ passwords: a.passwords ?? {}, roles: a.roles ?? {}, names: a.names ?? {}, added: a.added ?? [] });

  useEffect(() => {
    try {
      const ov = localStorage.getItem(OVERRIDES_KEY);
      const parsed: Overrides = ov ? JSON.parse(ov) : { passwords: {}, roles: {}, names: {}, added: [] };
      const added = parsed.added ?? [];
      setOverrides({ passwords: parsed.passwords ?? {}, roles: parsed.roles ?? {}, names: parsed.names ?? {}, added });
      const raw = localStorage.getItem(AUTH_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { id: string };
        const base = ACCOUNTS.find((a) => a.id === saved.id) ?? added.find((a) => a.id === saved.id);
        if (base) setUser({ ...base, name: parsed?.names?.[base.id] ?? base.name, accessRole: parsed?.roles?.[base.id] ?? base.accessRole });
      }
    } catch { /* ignore */ }
    setHydrated(true);

    // Shared cloud accounts (so an admin's added users reach every device)
    if (!cloudEnabled) return;
    let unsub = () => {};
    (async () => {
      const row = await cloudLoad();
      if (row && row.auth) { suppressAuthSave.current = true; applyAuth(row.auth as Partial<Overrides>); }
      else { await cloudSave({ auth: overridesRef.current }); }
      unsub = cloudSubscribe((r) => { if (r.auth) { suppressAuthSave.current = true; applyAuth(r.auth as Partial<Overrides>); } });
    })();
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!hydrated || !cloudEnabled) return;
    if (suppressAuthSave.current) { suppressAuthSave.current = false; return; }
    if (authSaveTimer.current) clearTimeout(authSaveTimer.current);
    authSaveTimer.current = setTimeout(() => cloudSave({ auth: overridesRef.current }), 700);
  }, [overrides, hydrated]);

  const persistOverrides = (ov: Overrides) => { try { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(ov)); } catch { /* ignore */ } };
  const persistUser = (u: SessionUser | null) => { try { if (u) localStorage.setItem(AUTH_KEY, JSON.stringify({ id: u.id })); else localStorage.removeItem(AUTH_KEY); } catch { /* ignore */ } };

  const accounts = useMemo(
    () => [...ACCOUNTS, ...overrides.added].map((a) => ({ ...a, name: overrides.names[a.id] ?? a.name, accessRole: overrides.roles[a.id] ?? a.accessRole })),
    [overrides.roles, overrides.names, overrides.added],
  );

  const passwordFor = useCallback((id: string) => overrides.passwords[id] ?? DEMO_PASSWORD, [overrides.passwords]);

  const login: AuthCtx["login"] = useCallback((email, password) => {
    const acct = accounts.find((a) => a.email === email.trim().toLowerCase());
    if (!acct) return { ok: false, error: "No account with that email." };
    const expected = overrides.passwords[acct.id] ?? DEMO_PASSWORD;
    if (password !== expected) return { ok: false, error: "Incorrect password." };
    setUser(acct); persistUser(acct);
    return { ok: true };
  }, [accounts, overrides.passwords]);

  const register: AuthCtx["register"] = useCallback((email, fullName, password) => {
    const acct = accounts.find((a) => a.email === email.trim().toLowerCase());
    if (!acct) return { ok: false, error: "That email isn't on the staff list. Ask an admin to add you." };
    if (!fullName.trim()) return { ok: false, error: "Please enter your full name." };
    if (password.length < 4) return { ok: false, error: "Choose a password of at least 4 characters." };
    setOverrides((o) => {
      const next = { ...o, names: { ...o.names, [acct.id]: fullName.trim() }, passwords: { ...o.passwords, [acct.id]: password } };
      persistOverrides(next);
      return next;
    });
    const updated = { ...acct, name: fullName.trim() };
    setUser(updated); persistUser(updated);
    return { ok: true };
  }, [accounts]);

  const loginAs: AuthCtx["loginAs"] = useCallback((id) => {
    const acct = accounts.find((a) => a.id === id);
    if (acct) { setUser(acct); persistUser(acct); }
  }, [accounts]);

  const logout: AuthCtx["logout"] = useCallback(() => { setUser(null); persistUser(null); }, []);

  const changeMyPassword: AuthCtx["changeMyPassword"] = useCallback((password) => {
    if (!user) return;
    setOverrides((o) => { const next = { ...o, passwords: { ...o.passwords, [user.id]: password } }; persistOverrides(next); return next; });
  }, [user]);

  const setPassword: AuthCtx["setPassword"] = useCallback((id, password) => {
    setOverrides((o) => { const next = { ...o, passwords: { ...o.passwords, [id]: password } }; persistOverrides(next); return next; });
  }, []);

  const resetPassword: AuthCtx["resetPassword"] = useCallback((id) => {
    setOverrides((o) => { const p = { ...o.passwords }; delete p[id]; const next = { ...o, passwords: p }; persistOverrides(next); return next; });
  }, []);

  const setAccessRole: AuthCtx["setAccessRole"] = useCallback((id, role) => {
    setOverrides((o) => { const next = { ...o, roles: { ...o.roles, [id]: role } }; persistOverrides(next); return next; });
    setUser((u) => (u && u.id === id ? { ...u, accessRole: role } : u));
  }, []);

  const addUser: AuthCtx["addUser"] = useCallback((u) => {
    const email = u.email.trim().toLowerCase();
    if (!u.name.trim()) return { ok: false, error: "Enter the person's full name." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid work email." };
    if (accounts.some((a) => a.email === email)) return { ok: false, error: "An account with that email already exists." };
    const acct: SessionUser = {
      id: `U-${Date.now().toString(36)}${Math.floor(Math.random() * 100)}`,
      name: u.name.trim(),
      role: u.role?.trim() || "Staff",
      department: u.department,
      email,
      accessRole: u.accessRole,
    };
    setOverrides((o) => { const next = { ...o, added: [...o.added, acct] }; persistOverrides(next); return next; });
    return { ok: true };
  }, [accounts]);

  const removeUser: AuthCtx["removeUser"] = useCallback((id) => {
    setOverrides((o) => {
      const added = o.added.filter((a) => a.id !== id);
      const passwords = { ...o.passwords }; delete passwords[id];
      const roles = { ...o.roles }; delete roles[id];
      const names = { ...o.names }; delete names[id];
      const next = { passwords, roles, names, added };
      persistOverrides(next); return next;
    });
  }, []);

  const isAdded: AuthCtx["isAdded"] = useCallback((id) => overrides.added.some((a) => a.id === id), [overrides.added]);

  const value: AuthCtx = {
    user, hydrated, accounts, isAdmin: user?.accessRole === "admin",
    login, register, loginAs, logout, changeMyPassword, addUser, removeUser, isAdded, setPassword, resetPassword, setAccessRole, passwordFor,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
