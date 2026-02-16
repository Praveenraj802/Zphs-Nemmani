self.addEventListener('push', event => {
    const data = event.data.json();
    console.log('Push Received:', data);

    const options = {
        body: data.body,
        icon: data.icon || 'https://ui-avatars.com/api/?name=ZPHS&background=random',
        vibrate: [200, 100, 200, 100, 200, 100, 200],
        data: {
            url: data.data.url
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
