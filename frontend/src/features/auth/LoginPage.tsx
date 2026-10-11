import { FormEvent, useState } from 'react';
import { Link, Location, useLocation, useNavigate } from 'react-router-dom';
import { login } from '../../api/auth.api';
import { ApiError, toApiError } from '../../api/errors';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { PasswordField } from '../../components/ui/PasswordField';
import { TextField } from '../../components/ui/TextField';
import { useAuthStore } from '../../store/auth.store';
import { AuthLayout } from './AuthLayout';
import { DemoAccounts } from './DemoAccounts';

function redirectTarget(location: Location): string {
  const from = (location.state as { from?: Location } | null)?.from;
  return from ? `${from.pathname}${from.search}` : '/';
}

function LoginError({ error }: { error: ApiError }) {
  if (error.code === 'ACCOUNT_PENDING') {
    return (
      <Alert tone="pending" title="Approval pending">
        Your mentor account is waiting for an admin to approve it. You can sign in as soon as
        it&apos;s approved.
      </Alert>
    );
  }
  return <Alert tone="error">{error.message}</Alert>;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((state) => state.setSession);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const session = await login(email, password);
      setSession(session.accessToken, session.user);
      navigate(redirectTarget(location), { replace: true });
    } catch (caught) {
      setError(toApiError(caught));
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle={
        <>
          New here?{' '}
          <Link to="/signup" className="font-semibold text-pine-600 hover:text-pine-700">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {error && <LoginError error={error} />}

        <TextField
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <PasswordField
          name="password"
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        <Button type="submit" className="w-full" loading={submitting}>
          Sign in
        </Button>
      </form>

      {import.meta.env.DEV && (
        <DemoAccounts
          onPick={(demoEmail, demoPassword) => {
            setEmail(demoEmail);
            setPassword(demoPassword);
            setError(null);
          }}
        />
      )}
    </AuthLayout>
  );
}
