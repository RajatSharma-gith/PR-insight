import { useState } from 'react';
import { marked } from "marked"


export default function App() {
  const [prUrl, setPrUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch('http://localhost:3001/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prUrl }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to review PR');
      
      setResults(data);
    } catch (err: any) {
      console.log("error.message")
      setError("something went wrong ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans py-12 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl font-extrabold mb-2 text-slate-900">AI Code Reviewer</h1>
        <p className="text-slate-500 mb-10">Powered by LangGraph and Gemini</p>
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8 text-left">
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4">
            <input 
              type="url" 
              required 
              placeholder="https://github.com/owner/repo/pull/123" 
              value={prUrl}
              onChange={(e) => setPrUrl(e.target.value)}
              className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-700"
            />
            <button 
              type="submit" 
              disabled={loading}
              className="bg-indigo-600 text-white px-8 py-3 rounded-lg hover:bg-indigo-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
            >
              {loading ? 'Reviewing...' : 'Review PR'}
            </button>
          </form>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-slate-600 font-medium">Agents are reviewing the code... This might take a minute.</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl mb-8 text-left shadow-sm">
            {error}
          </div>
        )}

        {/* Results State */}
        {results && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-left overflow-hidden">
            <div className="flex flex-wrap gap-4 mb-8 pb-8 border-b border-slate-100 justify-center">
              <div className="bg-red-50 text-red-700 px-6 py-3 rounded-xl border border-red-100 min-w-[120px] text-center">
                <span className="block text-3xl font-black mb-1">{results.critical}</span>
                <span className="text-xs uppercase font-bold tracking-wider">Critical</span>
              </div>
              <div className="bg-amber-50 text-amber-700 px-6 py-3 rounded-xl border border-amber-100 min-w-[120px] text-center">
                <span className="block text-3xl font-black mb-1">{results.suggestions}</span>
                <span className="text-xs uppercase font-bold tracking-wider">Suggestions</span>
              </div>
              <div className="bg-blue-50 text-blue-700 px-6 py-3 rounded-xl border border-blue-100 min-w-[120px] text-center">
                <span className="block text-3xl font-black mb-1">{results.nitpicks}</span>
                <span className="text-xs uppercase font-bold tracking-wider">Nitpicks</span>
              </div>
            </div>
            <div 
              className="prose max-w-none" 
              dangerouslySetInnerHTML={{ __html: marked.parse(results.summary) as string }} 
            />
          </div>
        )}
      </div>
    </div>
  );
}