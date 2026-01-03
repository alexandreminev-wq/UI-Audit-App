import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  disabled?: boolean;
}

/**
 * Shared Button component using CSS variables for consistent theming
 * across Sidepanel and Viewer
 */
export function Button({
  variant = 'primary',
  size = 'md',
  children,
  disabled = false,
  style,
  ...props
}: ButtonProps) {
  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.15s ease',
    fontFamily: 'inherit',
    opacity: disabled ? 0.5 : 1,
    ...style,
  };

  // Size variants
  const sizeStyles: Record<typeof size, React.CSSProperties> = {
    sm: {
      padding: '6px 12px',
      fontSize: '13px',
      lineHeight: '1.4',
    },
    md: {
      padding: '8px 16px',
      fontSize: '14px',
      lineHeight: '1.5',
    },
    lg: {
      padding: '10px 20px',
      fontSize: '15px',
      lineHeight: '1.5',
    },
  };

  // Variant styles
  const variantStyles: Record<typeof variant, React.CSSProperties> = {
    primary: {
      background: 'hsl(var(--primary))',
      color: 'hsl(var(--primary-foreground))',
      border: 'none',
    },
    secondary: {
      background: 'hsl(var(--secondary))',
      color: 'hsl(var(--secondary-foreground))',
      border: '1px solid hsl(var(--border))',
    },
    ghost: {
      background: 'transparent',
      color: 'hsl(var(--foreground))',
      border: '1px solid hsl(var(--border))',
    },
    destructive: {
      background: 'hsl(var(--destructive))',
      color: 'hsl(var(--destructive-foreground))',
      border: 'none',
    },
  };

  // Hover styles (applied via inline onMouseEnter/onMouseLeave for simplicity)
  const variantHoverStyles: Record<typeof variant, React.CSSProperties> = {
    primary: {
      filter: 'brightness(0.9)',
    },
    secondary: {
      background: 'hsl(var(--muted))',
    },
    ghost: {
      background: 'hsl(var(--muted))',
    },
    destructive: {
      filter: 'brightness(0.9)',
    },
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled) {
      Object.assign(e.currentTarget.style, variantHoverStyles[variant]);
    }
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled) {
      Object.assign(e.currentTarget.style, variantStyles[variant]);
    }
  };

  return (
    <button
      style={{
        ...baseStyles,
        ...sizeStyles[size],
        ...variantStyles[variant],
      }}
      disabled={disabled}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
    </button>
  );
}

