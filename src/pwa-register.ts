export function registerServiceWorker() {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && import.meta.env.PROD) {
        window.addEventListener('load', () => {
            navigator.serviceWorker
                .register('/sw.js')
                .then((registration) => {
                    console.log('PWA ServiceWorker registered successfully:', registration.scope);

                    // Auto-update when a new service worker is detected
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        if (newWorker) {
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    console.log('New app version installed, requesting skipWaiting...');
                                    newWorker.postMessage({ type: 'SKIP_WAITING' });
                                }
                            });
                        }
                    });
                })
                .catch((error) => {
                    console.warn('PWA ServiceWorker registration failed:', error);
                });

            // Prevent reload loops on controller change
            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!refreshing) {
                    refreshing = true;
                    console.log('ServiceWorker controller changed, refreshing for new version...');
                    window.location.reload();
                }
            });
        });
    }
}