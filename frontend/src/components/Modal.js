export default function Modal({ open, onClose, title, children, width = 500 }) {
    if (!open) return null;

    return (
        <div
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,.38)',
                zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(2px)'
            }}
        >
            <div style={{
                background: '#fff', borderRadius: 10, padding: '1.375rem',
                width, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto',
                border: '1px solid rgba(0,0,0,.09)',
                boxShadow: '0 4px 24px rgba(0,0,0,.12)',
                animation: 'modalIn .18s ease'
            }}>
                <style>{`@keyframes modalIn { from { opacity:0; transform:translateY(8px) scale(.98) } to { opacity:1; transform:none } }`}</style>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: '1.125rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{title}</span>
                    <button onClick={onClose} style={{
                        width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(0,0,0,.09)',
                        background: '#F5F4F0', cursor: 'pointer', fontSize: 14, color: '#6B6860',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>×</button>
                </div>
                {children}
            </div>
        </div>
    );
}