import { LogoMark } from '../../components/Logo';
import { Spinner } from '../../components/ui/Spinner';

export function SplashScreen() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-5" role="status">
      <LogoMark className="h-12 w-12" />
      <Spinner className="h-5 w-5 text-pine-600" />
      <span className="sr-only">Loading UnsaidTalks</span>
    </div>
  );
}
