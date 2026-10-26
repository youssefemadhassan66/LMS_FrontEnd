import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AuthShell from "./AuthShell";
import { TextField, PasswordField } from "./AuthField";
import "./Auth.css";

// Instructor accounts are provisioned by an admin, not self-served, so only the
// two public roles are offered here.
const ROLES = [
  {
    value: "student",
    label: "Student",
    icon: "fa-solid fa-graduation-cap",
    blurb: "Learn & compete",
  },
  {
    value: "parent",
    label: "Parent",
    icon: "fa-solid fa-user-shield",
    blurb: "Track progress",
  },
];

const PITCH = {
  login: {
    headline: "Welcome back to the orbit.",
    blurb:
      "Pick up your curriculum exactly where you left it — progress, streaks and reviews included.",
    points: [
      { icon: "fa-solid fa-bolt", text: "Your streak and XP are waiting" },
      {
        icon: "fa-solid fa-list-check",
        text: "Open tasks and upcoming sessions",
      },
      {
        icon: "fa-solid fa-chart-line",
        text: "Live progress across every track",
      },
    ],
  },
  signup: {
    headline: "Start your launch sequence.",
    blurb:
      "Create your account, then an admin will review it before you can enter the learning dashboard.",
    points: [
      {
        icon: "fa-solid fa-user-shield",
        text: "Admin-reviewed student and parent access",
      },
      {
        icon: "fa-solid fa-book-open",
        text: "Structured curriculum after approval",
      },
      {
        icon: "fa-solid fa-users",
        text: "A secure learning team for every student",
      },
    ],
  },
};

// Each form has its own URL so a sign-up CTA can link straight to sign-up, and
// a refresh, bookmark or shared link reopens the form that was showing. One
// component still serves both, so the shell and the tab animation are shared.
const LOGIN_PATH = "/login";
const SIGNUP_PATH = "/signup";

const Auth = () => {
  const location = useLocation();
  const isLogin = location.pathname !== SIGNUP_PATH;
  const navigate = useNavigate();
  const { user, login, signup, loading, error, setError } = useAuth();

  const [formData, setFormData] = useState({
    FullName: "",
    UserName: "",
    Email: "",
    password: "",
    role: "student",
  });

  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    return () => {
      setError(null);
    };
  }, [isLogin, setError]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isLogin) {
      const success = await login(formData.Email, formData.password);
      if (success) navigate("/dashboard");
    } else {
      const result = await signup({
        FullName: formData.FullName,
        UserName: formData.UserName,
        Email: formData.Email,
        password: formData.password,
        role: formData.role,
      });

      if (result?.pendingApproval) {
        navigate("/account-pending", {
          state: { email: formData.Email },
          replace: true,
        });
      } else if (result) {
        navigate("/dashboard");
      }
    }
  };

  // Replace, not push: flipping a tab is not a page visit, so Back should
  // still leave the auth screen rather than step through every toggle. The
  // query string and router state ride along, so a ProtectedRoute redirect's
  // `from` survives a detour through the other tab.
  const switchMode = (login) => {
    if (login === isLogin) return;
    setError(null);
    navigate(
      { pathname: login ? LOGIN_PATH : SIGNUP_PATH, search: location.search },
      { replace: true, state: location.state },
    );
  };

  const pitch = isLogin ? PITCH.login : PITCH.signup;

  return (
    <AuthShell
      headline={pitch.headline}
      blurb={pitch.blurb}
      points={pitch.points}
    >
      <section className="auth-card" data-no-drag>
        {/* Segmented switch. The indicator is a single sliding block so the two
            labels never reflow when the active one turns bold. */}
        <div
          className="auth-tabs"
          role="tablist"
          aria-label="Authentication mode"
        >
          <span
            className="auth-tabs-indicator"
            data-side={isLogin ? "left" : "right"}
            aria-hidden="true"
          />
          <button
            type="button"
            role="tab"
            aria-selected={isLogin}
            className={`auth-tab${isLogin ? " is-active" : ""}`}
            onClick={() => switchMode(true)}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isLogin}
            className={`auth-tab${!isLogin ? " is-active" : ""}`}
            onClick={() => switchMode(false)}
          >
            Create account
          </button>
        </div>

        <h2 className="auth-card-title">
          {isLogin ? "Sign in" : "Create your account"}
        </h2>
        <p className="auth-card-sub">
          {isLogin
            ? "Enter your credentials to reach your dashboard."
            : "Your account will be ready after a quick admin review."}
        </p>

        {error && (
          <div className="auth-error-msg" role="alert">
            <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* Keyed on the mode so switching remounts the fields — that is what
            lets autoFocus land on the first control of whichever form is up. */}
        <form
          key={isLogin ? "login" : "signup"}
          onSubmit={handleSubmit}
          className="auth-form"
        >
          {!isLogin && (
            <div className="auth-row">
              <TextField
                label="Full name"
                icon="fa-solid fa-user"
                type="text"
                name="FullName"
                value={formData.FullName}
                onChange={handleChange}
                placeholder="Ada Lovelace"
                autoComplete="name"
                autoFocus
                required
              />
              <TextField
                label="Username"
                icon="fa-solid fa-at"
                type="text"
                name="UserName"
                value={formData.UserName}
                onChange={handleChange}
                placeholder="ada"
                autoComplete="username"
                required
              />
            </div>
          )}

          <TextField
            label="Email address"
            icon="fa-solid fa-envelope"
            type="email"
            name="Email"
            value={formData.Email}
            onChange={handleChange}
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
            autoFocus={isLogin}
            required
          />

          <PasswordField
            label="Password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder={isLogin ? "Your password" : "At least 8 characters"}
            autoComplete={isLogin ? "current-password" : "new-password"}
            minLength={isLogin ? undefined : 8}
            strength={!isLogin}
            required
            trailing={
              isLogin ? (
                <Link to="/forgot-password" className="auth-inline-link">
                  Forgot password?
                </Link>
              ) : null
            }
          />

          {!isLogin && (
            <fieldset className="auth-roles">
              <legend className="auth-label">I am a…</legend>
              <div className="auth-role-grid">
                {ROLES.map((role) => (
                  <label
                    key={role.value}
                    className={`auth-role${formData.role === role.value ? " is-active" : ""}`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={role.value}
                      checked={formData.role === role.value}
                      onChange={handleChange}
                    />
                    <i className={role.icon} aria-hidden="true" />
                    <span className="auth-role-label">{role.label}</span>
                    <span className="auth-role-blurb">{role.blurb}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? (
              <>
                <i
                  className="fa-solid fa-circle-notch auth-spin"
                  aria-hidden="true"
                />
                {isLogin ? "Signing in…" : "Creating account…"}
              </>
            ) : (
              <>
                {isLogin ? "Sign in" : "Request account"}
                <i className="fa-solid fa-arrow-right" aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        <p className="auth-switch">
          {isLogin ? "Don't have an account?" : "Already have an account?"}
          <button
            type="button"
            className="switch-btn"
            onClick={() => switchMode(!isLogin)}
          >
            {isLogin ? "Create one" : "Sign in"}
          </button>
        </p>
      </section>
    </AuthShell>
  );
};

export default Auth;
