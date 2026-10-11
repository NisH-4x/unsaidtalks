import { FormEvent, useState } from 'react';
import { updateGroup } from '../../../api/admin.api';
import { toApiError } from '../../../api/errors';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { AdminGroupDetails } from '../../../types/conversation';
import { GroupDetailsFields } from './GroupDetailsFields';
import { groupDetailsFrom, toGroupDetailsInput, validateGroupName } from './groupDetails';

interface GroupDetailsEditorProps {
  group: AdminGroupDetails;
  onSaved: (group: AdminGroupDetails) => void;
}

export function GroupDetailsEditor({ group, onSaved }: GroupDetailsEditorProps) {
  const [values, setValues] = useState(() => groupDetailsFrom(group));
  const [nameError, setNameError] = useState<string>();
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const saved = groupDetailsFrom(group);
  const changed = (Object.keys(values) as Array<keyof typeof values>).some(
    (key) => values[key] !== saved[key],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const invalidName = validateGroupName(values.name);
    setNameError(invalidName);
    if (invalidName) return;

    setSaving(true);
    setNotice(null);
    try {
      const updated = await updateGroup(group.id, toGroupDetailsInput(values));
      setValues(groupDetailsFrom(updated));
      onSaved(updated);
      setNotice({ tone: 'success', text: 'Group details saved.' });
    } catch (caught) {
      setNotice({ tone: 'error', text: toApiError(caught).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-2xl border border-line bg-paper-raised p-5 shadow-card"
    >
      <h2 className="mb-4 font-semibold">Details</h2>
      <GroupDetailsFields
        values={values}
        onChange={(next) => {
          setValues(next);
          setNotice(null);
        }}
        nameError={nameError}
      />
      {notice && (
        <Alert tone={notice.tone} className="mt-5">
          {notice.text}
        </Alert>
      )}
      <div className="mt-5 flex justify-end">
        <Button type="submit" loading={saving} disabled={!changed}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
