import React, { useState, useRef, useEffect } from 'react';

/* ── App theme tokens (mirrors tailwind.config.js) ── */
const T = {
  acc:         '#BC6C5F',
  accHover:    '#a45a4e',
  accLight:    '#faecea',
  bgSurface:   '#faf8f5',
  bgCard:      '#ffffff',
  bgInput:     '#fdfcfa',
  bgHover:     '#f0ebe3',
  bgPanel:     '#f2ede6',
  borderBase:  '#e8e0d4',
  borderStrong:'#d4c8b8',
  txtPrimary:  '#1f1510',
  txtSecondary:'#5a4c3c',
  txtMuted:    '#9a8c7c',
  txtPlaceholder: '#c4b49a',
};

const QA = [
  {
    q: 'How does the credit system work?',
    a: 'Each AI chat message uses 1 credit. Free accounts start with 10 credits. Upgrade to Pro (coming soon) for unlimited messages.',
  },
  {
    q: 'How do I use the chat feature?',
    a: 'Type your GST question in the chat input and press Enter or ↑. The AI will respond with GST-specific guidance instantly.',
  },
  {
    q: 'How do I upload a file?',
    a: 'Click the 📎 icon in the chat input to upload a PDF, TXT, or DOCX (max 5 MB). You can then ask questions about that document.',
  },
  {
    q: 'Why is my OTP not working?',
    a: 'In dev mode, the OTP is always 111111. In production, check your spam folder. Click "Resend OTP" after 30 seconds if it doesn\'t arrive.',
  },
  {
    q: 'How do I upgrade my plan?',
    a: 'Pro plan is coming soon! Click "✨ Upgrade" in the dashboard to see plan details and get notified when it launches.',
  },
  {
    q: 'Can I delete a chat?',
    a: 'Yes — hover over any chat in the sidebar and click the 🗑 icon. Free plan supports up to 5 saved chats.',
  },
  {
    q: 'Is my data secure?',
    a: 'Yes. All data is encrypted with 256-bit SSL. Uploaded files are processed in memory only and never written to disk.',
  },
];

const QUICK_CHIPS = [
  'How does credit system work?',
  'How to upload a file?',
  'Where is GST news?',
];

const BOT_INTRO = {
  id: 0,
  from: 'bot',
  text: 'Hi! 👋 I\'m GSTWand Support. Click a question below or type your own.',
  suggestions: QA.map((item) => item.q),
};

const findAnswer = (input) => {
  const lower = input.toLowerCase();
  const match = QA.find((item) =>
    item.q.toLowerCase().split(' ').some((word) => word.length > 3 && lower.includes(word))
  );
  return match
    ? match.a
    : 'I\'m not sure about that. Try one of the suggested questions, or email support@gstwand.com for help.';
};

/* ── SVG Icons ── */
const IconSparkle = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" fill="currentColor"/>
    <path d="M19 3l.8 2.2L22 6l-2.2.8L19 9l-.8-2.2L16 6l2.2-.8z" fill="currentColor" opacity="0.65"/>
    <path d="M5 18l.5 1.5L7 20l-1.5.5L5 22l-.5-1.5L3 20l1.5-.5z" fill="currentColor" opacity="0.45"/>
  </svg>
);

const IconClose = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const IconSend = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

