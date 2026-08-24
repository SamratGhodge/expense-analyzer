import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { validatePasswordStrength, sanitizeText } from '../utils/security';

function Login() {
  const navigate = useNavigate();

  // Auth Modes: 'login' | 'signup' | 'otp_login'
  const [authMode, setAuthMode] = useState('login');

  // Step: 'credentials' | 'otp_verify'
  const [step, setStep] = useState('credentials');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [otpType, setOtpType] = useState('signup'); // 'signup' | 'email'

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Resend cooldown timer
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  // Sync profile helper
  const syncProfile = async (userObj) => {
    if (!userObj) return;
    try {
      await supabase.from('profiles').upsert({
        id: userObj.id,
        email: userObj.email,
        created_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Profile sync notice:', e);
    }
  };

  // 1. Handle Submit for Credentials Step (Password Login, Sign Up, or Request OTP)
  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const cleanEmail = sanitizeText(email);
    if (!cleanEmail) {
      setError('Please enter a valid email address.');
      return;
    }

    // A. Passwordless OTP Login
    if (authMode === 'otp_login') {
      setLoading(true);
      try {
        const { error: otpSendError } = await supabase.auth.signInWithOtp({
          email: cleanEmail,
          options: { shouldCreateUser: true },
        });

        if (otpSendError) {
          setError(otpSendError.message);
        } else {
          setOtpType('email');
          setStep('otp_verify');
          setCooldown(60);
          setMessage(`A 6-digit OTP verification code has been sent to ${cleanEmail}.`);
        }
      } catch (err) {
        setError(err.message || 'Failed to send OTP code.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // B. Password Sign Up / Login
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    if (authMode === 'signup') {
      const pwCheck = validatePasswordStrength(password);
      if (!pwCheck.valid) {
        setError(pwCheck.message);
        return;
      }
    } else if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      if (authMode === 'signup') {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });

        if (signUpError) {
          setError(signUpError.message);
        } else {
          // Check if email confirmation OTP is required
          if (signUpData?.user && !signUpData.session) {
            setOtpType('signup');
            setStep('otp_verify');
            setCooldown(60);
            setMessage(`Account registered! Enter the 6-digit OTP code sent to ${cleanEmail}.`);
          } else if (signUpData?.session) {
            // Logged in directly if confirmation disabled
            await syncProfile(signUpData.user);
            navigate('/dashboard');
          } else {
            setOtpType('signup');
            setStep('otp_verify');
            setCooldown(60);
            setMessage(`Verification code sent to ${cleanEmail}.`);
          }
        }
      } else {
        // Standard Password Login
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (signInError) {
          setError(signInError.message);
        } else {
          await syncProfile(signInData.user);
          navigate('/dashboard');
        }
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const cleanToken = otpToken.trim();
    if (!cleanToken || cleanToken.length < 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setLoading(true);

    try {
      // Try primary OTP type first ('signup' or 'email')
      let { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: cleanToken,
        type: otpType,
      });

      // If signup type returned an error, try fallback to 'email' / 'magiclink'
      if (verifyError && otpType === 'signup') {
        const fallbackRes = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: cleanToken,
          type: 'email',
        });
        verifyData = fallbackRes.data;
        verifyError = fallbackRes.error;
      }

      if (verifyError) {
        setError(`Verification failed: ${verifyError.message}`);
      } else if (verifyData?.user || verifyData?.session) {
        await syncProfile(verifyData.user || verifyData.session?.user);
        navigate('/dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Invalid or expired OTP code.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle Resend OTP
  const handleResendOtp = async () => {
    if (cooldown > 0) return;

    setError('');
    setMessage('');
    setLoading(true);

    try {
      let resendError = null;
      if (otpType === 'signup' && password) {
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email: email.trim(),
        });
        resendError = error;
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { shouldCreateUser: true },
        });
        resendError = error;
      }

      if (resendError) {
        setError(`Resend failed: ${resendError.message}`);
      } else {
        setCooldown(60);
        setMessage(`A fresh 6-digit OTP has been sent to ${email}.`);
      }
    } catch (err) {
      setError(err.message || 'Failed to resend code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <h2>Expense Analyzer</h2>
        <p className="subtitle">Smart Personal Expense &amp; Budget Management</p>

        {error && <div className="alert-error">{error}</div>}
        {message && <div className="alert-success">{message}</div>}

        {/* Step 1: Credentials Form */}
        {step === 'credentials' && (
          <>
            {/* Mode navigation tabs */}
            <div className="auth-nav-tabs">
              <button
                type="button"
                className={`auth-nav-tab ${authMode === 'login' ? 'active' : ''}`}
                onClick={() => { setAuthMode('login'); setError(''); setMessage(''); }}
              >
                Password Login
              </button>
              <button
                type="button"
                className={`auth-nav-tab ${authMode === 'otp_login' ? 'active' : ''}`}
                onClick={() => { setAuthMode('otp_login'); setError(''); setMessage(''); }}
              >
                Email OTP
              </button>
              <button
                type="button"
                className={`auth-nav-tab ${authMode === 'signup' ? 'active' : ''}`}
                onClick={() => { setAuthMode('signup'); setError(''); setMessage(''); }}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleCredentialsSubmit}>
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
                  required
                />
              </div>

              {authMode !== 'otp_login' && (
                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    placeholder={authMode === 'signup' ? 'Min 8 chars (letters & numbers)' : 'Enter your password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                    required
                  />
                </div>
              )}

              <button
                type="submit"
                className="btn-primary"
                style={{ width: '100%', marginTop: '6px', padding: '9px 18px', fontSize: '14px' }}
                disabled={loading}
              >
                {loading
                  ? 'Please wait...'
                  : authMode === 'otp_login'
                  ? 'Send 6-Digit OTP Code'
                  : authMode === 'signup'
                  ? 'Sign Up & Verify OTP'
                  : 'Login with Password'}
              </button>
            </form>

            <div style={{ marginTop: '16px', fontSize: '12px', color: '#666', textAlign: 'center', lineHeight: '1.5' }}>
              {authMode === 'otp_login' && (
                <span>We will send a one-time verification code to your email. No password required.</span>
              )}
              {authMode === 'signup' && (
                <span>A verification code will be sent to confirm your email address.</span>
              )}
            </div>
          </>
        )}

        {/* Step 2: OTP Verification Screen */}
        {step === 'otp_verify' && (
          <form onSubmit={handleVerifyOtp}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '28px', marginBottom: '6px' }}>📩</div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#333', marginBottom: '4px' }}>
                Verify Your Email
              </h3>
              <p style={{ fontSize: '12px', color: '#666' }}>
                Enter the 6-digit verification code sent to:
                <br />
                <strong style={{ color: '#2e6db4' }}>{email}</strong>
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="otp-input" style={{ textAlign: 'center', display: 'block' }}>
                6-Digit OTP Code
              </label>
              <input
                id="otp-input"
                type="text"
                maxLength={6}
                placeholder="123456"
                value={otpToken}
                onChange={(e) => setOtpToken(e.target.value.replace(/\D/g, ''))}
                className="otp-code-input"
                disabled={loading}
                autoFocus
                required
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', padding: '9px 18px', fontSize: '14px' }}
              disabled={loading || otpToken.length < 6}
            >
              {loading ? 'Verifying Code...' : 'Verify Code & Log In'}
            </button>

            {/* Resend code & Back options */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', fontSize: '12px' }}>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                onClick={() => { setStep('credentials'); setOtpToken(''); setError(''); setMessage(''); }}
                disabled={loading}
              >
                &larr; Change Email
              </button>

              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  color: cooldown > 0 ? '#999' : '#2e6db4',
                  cursor: cooldown > 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  padding: 0,
                }}
                onClick={handleResendOtp}
                disabled={cooldown > 0 || loading}
              >
                {cooldown > 0 ? `Resend Code (${cooldown}s)` : 'Resend OTP Code'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default Login;
