"use client";

import { CreateMenuForm } from "@/components/menu/create-menu-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CreateMenuDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateMenuDialog({
  open,
  onOpenChange,
}: CreateMenuDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[min(100%,32rem)] max-h-[min(90vh,40rem)] overflow-y-auto"
        data-component="create-menu-dialog"
      >
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="page-title text-center">
            Новое меню
          </DialogTitle>
          <p className="mt-1.5 text-center text-sm text-muted-foreground">
            Одна готовка · список ингредиентов для покупки.
          </p>
        </DialogHeader>
        <CreateMenuForm />
      </DialogContent>
    </Dialog>
  );
}
