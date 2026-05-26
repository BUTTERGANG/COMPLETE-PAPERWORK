import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: string;
  variant?: 'default' | 'accent' | 'success';
}

function StatCard({ label, value, icon, trend, variant = 'default' }: StatCardProps) {
  const variants = {
    default: '',
    accent: 'bg-accent/8 border-accent/20',
    success: 'bg-success/8 border-success/20',
  };

  return (
    <div className={`card-elevated ${variants[variant]} animate-fade-in`}>
      <div className="flex items-start justify-between mb-3">
        {icon && (
          <div className="w-9 h-9 rounded-xl bg-surface-3 flex items-center justify-center text-text-secondary">
            {icon}
          </div>
        )}
        {trend && (
          <span className="text-xs font-medium text-success">{trend}</span>
        )}
      </div>
      <p className="text-2xl font-bold tracking-tight text-text-primary">{value}</p>
      <p className="text-xs font-medium text-text-tertiary mt-1 uppercase tracking-wider">{label}</p>
    </div>
  );
}

export default React.memo(StatCard);
