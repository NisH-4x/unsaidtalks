import { ArrowLeft } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createGroup } from '../../../api/admin.api';
import { toApiError } from '../../../api/errors';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { PageHeader } from '../PageHeader';
import { GroupDetailsFields } from './GroupDetailsFields';
import { EMPTY_GROUP_DETAILS, toGroupDetailsInput, validateGroupName } from './groupDetails';
import { MemberPicker } from './MemberPicker';
import { useSelection } from './useSelection';

const NO_ONE = new Set<string>();

export function GroupCreatePage() {
  const navigate = useNavigate();
  const [details, setDetails] = useState(EMPTY_GROUP_DETAILS);
  const [nameError, setNameError] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { selected, toggle } = useSelection();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const invalidName = validateGroupName(details.name);
    setNameError(invalidName);
    if (invalidName) return;

    setSaving(true);
    setError(null);
    try {
      const group = await createGroup({
        ...toGroupDetailsInput(details),
        memberIds: [...selected.keys()],
      });
      navigate(`/admin/groups/${group.id}`, { replace: true, state: { created: true } });
    } catch (caught) {
      setError(toApiError(caught).message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Link
        to="/admin/groups"
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All groups
      </Link>
      <PageHeader title="New program group" />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-paper-raised p-5 shadow-card">
          <h2 className="mb-4 font-semibold">Details</h2>
          <GroupDetailsFields values={details} onChange={setDetails} nameError={nameError} />
        </section>

        <section className="rounded-2xl border border-line bg-paper-raised p-5 shadow-card">
          <h2 className="font-semibold">Members</h2>
          <p className="mb-4 mt-1 text-sm text-ink-muted">
            Optional. You can add or remove people later.
          </p>
          <MemberPicker excludeIds={NO_ONE} selected={selected} onToggle={toggle} />
        </section>
      </div>

      {error && (
        <Alert tone="error" className="mt-6">
          {error}
        </Alert>
      )}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          to="/admin/groups"
          className="inline-flex h-12 items-center justify-center rounded-xl px-5 font-semibold text-ink-soft hover:bg-paper-sunk"
        >
          Cancel
        </Link>
        <Button type="submit" loading={saving}>
          Create group
          {selected.size > 0
            ? ` with ${selected.size} ${selected.size === 1 ? 'person' : 'people'}`
            : ''}
        </Button>
      </div>
    </form>
  );
}
