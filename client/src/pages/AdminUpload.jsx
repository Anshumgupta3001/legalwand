import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';
import { useToast } from '../components/Toast';

const ACC = '#BC6C5F';
const ADMIN_KEY = '0000';

/* ── Admin key gate (same pattern as /overview) ── */
const KeyGate = ({ onUnlock }) => {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input === ADMIN_KEY) {
      onUnlock();
    } else {
      setError('Incorrect key. Access denied.');
      setShake(true);
      setTimeout(() => setShake(false), 600);
      setInput('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f7f4ef' }}>
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{ backgroundColor: '#fff', border: '1px solid #e8e0d4', boxShadow: '0 8px 32px rgba(26,18,8,0.10)' }}
      >
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl mx-auto mb-3"
            style={{ backgroundColor: ACC }}>🔐</div>
          <h1 className="font-serif text-xl font-semibold" style={{ color: '#1f1510' }}>Admin Access</h1>
          <p className="text-xs mt-1" style={{ color: '#9a8c7c' }}>Enter your admin key to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(''); }}
            placeholder="Enter admin key"
            autoFocus
            className={`w-full border rounded-xl px-4 py-3 text-sm outline-none transition-all ${shake ? 'animate-bounce' : ''}`}
            style={{
              borderColor: error ? '#c0392b' : '#e8e0d4',
              backgroundColor: '#faf8f5',
              color: '#1f1510',
            }}
            onFocus={(e) => { if (!error) e.target.style.borderColor = ACC; }}
            onBlur={(e) => { if (!error) e.target.style.borderColor = '#e8e0d4'; }}
          />
          {error && <p className="text-xs" style={{ color: '#c0392b' }}>⚠ {error}</p>}
          <button
            type="submit"
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ backgroundColor: ACC }}
          >
            Unlock →
          </button>
        </form>
      </div>
    </div>
  );
};

/* ── Upload status badge ── */
const StatusBadge = ({ status }) => {
  const config = {
    idle: null,
    uploading: { color: '#b8860b', bg: 'rgba(184,134,11,0.08)', border: 'rgba(184,134,11,0.25)', text: '⏳ Uploading and processing file…' },
    success: { color: '#2d6a4f', bg: '#f0faf5', border: '#5a9a7a', text: '✅ Uploaded and stored in Pinecone successfully.' },
    error: null,
  };
  const c = config[status];
  if (!c) return null;
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium"
      style={{ backgroundColor: c.bg, border: `1px solid ${c.border}`, color: c.color }}>
      {c.text}
    </div>
  );
};

