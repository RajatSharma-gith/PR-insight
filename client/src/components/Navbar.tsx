import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { GitPullRequest, History, LogOut } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Logo */}
        <Link to="/" className="navbar-logo">
          <div className="logo-icon">
            <GitPullRequest size={18} color="white" />
          </div>
          PR <span>Insight</span>
        </Link>

        {/* Actions */}
        <div className="navbar-actions">
          <Link
            to="/history"
            className="btn btn-ghost btn-sm"
            style={{ color: location.pathname === '/history' ? 'var(--accent-indigo)' : undefined }}
          >
            <History size={15} />
            History
          </Link>

          <button
            onClick={handleLogout}
            className="btn btn-ghost btn-sm"
            title="Logout"
          >
            <LogOut size={15} />
            Logout
          </button>

          <div className="user-avatar" title={user?.name ?? ''}>
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.name} />
            ) : (
              initials
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
