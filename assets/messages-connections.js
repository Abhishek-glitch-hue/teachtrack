(() => {
  const token = sessionStorage.getItem('teachtrack_token');
  if (!token) return;
  const api = (path, options = {}) => {
    options.headers = Object.assign({ Authorization: 'Bearer ' + token }, options.headers || {});
    return fetch(window.TEACHTRACK_API_ORIGIN + '/api' + path, options);
  };
  const people = document.getElementById('peopleList');
  const area = document.getElementById('messageArea');
  const input = document.getElementById('messageInput');
  const send = document.getElementById('sendButton');
  const status = document.getElementById('chatStatus');
  const chatApp = document.querySelector('.chat-app');
  const chatHead = document.getElementById('chatHead');
  if (!people || !area || !input || !send || !chatApp) return;

  let me = null;
  let users = [];
  let selected = null;
  const requestButton = document.createElement('button');
  requestButton.type = 'button';
  requestButton.className = 'connection-action header-connection-action';
  requestButton.hidden = true;
  if (chatHead) chatHead.insertBefore(requestButton, document.getElementById('refreshButton'));
  const panel = document.createElement('section');
  panel.className = 'connection-panel';
  panel.innerHTML = '<section class="connection-card"><div class="connection-title">Friends</div><div id="friendList" class="connection-list"></div></section><section class="connection-card"><div class="connection-title">Pending requests</div><div id="pendingList" class="connection-list"></div></section>';
  chatApp.insertAdjacentElement('afterend', panel);
  const style = document.createElement('style');
  style.textContent = '.connection-panel{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;width:min(1556px,calc(100% - 36px));margin:0 auto 28px}.connection-card{min-height:150px;padding:18px;border:1px solid #e3ebed;border-radius:16px;background:#fff;box-shadow:0 16px 36px -30px rgba(21,51,61,.45)}.connection-title{margin:0 0 13px;color:#647b84;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.connection-list{display:grid;gap:8px}.connection-item{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0;padding:11px 12px;border:1px solid #e7edef;border-radius:11px;background:#fbfcfc;font-size:12px}.connection-person{display:flex;align-items:center;min-width:0;padding:0;border:0;background:transparent;color:inherit;font:inherit;cursor:pointer}.connection-person:hover .connection-name{text-decoration:underline}.connection-avatar{display:none}.connection-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}.connection-item button:not(.connection-person),.connection-action{border:1px solid #00777c;border-radius:8px;background:#00777c;color:#fff;padding:6px 9px;font:700 11px inherit;cursor:pointer}.connection-remove{background:transparent!important;color:#b42336!important;border-color:#efc5cc!important}.connection-empty{color:#718087;font-size:12px;padding:8px 0}html[data-theme="dark"] .connection-card{background:#202a30;border-color:#35434b}html[data-theme="dark"] .connection-item{background:#1a242a;border-color:#35434b;color:#f1f5f6}html[data-theme="dark"] .connection-remove{color:#f09aaa!important;border-color:#7b3a49!important}.connection-actions{display:flex;gap:8px;justify-content:center;align-items:center;min-height:100%;flex-direction:column}@media(max-width:720px){.connection-panel{grid-template-columns:1fr;width:calc(100% - 18px);margin-bottom:28px}.connection-card{min-height:150px}.connection-item{min-width:100%}}';
  document.head.appendChild(style);
  style.textContent += '.connection-reject{margin-left:6px!important;border-color:#efc5cc!important;background:transparent!important;color:#b42336!important}#pendingList .connection-item{justify-content:flex-start}#pendingList .connection-person{flex:1}html[data-theme="dark"] .connection-reject{border-color:#7b3a49!important;color:#f09aaa!important}.header-connection-action{margin-left:12px;white-space:nowrap}.header-connection-action:disabled{cursor:default;opacity:.7}';

  const nameFor = item => item.name || item.email;
  const initials = name => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  function renderRequestButton() {
    if (!requestButton || !selected || !me || me.role === 'ADMIN' || selected.role === 'ADMIN') {
      if (requestButton) requestButton.hidden = true;
      return;
    }
    requestButton.hidden = false;
    requestButton.disabled = false;
    requestButton.onclick = null;
    if (selected.connectionStatus === 'ACCEPTED') {
      requestButton.textContent = 'Friends';
      requestButton.disabled = true;
    } else if (selected.connectionStatus === 'OUTGOING') {
      requestButton.textContent = 'Request sent';
      requestButton.disabled = true;
    } else if (selected.connectionStatus === 'INCOMING') {
      requestButton.textContent = 'Accept request';
      requestButton.onclick = () => respond(selected, 'ACCEPTED');
    } else {
      requestButton.textContent = 'Send friend request';
      requestButton.onclick = () => request(selected);
    }
  }
  function openFriend(user) {
    const match = Array.from(people.querySelectorAll('.person')).find(button => button.querySelector('b')?.textContent === user.name);
    if (match) match.click();
  }
  async function load() {
    const [meResponse, usersResponse] = await Promise.all([api('/auth/me'), api('/messages/users')]);
    me = (await meResponse.json()).user;
    users = (await usersResponse.json()).users || [];
    renderPanel();
    addRejectButtons();
    if (selected) {
      selected = users.find(user => user.id === selected.id) || selected;
      renderRequestButton();
    }
  }
  function addRejectButtons() {
    users.filter(user => user.role === 'TEACHER' && user.connectionStatus === 'INCOMING').forEach(user => {
      const row = Array.from(document.querySelectorAll('#pendingList .connection-item')).find(item => item.querySelector('.connection-name')?.textContent.startsWith(nameFor(user)));
      if (!row || row.querySelector('.connection-reject')) return;
      const reject = document.createElement('button');
      reject.type = 'button';
      reject.className = 'connection-reject';
      reject.textContent = 'Reject';
      reject.onclick = () => respond(user, 'REJECTED');
      row.appendChild(reject);
    });
  }
  function renderPanel() {
    const friends = users.filter(user => user.role === 'TEACHER' && user.connectionStatus === 'ACCEPTED');
    const pending = users.filter(user => user.role === 'TEACHER' && (user.connectionStatus === 'INCOMING' || user.connectionStatus === 'OUTGOING'));
    const friendList = document.getElementById('friendList');
    friendList.innerHTML = friends.length ? '' : '<div class="connection-empty">No accepted friends yet.</div>';
    friends.forEach(user => { const row = document.createElement('div'); row.className = 'connection-item'; row.innerHTML = '<button type="button" class="connection-person"><span class="connection-avatar"></span><span class="connection-name"></span></button>'; row.querySelector('.connection-avatar').textContent = initials(nameFor(user)); row.querySelector('.connection-name').textContent = nameFor(user); row.querySelector('.connection-person').onclick = () => openFriend(user); const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'connection-remove'; remove.textContent = 'Remove'; remove.onclick = () => removeFriend(user); row.appendChild(remove); friendList.appendChild(row); });
    const pendingList = document.getElementById('pendingList');
    pendingList.innerHTML = pending.length ? '' : '<div class="connection-empty">No pending requests.</div>';
    pending.forEach(user => { const row = document.createElement('div'); row.className = 'connection-item'; row.innerHTML = '<span class="connection-person"><span class="connection-avatar"></span><span class="connection-name"></span></span>'; row.querySelector('.connection-avatar').textContent = initials(nameFor(user)); row.querySelector('.connection-name').textContent = nameFor(user) + (user.connectionStatus === 'OUTGOING' ? ' · sent' : ''); if (user.connectionStatus === 'INCOMING') { const accept = document.createElement('button'); accept.textContent = 'Accept'; accept.onclick = () => respond(user, 'ACCEPTED'); row.appendChild(accept); } pendingList.appendChild(row); });
  }
  async function respond(user, decision) {
    const response = await api('/messages/requests/' + user.connectionId, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: decision }) });
    if (!response.ok) { status.textContent = (await response.json()).message || 'Unable to update request.'; return; }
    await load();
    const updatedUser = users.find(item => item.id === user.id) || user;
    if (selected && selected.id === user.id) {
      selected = updatedUser;
      if (updatedUser.connectionStatus === 'ACCEPTED') {
        input.disabled = false;
        send.disabled = false;
        status.textContent = '';
        openFriend(updatedUser);
      } else showAccess(updatedUser);
    }
  }
  async function removeFriend(user) {
    if (!window.confirm('Remove ' + nameFor(user) + ' from your friends?')) return;
    const response = await api('/messages/requests/' + user.connectionId, { method: 'DELETE' });
    if (!response.ok) { status.textContent = (await response.json()).message || 'Unable to remove friend.'; return; }
    if (selected && selected.id === user.id) { input.disabled = true; send.disabled = true; status.textContent = 'Friend removed. Send a new request to message again.'; }
    await load();
  }
  async function request(user) {
    const response = await api('/messages/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipientId: user.id }) });
    const data = await response.json();
    status.textContent = response.ok ? 'Connection request sent.' : data.message || 'Unable to send request.';
    await load();
    selected = users.find(item => item.id === user.id) || user;
    renderRequestButton();
    showAccess(selected);
  }
  function showAccess(user) {
    if (!me || me.role === 'ADMIN' || user.role === 'ADMIN' || user.connectionStatus === 'ACCEPTED') return;
    input.disabled = true; send.disabled = true;
    area.innerHTML = '<p class="empty">You need to be friends in order to chat.</p>';
  }
  people.addEventListener('click', event => { const button = event.target.closest('.person'); if (!button) return; const name = button.querySelector('b')?.textContent; selected = users.find(user => user.name === name); if (selected) setTimeout(() => { renderRequestButton(); showAccess(selected); }, 80); }, true);
  load().catch(() => {});
  if (window.io) { const socket = window.io(window.TEACHTRACK_API_ORIGIN, { auth: { token } }); socket.on('message:connection-request', load); socket.on('message:connection-updated', load); }
})();
