import { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [benutzer, setBenutzer] = useState(
        JSON.parse(localStorage.getItem('benutzer') || 'null')
    );
    const [managementModus, setManagementModusState] = useState(
        () => localStorage.getItem('managementModus') === 'true'
    );

    function setManagementModus(wert) {
        localStorage.setItem('managementModus', String(wert));
        setManagementModusState(wert);
    }

    function login(token, user) {
        localStorage.setItem('token', token);
        localStorage.setItem('benutzer', JSON.stringify(user));
        setBenutzer(user);
    }

    function logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('benutzer');
        setBenutzer(null);
    }

    return (
        <AuthContext.Provider value={{ benutzer, login, logout, managementModus, setManagementModus }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}