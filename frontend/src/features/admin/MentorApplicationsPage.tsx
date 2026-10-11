import { Inbox, RotateCw } from 'lucide-react';
import { useState } from 'react';
import {
  decideMentorApplication,
  listMentorApplications,
  MentorApplicationDecision,
} from '../../api/admin.api';
import { toApiError } from '../../api/errors';
import { Alert } from '../../components/ui/Alert';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadError } from '../../components/ui/LoadError';
import { Spinner } from '../../components/ui/Spinner';
import { useApiResource } from '../../hooks/useApiResource';
import { AdminUser } from '../../types/user';
import { formatRelative } from '../../utils/time';
import { PageHeader } from './PageHeader';

interface Notice {
  tone: 'success' | 'error';
  text: string;
}

interface ApplicantRowProps {
  applicant: AdminUser;
  busy: boolean;
  confirmingReject: boolean;
  onDecide: (decision: MentorApplicationDecision) => void;
  onAskReject: () => void;
  onCancelReject: () => void;
}

function ApplicantRow({
  applicant,
  busy,
  confirmingReject,
  onDecide,
  onAskReject,
  onCancelReject,
}: ApplicantRowProps) {
  const firstName = applicant.name.split(' ')[0];

  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-line bg-paper-raised p-4 shadow-card sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={applicant.name} seed={applicant.id} size="lg" />
        <div className="min-w-0">
          <p className="truncate font-semibold">{applicant.name}</p>
          <p className="truncate text-sm text-ink-muted">{applicant.email}</p>
          <p className="mt-0.5 text-xs text-ink-faint">
            Requested {formatRelative(applicant.createdAt)}
          </p>
        </div>
      </div>

      {confirmingReject ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-full text-sm text-ink-soft sm:w-auto">Decline {firstName}?</span>
          <Button
            size="sm"
            variant="danger"
            loading={busy}
            onClick={() => onDecide('reject')}
            className="flex-1 sm:flex-none"
          >
            Decline
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={onCancelReject}
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            size="sm"
            loading={busy}
            onClick={() => onDecide('approve')}
            className="flex-1 sm:flex-none"
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={onAskReject}
            className="flex-1 sm:flex-none"
          >
            Reject
          </Button>
        </div>
      )}
    </li>
  );
}

export function MentorApplicationsPage() {
  const { state, reload, setData } = useApiResource(listMentorApplications);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function decide(applicant: AdminUser, decision: MentorApplicationDecision) {
    setBusyId(applicant.id);
    setNotice(null);
    try {
      await decideMentorApplication(applicant.id, decision);
      if (state.phase === 'ready') {
        setData(state.data.filter(({ id }) => id !== applicant.id));
      }
      setNotice({
        tone: 'success',
        text:
          decision === 'approve'
            ? `${applicant.name} is now a mentor and can sign in.`
            : `${applicant.name}'s request was declined.`,
      });
    } catch (error) {
      setNotice({ tone: 'error', text: toApiError(error).message });
    } finally {
      setBusyId(null);
      setRejectingId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Mentor requests"
        description="People who signed up as mentors. Approving lets them sign in and be added to program groups."
      />

      {notice && (
        <Alert tone={notice.tone} className="mb-6">
          {notice.text}
        </Alert>
      )}

      {state.phase === 'loading' && (
        <div className="flex items-center gap-3 text-ink-muted">
          <Spinner /> Loading requests…
        </div>
      )}
      {state.phase === 'error' && <LoadError message={state.message} onRetry={reload} />}
      {state.phase === 'ready' && state.data.length === 0 && (
        <EmptyState
          icon={<Inbox className="h-8 w-8 text-ink-faint" aria-hidden="true" />}
          title="No pending requests"
          className="rounded-2xl border border-dashed border-line-strong"
          action={
            <Button variant="ghost" size="sm" onClick={reload}>
              <RotateCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
          }
        >
          New mentor signups will show up here.
        </EmptyState>
      )}
      {state.phase === 'ready' && state.data.length > 0 && (
        <ul className="space-y-3">
          {state.data.map((applicant) => (
            <ApplicantRow
              key={applicant.id}
              applicant={applicant}
              busy={busyId === applicant.id}
              confirmingReject={rejectingId === applicant.id}
              onDecide={(decision) => void decide(applicant, decision)}
              onAskReject={() => setRejectingId(applicant.id)}
              onCancelReject={() => setRejectingId(null)}
            />
          ))}
        </ul>
      )}
    </>
  );
}
