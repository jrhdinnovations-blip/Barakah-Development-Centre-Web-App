import { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PwaInstallBanner() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsVisible(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setIsVisible(false);
        }
        setDeferredPrompt(null);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 bg-slate-900/95 backdrop-blur-xl border border-blue-500/30 p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30 shrink-0">
                    <Smartphone className="h-5 w-5" />
                </div>
                <div>
                    <h4 className="text-xs font-bold text-white">Install SwiftMove</h4>
                    <p className="text-[11px] text-slate-400">Add to home screen for faster dispatch access.</p>
                </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                <Button
                    onClick={handleInstallClick}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs gap-1.5 h-8 px-3"
                >
                    <Download className="h-3.5 w-3.5" /> Install
                </Button>
                <button
                    onClick={() => setIsVisible(false)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}