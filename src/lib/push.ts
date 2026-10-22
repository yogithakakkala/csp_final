import { supabase } from '@/lib/supabase';

/** Public half of the push key pair (the private half lives only in the send-push function). */
export const VAPID_PUBLIC_KEY = 'BG7fAYmwDyO2BLvLBnnxNvtzFjWt312DffJ6hG5_2hBJRH2XGxcZ-lPD55Ahm-k_rcmZjDYXvjd-6scYBB_0E5s';

export type PushState = 'unsupported' | 'blocked' | 'off' | 'on';

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** iPhones only allow notifications after "Add to Home Screen". */
export const needsInstallForPush = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone);

function keyBytes(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

/** Ask permission, subscribe this browser and save it for the signed-in user. */
export async function enablePush(lang: 'en' | 'te'): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'));
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { error } = await supabase.from('push_subscriptions').upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, lang }, { onConflict: 'endpoint' });
  if (error) throw new Error(error.message);
  return 'on';
}

export async function disablePush(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }
  return 'off';
}

/** Keep the saved language in step with the app's language switch. */
export async function syncPushLang(lang: 'en' | 'te') {
  if (!pushSupported()) return;
  const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
  if (sub) await supabase.from('push_subscriptions').update({ lang }).eq('endpoint', sub.endpoint);
}

/** On sign-out: stop notifications for this browser and forget saved data. */
export async function forgetDevice() {
  try {
    await disablePush();
  } catch {
    /* offline or already gone */
  }
  navigator.serviceWorker?.controller?.postMessage('clear-data');
}

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* the app still works without it */
    });
  });
}
