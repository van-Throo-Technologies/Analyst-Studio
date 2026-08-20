"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

/**
 * Submit button that disables itself while its form is in flight.
 *
 * AI jobs in this app take real seconds, so a pending state is not a nicety —
 * without it an analyst will double-submit an extraction run.
 */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  className,
  disabled,
  title,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  disabled?: boolean;
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      title={title}
      disabled={pending || disabled}
      aria-busy={pending}
    >
      {pending ? (pendingLabel ?? "Working…") : children}
    </Button>
  );
}
