import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// This page handles the redirect from Google OAuth via the backend
// The backend redirects to /auth/callback?token=<jwt>
export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const { setTokenAndFetchUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (token) {
      setTokenAndFetchUser(token).then(() => navigate('/', { replace: true }));
    } else {
      navigate(`/login?error=${error || 'oauth_failed'}`, { replace: true });
    }
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  );
}
