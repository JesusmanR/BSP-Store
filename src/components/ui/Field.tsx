export function Field({
  label,
  name,
  type = 'text',
  required = false,
  placeholder,
  autoComplete,
  pattern,
  className = '',
  value,
  onChange,
}: {
  label: string;
  name?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  pattern?: string;
  className?: string;
  value?: string;
  onChange?: (val: string) => void;
}) {
  return (
    <label className={`field ${className}`.trim()}>
      {label}
      {required && <span> *</span>}
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder || label}
        autoComplete={autoComplete}
        pattern={pattern}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      />
    </label>
  );
}
