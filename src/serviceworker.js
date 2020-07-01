var CACHE_NAME = 'iris-messenger-cache-v1';

// stale-while-revalidate
if (self.location.host.indexOf('localhost') !== 0) {
  self.addEventListener('fetch', function(event) {
    event.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(event.request).then(function(response) {
          var fetchPromise = fetch(event.request).then(function(networkResponse) {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          })
          return response || fetchPromise;
        })
      })
    );
  });
}

self.addEventListener('push', ev => {
  const data = ev.data.json();
  console.log('Got push', data);
  self.registration.showNotification(data.title || 'Hello, World!', {
    body: data.body || 'Hello, World!',
    icon: './img/icon128.png'
  });
});
