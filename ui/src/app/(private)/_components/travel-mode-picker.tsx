"use client";

import { Bike, Car, Footprints } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { TRAVEL_MODE_LABEL } from "@/api/routing";
import { Button } from "@/components/ui/button";
import type { TravelMode } from "@/types/geo";

const MODES: { mode: TravelMode; icon: LucideIcon }[] = [
  { mode: "auto", icon: Car },
  { mode: "bicycle", icon: Bike },
  { mode: "pedestrian", icon: Footprints },
];

type TravelModePickerProps = {
  value: TravelMode;
  onChange: (mode: TravelMode) => void;
  disabled?: boolean;
};

/**
 * Input: Phương tiện đang chọn + callback đổi.
 * Output: Nhóm 3 nút ô tô / xe đạp / đi bộ. Mỗi phương tiện là một costing model riêng
 *         của Valhalla nên đổi nút là quãng đường và thời gian đổi thật.
 */
export function TravelModePicker({
  value,
  onChange,
  disabled = false,
}: TravelModePickerProps) {
  return (
    <div className="flex gap-1.5" role="group" aria-label="Phương tiện">
      {MODES.map(({ mode, icon: Icon }) => {
        const isActive = mode === value;
        return (
          <Button
            key={mode}
            type="button"
            size="sm"
            variant={isActive ? "default" : "outline"}
            className="flex-1"
            aria-pressed={isActive}
            disabled={disabled}
            onClick={() => onChange(mode)}
          >
            <Icon aria-hidden="true" />
            {TRAVEL_MODE_LABEL[mode]}
          </Button>
        );
      })}
    </div>
  );
}
