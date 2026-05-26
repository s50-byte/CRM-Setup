export default function FormField({ label, children }) {
    return (
        <div style={{ marginBottom: 10 }}>
            <label style={{
                display: 'block', fontSize: 11, fontWeight: 600, color: '#6B6860',
                textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3
            }}>{label}</label>
            {children}
        </div>
    );
}

export const inputStyle = {
    width: '100%', fontSize: 13, padding: '7px 11px',
    border: '1px solid rgba(0,0,0,.09)', borderRadius: 6,
    background: '#F5F4F0', fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box', color: '#1A1917'
};

export const rowStyle = {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10
};

export const btnRow = {
    display: 'flex', gap: 7, marginTop: '1.125rem', justifyContent: 'flex-end'
};

export const btnPrimary = {
    padding: '7px 16px', fontSize: 13, fontWeight: 500,
    cursor: 'pointer', border: 'none', borderRadius: 6,
    background: '#2563EB', color: '#fff', fontFamily: 'inherit'
};

export const btnSecondary = {
    padding: '7px 14px', fontSize: 13, fontWeight: 500,
    cursor: 'pointer', border: '1px solid rgba(0,0,0,.09)', borderRadius: 6,
    background: '#fff', color: '#6B6860', fontFamily: 'inherit'
};