import { Switch } from '../../../components/ui/Switch';
import { TextField } from '../../../components/ui/TextField';
import { GroupDetailsValues } from './groupDetails';

interface GroupDetailsFieldsProps {
  values: GroupDetailsValues;
  onChange: (values: GroupDetailsValues) => void;
  nameError?: string;
}

export function GroupDetailsFields({ values, onChange, nameError }: GroupDetailsFieldsProps) {
  const set = <K extends keyof GroupDetailsValues>(key: K, value: GroupDetailsValues[K]) =>
    onChange({ ...values, [key]: value });

  return (
    <div className="space-y-5">
      <TextField
        name="name"
        label="Group name"
        placeholder="TCS NQT Prep – Batch 12"
        value={values.name}
        onChange={(event) => set('name', event.target.value)}
        error={nameError}
        maxLength={80}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="program"
          label="Program"
          placeholder="TCS NQT Prep"
          value={values.program}
          onChange={(event) => set('program', event.target.value)}
          maxLength={80}
        />
        <TextField
          name="batch"
          label="Batch"
          placeholder="Batch 12"
          value={values.batch}
          onChange={(event) => set('batch', event.target.value)}
          maxLength={40}
        />
      </div>
      <div>
        <label
          htmlFor="field-description"
          className="mb-1.5 block text-sm font-medium text-ink-soft"
        >
          Description
        </label>
        <textarea
          id="field-description"
          name="description"
          rows={3}
          maxLength={500}
          value={values.description}
          onChange={(event) => set('description', event.target.value)}
          placeholder="What this group is for, schedules, expectations…"
          className="w-full resize-y rounded-xl border border-line-strong bg-paper-raised px-3.5 py-3 text-base text-ink placeholder:text-ink-faint focus:border-pine-500 focus:outline-none focus:ring-4 focus:ring-pine-100"
        />
      </div>
      <div className="rounded-xl border border-line bg-paper-sunk/50 p-4">
        <Switch
          checked={values.allowMenteeDirectChat}
          onChange={(checked) => set('allowMenteeDirectChat', checked)}
          label="Allow mentees to message each other"
          description="Off by default. Mentees can always message the mentors of their groups."
        />
      </div>
    </div>
  );
}
