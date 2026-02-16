/* 
  Zphs Nemmani Chat System v14.0 - THE PRECISE REPAIR
  - Real-time Sidebar User List
  - Fixed 'Add User' with Button Feedback
  - Enhanced Search Logic
  - Optimized for Render.com SSL
*/

console.log('Zphs Chat Engine v14.0 Starting...');

// --- 1. GLOBAL UI CONTROLS ---

window.openSingleModal = function () {
    const el = document.getElementById('single-modal');
    if (el) el.style.setProperty('display', 'flex', 'important');
    window.closeMenu();
};
window.closeSingleModal = function () {
    const el = document.getElementById('single-modal');
    if (el) el.style.display = 'none';
};
window.openBulkModal = function () {
    const el = document.getElementById('bulk-modal');
    if (el) el.style.setProperty('display', 'flex', 'important');
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

// --- SEARCH ENGINE ---
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
            msg.classList.add('bg-yellow-50');
        } else {
            msg.style.display = 'none';
        }
        if (!query) {
            msg.style.display = 'block';
            msg.classList.remove('bg-yellow-50');
        }
    });
};

// --- 2. MAIN CORE ---

(function () {
    const socket = io();
    const userData = localStorage.getItem('chatUser');
    if (!userData) { window.location.href = 'index.html'; return; }
    const user = JSON.parse(userData);
    const room = 'zphs-global';

    // PeerJS - Precise for Render HTTPS
    const peer = new Peer(undefined, {
        host: window.location.hostname,
        secure: true,
        port: 443,
        path: '/peerjs'
    });

    let activeStream = null;

    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM Ready v14.0');

        // Setup User Info
        document.getElementById('my-name').textContent = user.name;
        document.getElementById('my-avatar').src = `https://ui-avatars.com/api/?name=${user.name}`;

        // Join Room
        socket.emit('join-room', { userId: user.id, room: room });

        // Load History
        fetch(`/api/messages/${room}`).then(r => r.json()).then(msgs => {
            msgs.forEach(m => displayMessage(m, user.id));
            scrollDown();
        });

        // Load Sidebar Users
        loadSidebarUsers();

        // Emojis
        document.querySelectorAll('#emoji-panel span').forEach(span => {
            span.onclick = () => {
                const input = document.getElementById('msg-input');
                input.value += span.innerText;
                input.focus();
                document.getElementById('emoji-panel').classList.add('hidden');
                toggleSendBtn();
            };
        });

        // Mic Button
        let mediaRecorder;
        let audioChunks = [];
        const micBtn = document.getElementById('mic-btn');
        if (micBtn) {
            micBtn.onclick = async () => {
                if (micBtn.classList.contains('recording')) {
                    mediaRecorder.stop();
                    micBtn.classList.remove('recording', 'text-red-500', 'animate-pulse');
                } else {
                    try {
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        mediaRecorder = new MediaRecorder(stream);
                        audioChunks = [];
                        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
                        mediaRecorder.onstop = async () => {
                            const blob = new Blob(audioChunks, { type: 'audio/webm' });
                            const formData = new FormData();
                            formData.append('media', blob, 'voice.webm');
                            const res = await fetch('/api/upload', { method: 'POST', body: formData });
                            const d = await res.json();
                            if (d.url) socket.emit('send-message', { senderId: user.id, room, media: d.url, mediaType: 'audio' });
                        };
                        mediaRecorder.start();
                        micBtn.classList.add('recording', 'text-red-500', 'animate-pulse');
                    } catch (e) { alert('Mic access denied!'); }
                }
            };
        }
    });

    async function loadSidebarUsers() {
        try {
            const res = await fetch('/api/users');
            const users = await res.json();
            const list = document.getElementById('chat-list');
            if (!list) return;

            // Keep Global Item
            const globalHtml = list.firstElementChild.outerHTML;
            list.innerHTML = globalHtml;

            users.forEach(u => {
                if (u._id === user.id) return; // Skip me
                const item = document.createElement('div');
                item.className = 'chat-item';
                item.onclick = () => alert('Direct messaging coming soon! Use Global for now.');
                item.innerHTML = `
                    <img src="https://ui-avatars.com/api/?name=${u.displayName}\u0026background=random" class="avatar">
                    <div class="chat-info">
                        <div class="chat-name">${u.displayName}</div>
                        <div class="chat-last-msg">${u.phone.slice(0, 3)}****${u.phone.slice(-3)}</div>
                    </div>
                `;
                list.appendChild(item);
            });
        } catch (e) { console.error('Failed to load users'); }
    }

    // --- CALLING ENGINE ---
    window.startCall = function (type) {
        console.log('Initiating Call:', type);
        navigator.mediaDevices.getUserMedia({ video: type === 'video', audio: true }).then(stream => {
            activeStream = stream;
            document.getElementById('call-modal').style.setProperty('display', 'flex', 'important');
            document.getElementById('my-video').srcObject = stream;
            document.getElementById('my-video').play();
            socket.emit('call-user', { room: room, signalData: peer.id, from: user.id, name: user.name });
            alert('Calling Zphs Global Room...');
        }).catch(err => alert('Call failed: Camera/Mic permissions required.'));
    };

    socket.on('call-made', data => {
        if (data.from === user.id) return;
        if (confirm(`${data.name} is calling... Answer?`)) {
            navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
                activeStream = stream;
                document.getElementById('call-modal').style.setProperty('display', 'flex', 'important');
                document.getElementById('my-video').srcObject = stream;
                document.getElementById('my-video').play();
                const call = peer.call(data.signal, stream);
                call.on('stream', remoteStream => {
                    document.getElementById('remote-video').srcObject = remoteStream;
                    document.getElementById('remote-video').play();
                });
            });
        }
    });

    window.endCall = function () {
        if (activeStream) activeStream.getTracks().forEach(t => t.stop());
        document.getElementById('call-modal').style.display = 'none';
        activeStream = null;
    };

    // --- MESSAGING ---
    const msgInput = document.getElementById('msg-input');
    const sendBtn = document.getElementById('send-btn');
    const micBtnIcon = document.getElementById('mic-btn');

    function toggleSendBtn() {
        if (!msgInput || !sendBtn || !micBtnIcon) return;
        if (msgInput.value.trim().length \u003e 0) {
            sendBtn.classList.remove('hidden');
            micBtnIcon.classList.add('hidden');
        } else {
            sendBtn.classList.add('hidden');
            micBtnIcon.classList.remove('hidden');
        }
    }
    if (msgInput) msgInput.oninput = toggleSendBtn;

    window.sendMessage = function () {
        const content = msgInput.value.trim();
        if (content) {
            socket.emit('send-message', { senderId: user.id, content, room });
            msgInput.value = '';
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

        const isMe = (data.sender \u0026\u0026 (data.sender._id === myId || data.sender === myId));
        const div = document.createElement('div');
        div.id = `msg-${data._id}`;
        div.className = `message mb-4 p-3 rounded-lg max-w-[75%] shadow-sm ${isMe ? 'sent bg-green-200 ml-auto' : 'received bg-white mr-auto'}`;

        let html = '';
        if (data.sender \u0026\u0026!isMe) html += `\u003cdiv class="text-[10px] font-bold text-green-600 mb-1"\u003e${data.sender.displayName}\u003c/div\u003e`;
        if (data.content) html += `\u003cp class="text-sm text-black"\u003e${data.content}\u003c/p\u003e`;
        if (data.mediaType === 'audio') html += `\u003caudio controls src="${data.media}" class="w-48 mt-2 h-8"\u003e\u003c/audio\u003e`;

        const time = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        html += `\u003cdiv class="text-[9px] text-gray-500 text-right mt-1"\u003e${time}\u003c/div\u003e`;

        div.innerHTML = html;
        container.appendChild(div);
    }

    function scrollDown() {
        const c = document.getElementById('messages');
        if (c) c.scrollTop = c.scrollHeight;
    }

    // --- ADMIN REPAIR ---
    window.submitSingleAdd = async function () {
        const nameEl = document.getElementById('single-name');
        const phoneEl = document.getElementById('single-phone');
        const btn = document.querySelector('#single-modal button[onclick*="submit"]');

        const name = nameEl.value.trim();
        const phone = phoneEl.value.trim();

        if (!name || phone.length \u003c 10) return alert('Name and 10-digit Phone required');

        try {
            if (btn) { btn.innerText = 'SAVING...'; btn.disabled = true; }
            const res = await fetch('/api/users/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, phone })
            });
            const d = await res.json();
            if (d.success) {
                alert('SUCCESS! User added.');
                nameEl.value = '';
                phoneEl.value = '';
                window.closeSingleModal();
                loadSidebarUsers(); // Refresh sidebar!
            } else {
                alert(d.error || 'Server error');
            }
        } catch (e) {
            alert('Network Error: Check your connection');
        } finally {
            if (btn) { btn.innerText = 'Add User'; btn.disabled = false; }
        }
    };

    window.submitBulkImport = async function () {
        const textData = document.getElementById('bulk-text').value;
        const btn = document.querySelector('#bulk-modal button[onclick*="submit"]');

        try {
            if (btn) { btn.innerText = 'IMPORTING...'; btn.disabled = true; }
            const res = await fetch('/api/admin/bulk-import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ textData })
            });
            const d = await res.json();
            alert(d.message);
            window.closeBulkModal();
            loadSidebarUsers();
        } catch (e) { alert('Bulk error'); }
        finally { if (btn) { btn.innerText = 'Import Everything'; btn.disabled = false; } }
    };

})();
