"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

type AuthMode = "login" | "register";

type AuthFormProps = {
  mode: AuthMode;
};

type AuthResponse = {
  token: string;
  user: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
  };
};

type ApiErrorResponse = {
  detail?: string;
  [key: string]: string | string[] | undefined;
};

function isAuthResponse(data: AuthResponse | ApiErrorResponse | null): data is AuthResponse {
  return Boolean(data && "token" in data && typeof data.token === "string" && "user" in data);
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8000/api";

function splitDisplayName(displayName: string) {
  const trimmed = displayName.trim();
  if (!trimmed) {
    return { first_name: "", last_name: "" };
  }

  const [first, ...rest] = trimmed.split(/\s+/);
  return {
    first_name: first ?? "",
    last_name: rest.join(" "),
  };
}

export function AuthForm({ mode }: AuthFormProps) {
  const isLogin = mode === "login";

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [organization, setOrganization] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const endpoint = useMemo(
    () => `${API_BASE_URL}/auth/${isLogin ? "login" : "register"}/`,
    [isLogin],
  );

  function getErrorMessage(data: ApiErrorResponse | null) {
    if (!data) {
      return "Authentication failed. Please review your details and try again.";
    }

    if (typeof data.detail === "string" && data.detail.trim()) {
      return data.detail;
    }

    const firstFieldError = Object.values(data).find((value) =>
      Array.isArray(value) ? value.length > 0 : typeof value === "string" && value.trim(),
    );

    if (Array.isArray(firstFieldError)) {
      return firstFieldError[0] ?? "Authentication failed. Please review your details and try again.";
    }

    if (typeof firstFieldError === "string") {
      return firstFieldError;
    }

    return "Authentication failed. Please review your details and try again.";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const registerNameParts = splitDisplayName(displayName);
    const payload = isLogin
      ? {
          username,
          password,
        }
      : {
          username,
          email,
          password,
          display_name: displayName,
          organization,
          ...registerNameParts,
        };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => null)) as AuthResponse | ApiErrorResponse | null;

      if (!response.ok) {
        throw new Error(getErrorMessage(data as ApiErrorResponse | null));
      }

      if (!isAuthResponse(data) || !data.token) {
        throw new Error("Authentication succeeded, but no token was returned.");
      }

      window.localStorage.setItem("geopulse.token", data.token);
      window.localStorage.setItem("geopulse.user", JSON.stringify(data.user));
      window.location.assign("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete the request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass-panel-strong rounded-[24px] p-6 sm:p-8">
      <div className="space-y-5">
        {!isLogin && (
          <div>
            <label
              htmlFor="displayName"
              className="mb-2 block font-mono-ui text-[11px] uppercase tracking-[0.18em] text-[var(--on-surface-variant)]"
            >
              Full Name
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Aisha Bello"
              className="w-full rounded-2xl border border-[rgb(134,147,151,0.16)] bg-[rgb(26,31,47,0.7)] px-4 py-3 text-base text-[var(--on-surface)] outline-none transition placeholder:text-[rgb(188,201,205,0.45)] focus:border-[var(--primary)]"
            />
          </div>
        )}

        <div>
          <label
            htmlFor="username"
            className="mb-2 block font-mono-ui text-[11px] uppercase tracking-[0.18em] text-[var(--on-surface-variant)]"
          >
            Username
          </label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="intel_operator"
            className="w-full rounded-2xl border border-[rgb(134,147,151,0.16)] bg-[rgb(26,31,47,0.7)] px-4 py-3 text-base text-[var(--on-surface)] outline-none transition placeholder:text-[rgb(188,201,205,0.45)] focus:border-[var(--primary)]"
          />
        </div>

        {!isLogin && (
          <div>
            <label
              htmlFor="email"
              className="mb-2 block font-mono-ui text-[11px] uppercase tracking-[0.18em] text-[var(--on-surface-variant)]"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="team@geopulse.ai"
              className="w-full rounded-2xl border border-[rgb(134,147,151,0.16)] bg-[rgb(26,31,47,0.7)] px-4 py-3 text-base text-[var(--on-surface)] outline-none transition placeholder:text-[rgb(188,201,205,0.45)] focus:border-[var(--primary)]"
            />
          </div>
        )}

        {!isLogin && (
          <div>
            <label
              htmlFor="organization"
              className="mb-2 block font-mono-ui text-[11px] uppercase tracking-[0.18em] text-[var(--on-surface-variant)]"
            >
              Organization
            </label>
            <input
              id="organization"
              type="text"
              value={organization}
              onChange={(event) => setOrganization(event.target.value)}
              placeholder="North Corridor Response Unit"
              className="w-full rounded-2xl border border-[rgb(134,147,151,0.16)] bg-[rgb(26,31,47,0.7)] px-4 py-3 text-base text-[var(--on-surface)] outline-none transition placeholder:text-[rgb(188,201,205,0.45)] focus:border-[var(--primary)]"
            />
          </div>
        )}

        <div>
          <label
            htmlFor="password"
            className="mb-2 block font-mono-ui text-[11px] uppercase tracking-[0.18em] text-[var(--on-surface-variant)]"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Minimum 8 characters"
            className="w-full rounded-2xl border border-[rgb(134,147,151,0.16)] bg-[rgb(26,31,47,0.7)] px-4 py-3 text-base text-[var(--on-surface)] outline-none transition placeholder:text-[rgb(188,201,205,0.45)] focus:border-[var(--primary)]"
          />
        </div>
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-[rgb(255,129,122,0.16)] bg-[rgb(255,129,122,0.08)] px-4 py-3 text-sm text-[var(--tertiary-container)]">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-[var(--primary-container)] px-6 py-3.5 text-base font-semibold text-[var(--on-primary-container)] transition hover:bg-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? "Processing..." : isLogin ? "Login to Command Center" : "Create Access Account"}
      </button>

      <p className="mt-4 text-center text-sm text-[var(--on-surface-variant)]">
        {isLogin ? "Need an account?" : "Already have access?"}{" "}
        <Link
          href={isLogin ? "/register" : "/login"}
          className="font-semibold text-[var(--primary)] hover:underline"
        >
          {isLogin ? "Register here" : "Login here"}
        </Link>
      </p>
    </form>
  );
}
