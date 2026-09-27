type Props = {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export function SettingsToggle({ label, description, checked, onChange, disabled = false }: Props) {
  return <label className={`settings-toggle${disabled ? " is-disabled" : ""}`}>
    <span className="settings-toggle-copy"><strong>{label}</strong><span>{description}</span></span>
    <span className="settings-toggle-control">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span className="settings-toggle-track" aria-hidden="true"><span /></span>
    </span>
  </label>;
}
