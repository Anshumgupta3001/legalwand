import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { chatHistoryAPI, fileAPI } from '../services/api';
import { exportChatToPdf } from '../utils/exportChatPdf';
import { useToast } from '../components/Toast';

const ACC = '#BC6C5F';
const MAX_CREDITS_FREE = 10;
const MAX_CREDITS_PRO  = 100;
const MAX_CHATS = 10;

const LOADING_STEPS = [
  { icon: '⏳', text: 'Understanding the context of your request...' },
  { icon: '🔍', text: 'Searching across the knowledge base...' },
  { icon: '📄', text: 'Synthesizing insights from multiple sources...' },
  { icon: '🧠', text: 'Formulating a clear and comprehensive answer...' },
];

const SUGGESTED_QUESTIONS = [
  { q: 'What is GST and how does it work?', icon: '📚' },
  { q: 'How do I file GSTR-1?', icon: '📄' },
  { q: 'What is ITC and how to claim it?', icon: '💰' },
  { q: 'What are the penalties for late GST filing?', icon: '⚠️' },
  { q: 'Explain GSTR-3B vs GSTR-1', icon: '🔄' },
  { q: 'How to handle GST notices?', icon: '📬' },
];

/* ── Text renderer ── */
const renderText = (text) => {
  return text.split('\n').map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-2" />;
    const formatted = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <div key={i} className="flex items-start gap-2 text-[14px] leading-relaxed" style={{ color: '#5a4c3c' }}>
          <span className="mt-[7px] w-[5px] h-[5px] rounded-full flex-shrink-0" style={{ backgroundColor: ACC }} />
          <span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
        </div>
      );
    }
    if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\./)[1];
      return (
        <div key={i} className="flex items-start gap-2 text-[14px] leading-relaxed" style={{ color: '#5a4c3c' }}>
          <span className="font-semibold flex-shrink-0 w-4" style={{ color: ACC }}>{num}.</span>
          <span dangerouslySetInnerHTML={{ __html: line.replace(/^\d+\.\s/, '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
        </div>
      );
    }
    return (
      <p key={i} className="text-[14px] leading-relaxed" style={{ color: '#5a4c3c' }}
        dangerouslySetInnerHTML={{ __html: formatted }} />
    );
  });
};

/* ── Typing indicator ── */
const TypingDots = () => (
  <div className="flex items-center gap-1.5 py-1">
    {[0, 1, 2].map((i) => (
      <div key={i} className="w-2 h-2 rounded-full animate-bounce"
        style={{ backgroundColor: ACC, opacity: 0.7, animationDelay: `${i * 0.18}s` }} />
    ))}
  </div>
);

/* ── Credits bar (dark sidebar theme) ── */
const CreditsBar = ({ credits, maxCredits, isPro, onUpgrade }) => {
  const pct = Math.max(0, (credits / maxCredits) * 100);
  const isEmpty = credits <= 0;
  const planLabel = isPro ? 'Pro' : 'Free';
  return (
    <div className="px-3 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="px-3 py-2.5 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.55)' }}>{planLabel} Credits</span>
          <span className="text-[11px] font-bold" style={{ color: isEmpty ? '#f87171' : ACC }}>
            {credits} / {maxCredits}
          </span>
        </div>
        <div className="h-1.5 rounded-full mb-2" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
          <div className="h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: isEmpty ? '#f87171' : ACC }} />
        </div>
        {isEmpty ? (
          <button onClick={onUpgrade}
            className="w-full text-[12px] font-semibold py-1.5 rounded-lg transition-all hover:-translate-y-px"
            style={{ backgroundColor: ACC, color: '#fff' }}>
            Upgrade Plan ✨
          </button>
        ) : (
          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {credits === 1 ? '1 message left' : `${credits} messages left`} on {planLabel} plan
          </p>
        )}
      </div>
    </div>
  );
};

