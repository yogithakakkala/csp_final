import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Camera, Check, FileText, Loader2, MapPin, MoreHorizontal, Trash2 } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { supabase, safeStorageName, slug, MAX_UPLOAD_MB } from '@/lib/supabase';
import { COMMON_DOCUMENTS } from '@/data/documentOffices';
import { docKey, ISSUER } from '@/lib/docs';
import { useAuth } from '@/hooks/useAuth';
import { useUserDocuments, CONFIRMED } from '@/hooks/useUserDocuments';
import { Card, ListSkeleton, PageHeader, ProgressBar } from '@/components/ui';
import { openFile } from '@/lib/files';
import { cn } from '@/lib/utils';
import type { UserDocument } from '@/types';

export default function DocumentChecklist() {
  const { lang, tx } = useLang();
  const { user } = useAuth();
  const { docs, setDocs, loading } = useUserDocuments();
  const [busy, setBusy] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);

  const have = (name: string) => docs.find((d) => d.document_type === name) ?? docs.find((d) => docKey(d.document_type) === docKey(name));
  const ready = COMMON_DOCUMENTS.filter((d) => have(d.en)).length;

  const upsertLocal = (row: UserDocument) => setDocs((list) => [row, ...list.filter((d) => d.document_type !== row.document_type)]);

  const record = async (docType: string, file_url: string) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('user_documents')
      .upsert({ user_id: user.id, document_type: docType, file_url, uploaded_at: new Date().toISOString() }, { onConflict: 'user_id,document_type' })
      .select()
      .single();
    if (error) {
      // Databases without the v2 unique index: fall back to replace.
      await supabase.from('user_documents').delete().eq('user_id', user.id).eq('document_type', docType);
      const r = await supabase.from('user_documents').insert({ user_id: user.id, document_type: docType, file_url }).select().single();
      if (r.error) throw r.error;
      upsertLocal(r.data as UserDocument);
    } else upsertLocal(data as UserDocument);
  };

  const upload = async (docType: string, file: File) => {
    if (!user) return;
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return toast.error(tx(`File is over ${MAX_UPLOAD_MB} MB`, `ఫైల్ ${MAX_UPLOAD_MB} MB కంటే పెద్దది`));
    setBusy(docType);
    try {
      const path = `${user.id}/user-docs/${slug(docType)}-${safeStorageName(file.name)}`;
      const { error } = await supabase.storage.from('applications').upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (error) throw error;
      await record(docType, path);
      toast.success(tx('Saved to your documents', 'మీ పత్రాల్లో సేవ్ అయింది'));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const confirmHave = async (docType: string) => {
    setBusy(docType);
    try {
      await record(docType, CONFIRMED);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (d: UserDocument) => {
    setMenu(null);
    setDocs((list) => list.filter((x) => x.id !== d.id));
    await supabase.from('user_documents').delete().eq('id', d.id);
    if (d.file_url !== CONFIRMED) void supabase.storage.from('applications').remove([d.file_url]);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={tx('My documents', 'నా పత్రాలు')}
        subtitle={tx('Upload each document once and it is reused for every scheme you apply to. Private — only you and the Sachivalayam staff handling your application can see them.', 'ప్రతి పత్రం ఒక్కసారి అప్‌లోడ్ చేస్తే అన్ని పథకాల దరఖాస్తులకు వాడుకోవచ్చు. ప్రైవేట్ — మీరు, మీ దరఖాస్తు చూసే సిబ్బంది మాత్రమే చూడగలరు.')}
      />

      <Card className="mb-5 p-5">
        <div className="flex items-baseline justify-between">
          <p className="font-semibold">{tx(`${ready} of ${COMMON_DOCUMENTS.length} ready`, `${COMMON_DOCUMENTS.length}లో ${ready} సిద్ధం`)}</p>
          {ready === COMMON_DOCUMENTS.length && <span className="text-sm font-semibold text-leaf">{tx('All set for most schemes', 'చాలా పథకాలకు సిద్ధం')}</span>}
        </div>
        <ProgressBar value={(ready / COMMON_DOCUMENTS.length) * 100} className="mt-3" />
      </Card>

      {loading ? (
        <ListSkeleton rows={6} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-paper">
          {COMMON_DOCUMENTS.map((d) => {
            const h = have(d.en);
            const issuer = ISSUER[docKey(d.en)];
            const isFile = h && h.file_url !== CONFIRMED;
            return (
              <li key={d.en} className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-full', h ? 'bg-leaf text-white' : 'bg-ink-50 text-ink/40')}>
                    {h ? <Check className="size-4" /> : <FileText className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{lang === 'te' ? d.te : d.en}</p>
                    {h ? (
                      isFile ? (
                        <button onClick={() => openFile(h.file_url)} className="mt-0.5 text-sm font-medium text-leaf underline">
                          {tx('Photo saved — view', 'ఫోటో సేవ్ అయింది — చూడండి')}
                        </button>
                      ) : (
                        <p className="mt-0.5 text-sm text-leaf">{tx('You have this (no photo saved)', 'మీ దగ్గర ఉంది (ఫోటో లేదు)')}</p>
                      )
                    ) : issuer ? (
                      <p className="mt-0.5 text-sm text-muted">
                        {tx('Get it at', 'ఇక్కడ పొందండి:')} {lang === 'te' ? issuer.te : issuer.en}
                      </p>
                    ) : null}
                  </div>
                  <div className="relative flex shrink-0 items-center gap-1">
                    {!isFile && (
                      <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-[10px] bg-ink px-3 text-sm font-semibold text-white">
                        {busy === d.en ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
                        <span className="hidden sm:inline">{tx('Add photo', 'ఫోటో జోడించు')}</span>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="sr-only"
                          disabled={!!busy}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = '';
                            if (f) void upload(d.en, f);
                          }}
                        />
                      </label>
                    )}
                    {!h && (
                      <button onClick={() => confirmHave(d.en)} disabled={!!busy} className="h-10 rounded-[10px] border border-line px-3 text-sm font-semibold hover:border-ink/30">
                        {tx('I have it', 'నా దగ్గర ఉంది')}
                      </button>
                    )}
                    {h && (
                      <>
                        <button onClick={() => setMenu(menu === d.en ? null : d.en)} className="grid size-10 place-items-center rounded-full hover:bg-mist" aria-label={tx('More options', 'మరిన్ని')}>
                          <MoreHorizontal className="size-5" />
                        </button>
                        {menu === d.en && (
                          <div className="absolute right-0 top-11 z-10 w-44 rounded-[12px] border border-line bg-paper py-1 shadow-[var(--shadow-pop)]">
                            <button onClick={() => remove(h)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-kumkum hover:bg-kumkum-50">
                              <Trash2 className="size-4" /> {tx('Remove', 'తీసేయండి')}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Link to="/nearest-center?tab=meeseva" className="mt-5 flex items-center gap-3 rounded-[16px] bg-ink-50 p-4 text-[15px] hover:bg-ink-100">
        <MapPin className="size-5 shrink-0" />
        <span className="flex-1">{tx('Missing something? Most certificates are issued at a MeeSeva centre or your Sachivalayam.', 'ఏదైనా లేదా? చాలా ధృవపత్రాలు మీసేవ కేంద్రం లేదా సచివాలయంలో ఇస్తారు.')}</span>
        <span className="font-semibold underline">{tx('Find one', 'కనుగొనండి')}</span>
      </Link>
    </div>
  );
}
