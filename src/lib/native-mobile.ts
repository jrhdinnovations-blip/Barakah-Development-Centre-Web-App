/**
 * Native Mobile Integration for SwiftMove
 * Bridges Capacitor native plugins (iOS & Android) with the React web application.
 */

import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { App as CapApp } from '@capacitor/app';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Geolocation } from '@capacitor/geolocation';

/**
 * Returns true if the app is running inside a native iOS or Android shell.
 */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  return Capacitor.isNativePlatform();
}

/**
 * Returns the current platform: 'ios', 'android', or 'web'.
 */
export function getNativePlatform(): string {
  if (typeof window === 'undefined') return 'web';
  return Capacitor.getPlatform();
}

/**
 * Initializes native mobile listeners, status bar, and splash screen.
 * Call this once in the root application component.
 */
export async function initNativeMobile(): Promise<void> {
  if (!isNativeApp()) return;

  try {
    // 1. Configure Native Status Bar
    await StatusBar.setStyle({ style: Style.Dark });
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#080c17' });
    }
  } catch (err) {
    console.warn('[Native] StatusBar init skipped:', err);
  }

  try {
    // 2. Hide Splash Screen gracefully
    setTimeout(async () => {
      await SplashScreen.hide({ fadeOutDuration: 300 });
    }, 1200);
  } catch (err) {
    console.warn('[Native] SplashScreen init skipped:', err);
  }

  try {
    // 3. Android Hardware Back Button Handling
    CapApp.addListener('backButton', ({ canGoBack }) => {
      const pathname = window.location.pathname;

      // If user is on the main landing or root page, minimize/exit
      if (pathname === '/' || pathname === '/swiftmove' || pathname === '') {
        CapApp.exitApp();
      } else if (canGoBack && window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = '/';
      }
    });
  } catch (err) {
    console.warn('[Native] Hardware backButton listener skipped:', err);
  }

  try {
    // 4. Handle Deep Links & App State changes
    CapApp.addListener('appUrlOpen', (event) => {
      console.log('[Native] Deep link opened:', event.url);
      try {
        const url = new URL(event.url);
        if (url.pathname) {
          window.location.pathname = url.pathname;
        }
      } catch {
        // Fallback for custom schemes
      }
    });
  } catch (err) {
    console.warn('[Native] App URL listener skipped:', err);
  }
}

/**
 * Triggers native haptic vibration feedback for tactile responses.
 */
export async function triggerHaptic(
  type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light'
): Promise<void> {
  if (!isNativeApp()) {
    // Fallback: Web Vibration API
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(type === 'heavy' ? 40 : 15);
    }
    return;
  }

  try {
    switch (type) {
      case 'light':
        await Haptics.impact({ style: ImpactStyle.Light });
        break;
      case 'medium':
        await Haptics.impact({ style: ImpactStyle.Medium });
        break;
      case 'heavy':
        await Haptics.impact({ style: ImpactStyle.Heavy });
        break;
      case 'success':
        await Haptics.notification({ type: NotificationType.Success });
        break;
      case 'warning':
        await Haptics.notification({ type: NotificationType.Warning });
        break;
      case 'error':
        await Haptics.notification({ type: NotificationType.Error });
        break;
    }
  } catch (err) {
    console.warn('[Native] Haptics trigger skipped:', err);
  }
}

/**
 * Obtains high-accuracy GPS coordinates using the native Geolocation plugin.
 */
export async function getNativePosition(): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number;
} | null> {
  if (isNativeApp()) {
    try {
      const permission = await Geolocation.checkPermissions();
      if (permission.location !== 'granted') {
        const request = await Geolocation.requestPermissions();
        if (request.location !== 'granted') {
          return null;
        }
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      });

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
    } catch (err) {
      console.warn('[Native] Geolocation fallback to web:', err);
    }
  }

  // Web Geolocation fallback
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  });
}