/* ── Pricing Modal ── */
const PricingModal = ({ onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
    style={{ backgroundColor: 'rgba(31,21,16,0.45)' }} onClick={onClose}>
    <div className="w-full max-w-md rounded-2xl overflow-hidden"
      style={{ backgroundColor: '#faf8f5', boxShadow: '0 20px 60px rgba(26,18,8,0.18)' }}
      onClick={(e) => e.stopPropagation()}>
      <div className="px-6 py-5" style={{ borderBottom: '1px solid #e8e0d4' }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: ACC }}>GSTWand Plans</div>
            <h2 className="font-serif text-[22px] font-semibold" style={{ color: '#1f1510' }}>Pricing & Billing</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors hover:bg-bg-hover" style={{ color: '#9a8c7c' }}>✕</button>
        </div>
      </div>
      <div className="p-6 space-y-4">
        <div className="rounded-xl border p-5" style={{ borderColor: '#e8e0d4', backgroundColor: '#fff' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[13px] font-bold" style={{ color: '#1f1510' }}>Free Plan</div>
              <div className="text-[12px]" style={{ color: '#9a8c7c' }}>No credit card required</div>
            </div>
            <div className="text-[22px] font-bold font-serif" style={{ color: '#1f1510' }}>₹0</div>
          </div>
          <ul className="space-y-2 mb-4">
            {['10 AI chat messages', 'GST knowledge base access', 'Email support'].map((f) => (
              <li key={f} className="flex items-center gap-2 text-[13px]" style={{ color: '#5a4c3c' }}>
                <span style={{ color: ACC }}>✓</span> {f}
              </li>
            ))}
          </ul>
          <div className="text-center text-[12px] py-1.5 rounded-lg border font-medium" style={{ borderColor: '#e8e0d4', color: '#9a8c7c' }}>Current Plan</div>
        </div>
        <div className="rounded-xl border-2 p-5 relative overflow-hidden" style={{ borderColor: ACC, backgroundColor: '#fff' }}>
          <div className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: ACC, color: '#fff' }}>COMING SOON</div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[13px] font-bold" style={{ color: '#1f1510' }}>Pro Plan</div>
              <div className="text-[12px]" style={{ color: '#9a8c7c' }}>For CAs & businesses</div>
            </div>
            <div className="text-[22px] font-bold font-serif" style={{ color: ACC }}>₹???</div>
          </div>
          <ul className="space-y-2 mb-4">
            {['Unlimited AI chat messages', 'Priority GST expert support', 'GSTR auto-filing assistance', 'ITC reconciliation reports', 'Dedicated CA assigned'].map((f) => (
              <li key={f} className="flex items-center gap-2 text-[13px]" style={{ color: '#5a4c3c' }}>
                <span style={{ color: ACC }}>✓</span> {f}
              </li>
            ))}
          </ul>
          <button onClick={() => alert("Pro plan is coming soon! We'll notify you when it's available. 🚀")}
            className="w-full py-2 rounded-lg text-[13px] font-semibold transition-all hover:-translate-y-px"
            style={{ backgroundColor: ACC, color: '#fff' }}>
            🚀 Coming Soon — Notify Me
          </button>
        </div>
      </div>
      <div className="px-6 pb-5">
        <p className="text-center text-[11px]" style={{ color: '#c4b49a' }}>Questions? Email us at support@gstwand.com</p>
      </div>
    </div>
  </div>
);

