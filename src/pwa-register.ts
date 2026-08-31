export function registerServiceWorker() {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && import.meta.env.PROD) {
        window.addEventListener('load', () => {
            navigator.serviceWorker
                .register('/sw.js')
                .then((registration) => {
                    console.log('PWA ServiceWorker registered successfully:', registration.scope);
                })
                .catch((error) => {
                    console.warn('PWA ServiceWorker registration failed:', error);
                });
        });
    }
}