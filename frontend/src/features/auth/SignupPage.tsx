import { Hourglass } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signup } from '../../api/auth.api';
import { toApiError } from '../../api/errors';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { PasswordField } from '../../components/ui/PasswordField';
import { TextField } from '../../components/ui/TextField';
import { useAuthStore } from '../../store/auth.store';
import { SignupRole } from '../../types/user';
import { AuthLayout } from './AuthLayout';
import { RoleChoice } from './RoleChoice';
import { validateEmail, validateName, validateNewPassword } from './validation';

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

function ApplicationSent({ name }: { name: string }) {
  return (
    <AuthLayout title="Application sent" subtitle={`Thanks, ${name.split(' ')[0]}.`}>
      <div className="rounded-2xl border border-marigold-200 bg-marigold-50 p-5">
        <Hourglass className="h-6 w-6 text-marigold-600" aria-hidden="true" />
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
          An UnsaidTalks admin will review your mentor account. You&apos;ll be able to sign in as
          soon as it&apos;s approved.
        </p>
      </div>
      <Link
        to="/login"
        className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl border border-line-strong bg-paper-raised font-semibold text-ink hover:bg-paper-sunk"
      >
        Back to sign in
      </Link>
    </AuthLayout>
  );
}

export function SignupPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<SignupRole>('mentee');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingName, setPendingName] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const errors: FieldErrors = {
      name: validateName(name),
      email: validateEmail(email),
      password: validateNewPassword(password),
    };
    setFieldErrors(errors);
    if (errors.name || errors.email || errors.password) return;

    setSubmitting(true);
    try {
      const result = await signup({ name, email, password, role });
      if (result.status === 'pending_approval') {
        setPendingName(result.user.name);
        return;
      }
      setSession(result.accessToken, result.user);
      navigate('/', { replace: true });
    } catch (caught) {
      setFormError(toApiError(caught).message);
      setSubmitting(false);
    }
  }

  if (pendingName) return <ApplicationSent name={pendingName} />;

  return (
    <AuthLayout
      title="Create your account"
      subtitle={
        <>
          Already have one?{' '}
          <Link to="/login" className="font-semibold text-pine-600 hover:text-pine-700">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}

        <RoleChoice value={role} onChange={setRole} />
        <TextField
          name="name"
          label="Full name"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={fieldErrors.name}
        />
        <TextField
          name="email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldErrors.email}
          hint="Used to sign in. Never shown to other members."
        />
        <PasswordField
          name="password"
          label="Password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
          hint="At least 8 characters, with a letter and a number."
        />

        <Button type="submit" className="w-full" loading={submitting}>
          {role === 'mentor' ? 'Request mentor account' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  );
}
