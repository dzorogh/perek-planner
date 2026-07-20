"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { continueToPortionsAction } from "@/domain/menu/slot-actions";

type ContinueToShoppingButtonProps = {
  menuId: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      data-component="continue-to-shopping"
      className="w-full rounded-sm sm:w-auto"
      disabled={pending}
      aria-disabled={pending}
      aria-busy={pending}
    >
      {pending ? "Переходим…" : "К списку покупок →"}
    </Button>
  );
}

export function ContinueToShoppingButton({
  menuId,
}: ContinueToShoppingButtonProps) {
  return (
    <form action={continueToPortionsAction} className="mt-8 max-w-xl">
      <input type="hidden" name="menuId" value={menuId} />
      <SubmitButton />
    </form>
  );
}
