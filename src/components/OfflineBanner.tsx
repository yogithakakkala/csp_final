import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useLang } from '@/lib/i18n';

/** Shown while the phone has no internet: saved information still opens; sending needs internet. */
export default function OfflineBanner() {
  const { tx } = useLang();
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && !navigator.onLine);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (!offline) return null;
  return (
    <div role="status" className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-amber px-4 py-2 text-center text-sm font-semibold text-white">
      <WifiOff className="size-4 shrink-0" />
      {tx('No internet. You can still see schemes, your eligibility and saved applications. Sending needs internet.', 'ఇంటర్నెట్ లేదు. పథకాలు, మీ అర్హత, సేవ్ అయిన దరఖాస్తులు చూడవచ్చు. పంపడానికి ఇంటర్నెట్ కావాలి.')}
    </div>
  );
}
