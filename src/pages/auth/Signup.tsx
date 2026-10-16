import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MailCheck, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLang } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { claimStaff, forgetStaffKey, rememberStaffKey, STAFF_ERRORS } from '@/lib/staff';
import { Button, Field, Input, Notice, Segmented } from '@/components/ui';
import AuthLayout, { EmbeddedAuth } from './AuthLayout';
import PasswordInput from './PasswordInput';

type Role = 'citizen' | 'staff';
type Props = { embedded?: boolean; role?: Role; onRole?: (r: Role) => void; onSwitch?: () => void };

export default function Signup({ embedded, role: roleProp, onRole, onSwitch }: Props = {}) {
  const { tx, lang } = useLang();
  const location = useLocation();
  const { refreshProfile, setHoldRedirect } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [staffKey, setStaffKey] = useState('');
  const [roleState, setRoleState] = useState<Role>(() => (new URLSearchParams(location.search).get('as') === 'staff' ? 'staff' : 'citizen'));
  const role = roleProp ?? roleState;
  const setRole = (r: Role) => (onRole ? onRole(r) : setRoleState(r));
  const Shell = embedded ? EmbeddedAuth : AuthLayout;
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) return setError(tx('Use at least 6 characters for the password.', 'పాస్‌వర్డ్‌కు కనీసం 6 అక్షరాలు వాడండి.'));
    const key = role === 'staff' ? staffKey.trim() : '';
    if (role === 'staff' && !key) return setError(tx('Enter the staff key.', 'సిబ్బంది కీ నమోదు చేయండి.'));
    setLoading(true);
    setHoldRedirect(true);
    if (key) rememberStaffKey(key); // finished on first login if email confirmation is on
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() }, emailRedirectTo: `${window.location.origin}/login` },
    });
    if (err) {
      forgetStaffKey();
      setHoldRedirect(false);
      setLoading(false);
      setError(
        /registered|exists/i.test(err.message)
          ? tx('An account with this email already exists. Log in instead.', 'ఈ ఇమెయిల్‌తో ఖాతా ఇప్పటికే ఉంది. లాగిన్ అవ్వండి.')
          : err.message,
      );
      return;
    }
    // Signed in straight away (email confirmation off): check the staff key now.
    if (data.session && data.user) {
      if (key) {
        forgetStaffKey();
        const r = await claimStaff(key);
        if (!r.ok) {
          await supabase.auth.signOut();
          setHoldRedirect(false);
          setLoading(false);
          const [en, te] = STAFF_ERRORS[r.reason];
          setError(
            `${lang === 'te' ? te : en} ${tx('Your account was created — log in as staff with the right key.', 'మీ ఖాతా సృష్టించబడింది — సరైన కీతో సిబ్బందిగా లాగిన్ అవ్వండి.')}`,
          );
          return;
        }
      }
      await refreshProfile(data.user.id);
      setHoldRedirect(false);
      return;
    }
    setHoldRedirect(false);
    setLoading(false);
    setSentTo(email.trim());
  };

  if (sentTo)
    return (
      <Shell title={tx('Check your email', 'మీ ఇమెయిల్ చూడండి')}>
        <div className="flex flex-col items-start gap-4">
          <span className="grid size-14 place-items-center rounded-full bg-leaf-50 text-leaf">
            <MailCheck className="size-7" />
          </span>
          <p className="text-[15px]">
            {tx('We sent a confirmation link to', 'నిర్ధారణ లింక్ పంపాము:')} <strong>{sentTo}</strong>.{' '}
            {tx('Open it, then come back and log in.', 'దాన్ని తెరిచి, తిరిగి వచ్చి లాగిన్ అవ్వండి.')}
          </p>
          <p className="text-sm text-muted">{tx('Can’t find it? Look in Spam or Promotions.', 'కనబడలేదా? Spam లేదా Promotions చూడండి.')}</p>
          {onSwitch ? (
            <button type="button" onClick={onSwitch} className="font-semibold text-ink underline decoration-turmeric decoration-2 underline-offset-2">
              {tx('Go to log in', 'లాగిన్‌కు వెళ్లండి')}
            </button>
          ) : (
            <Link to="/login" className="font-semibold text-ink underline decoration-turmeric decoration-2 underline-offset-2">
              {tx('Go to log in', 'లాగిన్‌కు వెళ్లండి')}
            </Link>
          )}
        </div>
      </Shell>
    );

  return (
    <Shell
      title={role === 'staff' ? tx('Register as staff', 'సిబ్బందిగా నమోదు') : tx('Create your account', 'మీ ఖాతా సృష్టించండి')}
      subtitle={
        role === 'staff'
          ? tx('For Sachivalayam staff. You need the staff key from your administrator.', 'సచివాలయ సిబ్బందికి. మీ అడ్మినిస్ట్రేటర్ ఇచ్చే సిబ్బంది కీ కావాలి.')
          : tx('Free. Answer once, see every scheme your family qualifies for, and apply for all of them together.', 'ఉచితం. ఒక్కసారి జవాబివ్వండి, అర్హత ఉన్న అన్ని పథకాలు చూసి, అన్నింటికీ ఒకేసారి దరఖాస్తు చేయండి.')
      }
    >
      <Segmented
        value={role}
        onChange={(v) => {
          setRole(v);
          setError('');
        }}
        options={[
          { value: 'citizen' as const, label: tx('Citizen', 'పౌరులు') },
          { value: 'staff' as const, label: tx('Sachivalayam staff', 'సచివాలయ సిబ్బంది') },
        ]}
        className="mb-5"
      />
      <form onSubmit={submit} className="space-y-4">
        <Field label={tx('Full name (as on Aadhaar)', 'పూర్తి పేరు (ఆధార్‌లో ఉన్నట్లు)')} htmlFor="name">
          <Input id="name" required autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label={tx('Email', 'ఇమెయిల్')} htmlFor="email">
          <Input id="email" type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={tx('Password', 'పాస్‌వర్డ్')} hint={tx('At least 6 characters', 'కనీసం 6 అక్షరాలు')} htmlFor="password">
          <PasswordInput id="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>

        {role === 'staff' && (
          <Field label={tx('Staff key', 'సిబ్బంది కీ')} hint={tx('Given by your administrator.', 'మీ అడ్మినిస్ట్రేటర్ ఇస్తారు.')} htmlFor="staffkey">
            <PasswordInput id="staffkey" required autoComplete="off" inputMode="numeric" value={staffKey} onChange={(e) => setStaffKey(e.target.value)} />
          </Field>
        )}

        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          {role === 'staff' && <ShieldCheck className="size-5" />}
          {role === 'staff' ? tx('Register as staff', 'సిబ్బందిగా నమోదు') : tx('Create account', 'ఖాతా సృష్టించండి')}
        </Button>
      </form>
      <p className="mt-6 text-center text-[15px] text-muted">
        {tx('Already have an account?', 'ఇప్పటికే ఖాతా ఉందా?')}{' '}
        {onSwitch ? (
          <button type="button" onClick={onSwitch} className="font-semibold text-ink underline decoration-turmeric decoration-2 underline-offset-2">
            {tx('Log in', 'లాగిన్')}
          </button>
        ) : (
          <Link to={role === 'staff' ? '/login?as=staff' : '/login'} state={location.state} className="font-semibold text-ink underline decoration-turmeric decoration-2 underline-offset-2">
            {tx('Log in', 'లాగిన్')}
          </Link>
        )}
      </p>
    </Shell>
  );
}
