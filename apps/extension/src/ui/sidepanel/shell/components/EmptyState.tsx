export function EmptyState() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      minHeight: '400px',
    }}>
      {/* Illustration Placeholder */}
      <div style={{
        width: '100%',
        maxWidth: '280px',
        padding: '48px 32px',
        border: '2px dashed hsl(var(--border))',
        borderRadius: 'var(--radius)',
        background: 'hsl(var(--muted))',
        marginBottom: '24px',
      }}>
        {/* Card illustration */}
        <div style={{
          background: '#d1d5db',
          height: '64px',
          borderRadius: '8px',
          marginBottom: '12px',
        }} />
        <div style={{
          background: '#d1d5db',
          height: '12px',
          borderRadius: '4px',
          marginBottom: '8px',
        }} />
        <div style={{
          background: '#d1d5db',
          height: '12px',
          width: '60%',
          borderRadius: '4px',
          marginBottom: '16px',
        }} />
        <div style={{
          background: '#1f2937',
          height: '16px',
          borderRadius: '4px',
        }} />
      </div>

      {/* Text */}
      <h3 style={{
        margin: 0,
        marginBottom: '16px',
        fontSize: '16px',
        fontWeight: 600,
        color: 'hsl(var(--foreground))',
      }}>
        No captures yet....
      </h3>

      {/* Instructions */}
      <ol style={{
        margin: 0,
        padding: 0,
        listStyle: 'decimal',
        listStylePosition: 'inside',
        color: 'hsl(var(--muted-foreground))',
        fontSize: '14px',
        lineHeight: '1.8',
      }}>
        <li>Capture by clicking on stuff.</li>
        <li>Review details and provide context, save.</li>
        <li>Keep track with the project inventory.</li>
        <li>When you are done, open the project library to organize your audit.</li>
      </ol>
    </div>
  );
}
