import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { validatePasswordStrength, sanitizeText } from '../utils/security';

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const cleanEmail = sanitizeText(email);
    if (!cleanEmail || !password) {
      setError('Please fill in all fields.');
      return;
    }

    if (isSignup) {
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
      if (isSignup) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });

        if (signUpError) {
          setError(signUpError.message);
        } else {
          // Sync profile to database if user was returned
          if (signUpData?.user) {
            try {
              await supabase.from('profiles').upsert({
                id: signUpData.user.id,
                email: cleanEmail,
                created_at: new Date().toISOString(),
                last_sign_in_at: new Date().toISOString(),
              });
            } catch (e) {
              console.warn('Profiles upsert warning:', e);
            }
          }
          setMessage('Account created! You can now log in.');
          setIsSignup(false);
        }
      } else {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (signInError) {
          setError(signInError.message);
        } else {
          // Sync profile to database upon sign in
          if (signInData?.user) {
            try {
              await supabase.from('profiles').upsert({
                id: signInData.user.id,
                email: cleanEmail,
                last_sign_in_at: new Date().toISOString(),
              });
            } catch (e) {
              console.warn('Profiles upsert warning:', e);
            }
          }
          navigate('/dashboard');
        }
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
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

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              placeholder="student@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Min 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', marginTop: '6px' }}
            disabled={loading}
          >
            {loading ? 'Please wait...' : isSignup ? 'Sign Up' : 'Login'}
          </button>
        </form>

        <p style={{ fontSize: '13px', color: '#666', marginTop: '16px', textAlign: 'center' }}>
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            style={{ background: 'none', border: 'none', color: '#2e6db4', fontWeight: 600, padding: 0, fontSize: '13px' }}
            onClick={() => { setIsSignup(!isSignup); setError(''); setMessage(''); }}
            disabled={loading}
          >
            {isSignup ? 'Login' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  );
}

export default Login;
