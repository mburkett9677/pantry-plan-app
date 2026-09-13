"use client";

import { useFormStatus } from "react-dom";

function SubmitButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-secondary" type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

export function SkylightTestForm({
  action,
}: {
  action: () => Promise<void>;
}) {
  return (
    <form action={action}>
      <SubmitButton label="Test connection" pendingLabel="Testing…" />
    </form>
  );
}
