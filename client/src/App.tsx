import { useState } from 'react';
import { marked } from 'marked';
import { useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import { GitPullRequest, Search, AlertTriangle, Lightbulb, Info, Send, Bot } from 'lucide-react';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:3001';

export default function App() {
  const { token, user } = useAuth();

  const [prUrl, setPrUrl]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([]);
  const [asking, setAsking]     = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);
    setChatHistory([]);
    setSessionId(null);

    try {
      const response = await fetch(`${API_BASE}/api/review`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ prUrl }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to review PR');
      setResults(data);
      setSessionId(data.sessionId ?? null);
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    const userMsg = question.trim();
    setQuestion('');
    setAsking(true);
    setAskError(null);
    setChatHistory((prev) => [...prev, { role: 'user', content: userMsg }]);

    try {
      const response = await fetch(`${API_BASE}/api/ask`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ prUrl, question: userMsg, sessionId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to get answer');
      setChatHistory((prev) => [...prev, { role: 'assistant', content: data.answer }]);
    } catch (err: any) {
      setAskError(err.message || 'Something went wrong.');
      setChatHistory((prev) => prev.slice(0, -1)); // remove pending user msg
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="page-wrapper">
      <Navbar />

        <main className="container main-content">
          {/* Header */}
          <div className="page-header">
            <h1 className="page-title">
              AI <span className="gradient-text">Code Reviewer</span>
            </h1>
            <p className="page-subtitle">
              Paste a GitHub PR URL and our multi-agent AI will analyse security, bugs, and code quality in seconds.
            </p>
          </div>

          {/* PR Input */}
          <div className="card pr-input-card">
            <form id="review-form" onSubmit={handleSubmit}>
              <div className="pr-input-row">
                <div style={{ position: 'relative', flex: 1 }}>
                  <GitPullRequest
                    size={18}
                    style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}
                  />
                  <input
                    id="pr-url-input"
                    type="url"
                    required
                    className="form-input"
                    style={{ paddingLeft: 44, height: 50 }}
                    placeholder="https://github.com/owner/repo/pull/123"
                    value={prUrl}
                    onChange={(e) => setPrUrl(e.target.value)}
                  />
                </div>
                <button
                  id="review-submit-btn"
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ height: 50, minWidth: 140 }}
                >
                  {loading ? (
                    <>
                      <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, margin: 0 }} />
                      Reviewing...
                    </>
                  ) : (
                    <>
                      <Search size={16} /> Review PR
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Loading */}
          {loading && (
            <div className="loading-state card" style={{ padding: 48, marginBottom: 24 }}>
              <div className="spinner" />
              <p style={{ marginTop: 16, fontWeight: 600 }}>Agents are reviewing the code…</p>
              <p className="text-sm text-muted" style={{ marginTop: 4 }}>This may take 30–60 seconds</p>
            </div>
          )}

          {/* Error */}
          {error && <div className="alert alert-error mb-4">{error}</div>}

          {/* Results */}
          {results && (
            <div className="card" style={{ padding: 32, animation: 'slideUp 0.4s ease-out' }}>
              {/* Stats */}
              <div className="stats-row">
                <div className="stat-badge stat-critical">
                  <span className="stat-number">{results.critical}</span>
                  <span className="stat-label">
                    <AlertTriangle size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                    Critical
                  </span>
                </div>
                <div className="stat-badge stat-suggestions">
                  <span className="stat-number">{results.suggestions}</span>
                  <span className="stat-label">
                    <Lightbulb size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                    Suggestions
                  </span>
                </div>
                <div className="stat-badge stat-nitpicks">
                  <span className="stat-number">{results.nitpicks}</span>
                  <span className="stat-label">
                    <Info size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                    Nitpicks
                  </span>
                </div>
              </div>

              <div className="divider" />

              {/* Summary */}
              <div
                className="prose-dark"
                dangerouslySetInnerHTML={{ __html: marked.parse(results.summary) as string }}
              />

              {/* Chat section */}
              <div className="divider" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <Bot size={20} style={{ color: 'var(--accent-indigo)' }} />
                <h3 style={{ fontWeight: 700, fontSize: 17 }}>Ask a Follow-up Question</h3>
              </div>

              {/* Chat history */}
              {chatHistory.length > 0 && (
                <div className="chat-container" style={{ marginBottom: 20 }}>
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`chat-message ${msg.role === 'user' ? 'chat-message-user' : ''}`}>
                      <div className={`chat-avatar ${msg.role === 'user' ? 'chat-avatar-user' : 'chat-avatar-ai'}`}>
                        {msg.role === 'user'
                          ? (user?.name?.charAt(0).toUpperCase() ?? 'U')
                          : 'AI'}
                      </div>
                      <div className={`chat-bubble ${msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}`}>
                        {msg.role === 'assistant' ? (
                          <div className="prose-dark" dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) as string }} />
                        ) : msg.content}
                      </div>
                    </div>
                  ))}

                  {asking && (
                    <div className="chat-message">
                      <div className="chat-avatar chat-avatar-ai">AI</div>
                      <div className="chat-bubble chat-bubble-ai">
                        <div className="typing-indicator">
                          <div className="typing-dot" />
                          <div className="typing-dot" />
                          <div className="typing-dot" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {askError && <div className="alert alert-error mb-4">{askError}</div>}

              {/* Question input */}
              <form id="ask-form" onSubmit={handleAsk}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    id="question-input"
                    type="text"
                    className="form-input"
                    style={{ flex: 1, height: 46 }}
                    placeholder="e.g. Why is this code risky?"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    disabled={asking}
                  />
                  <button
                    id="ask-submit-btn"
                    type="submit"
                    className="btn btn-secondary"
                    style={{ height: 46 }}
                    disabled={asking || !question.trim()}
                  >
                    <Send size={16} />
                    {asking ? 'Thinking...' : 'Ask'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
    </div>
  );
}