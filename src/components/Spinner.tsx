interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-10 h-10' };
  return (
    <div className={`${sizes[size]} border-2 border-border border-t-accent rounded-full animate-spin ${className}`} />
  );
}
