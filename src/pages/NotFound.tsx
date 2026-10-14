import { useLang } from '@/lib/i18n';
import { useAuth } from '@/hooks/useAuth';
import { ButtonLink } from '@/components/ui';
import { LogoMark } from '@/components/Logo';

export default function NotFound() {
  const { tx } = useLang();
  const { user, isStaff } = useAuth();
  return (
    <div className="muggu-faint grid min-h-dvh place-items-center bg-mist p-6 text-center">
      <div>
        <LogoMark className="mx-auto size-14" />
        <h1 className="display mt-6 text-[32px]">{tx('This page doesn’t exist', 'ఈ పేజీ లేదు')}</h1>
        <p className="mt-2 text-muted">{tx('The link may be old or mistyped.', 'లింక్ పాతది లేదా తప్పుగా ఉండవచ్చు.')}</p>
        <ButtonLink to={user ? (isStaff ? '/admin' : '/home') : '/'} className="mt-6">
          {tx('Go to home', 'హోమ్‌కు వెళ్లండి')}
        </ButtonLink>
      </div>
    </div>
  );
}