/* ── Dashboard ── */
const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();
  const toast = useToast();

  const isPro = user?.pro_user ?? false;
  const maxCredits = isPro ? MAX_CREDITS_PRO : MAX_CREDITS_FREE;
  const credits = user?.credits ?? maxCredits;
  const isOutOfCredits = credits <= 0;

  // Chat history state
  const [chats, setChats] = useState([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // UI state
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showPricing, setShowPricing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // File upload state
  const [fileCtx, setFileCtx] = useState(null); // { filename }
  const [fileUploading, setFileUploading] = useState(false);

  const [loadingStep, setLoadingStep] = useState(0);

  const messagesEndRef   = useRef(null);
  const inputRef         = useRef(null);
  const fileInputRef     = useRef(null);
  const loadingTimersRef = useRef([]);

  /* ── Scroll to bottom on new messages ── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  /* ── Step through loading messages while isTyping ── */
  useEffect(() => {
    loadingTimersRef.current.forEach(clearTimeout);
    loadingTimersRef.current = [];
    if (isTyping) {
      setLoadingStep(0);
      loadingTimersRef.current = [
        setTimeout(() => setLoadingStep(1), 2000),
        setTimeout(() => setLoadingStep(2), 5000),
        setTimeout(() => setLoadingStep(3), 8000),
      ];
    } else {
      setLoadingStep(0);
    }
    return () => loadingTimersRef.current.forEach(clearTimeout);
  }, [isTyping]);

  /* ── Fetch chat list on mount ── */
  useEffect(() => {
    const fetchChats = async () => {
      setChatsLoading(true);
      try {
        const res = await chatHistoryAPI.getChats();
        setChats(res.data.data || []);
      } catch (err) {
        console.error('Failed to fetch chats:', err.message);
      } finally {
        setChatsLoading(false);
      }
    };
    fetchChats();
  }, []);

  /* ── Load a specific chat's messages ── */
  const loadChat = useCallback(async (chatId) => {
    if (activeChatId === chatId) return;
    setActiveChatId(chatId);
    setMessages([]);
    setMessagesLoading(true);
    try {
      const res = await chatHistoryAPI.getChatById(chatId);
      const dbMessages = res.data.data.messages || [];
      // Normalize DB format { role, content } → UI format { id, role, text }
      setMessages(dbMessages.map((m, i) => ({ id: i, role: m.role === 'assistant' ? 'ai' : 'user', text: m.content })));
    } catch (err) {
      console.error('Failed to load chat:', err.message);
    } finally {
      setMessagesLoading(false);
    }
  }, [activeChatId]);

  /* ── Delete a chat ── */
  const deleteChat = async (e, chatId) => {
    e.stopPropagation();
    setDeletingId(chatId);
    try {
      await chatHistoryAPI.deleteChat(chatId);
      setChats((prev) => prev.filter((c) => c._id !== chatId));
      if (activeChatId === chatId) {
        setActiveChatId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to delete chat:', err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const isAnyRegenerating = messages.some((m) => m.regenLoading);

  /* ── Send a message ── */
  const sendMessage = async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || isTyping || isAnyRegenerating) return;
    if (isOutOfCredits) { setShowPricing(true); return; }

    setInput('');
    setMessages((prev) => [...prev, { id: Date.now(), role: 'user', text: trimmed }]);
    setIsTyping(true);

    try {
      let reply, newCredits, sources = [], from_context = false;

      let usedChunkIds = [];
      if (!activeChatId) {
        // First message → create a new chat
        const res = await chatHistoryAPI.createChat(trimmed);
        const { chatId, title, reply: r, credits: c, sources: s, from_context: fc, usedChunkIds: uci } = res.data.data;
        reply = r;
        newCredits = c;
        sources = s || [];
        from_context = fc || false;
        usedChunkIds = uci || [];
        setActiveChatId(chatId);
        setChats((prev) => [{ _id: chatId, title, updatedAt: new Date() }, ...prev]);
      } else {
        // Subsequent message → append to existing chat
        const res = await chatHistoryAPI.addMessage(activeChatId, trimmed);
        reply = res.data.data.reply;
        newCredits = res.data.data.credits;
        sources = res.data.data.sources || [];
        from_context = res.data.data.from_context || false;
        usedChunkIds = res.data.data.usedChunkIds || [];
      }

      updateUser({ credits: newCredits });
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'ai', text: reply, sources, from_context, query: trimmed, usedChunkIds, moreFiles: [], moreLoading: false, noMore: false, regenLoading: false }]);
    } catch (err) {
      const serverMsg = err.response?.data?.message;
      const remainingCredits = err.response?.data?.credits;

      if (err.response?.status === 402) {
        if (remainingCredits !== undefined) updateUser({ credits: 0 });
        setMessages((prev) => [...prev, {
          id: Date.now() + 1, role: 'ai', isLimit: true,
          text: "**You've reached your free limit.**\n\nUpgrade to Pro to continue asking questions and get unlimited GST assistance.",
        }]);
        setShowPricing(true);
      } else if (err.response?.status === 429) {
        // Chat limit reached
        setMessages((prev) => prev.slice(0, -1)); // remove the optimistic user message
        alert(serverMsg || 'Chat limit reached. Delete old chats to continue.');
      } else {
        setMessages((prev) => [...prev, {
          id: Date.now() + 1, role: 'ai',
          text: serverMsg || 'Something went wrong. Please try again.',
        }]);
      }
    } finally {
      setIsTyping(false);
      inputRef.current?.focus();
    }
  };

  /* ── File upload ── */
  const MAX_CHAT_FILE_SIZE  = 25 * 1024 * 1024; // 25 MB
  const MAX_CHAT_TEXT_CHARS = 12000;

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';
    if (!file) return;

    // Client-side size guard — no network call wasted
    if (file.size > MAX_CHAT_FILE_SIZE) {
      toast.error(`Upload failed: File exceeds 25MB limit.`);
      return;
    }

    setFileUploading(true);
    const toastId = toast.loading('Uploading and processing file...');

    try {
      const res = await fileAPI.upload(file);
      const { filename, charCount } = res.data.data;
      setFileCtx({ filename });
      toast.dismiss(toastId);

      if (charCount > MAX_CHAT_TEXT_CHARS) {
        toast.success(
          'File uploaded successfully. You can now chat with this document. Note: Only the first ~12,000 characters were indexed.',
          6000,
        );
      } else {
        toast.success('File uploaded successfully. You can now chat with this document.');
      }
    } catch (err) {
      toast.dismiss(toastId);
      const serverMsg = err.response?.data?.message || '';
      let toastMsg;

      if (!err.response) {
        toastMsg = 'Upload failed: Network issue. Please try again.';
      } else if (serverMsg.toLowerCase().includes('too large') || serverMsg.toLowerCase().includes('25')) {
        toastMsg = 'Upload failed: File exceeds 25MB limit.';
      } else if (
        serverMsg.toLowerCase().includes('unable to extract') ||
        serverMsg.toLowerCase().includes('image scan') ||
        serverMsg.toLowerCase().includes('password')
      ) {
        toastMsg = 'Upload failed: Unable to extract content from file.';
      } else if (serverMsg.toLowerCase().includes('empty') || serverMsg.toLowerCase().includes('could not be read')) {
        toastMsg = 'Upload failed: No readable content found.';
      } else if (serverMsg.toLowerCase().includes('unsupported')) {
        toastMsg = 'Upload failed: Unsupported file type. Use PDF, TXT, or DOCX.';
      } else {
        toastMsg = 'Upload failed: Something went wrong while processing.';
      }

      toast.error(toastMsg);
    } finally {
      setFileUploading(false);
    }
  };

  /* ── Start a new (blank) chat ── */
  const startNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
    inputRef.current?.focus();
  };

  /* ── Fetch additional related files for an AI message ── */
  const fetchMoreFiles = async (msg) => {
    if (msg.moreLoading || msg.noMore) return;
    const excludeUrls = [...(msg.sources || []), ...(msg.moreFiles || [])];
    setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, moreLoading: true } : m));
    try {
      const res = await chatHistoryAPI.getRelatedFiles(msg.query, excludeUrls);
      const files = res.data?.data?.files || [];
      setMessages((prev) => prev.map((m) =>
        m.id === msg.id
          ? { ...m, moreLoading: false, moreFiles: [...(m.moreFiles || []), ...files], noMore: files.length === 0 }
          : m
      ));
    } catch {
      setMessages((prev) => prev.map((m) =>
        m.id === msg.id ? { ...m, moreLoading: false, noMore: true } : m
      ));
    }
  };

  /* ── Regenerate an AI answer using unused context chunks ── */
  const regenerateAnswer = async (msg) => {
    if (msg.regenLoading || isTyping) return;

    // Resolve the query — use stored query, or fall back to preceding user message
    let query = msg.query;
    if (!query) {
      const msgIdx = messages.findIndex((m) => m.id === msg.id);
      if (msgIdx > 0 && messages[msgIdx - 1].role === 'user') {
        query = messages[msgIdx - 1].text;
      }
    }
    if (!query || !activeChatId) return;

    setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, regenLoading: true, regenError: null } : m));
    try {
      const res = await chatHistoryAPI.regenerateMessage(activeChatId, {
        query,
        usedChunkIds: msg.usedChunkIds || [],
      });
      const { reply, credits: newCredits, sources, usedChunkIds: newIds, from_context } = res.data.data;
      updateUser({ credits: newCredits });
      setMessages((prev) => prev.map((m) =>
        m.id === msg.id
          ? { ...m, text: reply, sources: sources || [], usedChunkIds: newIds || [], from_context, regenLoading: false, regenError: null, moreFiles: [], noMore: false }
          : m
      ));
    } catch (err) {
      const serverMsg = err.response?.data?.message;
      if (err.response?.status === 402) {
        updateUser({ credits: 0 });
        setShowPricing(true);
      }
      const errorText = err.response?.status === 402
        ? null
        : (serverMsg || 'Failed to regenerate answer. Please try again.');
      setMessages((prev) => prev.map((m) =>
        m.id === msg.id ? { ...m, regenLoading: false, regenError: errorText } : m
      ));
    }
  };

  const handleLogout = () => {
    fileAPI.clearContext().catch(() => {}); // best-effort
    setFileCtx(null);
    logout();
    navigate('/');
  };

  const firstName = user?.firstName || user?.name?.split(' ')[0] || 'User';
  const initials = ((user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')).toUpperCase() || 'U';
  const atChatLimit = chats.length >= MAX_CHATS;

  return (
    <div className="flex h-screen overflow-hidden font-sans" style={{ backgroundColor: '#f7f4ef' }}>

      {/* ── CHAT HISTORY SIDEBAR ── */}
      {sidebarOpen && (
        <aside className="flex flex-col flex-shrink-0 w-[240px]"
          style={{ backgroundColor: '#111827', borderRight: '1px solid rgba(255,255,255,0.06)' }}>

          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 14px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.88)', letterSpacing: '.01em' }}>
              💬 Recent Chats
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              style={{
                color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none',
                cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '3px 5px',
                borderRadius: '6px', transition: 'color .15s, background .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; e.currentTarget.style.background = 'none'; }}
            >✕</button>
          </div>

          {/* New Chat button */}
          {(
            <div style={{ padding: '0 10px 8px' }}>
              {atChatLimit ? (
                <div style={{
                  padding: '9px 12px', borderRadius: '10px', textAlign: 'center',
                  fontSize: '11px', color: 'rgba(255,255,255,0.3)',
                  border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)',
                }}>
                  Maximum 10 chats allowed
                </div>
              ) : (
                <button
                  onClick={startNewChat}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: '7px', padding: '9px 14px', borderRadius: '10px',
                    background: 'rgba(188,108,95,0.2)', border: '1px solid rgba(188,108,95,0.35)',
                    color: '#BC6C5F', fontSize: '13px', fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(188,108,95,0.3)'; e.currentTarget.style.color = '#d4806e'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(188,108,95,0.2)'; e.currentTarget.style.color = '#BC6C5F'; }}
                >
                  ✏️ New Chat
                </button>
              )}
            </div>
          )}

          {/* Chat history list */}
          <div className="flex-1 overflow-y-auto"
            style={{ padding: '0 8px 8px' }}>
            {chatsLoading ? (
              <div style={{ padding: '8px 0' }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{
                    height: '36px', borderRadius: '9px', marginBottom: '4px',
                    background: 'rgba(255,255,255,0.06)',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }} />
                ))}
              </div>
            ) : chats.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', padding: '12px 6px 0' }}>
                No chats yet. Start a conversation below.
              </p>
            ) : (
              <>
                <div style={{
                  fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '.1em', color: 'rgba(255,255,255,0.25)',
                  padding: '10px 6px 6px',
                }}>
                  Recent · {chats.length}/{MAX_CHATS}
                </div>
                {chats.map((chat) => (
                  <div
                    key={chat._id}
                    className={`group chat-history-item ${chat._id === activeChatId ? 'chat-active' : ''}`}
                  >
                    <button
                      onClick={() => loadChat(chat._id)}
                      style={{
                        flex: 1, textAlign: 'left', padding: '9px 10px',
                        fontSize: '13px', background: 'none', border: 'none',
                        cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap', fontFamily: 'inherit',
                        color: chat._id === activeChatId ? '#fff' : 'rgba(255,255,255,0.6)',
                        fontWeight: chat._id === activeChatId ? 500 : 400,
                        minWidth: 0,
                      }}>
                      {chat.title}
                    </button>
                    <button
                      onClick={(e) => deleteChat(e, chat._id)}
                      disabled={deletingId === chat._id}
                      className="opacity-0 group-hover:opacity-100"
                      style={{
                        flexShrink: 0, padding: '5px 7px', marginRight: '4px',
                        borderRadius: '6px', background: 'none', border: 'none',
                        cursor: 'pointer', color: 'rgba(255,255,255,0.35)',
                        transition: 'all .15s', fontSize: '13px',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; e.currentTarget.style.background = 'none'; }}
                      title="Delete chat"
                    >
                      {deletingId === chat._id ? '…' : '🗑'}
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Credits bar */}
          <CreditsBar credits={credits} maxCredits={maxCredits} isPro={isPro} onUpgrade={() => setShowPricing(true)} />
        </aside>
      )}

      {/* ── MAIN ── */}
      <main className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#faf8f5' }}>

        {/* Top bar */}
        <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid #e8e0d4', backgroundColor: '#faf8f5' }}>
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-lg transition-colors hover:bg-bg-hover text-sm" style={{ color: '#9a8c7c' }}>☰</button>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold" style={{ color: '#1f1510' }}>GST AI Assistant</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: 'rgba(188,108,95,0.1)', color: ACC }}>
              Beta
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={async () => {
                  const tid = toast.loading('Generating PDF…');
                  try {
                    await exportChatToPdf(messages, user?.name || user?.email || '');
                    toast.dismiss(tid);
                    toast.success('PDF downloaded successfully.');
                  } catch {
                    toast.dismiss(tid);
                    toast.error('Failed to generate PDF. Please try again.');
                  }
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all hover:-translate-y-px border"
                style={{ borderColor: '#e8e0d4', color: '#5a4c3c', backgroundColor: '#fff' }}
                title="Download this chat as a PDF report"
              >
                ⬇ PDF
              </button>
            )}
            <button onClick={() => setShowPricing(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all hover:-translate-y-px border"
              style={{ borderColor: ACC, color: ACC, backgroundColor: 'rgba(188,108,95,0.06)' }}>
              ✨ Upgrade
            </button>
            {!atChatLimit && (
              <button onClick={startNewChat}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all hover:-translate-y-px border"
                style={{ borderColor: '#e8e0d4', color: '#5a4c3c', backgroundColor: '#fff' }}>
                ✏️ New Chat
              </button>
            )}
          </div>
        </div>

        {/* Messages / Welcome */}
        <div className="flex-1 overflow-y-auto">
          {messagesLoading ? (
            <div className="flex items-center justify-center h-full">
              <TypingDots />
            </div>
          ) : messages.length === 0 ? (

            /* ── WELCOME ── */
            <div className="flex flex-col items-center justify-center min-h-full px-4 py-12">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl mb-4"
                style={{ backgroundColor: ACC, boxShadow: '0 4px 16px rgba(188,108,95,0.25)' }}>⚖️</div>
              <h1 className="font-serif text-[28px] font-semibold mb-2 text-center" style={{ color: '#1f1510' }}>
                {isOutOfCredits ? "You've Used All Free Credits" : 'How can I help you with GST?'}
              </h1>
              <p className="text-[14px] mb-8 text-center max-w-md leading-relaxed" style={{ color: '#9a8c7c' }}>
                {isOutOfCredits
                  ? 'Upgrade to Pro to continue getting unlimited GST guidance and expert support.'
                  : "Ask me anything about GST filing, ITC, returns, notices or compliance. I'll explain it simply."}
              </p>

              {isOutOfCredits ? (
                <button onClick={() => setShowPricing(true)}
                  className="px-6 py-3 rounded-xl text-[14px] font-semibold transition-all hover:-translate-y-0.5"
                  style={{ backgroundColor: ACC, color: '#fff', boxShadow: '0 4px 16px rgba(188,108,95,0.3)' }}>
                  ✨ Upgrade to Pro — Coming Soon
                </button>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 w-full max-w-2xl">
                  {SUGGESTED_QUESTIONS.map(({ q, icon }) => (
                    <button key={q} onClick={() => sendMessage(q)}
                      className="group text-left px-4 py-3.5 rounded-xl border transition-all hover:-translate-y-0.5"
                      style={{ backgroundColor: '#fff', borderColor: '#e8e0d4' }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = ACC; e.currentTarget.style.boxShadow = '0 2px 8px rgba(188,108,95,0.12)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e8e0d4'; e.currentTarget.style.boxShadow = 'none'; }}>
                      <div className="text-lg mb-1.5">{icon}</div>
                      <div className="text-[13px] font-medium leading-snug" style={{ color: '#1f1510' }}>{q}</div>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-5 mt-10 flex-wrap justify-center">
                {['📧 support@gstwand.com', '🔒 256-bit SSL', '✅ GSTN Approved'].map((item) => (
                  <span key={item} className="text-[12px]" style={{ color: '#c4b49a' }}>{item}</span>
                ))}
              </div>
            </div>

          ) : (

            /* ── CHAT MESSAGES ── */
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
              {messages.map((msg) => msg.role === 'system' ? (
                /* ── System notice (file upload status) ── */
                <div key={msg.id} className="flex justify-center">
                  <div className="px-3 py-1.5 rounded-full text-[12px]"
                    style={{
                      backgroundColor: msg.isError ? 'rgba(220,53,69,0.08)' : 'rgba(188,108,95,0.08)',
                      color: msg.isError ? '#c0392b' : '#7a5c52',
                      border: `1px solid ${msg.isError ? 'rgba(220,53,69,0.2)' : 'rgba(188,108,95,0.15)'}`,
                    }}>
                    {msg.text}
                  </div>
                </div>
              ) : (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {msg.role === 'user' ? (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: ACC }}>{initials}</div>
                  ) : (
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                      style={{ backgroundColor: '#f2ede6', border: '1px solid #e8e0d4' }}>⚖️</div>
                  )}
                  <div className="max-w-[82%]">
                    <div className="text-[11px] font-medium mb-1"
                      style={{ color: '#9a8c7c', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                      {msg.role === 'user' ? firstName : 'GSTWand'}
                    </div>
                    <div className="px-4 py-3 rounded-2xl"
                      style={msg.role === 'user'
                        ? { backgroundColor: ACC, color: '#fff', borderBottomRightRadius: '4px' }
                        : msg.isLimit
                          ? { backgroundColor: '#fff8f0', border: 'rgba(188,108,95,0.35) solid 1px', borderBottomLeftRadius: '4px' }
                          : { backgroundColor: '#fff', border: '1px solid #e8e0d4', borderBottomLeftRadius: '4px' }}>
                      {msg.role === 'user'
                        ? <p className="text-[14px] leading-relaxed" style={{ color: '#fff' }}>{msg.text}</p>
                        : (
                          <div className="space-y-1">
                            {msg.regenLoading ? (
                              <div className="py-1 space-y-2">
                                <div className="h-2.5 rounded-full animate-pulse" style={{ background: '#f0ebe4', width: '88%' }} />
                                <div className="h-2.5 rounded-full animate-pulse" style={{ background: '#f0ebe4', width: '74%' }} />
                                <div className="h-2.5 rounded-full animate-pulse" style={{ background: '#f0ebe4', width: '82%' }} />
                                <div className="h-2.5 rounded-full animate-pulse" style={{ background: '#f0ebe4', width: '60%' }} />
                                <p className="text-[11.5px] font-semibold pt-1.5" style={{ color: '#b08070' }}>
                                  ⏳ Regenerating better answer…
                                </p>
                              </div>
                            ) : (
                              <>
                                {renderText(msg.text)}
                                {msg.regenError && (
                                  <p className="text-[12px] mt-1.5" style={{ color: '#c0392b' }}>
                                    ❌ {msg.regenError}
                                  </p>
                                )}
                              </>
                            )}
                            {!msg.isLimit && !msg.regenLoading && (
                              <div className="mt-2 pt-2" style={{ borderTop: '1px solid #f0ebe4' }}>
                                <button
                                  onClick={() => regenerateAnswer(msg)}
                                  disabled={isAnyRegenerating || isTyping}
                                  className="text-[11.5px] font-semibold transition-all hover:opacity-70 disabled:opacity-40"
                                  style={{
                                    color: '#9a8c7c', background: 'none', border: 'none',
                                    padding: 0, cursor: isAnyRegenerating || isTyping ? 'not-allowed' : 'pointer',
                                  }}
                                  title="Generate a new answer using different source chunks"
                                >
                                  ↻ Regenerate Answer
                                </button>
                              </div>
                            )}
                            {msg.isLimit && (
                              <button onClick={() => setShowPricing(true)}
                                className="mt-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all hover:-translate-y-px"
                                style={{ backgroundColor: ACC, color: '#fff' }}>
                                ✨ View Upgrade Options
                              </button>
                            )}
                            {!msg.regenLoading && msg.sources && msg.sources.length > 0 && (
                              <div className="mt-3 pt-3" style={{ borderTop: '1px solid #e8e0d4' }}>
                                {/* ── Top 2 sources ── */}
                                <p className="text-[11px] font-semibold mb-1.5" style={{ color: '#9a8c7c' }}>📄 Top Sources</p>
                                <div className="flex flex-col gap-1">
                                  {msg.sources.map((url, idx) => {
                                    const label = url.split('/').pop().split('?')[0] || url;
                                    return (
                                      <a key={idx} href={url} target="_blank" rel="noopener noreferrer"
                                        className="text-[12px] hover:underline break-all"
                                        style={{ color: ACC }}>
                                        {decodeURIComponent(label)}
                                      </a>
                                    );
                                  })}
                                </div>

                                {/* ── Additional files loaded via "Show More" ── */}
                                {msg.moreFiles && msg.moreFiles.length > 0 && (
                                  <div className="mt-2">
                                    <p className="text-[11px] font-semibold mb-1" style={{ color: '#9a8c7c' }}>🔗 More Related Files</p>
                                    <div className="flex flex-col gap-1">
                                      {msg.moreFiles.map((url, idx) => {
                                        const label = url.split('/').pop().split('?')[0] || url;
                                        return (
                                          <a key={idx} href={url} target="_blank" rel="noopener noreferrer"
                                            className="text-[12px] hover:underline break-all"
                                            style={{ color: ACC }}>
                                            {decodeURIComponent(label)}
                                          </a>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* ── Show More button (only if query is available and not exhausted) ── */}
                                {msg.query && !msg.noMore && (
                                  <button
                                    onClick={() => fetchMoreFiles(msg)}
                                    disabled={msg.moreLoading}
                                    className="mt-2 text-[11.5px] font-semibold transition-all hover:opacity-70"
                                    style={{
                                      color: ACC, background: 'none', border: 'none',
                                      padding: 0, cursor: msg.moreLoading ? 'wait' : 'pointer',
                                    }}
                                  >
                                    {msg.moreLoading ? '⏳ Loading…' : '🔍 Show More Related Files'}
                                  </button>
                                )}

                                {/* ── Empty state after exhausting results ── */}
                                {msg.noMore && (
                                  <p className="mt-1.5 text-[11px]" style={{ color: '#9a8c7c' }}>
                                    {msg.moreFiles && msg.moreFiles.length > 0
                                      ? 'No more relevant files found'
                                      : 'No other relevant files found'}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      }
                    </div>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                    style={{ backgroundColor: '#f2ede6', border: '1px solid #e8e0d4' }}>⚖️</div>
                  <div className="px-4 py-3 rounded-2xl" style={{ backgroundColor: '#fff', border: '1px solid #e8e0d4', minWidth: '220px' }}>
                    <p className="text-[13px] font-medium mb-2" style={{ color: '#6b5c4e' }}>
                      {LOADING_STEPS[loadingStep].icon} {LOADING_STEPS[loadingStep].text}
                    </p>
                    <TypingDots />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ── INPUT ── */}
        <div className="flex-shrink-0 px-4 pb-5 pt-3"
          style={{ borderTop: '1px solid #e8e0d4' }}>
          <div className="max-w-2xl mx-auto">
            {isOutOfCredits ? (
              <div className="rounded-2xl border px-5 py-4 text-center"
                style={{ backgroundColor: '#fff8f0', borderColor: 'rgba(188,108,95,0.35)' }}>
                <p className="text-[14px] font-semibold mb-1" style={{ color: '#1f1510' }}>You've reached your free limit</p>
                <p className="text-[12px] mb-3" style={{ color: '#9a8c7c' }}>Upgrade to Pro for unlimited GST assistance</p>
                <button onClick={() => setShowPricing(true)}
                  className="px-5 py-2 rounded-xl text-[13px] font-semibold transition-all hover:-translate-y-px"
                  style={{ backgroundColor: ACC, color: '#fff' }}>
                  ✨ Upgrade to Continue
                </button>
              </div>
            ) : (
              <>
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.docx"
                  className="hidden"
                  onChange={handleFileSelect}
                />

                {/* Active file strip */}
                {fileCtx && (
                  <div className="flex items-center gap-2 px-3 py-1.5 mb-1.5 rounded-xl"
                    style={{ backgroundColor: 'rgba(188,108,95,0.08)', border: '1px solid rgba(188,108,95,0.2)' }}>
                    <span className="text-[13px]">📎</span>
                    <span className="flex-1 text-[12px] truncate font-medium" style={{ color: '#5a4c3c' }}>
                      {fileCtx.filename}
                    </span>
                    <button
                      onClick={() => { fileAPI.clearContext().catch(() => {}); setFileCtx(null); }}
                      className="text-[11px] px-1.5 py-0.5 rounded hover:opacity-70 transition-opacity"
                      style={{ color: '#9a8c7c' }}
                      title="Remove file">
                      ✕
                    </button>
                  </div>
                )}

                <div className="flex items-end gap-2 px-4 py-3 rounded-2xl border"
                  style={{ backgroundColor: '#fff', borderColor: '#e8e0d4', boxShadow: '0 1px 6px rgba(26,18,8,0.05)' }}>
                  {/* Upload button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={fileUploading}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-sm transition-all disabled:opacity-40 hover:opacity-70 flex-shrink-0"
                    style={{ backgroundColor: fileCtx ? 'rgba(188,108,95,0.12)' : '#f2ede6', color: fileCtx ? ACC : '#9a8c7c' }}
                    title={fileUploading ? 'Processing…' : 'Upload file (PDF, TXT, DOCX)'}>
                    {fileUploading ? '⏳' : '📎'}
                  </button>
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !isAnyRegenerating) { e.preventDefault(); sendMessage(); } }}
                    placeholder={fileCtx ? `Ask about "${fileCtx.filename}"…` : 'Ask anything about GST, ITC, returns, notices…'}
                    rows={1}
                    className="flex-1 resize-none outline-none text-[14px] leading-relaxed bg-transparent"
                    style={{ color: '#1f1510', maxHeight: '140px', minHeight: '22px' }}
                  />
                  <button onClick={() => sendMessage()} disabled={!input.trim() || isTyping || isAnyRegenerating}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm transition-all disabled:opacity-30"
                    style={{ backgroundColor: input.trim() ? ACC : '#d4c8b8', flexShrink: 0 }}>↑</button>
                </div>
                <p className="text-center text-[11px] mt-2" style={{ color: '#c4b49a' }}>
                  Enter to send · Shift+Enter for new line · {credits} credit{credits !== 1 ? 's' : ''} remaining
                </p>
              </>
            )}
          </div>
        </div>
      </main>

      {showPricing && <PricingModal onClose={() => setShowPricing(false)} />}
    </div>
  );
};

export default Dashboard;
