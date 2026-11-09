import { Icon } from './Icon';

export function Quantity({ value, set }: { value: number; set: (n: number) => void }) {
  return (
    <div className="quantity">
      <button
        type="button"
        aria-label="Disminuir cantidad"
        onClick={() => set(Math.max(1, value - 1))}
        disabled={value <= 1}
      >
        <Icon name="minus" size={15} />
      </button>
      <span>{value}</span>
      <button
        type="button"
        aria-label="Aumentar cantidad"
        onClick={() => set(Math.min(20, value + 1))}
        disabled={value >= 20}
      >
        <Icon name="plus" size={15} />
      </button>
    </div>
  );
}
