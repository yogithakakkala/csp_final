import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useLang } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button, Field, Notice } from '@/components/ui';
import AuthLayout from './AuthLayout';
import PasswordInput from './PasswordInput';

export default function ResetPassword() {
  const { tx } = useLang();
  const { user, ready, clearRecovering, isStaff } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return setError(tx('Use at least 6 characters.', 'కనీసం 6 అక్షరాలు వాడండి.'));
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) return setError(err.message);
    clearRecovering();
    toast.success(tx('Password updated', 'పాస్‌వర్డ్ మార్చబడింది'));
    navigate(isStaff ? '/admin' : '/home', { replace: true });
  };

  return (
    <AuthLayout title={tx('Set a new password', 'కొత్త పాస్‌వర్డ్ పెట్టండి')}>
      {ready && !user ? (
        <Notice tone="warn">
          {tx('This reset link has expired or was already used.', 'ఈ రీసెట్ లింక్ గడువు ముగిసింది లేదా ఇప్పటికే వాడబడింది.')}{' '}
          <Link to="/forgot-password" className="font-semibold underline">
            {tx('Send a new one', 'కొత్తది పంపండి')}
          </Link>
        </Notice>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label={tx('New password', 'కొత్త పాస్‌వర్డ్')} htmlFor="pw">
            <PasswordInput id="pw" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error && <Notice tone="error">{error}</Notice>}
          <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!ready}>
            {tx('Save password', 'పాస్‌వర్డ్ సేవ్ చేయండి')}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
