import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export function timeLabel(iso: string, lang: 'en' | 'te') {
  return new Date(iso).toLocaleString(lang === 'te' ? 'te-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** Opens a private uploaded file through a 10-minute signed link. */
export async function openFile(path: string) {
  // Open the tab synchronously (popup blockers), then point it at the signed URL.
  const win = window.open('', '_blank');
  if (win) win.opener = null;
  const { data, error } = await supabase.storage.from('applications').createSignedUrl(path, 600);
  if (data?.signedUrl) {
    if (win) win.location.href = data.signedUrl;
    else window.location.href = data.signedUrl;
  } else {
    win?.close();
    toast.error(error?.message ?? 'File not available');
  }
}
