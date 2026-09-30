import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApiRequest } from '../../hooks/useApiRequest';
import { Skeleton } from '../../components/Skeleton/Skeleton';

/* ─── Neo-Brutalist Inline Styles ─── */
const s = {
  page: { display: 'flex', gap: '1.5rem', height: 'calc(100vh - 160px)', minHeight: '500px' },
  
  /* Conversation List Panel */
  listPanel: {
    width: '320px', minWidth: '280px', background: 'var(--card-bg)', border: '3px solid var(--border-color)',
    borderRadius: 'var(--radius-md)', boxShadow: '4px 4px 0px 0px var(--shadow-color)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  listHeader: {
    padding: '1.25rem 1rem', borderBottom: '3px solid var(--border-color)',
    fontFamily: 'var(--font-heading)', fontSize: '1.3rem', fontWeight: 400,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  listSearch: {
    margin: '0.75rem', padding: '0.5rem 0.85rem', border: '2px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
    fontSize: '0.85rem', fontWeight: 500, fontFamily: 'var(--font-body)', outline: 'none',
    boxShadow: '2px 2px 0px 0px var(--shadow-color)',
  },
  convItem: (active) => ({
    padding: '1rem', cursor: 'pointer', display: 'flex', gap: '0.75rem', alignItems: 'center',
    borderBottom: '2px solid var(--border-color)', transition: 'all 0.15s ease',
    background: active ? 'var(--brand-primary)' : 'transparent',
    color: active ? '#fff' : 'var(--text-primary)',
  }),
  convAvatar: (active) => ({
    width: '42px', height: '42px', borderRadius: '50%', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0,
    background: active ? 'rgba(255,255,255,0.2)' : 'var(--bg-tertiary)',
    border: '2px solid var(--border-color)', color: active ? '#fff' : 'var(--text-primary)',
  }),
  convName: { fontWeight: 700, fontSize: '0.92rem', margin: 0 },
  convPreview: (active) => ({
    fontSize: '0.8rem', margin: '0.15rem 0 0', color: active ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px',
  }),
  unreadBadge: {
    minWidth: '22px', height: '22px', borderRadius: '50%', background: 'var(--error)',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.7rem', fontWeight: 700, marginLeft: 'auto', flexShrink: 0,
  },

  /* Chat Panel */
  chatPanel: {
    flex: 1, background: 'var(--card-bg)', border: '3px solid var(--border-color)',
    borderRadius: 'var(--radius-md)', boxShadow: '4px 4px 0px 0px var(--shadow-color)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  chatHeader: {
    padding: '1rem 1.25rem', borderBottom: '3px solid var(--border-color)',
    display: 'flex', alignItems: 'center', gap: '0.75rem',
  },
  chatHeaderName: { fontFamily: 'var(--font-heading)', fontSize: '1.15rem', fontWeight: 400, margin: 0 },
  chatHeaderRole: { fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
    padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-sm)', border: '2px solid var(--border-color)',
    background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
  },
  
  msgArea: {
    flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem',
    background: 'var(--bg-secondary)',
  },
  
  bubble: (isMine) => ({
    display: 'inline-block', minWidth: '60px', maxWidth: '100%',
    padding: '0.65rem 1rem', borderRadius: isMine ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
    border: '2px solid var(--border-color)',
    background: isMine ? 'var(--brand-primary)' : 'var(--card-bg)',
    color: isMine ? '#fff' : 'var(--text-primary)',
    boxShadow: isMine ? '3px 3px 0px 0px rgba(0,0,0,0.12)' : '2px 2px 0px 0px var(--shadow-color)',
    fontSize: '0.9rem', lineHeight: 1.55, overflowWrap: 'break-word', wordBreak: 'normal',
  }),
  bubbleTime: (isMine) => ({
    fontSize: '0.68rem', marginTop: '0.2rem', padding: '0 0.25rem',
    color: 'var(--text-muted)', textAlign: isMine ? 'right' : 'left',
  }),
  msgRow: (isMine) => ({
    display: 'flex', flexDirection: 'column',
    alignItems: isMine ? 'flex-end' : 'flex-start',
    maxWidth: '65%', alignSelf: isMine ? 'flex-end' : 'flex-start',
  }),

  /* Input Bar */
  inputBar: {
    padding: '1rem 1.25rem', borderTop: '3px solid var(--border-color)',
    display: 'flex', gap: '0.75rem', alignItems: 'center',
  },
  msgInput: {
    flex: 1, padding: '0.65rem 1rem', border: '2px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
    fontSize: '0.9rem', fontWeight: 500, fontFamily: 'var(--font-body)', outline: 'none',
    boxShadow: '2px 2px 0px 0px var(--shadow-color)',
  },
  sendBtn: {
    padding: '0.65rem 1.4rem', background: 'var(--brand-primary)', color: '#fff',
    border: '3px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
    fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em',
    boxShadow: 'var(--shadow-sm)', cursor: 'pointer', transition: 'all 0.12s ease',
    fontFamily: 'var(--font-body)',
  },

  emptyChat: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    color: 'var(--text-muted)', gap: '0.75rem',
  },

  /* New message picker */
  newMsgBtn: {
    padding: '0.4rem 0.75rem', background: 'var(--brand-primary)', color: '#fff',
    border: '2px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
    fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', cursor: 'pointer',
    boxShadow: '2px 2px 0px 0px var(--shadow-color)',
  },
};

