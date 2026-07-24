"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { EquipmentPicker } from "@/components/menu/equipment-picker";
import {
  updateMenuEquipmentAction,
  type UpdateMenuEquipmentState,
} from "@/domain/menu/equipment-actions";
import {
  DEFAULT_AVAILABLE_EQUIPMENT,
  equipmentToCsv,
  listFromSelection,
  selectionFromList,
  type EquipmentId,
  type EquipmentSelection,
} from "@/domain/menu/equipment";

type MenuEquipmentEditorProps = {
  menuId: string;
  initialEquipment: EquipmentId[];
};

export function MenuEquipmentEditor({
  menuId,
  initialEquipment,
}: MenuEquipmentEditorProps) {
  const [equipment, setEquipment] = useState<EquipmentSelection>(() =>
    selectionFromList(initialEquipment),
  );
  const [state, formAction, isPending] = useActionState<
    UpdateMenuEquipmentState,
    FormData
  >(updateMenuEquipmentAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const skipFirst = useRef(true);
  const equipmentCsv = equipmentToCsv(
    listFromSelection(equipment) ?? [...DEFAULT_AVAILABLE_EQUIPMENT],
  );

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    formRef.current?.requestSubmit();
  }, [equipmentCsv]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mb-6 max-w-xl text-left"
      data-component="menu-equipment-editor"
    >
      <input type="hidden" name="menuId" value={menuId} />
      <input type="hidden" name="equipment" value={equipmentCsv} />
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-slot-label">
        Техника для этого меню
      </p>
      <EquipmentPicker
        value={equipment}
        onChange={setEquipment}
        disabled={isPending}
        ariaLabel="Техника для этого меню"
      />
      {state && !state.ok ? (
        <p className="mt-2 text-sm text-warning-fg" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
