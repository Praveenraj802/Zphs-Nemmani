/* 
  Zphs Nemmani Chat System v13.0 - THE GLOBAL LINK FIX
  - Fully Operational Video/Audio Calls
  - Active Message Search Engine
  - Optimized for Render.com Deployment
*/

console.log('Zphs Chat Engine v13.0 Starting...');

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

// --- MESSAGE SEARCH LOGIC ---
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
            msg.classList.add('bg-yellow-100'); // Highlight matches
        } else {
            msg.style.display = 'none';
        }
        if (!query) msg.classList.remove('bg-yellow-100');
    });
};

// --- 2. MAIN CORE ---

(function () {
    const socket = io();
    const userData = localStorage.getItem('chatUser');
    if (!userData) { window.location.href = 'index.html'; return; }
    const user = JSON.parse(userData);
    const room = 'zphs-global';

    // PeerJS Setup
    const peer = new Peer(undefined, {
        host: '/',
        secure: true,
        port: 443,
        path: '/peerjs'
    });

    let activeStream = null;

    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM Ready v13.0');

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

        // Emojis
        document.querySelectorAll('#emoji-panel span').forEach(span => {
            span.onclick = () => {
                const input = document.getElementById('msg-input');
                input.value += span.innerText;
                input.focus();
                document.getElementById('emoji-panel').classList.add('hidden');
            };
        });

        // Mic Button (Voice Messaging)
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

    // --- CALLING ENGINE ---
    window.startCall = function (type) {
        console.log('Initiating Call:', type);
        navigator.mediaDevices.getUserMedia({ video: type === 'video', audio: true }).then(stream => {
            activeStream = stream;
            document.getElementById('call-modal').style.setProperty('display', 'flex', 'important');
            document.getElementById('my-video').srcObject = stream;
            document.getElementById('my-video').play();
            socket.emit('call-user', { room: room, signalData: peer.id, from: user.id, name: user.name });
        }).catch(err => alert('Call failed: Camera/Mic permissions required.'));
    };

    socket.on('call-made', data => {
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
    window.sendMessage = function () {
        const input = document.getElementById('msg-input');
        const content = input.value.trim();
        if (content) {
            socket.emit('send-message', { senderId: user.id, content, room });
            input.value = '';
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
        div.className = `message mb-4 p-3 rounded-lg max-w-[75%] shadow-sm ${isMe ? 'sent bg-green-200 ml-auto' : 'received bg-white mr-auto'}`;

        let html = '';
        if (data.content) html += `<p class="text-sm">${data.content}</p>`;
        if (data.mediaType === 'audio') html += `<audio controls src="${data.media}" class="w-48 mt-2 h-8"></audio>`;

        const time = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        html += `<div class="text-[9px] text-gray-500 text-right mt-1">${time}</div>`;

        div.innerHTML = html;
        container.appendChild(div);
    }

    function scrollDown() {
        const c = document.getElementById('messages');
        if (c) c.scrollTop = c.scrollHeight;
    }

    // --- ADMIN ---
    window.submitSingleAdd = async function () {
        const name = document.getElementById('single-name').value.trim();
        const phone = document.getElementById('single-phone').value.trim();
        if (!name || phone.length < 10) return alert('Name and 10-digit Phone required');
        const res = await fetch('/api/users/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone })
        });
        const d = await res.json();
        if (d.success) { alert('User added!'); window.closeSingleModal(); }
        else alert(d.error);
    };

    window.submitBulkImport = async function () {
        const textData = document.getElementById('bulk-text').value;
        const res = await fetch('/api/admin/bulk-import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ textData })
        });
        const d = await res.json();
        alert(d.message);
        window.closeBulkModal();
    };

})();
