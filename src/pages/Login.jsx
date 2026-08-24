import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    // Simulate login — just store a flag and redirect
    localStorage.setItem('ea_logged_in', 'true');
    localStorage.setItem('ea_user', email);
    navigate('/dashboard');
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <h2>Expense Analyzer</h2>
        <p className="subtitle">Final Year Project — B.Tech CSE</p>

        {error && <p style={{ color: '#c0392b', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="student@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '4px' }}>
            Login
          </button>
        </form>

        <p style={{ fontSize: '12px', color: '#999', marginTop: '18px', textAlign: 'center' }}>
          Demo: use any email &amp; password
        </p>
      </div>
    </div>
  );
}

export default Login;
