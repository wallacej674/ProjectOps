import { useState } from "react";
import { authApi } from "../../api/auth";
import { ApiError } from "../../api/client";
import { AppShell } from "../../components/layout/AppShell";
import { useAuth } from "../auth/AuthContext";

/** Account settings: display name, view-only email, and password change. */
export function SettingsPage() {
  const { user, setUser } = useAuth();

  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [profilePending, setProfilePending] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordPending, setPasswordPending] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setProfilePending(true);
    setProfileError("");
    setProfileSaved(false);
    try {
      const updated = await authApi.updateProfile({ display_name: displayName.trim() || null });
      setUser(updated);
      setDisplayName(updated.display_name ?? "");
      setProfileSaved(true);
    } catch (e) {
      setProfileError(e instanceof ApiError ? e.message : "Profile could not be saved.");
    } finally {
      setProfilePending(false);
    }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setPasswordPending(true);
    setPasswordError("");
    setPasswordMessage("");
    try {
      const result = await authApi.changePassword({ current_password: currentPassword, new_password: newPassword });
      setPasswordMessage(result.message);
      setCurrentPassword("");
      setNewPassword("");
    } catch (e) {
      setPasswordError(e instanceof ApiError ? e.message : "Password could not be changed.");
    } finally {
      setPasswordPending(false);
    }
  }

  return (
    <AppShell>
      <section className="content" aria-labelledby="settings-title">
        <div className="page-head">
          <div>
            <div className="eyebrow">Account</div>
            <h1 id="settings-title">Settings</h1>
            <p>Manage your ProjectOps account.</p>
          </div>
        </div>

        <form className="panel form" onSubmit={saveProfile} noValidate>
          <h2>Profile</h2>
          {profileError && (
            <p className="error-text" role="alert">
              {profileError}
            </p>
          )}
          {profileSaved && !profileError && <p className="success-text">Profile updated.</p>}
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="settings-email">Email</label>
              <input id="settings-email" value={user?.email ?? ""} disabled readOnly />
              <span className="hint">Contact support to change the email on your account.</span>
            </div>
            <div className="field full">
              <label htmlFor="settings-display-name">Display name</label>
              <input
                id="settings-display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={profilePending}
              />
            </div>
          </div>
          <div className="form-actions">
            <button className="button primary" disabled={profilePending}>
              {profilePending ? "Saving" : "Save profile"}
            </button>
          </div>
        </form>

        <form className="panel form" onSubmit={changePassword} noValidate>
          <h2>Change password</h2>
          {passwordError && (
            <p className="error-text" role="alert">
              {passwordError}
            </p>
          )}
          {passwordMessage && !passwordError && <p className="success-text">{passwordMessage}</p>}
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="settings-current-password">Current password</label>
              <input
                id="settings-current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={passwordPending}
              />
            </div>
            <div className="field full">
              <label htmlFor="settings-new-password">New password</label>
              <input
                id="settings-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={passwordPending}
              />
              <span className="hint">At least 8 characters.</span>
            </div>
          </div>
          <div className="form-actions">
            <button className="button primary" disabled={passwordPending || !currentPassword || !newPassword}>
              {passwordPending ? "Changing" : "Change password"}
            </button>
          </div>
        </form>
      </section>
    </AppShell>
  );
}
