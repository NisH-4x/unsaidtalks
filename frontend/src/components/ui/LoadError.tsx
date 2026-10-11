import { Alert } from './Alert';

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert tone="error">
      {message}{' '}
      <button type="button" onClick={onRetry} className="font-semibold underline">
        Try again
      </button>
    </Alert>
  );
}
