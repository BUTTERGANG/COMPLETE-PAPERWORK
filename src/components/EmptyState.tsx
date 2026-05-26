interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action, secondaryAction }: EmptyStateProps) {
  return (
    <div className="card-elevated text-center py-16 animate-fade-in">
      <div className="w-14 h-14 rounded-2xl bg-surface-3 flex items-center justify-center mx-auto mb-4">
        {icon}
      </div>
      <p className="text-base font-semibold text-text-primary mb-1">{title}</p>
      <p className="text-sm text-text-tertiary mb-6">{description}</p>
      {action && (
        <button onClick={action.onClick} className="btn-primary">
          {action.label}
        </button>
      )}
      {secondaryAction && (
        <button onClick={secondaryAction.onClick} className="btn-secondary mt-3">
          {secondaryAction.label}
        </button>
      )}
    </div>
  );
}
