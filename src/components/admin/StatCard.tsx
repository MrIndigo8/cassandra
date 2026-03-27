interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
}

export default function StatCard({ title, value, change, changeType = 'neutral', icon }: StatCardProps) {
  const changeClass =
    changeType === 'positive'
      ? 'text-emerald-400'
      : changeType === 'negative'
      ? 'text-red-400'
      : 'text-text-muted';

  return (
    <div className="card border-border p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-text-secondary">{title}</p>
        {icon}
      </div>
      <p className="text-3xl font-bold text-text-primary">{value}</p>
      {change ? <p className={`mt-2 text-xs ${changeClass}`}>{change}</p> : null}
    </div>
  );
}
