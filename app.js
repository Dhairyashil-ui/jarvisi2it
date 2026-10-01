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

  // Screen View Switchers (Ensures Welcome & Chat views are NEVER shown together)
  function showWelcomeView() {
    if (welcomeView) {
      welcomeView.classList.remove('hidden');
      welcomeView.style.display = 'flex';
    }
    if (chatConversationView) {
      chatConversationView.classList.remove('active');
      chatConversationView.style.display = 'none';
    }
  }

  function showChatView() {
    if (welcomeView) {
      welcomeView.classList.add('hidden');
      welcomeView.style.display = 'none';
    }
    if (chatConversationView) {
      chatConversationView.classList.add('active');
      chatConversationView.style.display = 'flex';
    }
  }

  // Ensure initial view is strictly welcome screen
  showWelcomeView();

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
        <button class="chat-item-delete-btn" title="Delete chat" data-id="${chat.id}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      `;
      
      item.addEventListener('click', (e) => {
        if (e.target.closest('.chat-item-delete-btn')) return;
        loadChat(chat.id);
      });

      const delBtn = item.querySelector('.chat-item-delete-btn');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          promptDeleteChat(chat.id, chat.title);
        });
      }

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
      showChatView();
      messagesContainer.innerHTML = '';

      // Update Chat View Header with Chat Title and Version
      const currentChatTitleEl = document.getElementById('current-chat-title');
      if (currentChatTitleEl) {
        currentChatTitleEl.textContent = chat.title || 'Conversation';
        currentChatTitleEl.title = chat.title || 'Conversation';
      }
      const currentChatVersionTagEl = document.getElementById('current-chat-version-tag');
      if (currentChatVersionTagEl) {
        currentChatVersionTagEl.textContent = 'JARVIS 1.2';
      }

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
    authorName.textContent = role === 'user' ? 'Dhairyashil' : 'JARVIS 1.2';
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
    author.textContent = 'JARVIS 1.2';

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
    const messagesContainer = document.getElementById('messages-container');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
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
    inputElement.style.height = '';

    // Switch to conversation view immediately if in welcome view
    if (welcomeView && !welcomeView.classList.contains('hidden')) {
      showChatView();
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

  // Auto-resize textarea helper
  function autoResizeTextarea(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 110) + 'px';
  }

  // Event Listeners for Send Buttons & Enter Key
  if (btnSendTask) {
    btnSendTask.addEventListener('click', () => submitUserMessage(promptInput));
  }
  if (btnDockedSend) {
    btnDockedSend.addEventListener('click', () => submitUserMessage(dockedPromptInput));
  }

  if (promptInput) {
    promptInput.addEventListener('input', () => autoResizeTextarea(promptInput));
    promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitUserMessage(promptInput);
      }
    });
  }

  if (dockedPromptInput) {
    dockedPromptInput.addEventListener('input', () => autoResizeTextarea(dockedPromptInput));
    dockedPromptInput.addEventListener('focus', () => {
      setTimeout(() => {
        scrollToBottom();
        dockedPromptInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 250);
    });
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
      showWelcomeView();
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

  // ==========================================================================
  // Model Selector Options (1.2 through 1.8)
  // ==========================================================================

  const JARVIS_MODELS = [
    {
      version: '1.2',
      name: 'JARVIS 1.2',
      active: true,
      status: 'Active · Ready',
      statusClass: 'model-badge-active',
      desc: 'Current operational core. Production-grade Marathi, Hindi, and English multilingual conversational intelligence.'
    },
    {
      version: '1.3',
      name: 'JARVIS 1.3',
      active: false,
      status: 'In developing stage · Coming soon',
      statusClass: 'model-badge-dev',
      desc: 'Autonomous coding agent loop & terminal toolchain execution.'
    },
    {
      version: '1.4',
      name: 'JARVIS 1.4',
      active: false,
      status: 'In developing stage · Coming soon',
      statusClass: 'model-badge-dev',
      desc: 'Multimodal vision reasoning & real-time canvas diagram analysis.'
    },
    {
      version: '1.5',
      name: 'JARVIS 1.5',
      active: false,
      status: 'In developing stage · Coming soon',
      statusClass: 'model-badge-dev',
      desc: 'Extended 1M token context engine with deep repository-scale intelligence.'
    },
    {
      version: '1.6',
      name: 'JARVIS 1.6',
      active: false,
      status: 'In developing stage · Coming soon',
      statusClass: 'model-badge-dev',
      desc: 'Self-evolving neural memory bank & cross-project synapsing.'
    },
    {
      version: '1.7',
      name: 'JARVIS 1.7',
      active: false,
      status: 'In developing stage · Coming soon',
      statusClass: 'model-badge-dev',
      desc: 'Real-time bidirectional speech & voice synthesis loop.'
    },
    {
      version: '1.8',
      name: 'JARVIS 1.8',
      active: false,
      status: 'In developing stage · Coming soon',
      statusClass: 'model-badge-dev',
      desc: 'Full autonomous AGI operating system orchestrator.'
    }
  ];

  function renderModelOptions() {
    const list = document.getElementById('model-options-list');
    if (!list) return;
    list.innerHTML = '';

    JARVIS_MODELS.forEach(m => {
      const card = document.createElement('div');
      card.className = `model-option-card ${m.active ? 'active' : ''}`;
      card.innerHTML = `
        <div class="model-option-left">
          <div class="model-title-row">
            <span class="model-title-text">${m.name}</span>
            <span class="${m.statusClass}">${m.status}</span>
          </div>
          <p class="model-desc-text">${m.desc}</p>
        </div>
        <div class="model-option-status-icon">
          ${m.active ? `
            <svg class="model-check-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          ` : `
            <svg class="model-lock-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          `}
        </div>
      `;

      card.addEventListener('click', () => {
        if (m.active) {
          closeModal('modal-model-selector');
          showToast(`✅ ${m.name} is your active model and fully operational.`, 'success');
        } else {
          showToast(`⚠️ ${m.name} is in developing stage — Coming soon! Staying on JARVIS 1.2.`, 'warning', 4500);
        }
      });

      list.appendChild(card);
    });
  }

  function openModelSelector() {
    renderModelOptions();
    openModal('modal-model-selector');
  }

  const btnModelSelector = document.getElementById('btn-model-selector');
  const btnDockedModelSelector = document.getElementById('btn-docked-model-selector');
  if (btnModelSelector) {
    btnModelSelector.addEventListener('click', openModelSelector);
  }
  if (btnDockedModelSelector) {
    btnDockedModelSelector.addEventListener('click', openModelSelector);
  }

  // ==========================================================================
  // Chat Deletion Logic (Deletable Chat Window & Sidebar Items)
  // ==========================================================================

  let pendingDeleteChatId = null;

  function promptDeleteChat(chatId, title = '') {
    pendingDeleteChatId = chatId;
    const confirmText = document.getElementById('delete-confirm-text');
    if (confirmText) {
      confirmText.textContent = title 
        ? `Are you sure you want to delete "${title}"? All conversation messages will be permanently removed.`
        : `Are you sure you want to delete this conversation? All messages will be permanently removed.`;
    }
    openModal('modal-delete-confirm');
  }

  const btnDeleteCurrentChat = document.getElementById('btn-delete-current-chat');
  const btnConfirmDelete = document.getElementById('btn-confirm-delete');
  const btnCancelDelete = document.getElementById('btn-cancel-delete');

  if (btnDeleteCurrentChat) {
    btnDeleteCurrentChat.addEventListener('click', () => {
      if (!activeChatId) return;
      const currentChat = cachedChats.find(c => c.id === activeChatId);
      promptDeleteChat(activeChatId, currentChat ? currentChat.title : '');
    });
  }

  if (btnCancelDelete) {
    btnCancelDelete.addEventListener('click', () => {
      pendingDeleteChatId = null;
      closeModal('modal-delete-confirm');
    });
  }

  if (btnConfirmDelete) {
    btnConfirmDelete.addEventListener('click', async () => {
      const chatIdToDelete = pendingDeleteChatId;
      closeModal('modal-delete-confirm');
      pendingDeleteChatId = null;

      if (!chatIdToDelete) return;

      try {
        const res = await fetch(`/api/chat/${chatIdToDelete}`, {
          method: 'DELETE'
        });
        if (!res.ok) throw new Error('Failed to delete chat');

        showToast('Chat conversation deleted successfully.', 'success');

        // If the currently open chat was deleted, switch back to welcome dashboard
        if (activeChatId === chatIdToDelete) {
          activeChatId = null;
          showWelcomeView();
          if (promptInput) {
            promptInput.value = '';
            promptInput.focus();
          }
        }

        // Refresh sidebar chat list
        await fetchHistory(chatSearchInput ? chatSearchInput.value : '');
      } catch (err) {
        showToast(`Failed to delete chat: ${err.message}`, 'danger');
      }
    });
  }

  // ==========================================================================
  // Modal Helpers
  // ==========================================================================

  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('open');
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('open');
  }

  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.dataset.modal || btn.closest('.modal-backdrop').id;
      closeModal(modalId);
    });
  });

  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.classList.remove('open');
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.open').forEach(m => m.classList.remove('open'));
    }
  });

  // Sidebar Modal triggers
  const btnOpenProjects = document.getElementById('btn-open-projects');
  if (btnOpenProjects) {
    btnOpenProjects.addEventListener('click', () => openModal('modal-projects'));
  }

  const btnOpenArtifacts = document.getElementById('btn-open-artifacts');
  if (btnOpenArtifacts) {
    btnOpenArtifacts.addEventListener('click', () => {
      showToast('Artifacts workspace is synchronized with active session.', 'info');
    });
  }

  const btnOpenCustomize = document.getElementById('btn-open-customize');
  if (btnOpenCustomize) {
    btnOpenCustomize.addEventListener('click', openModelSelector);
  }

  const btnProfileGhost = document.getElementById('btn-profile-ghost');
  const userProfileMenuBtn = document.getElementById('user-profile-menu-btn');
  if (btnProfileGhost) {
    btnProfileGhost.addEventListener('click', () => openModal('modal-memory'));
  }
  if (userProfileMenuBtn) {
    userProfileMenuBtn.addEventListener('click', () => openModal('modal-memory'));
  }

  // ==========================================================================
  // Toast Notifications Helper
  // ==========================================================================

  function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;
    let iconSvg = '';
    if (type === 'warning') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    } else if (type === 'success') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    } else if (type === 'danger') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
    } else {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }
    toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-hide');
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  // Initialize: Load history on startup
  fetchHistory();
});
