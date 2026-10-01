// JARVIS 1.8 · Production Client Logic
// Connected to Groq Backend with Shared Persistent History & Multilingual Intelligence

document.addEventListener('DOMContentLoaded', () => {
  let activeChatId = null;
  let activeMode = 'chat'; // 'chat' | 'cowork'
  let cachedChats = [];
  let isSending = false;

  // DOM Elements
  const welcomeView = document.getElementById('welcome-view');
  const chatConversationView = document.getElementById('chat-conversation-view');
  const messagesContainer = document.getElementById('messages-container');
  const chatsList = document.getElementById('chats-list');
  const promptInput = document.getElementById('prompt-input');
  const dockedPromptInput = document.getElementById('docked-prompt-input');
  const btnSendTask = document.getElementById('btn-send-task');
  const btnDockedSend = document.getElementById('btn-docked-send');
  const btnNewChat = document.getElementById('btn-new-chat');
  const appSidebar = document.getElementById('app-sidebar');
  const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
  const greetingTitle = document.getElementById('greeting-title');
  const sidebarSearchBox = document.getElementById('sidebar-search-box');
  const chatSearchInput = document.getElementById('chat-search-input');
  const btnSearchChats = document.getElementById('btn-search-chats');

  // Dynamic Greeting based on time of day
  function updateGreeting() {
    const hour = new Date().getHours();
    let timeGreeting = "Evening";
    if (hour >= 5 && hour < 12) timeGreeting = "Morning";
    else if (hour >= 12 && hour < 17) timeGreeting = "Afternoon";
    if (greetingTitle) {
      greetingTitle.textContent = `${timeGreeting}, how are things?`;
    }
  }
  updateGreeting();

  // Load All Shared Chats from Server
  async function fetchHistory(filterText = '') {
    try {
      const res = await fetch('/api/history');
      if (!res.ok) throw new Error('Failed to load history');
      const data = await res.json();
      cachedChats = data.chats || [];
      renderChatsList(filterText);
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  }

  // Render Sidebar Chats List
  function renderChatsList(filterText = '') {
    if (!chatsList) return;
    chatsList.innerHTML = '';

    const filtered = cachedChats.filter(c => 
      c.title.toLowerCase().includes(filterText.toLowerCase())
    );

    if (filtered.length === 0) {
      const emptyItem = document.createElement('div');
      emptyItem.style.padding = '12px 14px';
      emptyItem.style.fontSize = '12.5px';
      emptyItem.style.color = 'var(--text-tertiary)';
      emptyItem.textContent = filterText ? 'No matching chats found' : 'No chats yet';
      chatsList.appendChild(emptyItem);
      return;
    }

    filtered.forEach(chat => {
      const item = document.createElement('div');
      item.className = `chat-history-item ${chat.id === activeChatId ? 'active' : ''}`;
      item.dataset.id = chat.id;
      item.innerHTML = `
        <span class="chat-item-bullet"></span>
        <span class="chat-item-title" title="${escapeHtml(chat.title)}">${escapeHtml(chat.title)}</span>
      `;
      item.addEventListener('click', () => loadChat(chat.id));
      chatsList.appendChild(item);
    });
  }

  // Load a Specific Chat
  async function loadChat(chatId) {
    try {
      const res = await fetch(`/api/chat/${chatId}`);
      if (!res.ok) throw new Error('Chat not found');
      const chat = await res.json();

      activeChatId = chatId;
      renderChatsList(chatSearchInput ? chatSearchInput.value : '');

      // Switch to conversation view
      welcomeView.style.display = 'none';
      chatConversationView.style.display = 'flex';
      messagesContainer.innerHTML = '';

      if (chat.messages && chat.messages.length > 0) {
        chat.messages.forEach(msg => {
          appendMessage(msg.role, msg.content, msg.time);
        });
      }

      scrollToBottom();
      if (dockedPromptInput) dockedPromptInput.focus();
    } catch (err) {
      console.error('Error loading chat:', err);
    }
  }

  // Append Message to Conversation UI
  function appendMessage(role, content, time = '') {
    const row = document.createElement('div');
    row.className = 'chat-message-row';

    const avatar = document.createElement('div');
    avatar.className = `chat-avatar ${role}`;
    if (role === 'user') {
      avatar.textContent = 'DS';
    } else {
      avatar.innerHTML = `<img src="jarvis_emblem.png" alt="JARVIS">`;
    }

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    const authorRow = document.createElement('div');
    authorRow.className = 'message-author';
    authorRow.style.display = 'flex';
    authorRow.style.alignItems = 'center';
    authorRow.style.justifyContent = 'space-between';

    const authorName = document.createElement('span');
    authorName.textContent = role === 'user' ? 'Dhairyashil' : 'JARVIS 1.8';
    authorRow.appendChild(authorName);

    if (time) {
      const timeStamp = document.createElement('span');
      timeStamp.style.fontSize = '11px';
      timeStamp.style.fontWeight = '400';
      timeStamp.style.color = 'var(--text-tertiary)';
      timeStamp.textContent = time;
      authorRow.appendChild(timeStamp);
    }

    const body = document.createElement('div');
    body.className = 'message-body';
    body.innerHTML = formatMarkdown(content);

    bubble.appendChild(authorRow);
    bubble.appendChild(body);

    row.appendChild(avatar);
    row.appendChild(bubble);
    messagesContainer.appendChild(row);

    scrollToBottom();
    return row;
  }

  // Append Thinking Indicator
  function appendThinkingIndicator() {
    const row = document.createElement('div');
    row.className = 'chat-message-row';
    row.id = 'thinking-indicator-row';

    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar assistant';
    avatar.innerHTML = `<img src="jarvis_emblem.png" alt="JARVIS">`;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    const author = document.createElement('div');
    author.className = 'message-author';
    author.textContent = 'JARVIS 1.8';

    const body = document.createElement('div');
    body.className = 'message-body';
    body.style.display = 'flex';
    body.style.alignItems = 'center';
    body.style.gap = '8px';
    body.style.color = 'var(--text-secondary)';
    body.innerHTML = `
      <span class="status-dot-pulse" style="width:7px; height:7px;"></span>
      <span>विचार करतोय... (Thinking)</span>
    `;

    bubble.appendChild(author);
    bubble.appendChild(body);

    row.appendChild(avatar);
    row.appendChild(bubble);
    messagesContainer.appendChild(row);

    scrollToBottom();
    return row;
  }

  function removeThinkingIndicator() {
    const el = document.getElementById('thinking-indicator-row');
    if (el) el.remove();
  }

  function scrollToBottom() {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.scrollTop = mainContent.scrollHeight;
    }
  }

  // Format Markdown (Code blocks, bold, lists, linebreaks)
  function formatMarkdown(text) {
    if (!text) return '';
    let escaped = escapeHtml(text);

    // Code blocks ```code```
    escaped = escaped.replace(/```([a-zA-Z0-9]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre style="background:var(--bg-secondary); border:1px solid var(--border-subtle); border-radius:8px; padding:12px; margin:10px 0; overflow-x:auto; font-family:var(--font-mono); font-size:12.5px; line-height:1.5;"><code>${code}</code></pre>`;
    });

    // Inline code `code`
    escaped = escaped.replace(/`([^`]+)`/g, '<code style="background:var(--bg-pill); color:var(--jarvis-navy); padding:2px 6px; border-radius:4px; font-family:var(--font-mono); font-size:12px;">$1</code>');

    // Bold **text**
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Italics *text*
    escaped = escaped.replace(/\*([^\*]+)\*/g, '<em>$1</em>');

    // Line breaks
    escaped = escaped.replace(/\n/g, '<br>');

    return escaped;
  }

  function escapeHtml(string) {
    return String(string)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Handle User Message Submission
  async function submitUserMessage(inputElement) {
    if (isSending || !inputElement) return;
    const text = inputElement.value.trim();
    if (!text) return;

    isSending = true;
    inputElement.value = '';

    // Switch to conversation view immediately if in welcome view
    if (welcomeView.style.display !== 'none') {
      welcomeView.style.display = 'none';
      chatConversationView.style.display = 'flex';
      messagesContainer.innerHTML = '';
    }

    // Display user message right away
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    appendMessage('user', text, nowTime);

    // Show thinking animation
    appendThinkingIndicator();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: activeChatId,
          message: text,
          mode: activeMode
        })
      });

      removeThinkingIndicator();

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const resData = await response.json();
      activeChatId = resData.chatId;

      // Append assistant's real human-like reply
      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      appendMessage('assistant', resData.reply, replyTime);

      // Refresh sidebar chat list to show updated or newly created chat title
      await fetchHistory(chatSearchInput ? chatSearchInput.value : '');

    } catch (err) {
      removeThinkingIndicator();
      appendMessage('assistant', `Arey bhau, kahi tari error aala connect kartana. Please check if backend is running. (${err.message})`);
    } finally {
      isSending = false;
      if (dockedPromptInput) dockedPromptInput.focus();
    }
  }

  // Event Listeners for Send Buttons & Enter Key
  if (btnSendTask) {
    btnSendTask.addEventListener('click', () => submitUserMessage(promptInput));
  }
  if (btnDockedSend) {
    btnDockedSend.addEventListener('click', () => submitUserMessage(dockedPromptInput));
  }

  if (promptInput) {
    promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitUserMessage(promptInput);
      }
    });
  }

  if (dockedPromptInput) {
    dockedPromptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitUserMessage(dockedPromptInput);
      }
    });
  }

  // + New Task Button: Start a fresh session
  if (btnNewChat) {
    btnNewChat.addEventListener('click', () => {
      activeChatId = null;
      renderChatsList(chatSearchInput ? chatSearchInput.value : '');
      welcomeView.style.display = 'flex';
      chatConversationView.style.display = 'none';
      if (promptInput) {
        promptInput.value = '';
        promptInput.focus();
      }
    });
  }

  // Mode Toggle (Chat / Cowork)
  document.querySelectorAll('.mode-pill-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.mode-pill-btn').forEach(b => b.classList.remove('active'));
      const mode = e.target.dataset.mode || 'chat';
      activeMode = mode;
      document.querySelectorAll(`[data-mode="${mode}"]`).forEach(b => b.classList.add('active'));
    });
  });

  // Sidebar Toggle (Hamburger Button & Ctrl+B)
  if (btnToggleSidebar) {
    btnToggleSidebar.addEventListener('click', toggleSidebar);
  }

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      toggleSidebar();
    }
  });

  function toggleSidebar() {
    if (appSidebar) {
      appSidebar.classList.toggle('collapsed');
    }
  }

  // Mobile Backdrop listener
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', () => {
      if (appSidebar) appSidebar.classList.add('collapsed');
    });
  }

  // Auto-close sidebar on mobile after choosing a chat
  const originalLoadChat = loadChat;
  loadChat = async function(chatId) {
    if (window.innerWidth <= 768 && appSidebar) {
      appSidebar.classList.add('collapsed');
    }
    return originalLoadChat(chatId);
  };

  // Search in Chats
  if (btnSearchChats && sidebarSearchBox) {
    btnSearchChats.addEventListener('click', () => {
      const isHidden = sidebarSearchBox.style.display === 'none';
      sidebarSearchBox.style.display = isHidden ? 'block' : 'none';
      if (isHidden && chatSearchInput) chatSearchInput.focus();
    });
  }

  if (chatSearchInput) {
    chatSearchInput.addEventListener('input', (e) => {
      renderChatsList(e.target.value);
    });
  }

  // Initialize: Load history on startup
  fetchHistory();
});
