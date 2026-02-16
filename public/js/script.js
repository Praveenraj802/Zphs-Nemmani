/* 
  Zphs Nemmani Chat System v15.0 - THE EMERGENCY CACHE-BREAKER
  - Fixed PeerJS for both Local and Render.com
  - Aggressive Interaction Fixes
  - Added "Boot Success" Notification
*/

console.log('%c Zphs Chat v15.0 Booting... ', 'background: #059669; color: #fff; font-weight: bold;');

// --- 1. ABSOLUTE GLOBAL UI (Outside IIFE to ensure availability) ---

window.openSingleModal = function () {
    console.log('UI: Opening Add Single Modal');
    const el = document.getElementById('single-modal');
    if (el) {
        el.style.setProperty('display', 'flex', 'important');
        el.classList.remove('hidden');
        el.style.zIndex = "20000";
    }
    window.closeMenu();
};

window.closeSingleModal = function () {
    const el = document.getElementById('single-modal');
    if (el) el.style.display = 'none';
};

window.openBulkModal = function () {
    const el = document.getElementById('bulk-modal');
    if (el) {
        el.style.setProperty('display', 'flex', 'important');
        el.classList.remove('hidden');
        el.style.zIndex = "20000";
    }
    window.closeMenu();
};

window.closeBulkModal = function () {
    const el = document.getElementById('bulk-modal');
    if (el) el.style.display = 'none';
};

window.toggleMenu = function (e) {
    if (e) e.stopPropagation();
    const el = document.getElementById('header-menu');
    if (el) {
        const isHidden = (el.style.display === 'none' || el.classList.contains('hidden'));
        el.style.display = isHidden ? 'block' : 'none';
        el.classList.remove('hidden');
    }
};

window.closeMenu = function () {
    const el = document.getElementById('header-menu');
    if (el) el.style.display = 'none';
};

window.toggleEmojiPanel = function (e) {
    if (e) e.stopPropagation();
    const el = document.getElementById('emoji-panel');
    if (el) el.classList.toggle('hidden');
};

window.toggleSearch = function (e) {
    if (e) e.stopPropagation();
    const container = document.getElementById('msg-search-container');
    if (container) {
        container.classList.toggle('hidden');
        if (!container.classList.contains('hidden')) {
            document.getElementById('msg-search-input').focus();
        }
    }
};

window.searchMessages = function () {
    const query = document.getElementById('msg-search-input').value.toLowerCase();
    const messages = document.querySelectorAll('#messages .message');
    messages.forEach(msg => {
        const text = msg.innerText.toLowerCase();
        if (text.includes(query)) {
            msg.style.display = 'block';
            msg.style.backgroundColor = '#fef3c7'; // Light yellow
        } else {
            msg.style.display = 'none';
        }
        if (!query) {
            msg.style.display = 'block';
            msg.style.backgroundColor = '';
        }
    });
};

// --- 2. THE CORE ENGINE ---

