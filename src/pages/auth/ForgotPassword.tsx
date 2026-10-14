import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { Button, Field, Input, Notice } from '@/components/ui';
import AuthLayout from './AuthLayout';

export default function ForgotPassword() {
  const { tx } = useLang();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    setLoading(false);
    if (err) setError(err.message);
    else setSent(true);
  };

  return (
    <AuthLayout title={tx('Reset your password', 'పాస్‌వర్డ్ రీసెట్')} subtitle={tx('We’ll email you a link to set a new one.', 'కొత్త పాస్‌వర్డ్ కోసం లింక్ ఇమెయిల్ చేస్తాం.')}>
      {sent ? (
        <Notice tone="success">
          {tx('If an account exists for', 'ఖాతా ఉంటే')} <strong>{email}</strong>{tx(', a reset link is on its way. Check Spam too.', 'కు రీసెట్ లింక్ వస్తుంది. Spam కూడా చూడండి.')}
        </Notice>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label={tx('Email', 'ఇమెయిల్')} htmlFor="email">
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {error && <Notice tone="error">{error}</Notice>}
          <Button type="submit" size="lg" className="w-full" loading={loading}>
            {tx('Send reset link', 'రీసెట్ లింక్ పంపండి')}
          </Button>
        </form>
      )}
      <p className="mt-6 text-center">
        <Link to="/login" className="font-semibold text-ink underline decoration-turmeric decoration-2 underline-offset-2">
          {tx('Back to log in', 'లాగిన్‌కు తిరిగి')}
        </Link>
      </p>
    </AuthLayout>
  );
}