/* ── Main upload panel ── */
const UploadPanel = ({ onLock }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | uploading | success | error
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.docx'];
  const isValidFile = (f) => ALLOWED_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext));

  const selectFile = (f) => {
    if (!f) return;
    if (!isValidFile(f)) {
      toast.error('Unsupported file. Please upload a PDF, TXT, or DOCX.');
      return;
    }
    setFile(f);
    setStatus('idle');
    setResult(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    selectFile(e.dataTransfer.files[0]);
  };

  const handleUpload = async () => {
    if (!file || status === 'uploading') return;
    setStatus('uploading');
    setResult(null);
    try {
      const res = await adminAPI.uploadFile(file, ADMIN_KEY);
      setResult(res.data.data);
      setStatus('success');
      toast.success(`Stored ${res.data.data.chunks} vectors for "${res.data.data.filename}"`);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Upload failed.';
      setStatus('error');
      toast.error(msg);
    }
  };

  const reset = () => {
    setFile(null);
    setStatus('idle');
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f7f4ef' }}>

      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between"
        style={{ backgroundColor: '#fff', borderBottom: '1px solid #e8e0d4' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
            style={{ backgroundColor: ACC }}>⚖️</div>
          <span className="font-serif text-[16px] font-semibold" style={{ color: '#1f1510' }}>
            GST<span style={{ color: ACC }}>Wand</span>
            <span className="text-xs font-sans font-normal ml-2" style={{ color: '#9a8c7c' }}>Admin Upload</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-xs px-3 py-1.5 rounded-lg border transition-all hover:opacity-80"
            style={{ borderColor: '#e8e0d4', color: '#5a4c3c', backgroundColor: '#fff' }}
          >
            ← Dashboard
          </button>
          <button
            onClick={onLock}
            className="text-xs px-3 py-1.5 rounded-lg border transition-all hover:opacity-80"
            style={{ borderColor: '#e8e0d4', color: '#9a8c7c', backgroundColor: '#fff' }}
          >
            🔒 Lock
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-xl mx-auto px-6 py-10 space-y-6">

        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: ACC }}>
            Pinecone Knowledge Base
          </div>
          <h1 className="font-serif text-2xl font-semibold" style={{ color: '#1f1510' }}>
            Upload Admin Document
          </h1>
          <p className="text-sm mt-1" style={{ color: '#9a8c7c' }}>
            Files are extracted, chunked, embedded with <strong>llama-text-embed-v2</strong>, and stored in Pinecone with tag <code className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: '#f2ede6' }}>admin</code>.
          </p>
        </div>

        {/* Drop zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 py-12 cursor-pointer transition-all"
          style={{
            borderColor: dragOver ? ACC : '#d4c8b8',
            backgroundColor: dragOver ? 'rgba(188,108,95,0.04)' : '#fff',
          }}
        >
          <div className="text-3xl">📁</div>
          {file ? (
            <div className="text-center">
              <div className="text-sm font-semibold" style={{ color: '#1f1510' }}>{file.name}</div>
              <div className="text-xs mt-0.5" style={{ color: '#9a8c7c' }}>
                {(file.size / 1024).toFixed(1)} KB · Click to change
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="text-sm font-medium" style={{ color: '#5a4c3c' }}>
                Drop a file here or <span style={{ color: ACC }}>browse</span>
              </div>
              <div className="text-xs mt-0.5" style={{ color: '#9a8c7c' }}>PDF, TXT, DOCX · Max 10 MB</div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.docx"
            className="hidden"
            onChange={(e) => selectFile(e.target.files[0])}
          />
        </div>

        {/* Status */}
        <StatusBadge status={status} />

        {/* Result card */}
        {status === 'success' && result && (
          <div className="rounded-xl px-5 py-4 space-y-2"
            style={{ backgroundColor: '#fff', border: '1px solid #e8e0d4' }}>
            <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#9a8c7c' }}>
              Upload Summary
            </div>
            {[
              { label: 'File', value: result.filename },
              { label: 'Characters extracted', value: result.charCount?.toLocaleString() },
              { label: 'Vectors stored', value: result.chunks },
              { label: 'Tag', value: 'admin' },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm">
                <span style={{ color: '#9a8c7c' }}>{label}</span>
                <span className="font-medium" style={{ color: '#1f1510' }}>{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleUpload}
            disabled={!file || status === 'uploading'}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: ACC }}
          >
            {status === 'uploading' ? '⏳ Processing…' : '🚀 Upload to Pinecone'}
          </button>
          {file && status !== 'uploading' && (
            <button
              onClick={reset}
              className="px-4 py-3 rounded-xl text-sm border transition-all hover:opacity-80"
              style={{ borderColor: '#e8e0d4', color: '#9a8c7c', backgroundColor: '#fff' }}
            >
              Clear
            </button>
          )}
        </div>

        <p className="text-xs text-center" style={{ color: '#c4b49a' }}>
          Each chunk (~800 chars) is embedded separately. Large files may take a moment.
        </p>
      </div>
    </div>
  );
};

/* ── Page ── */
const AdminUpload = () => {
  const [unlocked, setUnlocked] = useState(false);

  if (!unlocked) return <KeyGate onUnlock={() => setUnlocked(true)} />;
  return <UploadPanel onLock={() => setUnlocked(false)} />;
};

export default AdminUpload;
