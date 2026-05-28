import { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [benutzer, setBenutzer] = useState(
        JSON.parse(localStorage.getItem('benutzer') || 'null')
    );
    const [managementModus, setManagementModus] = useState(false);

    function login(token, user) {
        localStorage.setItem('token', token);
        localStorage.setItem('benutzer', JSON.stringify(user));
        setBenutzer(user);
    }

    function logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('benutzer');
        setBenutzer(null);
        setManagementModus(false);
    }

    function toggleManagementModus() {
        setManagementModus(m => !m);
    }

    return (
        <AuthContext.Provider value={{ benutzer, login, logout, managementModus, toggleManagementModus }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}