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

window.leaveChat = async function () {
    if (!confirm('Are you sure? This will delete your account and history!')) return;
    const userData = localStorage.getItem('chatUser');
    if (!userData) return window.location.href = 'index.html';
    const user = JSON.parse(userData);

    try {
        await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
        localStorage.removeItem('chatUser');
        window.location.href = 'index.html';
    } catch (e) { alert('Failed to leave'); }
};

window.clearChat = async function () {
    if (!confirm('Clear all messages in this room?')) return;
    const room = 'zphs-global'; // Hardcoded for now as per current setup
    try {
        const res = await fetch(`/api/messages/room/${room}`, { method: 'DELETE' });
        const d = await res.json();
        if (d.success) {
            document.getElementById('messages').innerHTML = '';
            window.closeMenu();
        }
    } catch (e) { alert('Clear failed'); }
};

window.filterChatList = function () {
    const query = document.getElementById('sidebar-search').value.toLowerCase();
    const items = document.querySelectorAll('#chat-list .chat-item');
    items.forEach(item => {
        const name = item.querySelector('.chat-name').innerText.toLowerCase();
        item.style.display = name.includes(query) ? 'flex' : 'none';
    });
};

window.switchRoom = function (newRoom) {
    console.log('Switching to room:', newRoom);
    // Currently only supporting global, but we can refresh messages
    location.reload();
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
        setupMediaHandlers();
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

        const micBtn = document.getElementById('mic-btn');
        if (micBtn) micBtn.onclick = toggleRecording;
    }

    function setupMediaHandlers() {
        window.uploadFile = async function () {
            const fileInput = document.getElementById('file-input');
            if (!fileInput || !fileInput.files.length) return;

            const file = fileInput.files[0];
            const formData = new FormData();
            formData.append('media', file);

            try {
                const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (data.url) {
                    socket.emit('send-message', {
                        senderId: user.id,
                        content: '',
                        media: data.url,
                        mediaType: data.type,
                        room
                    });
                }
            } catch (e) {
                console.error('Upload failed:', e);
                alert('File upload failed.');
            }
        };
    }

    let mediaRecorder;
    let audioChunks = [];
    let isRecording = false;
    let recordingTimer;
    let startTime;

    async function toggleRecording() {
        const micBtn = document.getElementById('mic-btn');
        const input = document.getElementById('msg-input');

        if (!isRecording) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

                // Determine supported MIME type
                const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' :
                    MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/ogg';

                mediaRecorder = new MediaRecorder(stream, { mimeType });
                audioChunks = [];

                mediaRecorder.ondataavailable = e => {
                    if (e.data.size > 0) audioChunks.push(e.data);
                };

                mediaRecorder.onstop = async () => {
                    if (audioChunks.length === 0) return;

                    const audioBlob = new Blob(audioChunks, { type: mimeType });
                    const extension = mimeType.split('/')[1].split(';')[0];
                    const file = new File([audioBlob], `voice-${Date.now()}.${extension}`, { type: mimeType });

                    const formData = new FormData();
                    formData.append('media', file);

                    try {
                        const res = await fetch('/api/upload', { method: 'POST', body: formData });
                        const data = await res.json();
                        if (data.url) {
                            socket.emit('send-message', {
                                senderId: user.id,
                                content: '',
                                media: data.url,
                                mediaType: 'audio',
                                room
                            });
                        }
                    } catch (e) {
                        console.error('Voice upload failed', e);
                        alert('Could not send voice message. Server error.');
                    }

                    stream.getTracks().forEach(t => t.stop());
                };

                mediaRecorder.start();
                isRecording = true;
                startTime = Date.now();
                micBtn.classList.add('text-red-500', 'animate-pulse');
                if (input) input.placeholder = "Recording... Click mic to stop";

                // Safety timeout (max 2 mins)
                recordingTimer = setTimeout(() => { if (isRecording) toggleRecording(); }, 120000);

            } catch (e) {
                console.error('Mic error:', e);
                alert('Microphone error: ' + (e.name === 'NotAllowedError' ? 'Permission Denied' : e.message));
            }
        } else {
            clearTimeout(recordingTimer);
            if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
            isRecording = false;
            micBtn.classList.remove('text-red-500', 'animate-pulse');
            if (input) input.placeholder = "Type a message";
        }
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

    socket.on('message-deleted', msgId => {
        const el = document.getElementById(`msg-${msgId}`);
        if (el) el.remove();
    });

    socket.on('user-deleted', userId => {
        // Refresh sidebar to remove deleted user
        loadSidebarUsers();
    });

    function displayMessage(data, myId) {
        if (!data || document.getElementById(`msg-${data._id}`)) return;
        const container = document.getElementById('messages');
        if (!container) return;

        const isMe = (data.sender && (data.sender._id === myId || data.sender === myId));
        const senderId = data.sender?._id || data.sender;
        const senderName = data.sender?.displayName || (isMe ? user.name : 'Friend');

        const div = document.createElement('div');
        div.id = `msg-${data._id}`;
        div.className = `message mb-4 p-3 rounded-lg max-w-[75%] shadow-sm ${isMe ? 'sent bg-green-200 ml-auto' : 'received bg-white mr-auto text-black'}`;

        let html = '';
        // Dropdown Toggle Button
        html += `<div class="msg-options-btn" onclick="toggleMsgDropdown(event, '${data._id}')">
                    <i class="fas fa-chevron-down"></i>
                 </div>`;

        // Dropdown Menu
        html += `<div id="dropdown-${data._id}" class="msg-dropdown">
                    <div onclick="copyMsg('${data._id}', '${data.content || ''}', '${data.media || ''}')"><i class="fas fa-copy"></i> Copy</div>
                    <div onclick="infoMsg('${data._id}', '${senderName}', '${data.timestamp}')"><i class="fas fa-info-circle"></i> Info</div>
                    ${isMe ? `<div onclick="deleteMsg('${data._id}')" class="delete-opt"><i class="fas fa-trash-alt"></i> Delete</div>` : ''}
                 </div>`;

        if (data.sender && !isMe) {
            html += `<div class="text-[10px] font-bold text-green-700 mb-1">${senderName}</div>`;
        }

        if (data.content) html += `<p class="text-sm">${data.content}</p>`;
        if (data.mediaType === 'audio') html += `<audio controls src="${data.media}" class="w-48 mt-2 h-8"></audio>`;
        if (data.mediaType === 'image') html += `<img src="${data.media}" class="w-full max-w-xs mt-2 rounded-lg cursor-pointer" onclick="window.open('${data.media}', '_blank')">`;
        if (data.mediaType === 'video') html += `<video controls src="${data.media}" class="w-full max-w-xs mt-2 rounded-lg"></video>`;
        if (data.mediaType === 'file') {
            const fileName = data.media.split('-').slice(1).join('-');
            html += `<div class="mt-2 p-2 bg-gray-50 rounded border flex items-center gap-3">
                        <i class="fas fa-file-alt text-xl text-blue-500"></i>
                        <div class="flex-1 overflow-hidden">
                            <div class="text-xs font-bold truncate">${fileName}</div>
                            <a href="${data.media}" download class="text-[10px] text-blue-600 hover:underline">Download File</a>
                        </div>
                     </div>`;
        }

        const time = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        html += `<div class="text-[9px] text-gray-400 text-right mt-1">${time}</div>`;

        div.innerHTML = html;
        container.appendChild(div);
    }

    function scrollDown() {
        const c = document.getElementById('messages');
        if (c) c.scrollTop = c.scrollHeight;
    }

    // --- MESSAGE OPTIONS ---
    window.toggleMsgDropdown = function (e, msgId) {
        e.stopPropagation();
        // Close all other dropdowns
        document.querySelectorAll('.msg-dropdown').forEach(d => {
            if (d.id !== `dropdown-${msgId}`) d.classList.remove('show');
        });
        const d = document.getElementById(`dropdown-${msgId}`);
        if (d) d.classList.toggle('show');
    };

    window.copyMsg = function (msgId, content, mediaUrl) {
        let text = content || "";
        if (mediaUrl) {
            const fullUrl = window.location.origin + mediaUrl;
            text = text ? `${text}\nLink: ${fullUrl}` : fullUrl;
        }

        navigator.clipboard.writeText(text).then(() => {
            const btn = document.querySelector(`#dropdown-${msgId} div:first-child`);
            const original = btn.innerHTML;
            btn.innerHTML = `<i class="fas fa-check text-green-500"></i> Copied!`;
            setTimeout(() => {
                btn.innerHTML = original;
                document.getElementById(`dropdown-${msgId}`).classList.remove('show');
            }, 1000);
        });
    };

    window.deleteMsg = async function (msgId) {
        if (!confirm('Are you sure you want to delete this message?')) return;
        try {
            const res = await fetch(`/api/messages/${msgId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                const el = document.getElementById(`msg-${msgId}`);
                if (el) el.remove();
            }
        } catch (e) {
            console.error('Delete failed', e);
        }
    };

    window.infoMsg = function (msgId, senderName, timestamp) {
        const time = new Date(timestamp).toLocaleString();
        alert(`Message Info:\nSender: ${senderName}\nTime: ${time}\nID: ${msgId}`);
        document.getElementById(`dropdown-${msgId}`).classList.remove('show');
    };

    // Close dropdowns on document click
    document.addEventListener('click', () => {
        document.querySelectorAll('.msg-dropdown').forEach(d => d.classList.remove('show'));
    });

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

    window.toggleMute = function () {
        if (activeStream) {
            const audioTrack = activeStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                const icon = document.querySelector('button[onclick="toggleMute()"] i');
                icon.className = audioTrack.enabled ? 'fas fa-microphone' : 'fas fa-microphone-slash text-red-500';
            }
        }
    };

    window.toggleVideo = function () {
        if (activeStream) {
            const videoTrack = activeStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                const icon = document.querySelector('button[onclick="toggleVideo()"] i');
                icon.className = videoTrack.enabled ? 'fas fa-video' : 'fas fa-video-slash text-red-500';
            }
        }
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
