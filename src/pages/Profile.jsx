import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { validatePasswordStrength } from '../utils/security';

function Profile() {
  const { user } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const email = user?.email || 'student@university.edu';
  const initial = email.charAt(0).toUpperCase();

  // Format joined date from Supabase auth timestamp
  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : 'August 2026';

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const pwCheck = validatePasswordStrength(newPassword);
    if (!pwCheck.valid) {
      setError(pwCheck.message);
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccessMsg('Password updated successfully.');
        setNewPassword('');
        setShowPasswordForm(false);
      }
    } catch (err) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">User Profile</h1>

      {error && <div className="alert-error">{error}</div>}
      {successMsg && <div className="alert-success">{successMsg}</div>}

      <div className="profile-card">
        <div className="avatar-placeholder">
          {initial}
        </div>

        <div className="info-row">
          <div className="info-label">Account Email</div>
          <div className="info-value">{email}</div>
        </div>

        <div className="info-row">
          <div className="info-label">Project Details</div>
          <div className="info-value">B.Tech CSE — Final Year Project</div>
        </div>

        <div className="info-row">
          <div className="info-label">User ID (Auth UID)</div>
          <div className="info-value" style={{ fontSize: '12px', color: '#666666', fontFamily: 'monospace' }}>
            {user?.id || '—'}
          </div>
        </div>

        <div className="info-row">
          <div className="info-label">Member Since</div>
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
              Change Password
            </button>
          </div>
        ) : (
          <form onSubmit={handlePasswordUpdate} style={{ marginTop: '8px' }}>
            <div className="form-group">
              <label htmlFor="new-password">New Password</label>
              <input
                id="new-password"
                type="password"
                placeholder="Enter at least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Updating...' : 'Save New Password'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowPasswordForm(false);
                  setNewPassword('');
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