const HelpWidget = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([BOT_INTRO]);
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open, messages]);

  const send = (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed) return;
    setInput('');

    const userMsg = { id: Date.now(), from: 'user', text: trimmed };
    const botMsg = { id: Date.now() + 1, from: 'bot', text: findAnswer(trimmed) };
    setMessages((prev) => [...prev, userMsg, botMsg]);
  };

  return (
    <>
      <style>{`
        @keyframes hw-slide-up {
          from { opacity: 0; transform: translateY(14px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        @keyframes hw-fade-in {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes hw-pulse-ring {
          0%   { box-shadow: 0 0 0 0   rgba(188,108,95,0.38); }
          70%  { box-shadow: 0 0 0 10px rgba(188,108,95,0); }
          100% { box-shadow: 0 0 0 0   rgba(188,108,95,0); }
        }
        .hw-popup    { animation: hw-slide-up 0.25s cubic-bezier(.22,.68,0,1.15) forwards; }
        .hw-msg      { animation: hw-fade-in 0.18s ease forwards; }
        .hw-fab      { animation: hw-pulse-ring 2.6s ease-out infinite; }
        .hw-scroll::-webkit-scrollbar { width: 4px; }
        .hw-scroll::-webkit-scrollbar-track { background: transparent; }
        .hw-scroll::-webkit-scrollbar-thumb { background: rgba(188,108,95,0.22); border-radius: 99px; }
        .hw-chip:hover {
          background: ${T.accLight} !important;
          border-color: ${T.acc} !important;
          color: ${T.acc} !important;
        }
        .hw-suggestion:hover {
          background: ${T.bgHover} !important;
          border-color: ${T.borderStrong} !important;
        }
        .hw-send-btn:not(:disabled):hover {
          background: ${T.accHover} !important;
          transform: scale(1.05);
        }
        .hw-close-btn:hover { background: rgba(255,255,255,0.18) !important; }
      `}</style>

      {/* ── Floating Button ── */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open AI assistant"
        className={!open ? 'hw-fab' : ''}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9998,
          width: '54px',
          height: '54px',
          borderRadius: '50%',
          backgroundColor: T.acc,
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 6px 24px rgba(188,108,95,0.42)',
          transition: 'transform 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.08)';
          e.currentTarget.style.backgroundColor = T.accHover;
          e.currentTarget.style.boxShadow = '0 10px 32px rgba(188,108,95,0.52)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.backgroundColor = T.acc;
          e.currentTarget.style.boxShadow = '0 6px 24px rgba(188,108,95,0.42)';
        }}
      >
        {open ? <IconClose /> : <IconSparkle />}
      </button>

      {/* ── Chat Popup ── */}
      {open && (
        <div
          className="hw-popup"
          style={{
            position: 'fixed',
            bottom: '90px',
            right: '24px',
            zIndex: 9999,
            width: '352px',
            maxWidth: 'calc(100vw - 32px)',
            height: '516px',
            maxHeight: 'calc(100vh - 120px)',
            borderRadius: '20px',
            backgroundColor: T.bgCard,
            boxShadow: '0 16px 48px rgba(26,18,8,0.13), 0 2px 8px rgba(26,18,8,0.06)',
            border: `1px solid ${T.borderBase}`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: '"DM Sans", sans-serif',
          }}
        >
          {/* ── Header ── */}
          <div
            style={{
              padding: '15px 16px',
              backgroundColor: T.acc,
              display: 'flex',
              alignItems: 'center',
              gap: '11px',
              flexShrink: 0,
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.18)',
                border: '2px solid rgba(255,255,255,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '17px',
                flexShrink: 0,
              }}
            >
              ⚖️
            </div>

            {/* Title */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '13.5px', lineHeight: 1.25, letterSpacing: '-0.01em' }}>
                AI Assistant
              </div>
              <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', marginTop: '2px' }}>
                Ask anything about GST or the app
              </div>
            </div>

            {/* Online badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginRight: '6px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#7edea8', boxShadow: '0 0 5px #7edea8' }} />
              <span style={{ color: 'rgba(255,255,255,0.68)', fontSize: '10px', fontWeight: 500 }}>Online</span>
            </div>

            {/* Close */}
            <button
              onClick={() => setOpen(false)}
              className="hw-close-btn"
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.82)',
                cursor: 'pointer',
                padding: '5px',
                borderRadius: '7px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.14s',
                flexShrink: 0,
              }}
            >
              <IconClose />
            </button>
          </div>

          {/* ── Quick chips ── */}
          <div
            style={{
              padding: '9px 13px 7px',
              display: 'flex',
              gap: '6px',
              flexWrap: 'wrap',
              borderBottom: `1px solid ${T.borderBase}`,
              backgroundColor: T.bgPanel,
              flexShrink: 0,
            }}
          >
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip}
                className="hw-chip"
                onClick={() => send(chip)}
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  padding: '4px 10px',
                  borderRadius: '999px',
                  border: `1px solid ${T.borderBase}`,
                  background: T.bgCard,
                  color: T.txtSecondary,
                  cursor: 'pointer',
                  transition: 'all 0.14s',
                  whiteSpace: 'nowrap',
                }}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* ── Messages ── */}
          <div
            className="hw-scroll"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '14px 13px',
              display: 'flex',
              flexDirection: 'column',
              gap: '11px',
              backgroundColor: T.bgSurface,
            }}
          >
            {messages.map((msg) => (
              <div key={msg.id} className="hw-msg">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: msg.from === 'user' ? 'flex-end' : 'flex-start',
                    alignItems: 'flex-end',
                    gap: '7px',
                  }}
                >
                  {/* Bot avatar */}
                  {msg.from === 'bot' && (
                    <div
                      style={{
                        width: '25px',
                        height: '25px',
                        borderRadius: '50%',
                        backgroundColor: T.acc,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        flexShrink: 0,
                        color: '#fff',
                      }}
                    >
                      ⚖️
                    </div>
                  )}

                  <div
                    style={{
                      maxWidth: '82%',
                      padding: '9px 13px',
                      borderRadius: msg.from === 'user'
                        ? '14px 14px 4px 14px'
                        : '4px 14px 14px 14px',
                      backgroundColor: msg.from === 'user' ? T.acc : T.bgCard,
                      color: msg.from === 'user' ? '#ffffff' : T.txtPrimary,
                      fontSize: '13px',
                      lineHeight: '1.55',
                      boxShadow: msg.from === 'user'
                        ? '0 3px 10px rgba(188,108,95,0.28)'
                        : '0 1px 4px rgba(26,18,8,0.07)',
                      border: msg.from === 'bot' ? `1px solid ${T.borderBase}` : 'none',
                    }}
                  >
                    {msg.text}
                  </div>
                </div>

                {/* Suggestion list */}
                {msg.suggestions && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '5px',
                      marginTop: '9px',
                      marginLeft: '32px',
                    }}
                  >
                    {msg.suggestions.map((q) => (
                      <button
                        key={q}
                        className="hw-suggestion"
                        onClick={() => send(q)}
                        style={{
                          textAlign: 'left',
                          background: T.bgCard,
                          border: `1px solid ${T.borderBase}`,
                          borderRadius: '10px',
                          padding: '7px 11px',
                          fontSize: '12px',
                          color: T.txtSecondary,
                          cursor: 'pointer',
                          transition: 'all 0.14s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '7px',
                        }}
                      >
                        <span style={{ color: T.acc, fontSize: '10px', flexShrink: 0 }}>▸</span>
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* ── Input area ── */}
          <div
            style={{
              padding: '11px 13px',
              borderTop: `1px solid ${T.borderBase}`,
              backgroundColor: T.bgCard,
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                border: `1.5px solid ${T.borderBase}`,
                borderRadius: '10px',
                backgroundColor: T.bgInput,
                padding: '0 11px',
                transition: 'border-color 0.14s, box-shadow 0.14s',
              }}
              onFocusCapture={(e) => {
                e.currentTarget.style.borderColor = T.acc;
                e.currentTarget.style.boxShadow = 'rgba(188,108,95,0.15) 0 0 0 3px';
              }}
              onBlurCapture={(e) => {
                e.currentTarget.style.borderColor = T.borderBase;
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
                placeholder="Ask your question…"
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  fontSize: '13px',
                  color: T.txtPrimary,
                  padding: '9px 0',
                  fontFamily: '"DM Sans", sans-serif',
                }}
              />
            </div>

            <button
              onClick={() => send()}
              disabled={!input.trim()}
              className={input.trim() ? 'hw-send-btn' : ''}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: input.trim() ? T.acc : T.borderBase,
                color: input.trim() ? '#ffffff' : T.txtPlaceholder,
                border: 'none',
                cursor: input.trim() ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.16s ease',
                boxShadow: input.trim() ? '0 3px 10px rgba(188,108,95,0.28)' : 'none',
              }}
            >
              <IconSend />
            </button>
          </div>

          {/* ── Footer ── */}
          <div
            style={{
              textAlign: 'center',
              padding: '5px 13px 9px',
              fontSize: '10.5px',
              color: T.txtMuted,
              backgroundColor: T.bgCard,
              borderTop: `1px solid ${T.borderBase}`,
            }}
          >
            Powered by <span style={{ color: T.acc, fontWeight: 600 }}>GSTWand AI</span>
          </div>
        </div>
      )}
    </>
  );
};

export default HelpWidget;
