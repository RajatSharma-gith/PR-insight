import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { marked } from 'marked';
import { GitPullRequest, Trash2, MessageSquare, Clock, AlertTriangle, Lightbulb, Info } from 'lucide-react';
import Navbar from '../components/Navbar';

interface Session {
  _id: string;
  prUrl: string;
  summary: string;
  findingsCount: number;
  criticalCount: number;
  suggestionsCount: number;
  nitpicksCount: number;
  createdAt: string;
}

interface ChatMessage {
  _id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:3001';

export default function HistoryPage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [sessions, setSessions]         = useState<Session[]>([]);
  const [selected, setSelected]         = useState<Session | null>(null);
  const [messages, setMessages]         = useState<ChatMessage[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingDetail, setLoadingDetail]     = useState(false);
  const [deleting, setDeleting]         = useState<string | null>(null);

  const authHeaders = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchSessions();
  }, []);

  async function fetchSessions() {
    setLoadingSessions(true);
    try {
      const res = await fetch(`${API_BASE}/api/history`, { headers: authHeaders });
      const data = await res.json();
      setSessions(data.sessions || []);
    } finally {
      setLoadingSessions(false);
    }
  }

  async function loadDetail(session: Session) {
    setSelected(session);
    setLoadingDetail(true);
    setMessages([]);
    try {
      const res = await fetch(`${API_BASE}/api/history/${session._id}`, { headers: authHeaders });
      const data = await res.json();
      setMessages(data.messages || []);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function deleteSession(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setDeleting(id);
    await fetch(`${API_BASE}/api/history/${id}`, { method: 'DELETE', headers: authHeaders });
    setSessions((prev) => prev.filter((s) => s._id !== id));
    if (selected?._id === id) { setSelected(null); setMessages([]); }
    setDeleting(null);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  function getPRLabel(url: string) {
    try {
      const parts = new URL(url).pathname.split('/');
      return `${parts[1]}/${parts[2]} #${parts[4]}`;
    } catch { return url; }
  }

  return (
    <div className="page-wrapper">
      <Navbar />
        <div className="container-wide history-page">
          <div className="history-header">
            <h1 className="page-title" style={{ fontSize: 28, textAlign: 'left', marginBottom: 4 }}>
              Review <span className="gradient-text">History</span>
            </h1>
            <p className="text-secondary text-sm">Your past PR reviews and conversations</p>
          </div>

          {loadingSessions ? (
            <div className="loading-state"><div className="spinner" /><p>Loading history...</p></div>
          ) : sessions.length === 0 ? (
            <div className="history-empty">
              <div className="history-empty-icon">📋</div>
              <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>No reviews yet</p>
              <p className="text-muted text-sm">Reviews you run will appear here.</p>
              <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/')}>
                <GitPullRequest size={16} /> Review a PR
              </button>
            </div>
          ) : (
            <div className="history-grid">
              {/* Sidebar list */}
              <div className="history-sidebar">
                <div className="card" style={{ padding: '8px' }}>
                  <div className="history-list">
                    {sessions.map((s) => (
                      <div
                        key={s._id}
                        className={`history-item ${selected?._id === s._id ? 'active' : ''}`}
                        onClick={() => loadDetail(s)}
                      >
                        <div className="history-item-url">{getPRLabel(s.prUrl)}</div>
                        <div className="history-item-meta">
                          <Clock size={11} />
                          {formatDate(s.createdAt)}
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {s.criticalCount > 0 && <span className="chip chip-critical"><AlertTriangle size={9}/>{s.criticalCount}</span>}
                            {s.suggestionsCount > 0 && <span className="chip chip-suggestions"><Lightbulb size={9}/>{s.suggestionsCount}</span>}
                            {s.nitpicksCount > 0 && <span className="chip chip-nitpicks"><Info size={9}/>{s.nitpicksCount}</span>}
                          </div>
                          <button
                            className="btn btn-danger btn-sm"
                            style={{ padding: '4px 8px', fontSize: 11 }}
                            onClick={(e) => deleteSession(e, s._id)}
                            disabled={deleting === s._id}
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Detail panel */}
              <div>
                {!selected ? (
                  <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <GitPullRequest size={40} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                    <p>Select a review from the left to see its details</p>
                  </div>
                ) : loadingDetail ? (
                  <div className="card loading-state"><div className="spinner" /><p>Loading review...</p></div>
                ) : (
                  <div className="card history-detail">
                    <div style={{ marginBottom: 20 }}>
                      <a
                        href={selected.prUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--accent)', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}
                      >
                        🔗 {selected.prUrl}
                      </a>
                      <p className="text-muted text-sm" style={{ marginTop: 4 }}>
                        <Clock size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                        {formatDate(selected.createdAt)}
                      </p>
                    </div>

                    {/* Stats */}
                    <div className="history-detail-stats">
                      <div className="stat-badge stat-critical">
                        <span className="stat-number">{selected.criticalCount}</span>
                        <span className="stat-label">Critical</span>
                      </div>
                      <div className="stat-badge stat-suggestions">
                        <span className="stat-number">{selected.suggestionsCount}</span>
                        <span className="stat-label">Suggestions</span>
                      </div>
                      <div className="stat-badge stat-nitpicks">
                        <span className="stat-number">{selected.nitpicksCount}</span>
                        <span className="stat-label">Nitpicks</span>
                      </div>
                    </div>

                    <div className="divider" />

                    {/* Summary */}
                    <div
                      className="prose-dark"
                      dangerouslySetInnerHTML={{ __html: marked.parse(selected.summary) as string }}
                    />

                    {/* Chat messages */}
                    {messages.length > 0 && (
                      <>
                        <div className="divider" />
                        <h3 style={{ fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <MessageSquare size={18} style={{ color: 'var(--accent)' }} />
                          Follow-up Q&amp;A
                        </h3>
                        <div className="chat-container">
                          {messages.map((msg) => (
                            <div key={msg._id} className={`chat-message ${msg.role === 'user' ? 'chat-message-user' : ''}`}>
                              <div className={`chat-avatar ${msg.role === 'user' ? 'chat-avatar-user' : 'chat-avatar-ai'}`}>
                                {msg.role === 'user' ? 'U' : 'AI'}
                              </div>
                              <div className={`chat-bubble ${msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}`}>
                                {msg.role === 'assistant' ? (
                                  <div className="prose-dark" dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) as string }} />
                                ) : msg.content}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
    </div>
  );
}
