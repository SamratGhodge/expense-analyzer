import { NavLink, Outlet, useNavigate } from 'react-router-dom';

function Layout() {
  const navigate = useNavigate();
  const userEmail = localStorage.getItem('ea_user') || 'user';

  const handleLogout = () => {
    localStorage.removeItem('ea_logged_in');
    localStorage.removeItem('ea_user');
    navigate('/login');
  };

  return (
    <>
      {/* Navbar */}
      <nav className="navbar">
        <div className="brand">Expense Analyzer</div>
        <div className="nav-right">
          <span>{userEmail}</span>
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
              <NavLink to="/insights" className={({ isActive }) => isActive ? 'active' : ''}>
                Insights
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
