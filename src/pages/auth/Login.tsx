import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { claimStaff, STAFF_ERRORS } from '@/lib/staff';
import { Button, Field, Input, Notice, Segmented } from '@/components/ui';
import AuthLayout, { EmbeddedAuth } from './AuthLayout';
import PasswordInput from './PasswordInput';

type Role = 'citizen' | 'staff';

type Props = { embedded?: boolean; role?: Role; onRole?: (r: Role) => void; onSwitch?: () => void };

export default function Login({ embedded, role: roleProp, onRole, onSwitch }: Props = {}) {
  const { tx, lang } = useLang();
  const location = useLocation();
  const { refreshProfile, setHoldRedirect } = useAuth();
  const flash = (location.state as { flash?: string } | null)?.flash;
  const [roleState, setRoleState] = useState<Role>(() => (new URLSearchParams(location.search).get('as') === 'staff' ? 'staff' : 'citizen'));
  const role = roleProp ?? roleState;
  const setRole = (r: Role) => (onRole ? onRole(r) : setRoleState(r));
  const Shell = embedded ? EmbeddedAuth : AuthLayout;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [staffKey, setStaffKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fail = async (msg: string, signOut = false) => {
    if (signOut) await supabase.auth.signOut();
    setHoldRedirect(false);
    setLoading(false);
    setError(msg);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (role === 'staff' && !staffKey.trim()) return setError(tx('Enter the staff key.', 'సిబ్బంది కీ నమోదు చేయండి.'));
    setLoading(true);
    // Keep the user on this page until the staff key has been checked.
    setHoldRedirect(true);
    const { data, error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err || !data.user) {
      if (err && /confirm/i.test(err.message)) return fail(tx('Please confirm your email first — open the link we sent you, then log in.', 'ముందుగా మీ ఇమెయిల్ నిర్ధారించండి — మేము పంపిన లింక్ తెరిచి లాగిన్ అవ్వండి.'));
      if (err && /fetch|network/i.test(err.message)) return fail(tx('No internet connection. Check your network and try again.', 'ఇంటర్నెట్ లేదు. నెట్‌వర్క్ చూసి మళ్లీ ప్రయత్నించండి.'));
      return fail(tx('That email and password don’t match. Check them and try again.', 'ఇమెయిల్, పాస్‌వర్డ్ సరిపోలలేదు. మళ్లీ చూసి ప్రయత్నించండి.'));
    }

    if (role === 'staff') {
      const r = await claimStaff(staffKey);
      if (!r.ok) {
        const [en, te] = STAFF_ERRORS[r.reason];
        return fail(lang === 'te' ? te : en, true);
      }
    } else {
      const { data: p } = await supabase.from('profiles').select('is_staff').eq('id', data.user.id).maybeSingle();
      if (p?.is_staff) {
        setRole('staff');
        return fail(tx('This is a staff account. Choose “Sachivalayam staff” and enter the staff key.', 'ఇది సిబ్బంది ఖాతా. “సచివాలయ సిబ్బంది” ఎంచుకుని సిబ్బంది కీ నమోదు చేయండి.'), true);
      }
    }
    await refreshProfile(data.user.id);
    setHoldRedirect(false); // the router now sends citizens home and staff to the panel
  };

  return (
    <Shell
      title={role === 'staff' ? tx('Staff login', 'సిబ్బంది లాగిన్') : tx('Welcome back', 'మళ్లీ స్వాగతం')}
      subtitle={
        role === 'staff'
          ? tx('Review applications, request documents and update status.', 'దరఖాస్తులు సమీక్షించండి, పత్రాలు అడగండి, స్థితి మార్చండి.')
          : tx('See the schemes your family qualifies for and apply for all of them together.', 'మీ కుటుంబానికి అర్హత ఉన్న పథకాలు చూసి, అన్నింటికీ ఒకేసారి దరఖాస్తు చేయండి.')
      }
    >
      {flash && <Notice tone="success" className="mb-5">{flash}</Notice>}
      <Segmented<Role>
        value={role}
        onChange={(v) => {
          setRole(v);
          setError('');
        }}
        options={[
          { value: 'citizen', label: tx('Citizen', 'పౌరులు') },
          { value: 'staff', label: tx('Sachivalayam staff', 'సచివాలయ సిబ్బంది') },
        ]}
        className="mb-5"
      />
      <form onSubmit={submit} className="space-y-4">
        <Field label={tx('Email', 'ఇమెయిల్')} htmlFor="email">
          <Input id="email" type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={tx('Password', 'పాస్‌వర్డ్')} htmlFor="password">
          <PasswordInput id="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {role === 'staff' && (
          <Field label={tx('Staff key', 'సిబ్బంది కీ')} hint={tx('Given by your administrator.', 'మీ అడ్మినిస్ట్రేటర్ ఇస్తారు.')} htmlFor="staffkey">
            <PasswordInput id="staffkey" required autoComplete="off" inputMode="numeric" value={staffKey} onChange={(e) => setStaffKey(e.target.value)} />
          </Field>
        )}
        <div className="-mt-1 text-right">
          <Link to="/forgot-password" className="text-sm font-semibold text-ink underline decoration-turmeric decoration-2 underline-offset-2">
            {tx('Forgot password?', 'పాస్‌వర్డ్ మర్చిపోయారా?')}
          </Link>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          {role === 'staff' && <ShieldCheck className="size-5" />}
          {role === 'staff' ? tx('Log in as staff', 'సిబ్బందిగా లాగిన్') : tx('Log in', 'లాగిన్')}
        </Button>
      </form>
      <p className="mt-6 text-center text-[15px] text-muted">
        {tx('New here?', 'కొత్తవారా?')}{' '}
        {onSwitch ? (
          <button type="button" onClick={onSwitch} className="font-semibold text-ink underline decoration-turmeric decoration-2 underline-offset-2">
            {role === 'staff' ? tx('Register as staff', 'సిబ్బందిగా నమోదు') : tx('Create an account', 'ఖాతా సృష్టించండి')}
          </button>
        ) : (
          <Link to={role === 'staff' ? '/signup?as=staff' : '/signup'} state={location.state} className="font-semibold text-ink underline decoration-turmeric decoration-2 underline-offset-2">
            {role === 'staff' ? tx('Register as staff', 'సిబ్బందిగా నమోదు') : tx('Create an account', 'ఖాతా సృష్టించండి')}
          </Link>
        )}
      </p>
    </Shell>
  );
}