const MessagesPage = () => {
  const { userId: paramUserId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { request } = useApiRequest();
  const msgEndRef = useRef(null);

  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(paramUserId || null);
  const [messages, setMessages] = useState([]);
  const [msgInput, setMsgInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [showNewMsg, setShowNewMsg] = useState(false);
  const [allowedContacts, setAllowedContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Fetch allowed contacts based on user role
  const fetchContacts = useCallback(async () => {
    if (!user) return;
    const role = (user.role || '').toLowerCase();
    setLoadingContacts(true);

    const contactsMap = new Map();
    const addContact = (u, roleHint) => {
      if (!u) return;
      const id = typeof u === 'object' ? u._id : u;
      if (!id || id === user._id) return;

      const existing = contactsMap.get(id);
      const fullName = (typeof u === 'object' ? (u.FullName || u.UserName) : null) || existing?.FullName || 'User';
      const email = (typeof u === 'object' ? u.Email : null) || existing?.Email || '';
      const r = (typeof u === 'object' ? u.role : null) || existing?.role || roleHint || 'user';

      contactsMap.set(id, {
        _id: id,
        FullName: fullName,
        Email: email,
        role: r,
      });
    };

    const extractList = (res) => {
      if (!res) return [];
      const d = res.data ?? res;
      if (Array.isArray(d)) return d;
      if (d && typeof d === 'object') {
        if (Array.isArray(d.docs)) return d.docs;
        if (Array.isArray(d.users)) return d.users;
        if (Array.isArray(d.profiles)) return d.profiles;
        if (Array.isArray(d.sessions)) return d.sessions;
        if (Array.isArray(d.tasks)) return d.tasks;
        if (Array.isArray(d.channels)) return d.channels;
      }
      return [];
    };

    try {
      try {
        const channelResponse = await request('/api/v1/channels');
        extractList(channelResponse).forEach(channel => {
          (channel.members || []).forEach(member => addContact(member.userId, member.role));
        });
      } catch { /* direct messages still have role-specific fallbacks */ }

      if (role === 'admin') {
        try {
          const res = await request('/api/v1/user');
          const list = extractList(res);
          list.forEach(u => addContact(u));
        } catch { /* admin fallback */ }
      } else if (role === 'instructor') {
        const [sessionsRes, tasksRes, profilesRes] = await Promise.allSettled([
          request('/api/v1/session?limit=500'),
          request('/api/v1/task?limit=500'),
          // /all is the list route; the bare collection path 404'd. Scoped to
          // this instructor's assigned students by the backend.
          request('/api/v1/StudentProfile/all?limit=500'),
        ]);

        if (sessionsRes.status === 'fulfilled') {
          extractList(sessionsRes.value).forEach(s => {
            if (s.studentProfileId?.user) addContact(s.studentProfileId.user, 'student');
          });
        }

        if (tasksRes.status === 'fulfilled') {
          extractList(tasksRes.value).forEach(t => {
            if (t.studentProfileId?.user) addContact(t.studentProfileId.user, 'student');
          });
        }

        if (profilesRes.status === 'fulfilled') {
          extractList(profilesRes.value).forEach(p => {
            if (p.user) addContact(p.user, 'student');
            // Profiles carry a `parents` array of users.
            (p.parents || []).forEach((parent) => addContact(parent, 'parent'));
          });
        }
      } else if (role === 'student') {
        const [sessionsRes, tasksRes] = await Promise.allSettled([
          request('/api/v1/session/me?limit=500'),
          request('/api/v1/task/me?limit=500'),
        ]);

        if (sessionsRes.status === 'fulfilled') {
          extractList(sessionsRes.value).forEach(s => {
            if (s.instructorId) addContact(s.instructorId, 'instructor');
          });
        }

        if (tasksRes.status === 'fulfilled') {
          extractList(tasksRes.value).forEach(t => {
            if (t.instructorId) addContact(t.instructorId, 'instructor');
          });
        }

        if (user.parent) addContact(user.parent, 'parent');
      } else if (role === 'parent') {
        const [childrenRes, sessionsRes] = await Promise.allSettled([
          request('/api/v1/studentProfile/me'),
          request('/api/v1/session/me?limit=500'),
        ]);

        if (childrenRes.status === 'fulfilled') {
          extractList(childrenRes.value).forEach(p => {
            if (p.user) addContact(p.user, 'student');
          });
        }

        if (sessionsRes.status === 'fulfilled') {
          extractList(sessionsRes.value).forEach(s => {
            if (s.instructorId) addContact(s.instructorId, 'instructor');
          });
        }
      }

      setAllowedContacts(Array.from(contactsMap.values()));
    } catch {
      setAllowedContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  }, [user, request]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Fetch conversations list
  const fetchConversations = useCallback(async () => {
    try {
      const res = await request('/api/v1/messages/conversations');
      setConversations(res.data || []);
    } catch { /* silently handle */ }
  }, [request]);

  // Fetch messages for a specific conversation
  const fetchMessages = useCallback(async (otherId) => {
    if (!otherId) return;
    setLoadingMsgs(true);
    try {
      const res = await request(`/api/v1/messages/${otherId}`);
      setMessages(res.data || []);
      // Mark as read
      await request(`/api/v1/messages/${otherId}/read`, 'PATCH').catch(() => {});
    } catch { setMessages([]); }
    finally { setLoadingMsgs(false); }
  }, [request]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);
  useEffect(() => { if (activeChat) fetchMessages(activeChat); }, [activeChat, fetchMessages]);
  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async () => {
    if (!msgInput.trim() || !activeChat || sending) return;
    setSending(true);
    try {
      await request('/api/v1/messages', 'POST', { receiverId: activeChat, content: msgInput.trim() });
      setMsgInput('');
      await fetchMessages(activeChat);
      await fetchConversations();
    } catch (err) { alert(err.message); }
    finally { setSending(false); }
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  const selectConversation = (otherId) => {
    setActiveChat(otherId);
    setShowNewMsg(false);
    navigate(`/dashboard/messages/${otherId}`, { replace: true });
  };

  const startNewConversation = (otherId) => {
    selectConversation(otherId);
  };

  // Find active user info
  const activeChatUser = conversations.find(c => c.otherUserId === activeChat);
  const activeChatUserFromList = allowedContacts.find(u => u._id === activeChat);
  const chatName = activeChatUser?.fullName || activeChatUserFromList?.FullName || 'User';
  const chatRole = activeChatUser?.role || activeChatUserFromList?.role || '';
  const chatInitials = chatName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const filteredConversations = searchQ.trim()
    ? conversations.filter(c => c.fullName?.toLowerCase().includes(searchQ.toLowerCase()))
    : conversations;

  const filteredUsers = searchQ.trim()
    ? allowedContacts.filter(u => u.FullName?.toLowerCase().includes(searchQ.toLowerCase()) || u.Email?.toLowerCase().includes(searchQ.toLowerCase()))
    : allowedContacts;

  return (
    <div style={{ padding: '0' }}>
      <div style={s.page}>
        {/* ═══ LEFT: Conversations List ═══ */}
        <div style={s.listPanel}>
          <div style={s.listHeader}>
            <span>Messages</span>
            <button style={s.newMsgBtn} onClick={() => setShowNewMsg(!showNewMsg)}>
              {showNewMsg ? '← Back' : '+ New'}
            </button>
          </div>
          <input
            type="text"
            placeholder={showNewMsg ? '🔍 Search users...' : '🔍 Search conversations...'}
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            style={s.listSearch}
          />
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {showNewMsg ? (
              /* New Message: User Picker */
              loadingContacts ? (
                <p style={{ padding: '1.5rem', color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.85rem' }}>
                  <i className="fa-solid fa-circle-notch fa-spin" /> Loading contacts...
                </p>
              ) : filteredUsers.length === 0 ? (
                <p style={{ padding: '1.5rem', color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.85rem' }}>
                  No contacts found
                </p>
              ) : filteredUsers.map(u => (
                <div
                  key={u._id}
                  style={s.convItem(false)}
                  onClick={() => startNewConversation(u._id)}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={s.convAvatar(false)}>
                    {(u.FullName || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={s.convName}>{u.FullName}</p>
                    <p style={s.convPreview(false)}>{u.role || 'User'}</p>
                  </div>
                </div>
              ))
            ) : (
              /* Existing Conversations */
              filteredConversations.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: '1.5rem', margin: '0 0 0.5rem' }}><i className="fa-solid fa-comment" /></p>
                  <p style={{ fontSize: '0.85rem' }}>No conversations yet</p>
                  <button style={{ ...s.newMsgBtn, marginTop: '0.75rem' }} onClick={() => setShowNewMsg(true)}>Start a conversation</button>
                </div>
              ) : filteredConversations.map(conv => {
                const isActive = conv.otherUserId === activeChat;
                const initials = (conv.fullName || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                return (
                  <div
                    key={conv.otherUserId}
                    style={s.convItem(isActive)}
                    onClick={() => selectConversation(conv.otherUserId)}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={s.convAvatar(isActive)}>{initials}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={s.convName}>{conv.fullName}</p>
                      <p style={s.convPreview(isActive)}>{conv.latestMessage || 'No messages yet'}</p>
                    </div>
                    {conv.unreadCount > 0 && <div style={s.unreadBadge}>{conv.unreadCount}</div>}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ═══ RIGHT: Chat Area ═══ */}
        <div style={s.chatPanel}>
          {!activeChat ? (
            <div style={s.emptyChat}>
              <span style={{ fontSize: '3rem' }}><i className="fa-solid fa-comment" /></span>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 400, margin: 0 }}>Select a conversation</h3>
              <p style={{ fontSize: '0.85rem' }}>Choose a conversation from the left or start a new one</p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div style={s.chatHeader}>
                <div style={s.convAvatar(false)}>{chatInitials}</div>
                <div>
                  <h3 style={s.chatHeaderName}>{chatName}</h3>
                </div>
                {chatRole && <span style={s.chatHeaderRole}>{chatRole}</span>}
              </div>

              {/* Messages */}
              <div style={s.msgArea}>
                {loadingMsgs ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.5rem 0' }} aria-hidden="true">
                    {[false, true, false, true, false].map((mine, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                        <Skeleton width={`${45 + (i % 3) * 12}%`} height="2.2rem" style={{ borderRadius: '14px', maxWidth: '70%' }} />
                      </div>
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ ...s.emptyChat, flex: 'unset', padding: '3rem 0' }}>
                    <span style={{ fontSize: '2rem' }}>👋</span>
                    <p style={{ fontSize: '0.9rem' }}>Start the conversation! Send a message below.</p>
                  </div>
                ) : (
                  messages.map(msg => {
                    const isMine = (msg.sender?._id || msg.sender) === user?._id;
                    return (
                      <div key={msg._id} style={s.msgRow(isMine)}>
                        <div style={s.bubble(isMine)}>{msg.content}</div>
                        <p style={s.bubbleTime(isMine)}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    );
                  })
                )}
                <div ref={msgEndRef} />
              </div>

              {/* Input */}
              <div style={s.inputBar}>
                <input
                  type="text"
                  value={msgInput}
                  onChange={e => setMsgInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  style={s.msgInput}
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !msgInput.trim()}
                  style={{ ...s.sendBtn, opacity: sending || !msgInput.trim() ? 0.6 : 1 }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translate(-2px, -2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                >
                  {sending ? '...' : <>Send <i className="fa-solid fa-paper-plane" style={{ marginLeft: '0.3rem' }} /></>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagesPage;
