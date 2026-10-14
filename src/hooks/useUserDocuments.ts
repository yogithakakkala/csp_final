import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { docKey } from '@/lib/docs';
import type { UserDocument } from '@/types';

/** The citizen's saved documents, with helpers to match loosely-named scheme documents. */
export function useUserDocuments() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<UserDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) {
      setDocs([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase.from('user_documents').select('*').eq('user_id', user.id).order('uploaded_at', { ascending: false });
    setDocs((data as UserDocument[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const find = useCallback((name: string) => {
    const k = docKey(name);
    return docs.find((d) => d.document_type === name) ?? docs.find((d) => docKey(d.document_type) === k);
  }, [docs]);

  return { docs, setDocs, loading, reload, find };
}

export const CONFIRMED = 'confirmed-by-user';
