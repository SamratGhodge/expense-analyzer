import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

function Layout() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <>
      {/* Navbar */}
      <nav className="navbar">
        <div className="brand">Expense Analyzer</div>
        <div className="nav-right">
          <span>{user?.email || 'user'}</span>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      <div className="app-body">
        {/* Sidebar */}
        <aside className="sidebar">
          <ul>
            <li>
              <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>
                Dashboard
              </NavLink>
            </li>
            <li>
              <NavLink to="/transactions" className={({ isActive }) => isActive ? 'active' : ''}>
                Transactions
              </NavLink>
            </li>
            <li>
              <NavLink to="/budgets" className={({ isActive }) => isActive ? 'active' : ''}>
                Budgets
              </NavLink>
            </li>
            <li>
              <NavLink to="/insights" className={({ isActive }) => isActive ? 'active' : ''}>
                Insights
              </NavLink>
            </li>
            <li>
              <NavLink to="/subscriptions" className={({ isActive }) => isActive ? 'active' : ''}>
                Subscriptions
              </NavLink>
            </li>
            <li>
              <NavLink to="/import-statement" className={({ isActive }) => isActive ? 'active' : ''}>
                Import Statement
              </NavLink>
            </li>
            <li>
              <NavLink to="/profile" className={({ isActive }) => isActive ? 'active' : ''}>
                Profile
              </NavLink>
            </li>
          </ul>
        </aside>

        {/* Page content */}
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </>
  );
}

export default Layout;
