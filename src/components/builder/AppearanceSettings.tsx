import { Palette } from "lucide-react";
import { MAX_WHEEL_OPACITY, MAX_WHEEL_SCALE, MIN_WHEEL_OPACITY, MIN_WHEEL_SCALE } from "../../lib/constants";

type Props = {
  wheelScale: number;
  onWheelScaleChange: (scale: number) => void;
  wheelOpacity: number;
  onWheelOpacityChange: (opacity: number) => void;
};

type RangeSettingProps = {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
};

function RangeSetting({ label, description, value, min, max, onChange }: RangeSettingProps) {
  return <label className="settings-range">
    <span className="settings-range-copy"><strong>{label}</strong><span>{description}</span></span>
    <span className="settings-range-control">
      <input type="range" min={min} max={max} step="1" value={value} onChange={(event) => onChange(event.target.valueAsNumber)} />
      <output>{value}%</output>
    </span>
  </label>;
}

export function AppearanceSettings({ wheelScale, onWheelScaleChange, wheelOpacity, onWheelOpacityChange }: Props) {
  return <article className="settings-card">
    <div className="settings-card-heading"><span className="settings-icon"><Palette size={19} /></span><div><h2>Wheel appearance</h2><p>Adjust the wheel without changing its transparent window background.</p></div></div>
    <div className="settings-range-list">
      <RangeSetting label="Wheel size" description="Scale the wheel from 70% to 150% of its default size." value={wheelScale} min={MIN_WHEEL_SCALE} max={MAX_WHEEL_SCALE} onChange={onWheelScaleChange} />
      <RangeSetting label="Wheel opacity" description="Control how see-through the dark main and submenu wedge fills are." value={wheelOpacity} min={MIN_WHEEL_OPACITY} max={MAX_WHEEL_OPACITY} onChange={onWheelOpacityChange} />
    </div>
  </article>;
}