(function () {
    const socket = io();
    const userData = localStorage.getItem('chatUser');
    if (!userData) {
        console.warn('Auth: No user found, redirecting to login');
        window.location.href = 'index.html';
        return;
    }
    const user = JSON.parse(userData);
    const room = 'zphs-global';

    // PeerJS - Smart Configuration for Local vs Cloud
    const isSSL = window.location.protocol === 'https:';
    const peer = new Peer(undefined, {
        host: window.location.hostname,
        secure: isSSL,
        port: isSSL ? 443 : parseInt(window.location.port) || 3010,
        path: '/peerjs'
    });

    let activeStream = null;

    document.addEventListener('DOMContentLoaded', () => {
        console.info('Core: DOM Fully Loaded v15.0');

        // UI Init
        const nameDisplay = document.getElementById('my-name');
        const avatarDisplay = document.getElementById('my-avatar');
        if (nameDisplay) nameDisplay.textContent = user.name;
        if (avatarDisplay) avatarDisplay.src = `https://ui-avatars.com/api/?name=${user.name}`;

        socket.emit('join-room', { userId: user.id, room: room });

        // Load Initial Data
        fetchMessages();
        loadSidebarUsers();

        // Emoji Handlers
        document.querySelectorAll('#emoji-panel span').forEach(span => {
            span.onclick = () => {
                const input = document.getElementById('msg-input');
                if (input) {
                    input.value += span.innerText;
                    input.focus();
                    toggleSendBtn();
                }
                document.getElementById('emoji-panel').classList.add('hidden');
            };
        });

        // Initialize Chat Controls
        setupMessaging();
    });

    async function fetchMessages() {
        try {
            const r = await fetch(`/api/messages/${room}`);
            const msgs = await r.json();
            const container = document.getElementById('messages');
            if (container) container.innerHTML = ''; // Clear
            msgs.forEach(m => displayMessage(m, user.id));
            scrollDown();
        } catch (e) { console.error('Data: Failed to fetch history'); }
    }

    async function loadSidebarUsers() {
        try {
            const res = await fetch('/api/users');
            const users = await res.json();
            const list = document.getElementById('chat-list');
            if (!list) return;

            const firstNode = list.querySelector('.chat-item');
            list.innerHTML = '';
            if (firstNode) list.appendChild(firstNode); // Keep Global

            users.forEach(u => {
                if (u._id === user.id) return;
                const item = document.createElement('div');
                item.className = 'chat-item';
                item.onclick = () => alert('Direct messages coming in next update!');
                item.innerHTML = `
                    <img src="https://ui-avatars.com/api/?name=${u.displayName}&background=random" class="avatar">
                    <div class="chat-info">
                        <div class="chat-name">${u.displayName}</div>
                        <div class="chat-last-msg">${u.phone.slice(0, 3)}****${u.phone.slice(-3)}</div>
                    </div>
                `;
                list.appendChild(item);
            });
        } catch (e) { console.error('Data: Failed to load users'); }
    }

    function setupMessaging() {
        const input = document.getElementById('msg-input');
        if (input) input.oninput = toggleSendBtn;
    }

    function toggleSendBtn() {
        const input = document.getElementById('msg-input');
        const sendBtn = document.getElementById('send-btn');
        const micIcon = document.getElementById('mic-btn');
        if (!input || !sendBtn || !micIcon) return;

        if (input.value.trim().length > 0) {
            sendBtn.classList.remove('hidden');
            micIcon.classList.add('hidden');
        } else {
            sendBtn.classList.add('hidden');
            micIcon.classList.remove('hidden');
        }
    }

    window.sendMessage = function () {
        const input = document.getElementById('msg-input');
        if (!input) return;
        const content = input.value.trim();
        if (content) {
            socket.emit('send-message', { senderId: user.id, content, room });
            input.value = '';
            toggleSendBtn();
        }
    };

    window.handleTyping = function (e) {
        if (e.key === 'Enter') { e.preventDefault(); window.sendMessage(); }
    };

    socket.on('receive-message', data => {
        displayMessage(data, user.id);
        scrollDown();
    });

    function displayMessage(data, myId) {
        if (!data || document.getElementById(`msg-${data._id}`)) return;
        const container = document.getElementById('messages');
        if (!container) return;

        const isMe = (data.sender && (data.sender._id === myId || data.sender === myId));
        const div = document.createElement('div');
        div.id = `msg-${data._id}`;
        div.className = `message mb-4 p-3 rounded-lg max-w-[75%] shadow-sm ${isMe ? 'sent bg-green-200 ml-auto' : 'received bg-white mr-auto text-black'}`;

        let html = '';
        if (data.sender && !isMe) {
            const name = data.sender.displayName || 'Friend';
            html += `<div class="text-[10px] font-bold text-green-700 mb-1">${name}</div>`;
        }

        if (data.content) html += `<p class="text-sm">${data.content}</p>`;
        if (data.mediaType === 'audio') html += `<audio controls src="${data.media}" class="w-48 mt-2 h-8"></audio>`;

        const time = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        html += `<div class="text-[9px] text-gray-400 text-right mt-1">${time}</div>`;

        div.innerHTML = html;
        container.appendChild(div);
    }

    function scrollDown() {
        const c = document.getElementById('messages');
        if (c) c.scrollTop = c.scrollHeight;
    }

    // --- CALLS ---
    window.startCall = function (type) {
        console.log('Call: Starting', type);
        navigator.mediaDevices.getUserMedia({ video: type === 'video', audio: true }).then(stream => {
            activeStream = stream;
            document.getElementById('call-modal').style.setProperty('display', 'flex', 'important');
            const v = document.getElementById('my-video');
            v.srcObject = stream;
            v.play();
            socket.emit('call-user', { room: room, signalData: peer.id, from: user.id, name: user.name });
        }).catch(err => alert('Media Error: Please allow camera/mic access in browser settings.'));
    };

    socket.on('call-made', data => {
        if (data.from === user.id) return;
        if (confirm(`${data.name} is calling you. Answer?`)) {
            navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
                activeStream = stream;
                document.getElementById('call-modal').style.setProperty('display', 'flex', 'important');
                document.getElementById('my-video').srcObject = stream;
                document.getElementById('my-video').play();
                const call = peer.call(data.signal, stream);
                call.on('stream', rs => {
                    const rv = document.getElementById('remote-video');
                    rv.srcObject = rs;
                    rv.play();
                });
            });
        }
    });

    window.endCall = function () {
        if (activeStream) activeStream.getTracks().forEach(t => t.stop());
        document.getElementById('call-modal').style.display = 'none';
        activeStream = null;
    };

    // --- FORM SUBMISSIONS ---
    window.submitSingleAdd = async function () {
        const name = document.getElementById('single-name').value.trim();
        const phone = document.getElementById('single-phone').value.trim();
        const btn = document.querySelector('#single-modal button[onclick*="submit"]');

        if (!name || phone.length < 10) return alert('Error: Name and 10-digit number required.');

        try {
            if (btn) { btn.innerText = 'SAVING...'; btn.disabled = true; }
            const res = await fetch('/api/users/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, phone })
            });
            const d = await res.json();
            if (d.success) {
                alert('Success: User Added!');
                window.closeSingleModal();
                loadSidebarUsers();
            } else {
                alert(d.error || 'Could not add user.');
            }
        } catch (e) { alert('Network error. Check server.'); }
        finally { if (btn) { btn.innerText = 'Add User'; btn.disabled = false; } }
    };

    window.submitBulkImport = async function () {
        const text = document.getElementById('bulk-text').value;
        const btn = document.querySelector('#bulk-modal button[onclick*="submit"]');
        if (!text) return alert('Paste something first!');

        try {
            if (btn) { btn.innerText = 'IMPORTING...'; btn.disabled = true; }
            const res = await fetch('/api/admin/bulk-import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ textData: text })
            });
            const d = await res.json();
            alert(`Result: ${d.message}`);
            window.closeBulkModal();
            loadSidebarUsers();
        } catch (e) { alert('Bulk error'); }
        finally { if (btn) { btn.innerText = 'Import Everything'; btn.disabled = false; } }
    };

})();
