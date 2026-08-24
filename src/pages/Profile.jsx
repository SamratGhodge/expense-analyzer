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

  // Email OTP Verification State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const email = user?.email || 'user@example.com';
  const initial = email.charAt(0).toUpperCase();

  // Cooldown timer
  useEffect(() => {
    let timer;
    if (otpCooldown > 0) {
      timer = setInterval(() => setOtpCooldown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [otpCooldown]);

  // Check email verification status from Supabase auth / database
  useEffect(() => {
    async function checkVerificationStatus() {
      if (!user?.id) return;

      // Check if Supabase user object has email_confirmed_at
      if (user?.email_confirmed_at) {
        setIsEmailVerified(true);
      }

      // Check public.profiles record
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('email_verified')
          .eq('id', user.id)
          .single();

        if (data?.email_verified) {
          setIsEmailVerified(true);
        }
      } catch (e) {
        console.warn('Profile read notice:', e);
      }
    }

    checkVerificationStatus();
  }, [user]);

  // Send Email OTP
  const handleSendEmailOtp = async () => {
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: user.email,
        options: { shouldCreateUser: false },
      });

      if (otpError) {
        setError(`Failed to send OTP: ${otpError.message}`);
      } else {
        setShowOtpModal(true);
        setOtpCooldown(60);
        setSuccessMsg(`A 6-digit verification OTP code has been sent to ${user.email}.`);
      }
    } catch (err) {
      setError(err.message || 'Failed to dispatch verification OTP.');
    } finally {
      setLoading(false);
    }
  };

  // Verify Email OTP
  const handleVerifyEmailOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const token = otpToken.trim();
    if (!token || token.length < 6) {
      setError('Please enter the complete 6-digit OTP.');
      return;
    }

    setLoading(true);

    try {
      // Verify OTP code with Supabase
      let { error: verifyError } = await supabase.auth.verifyOtp({
        email: user.email,
        token,
        type: 'email',
      });

      if (verifyError) {
        // Fallback check with 'signup' type
        const res = await supabase.auth.verifyOtp({
          email: user.email,
          token,
          type: 'signup',
        });
        verifyError = res.error;
      }

      if (verifyError) {
        setError(`OTP Verification failed: ${verifyError.message}`);
      } else {
        setIsEmailVerified(true);
        setShowOtpModal(false);
        setOtpToken('');
        setSuccessMsg('Email verified successfully! Your account is now confirmed.');

        // Update verified status in public.profiles
        try {
          await supabase.from('profiles').upsert({
            id: user.id,
            email: user.email,
            email_verified: true,
            verified_at: new Date().toISOString(),
          });
        } catch (e) {
          console.warn('Profile update notice:', e);
        }
      }
    } catch (err) {
      setError(err.message || 'Invalid or expired OTP code.');
    } finally {
      setLoading(false);
    }
  };

  // Password update with current password verification
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
      // Step 1: Verify current password
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (verifyError) {
        setError('Incorrect current password. Identity verification failed.');
        setLoading(false);
        return;
      }

      // Step 2: Update password
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

  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'August 2026';

  return (
    <div>
      <h1 className="page-title">My Profile &amp; Security</h1>

      {error && <div className="alert-error">{error}</div>}
      {successMsg && <div className="alert-success">{successMsg}</div>}

      {/* Profile & Security Card */}
      <div className="profile-card" style={{ maxWidth: '520px', marginBottom: '24px' }}>
        <div className="avatar-placeholder">
          {initial}
        </div>

        <div className="info-row">
          <div className="info-label">Account Email</div>
          <div className="info-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{email}</span>
            {isEmailVerified ? (
              <span style={{ fontSize: '11px', color: '#27ae60', backgroundColor: '#eef9f2', padding: '2px 8px', borderRadius: '3px', fontWeight: 600 }}>
                Verified ✓
              </span>
            ) : (
              <span style={{ fontSize: '11px', color: '#e67e22', backgroundColor: '#fff7ed', padding: '2px 8px', borderRadius: '3px', fontWeight: 600 }}>
                Unverified ⚠️
              </span>
            )}
          </div>
        </div>

        {/* Email Verification Box */}
        {!isEmailVerified && (
          <div style={{ background: '#f8f9fa', border: '1px solid #e0e0e0', padding: '12px 14px', borderRadius: '3px', margin: '14px 0' }}>
            <div style={{ fontSize: '13px', color: '#444', marginBottom: '8px' }}>
              Your email is currently unverified. Verify with an OTP code for enhanced account security.
            </div>

            {!showOtpModal ? (
              <button
                className="btn-primary"
                style={{ fontSize: '12px', padding: '6px 14px' }}
                onClick={handleSendEmailOtp}
                disabled={loading}
              >
                {loading ? 'Sending OTP...' : '📩 Send Verification OTP'}
              </button>
            ) : (
              <form onSubmit={handleVerifyEmailOtp} style={{ marginTop: '8px' }}>
                <label htmlFor="email-otp" style={{ fontSize: '12px', fontWeight: 600, color: '#444', display: 'block', marginBottom: '4px' }}>
                  Enter 6-Digit OTP sent to {email}
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    id="email-otp"
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={otpToken}
                    onChange={(e) => setOtpToken(e.target.value.replace(/\D/g, ''))}
                    style={{ width: '130px', padding: '6px 10px', fontSize: '15px', fontFamily: 'monospace', letterSpacing: '4px' }}
                    disabled={loading}
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                    disabled={loading || otpToken.length < 6}
                  >
                    {loading ? 'Verifying...' : 'Verify OTP'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                    onClick={handleSendEmailOtp}
                    disabled={otpCooldown > 0 || loading}
                  >
                    {otpCooldown > 0 ? `Resend (${otpCooldown}s)` : 'Resend'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

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
