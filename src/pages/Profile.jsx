import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { validatePasswordStrength } from '../utils/security';

function Profile() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const email = user?.email || 'user@example.com';
  const initial = email.charAt(0).toUpperCase();

  // Format joined date from Supabase auth timestamp
  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'August 2026';

  // Ensure account is recorded in database `public.profiles` in background
  useEffect(() => {
    async function syncDatabaseProfile() {
      if (user?.id && user?.email) {
        try {
          await supabase.from('profiles').upsert({
            id: user.id,
            email: user.email,
            last_sign_in_at: new Date().toISOString(),
          });
        } catch (err) {
          console.warn('Profile sync warning:', err);
        }
      }
    }
    syncDatabaseProfile();
  }, [user?.id, user?.email]);

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!currentPassword) {
      setError('Please enter your current password to verify identity.');
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError('Please fill in both new password fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match. Please re-enter.');
      return;
    }

    if (newPassword === currentPassword) {
      setError('New password must be different from your current password.');
      return;
    }

    const pwCheck = validatePasswordStrength(newPassword);
    if (!pwCheck.valid) {
      setError(pwCheck.message);
      return;
    }

    setLoading(true);

    try {
      // Step 1: Verify current password by attempting re-authentication
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (verifyError) {
        setError('Incorrect current password. Identity verification failed.');
        setLoading(false);
        return;
      }

      // Step 2: Current password is valid -> proceed to update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(`Failed to update password: ${updateError.message}`);
      } else {
        setSuccessMsg('Password updated successfully! You can now use your new password.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowPasswordForm(false);
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred during password update.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">My Profile</h1>

      {error && <div className="alert-error">{error}</div>}
      {successMsg && <div className="alert-success">{successMsg}</div>}

      {/* Profile & Security Card */}
      <div className="profile-card" style={{ maxWidth: '520px' }}>
        <div className="avatar-placeholder">
          {initial}
        </div>

        <div className="info-row">
          <div className="info-label">Account Email</div>
          <div className="info-value">{email}</div>
        </div>

        <div className="info-row">
          <div className="info-label">User ID (Auth UID)</div>
          <div className="info-value" style={{ fontSize: '12px', color: '#666666', fontFamily: 'monospace' }}>
            {user?.id || '—'}
          </div>
        </div>

        <div className="info-row">
          <div className="info-label">Account Created</div>
          <div className="info-value">{joinedDate}</div>
        </div>

        <hr className="section-divider" />

        {!showPasswordForm ? (
          <div>
            <button
              className="btn-secondary"
              onClick={() => {
                setShowPasswordForm(true);
                setError('');
                setSuccessMsg('');
              }}
            >
              🔒 Change Password
            </button>
          </div>
        ) : (
          <form onSubmit={handlePasswordUpdate} style={{ marginTop: '8px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#333', marginBottom: '12px' }}>
              Update Account Password
            </h3>

            <div className="form-group">
              <label htmlFor="current-password">Current Password *</label>
              <input
                id="current-password"
                type="password"
                placeholder="Enter current password to verify"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
              />
            </div>

            <div className="form-group">
              <label htmlFor="new-password">New Password (Min 8 chars, 1 letter, 1 number) *</label>
              <input
                id="new-password"
                type="password"
                placeholder="Enter new strong password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirm-password">Confirm New Password *</label>
              <input
                id="confirm-password"
                type="password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Verifying & Saving...' : 'Save New Password'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowPasswordForm(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setError('');
                }}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default Profile;
