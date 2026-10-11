import { Eye, EyeOff } from 'lucide-react';
import { ComponentProps, useState } from 'react';
import { TextField } from './TextField';

type PasswordFieldProps = Omit<ComponentProps<typeof TextField>, 'type' | 'trailing'>;

export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-muted hover:bg-paper-sunk hover:text-ink"
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </button>
      }
    />
  );
}
