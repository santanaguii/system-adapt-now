// =============================================
// MEU SISTEMA - Auth JavaScript
// =============================================

// Auth-related client-side functionality
// Most auth is handled server-side via forms

document.addEventListener('DOMContentLoaded', () => {
    // Password strength indicator (optional enhancement)
    const passwordInput = document.querySelector('input[name="password"], input[name="new_password"]');
    
    if (passwordInput) {
        passwordInput.addEventListener('input', (e) => {
            const password = e.target.value;
            const strength = getPasswordStrength(password);
            
            // Could add visual indicator here
            passwordInput.style.borderColor = strength.color;
        });
    }
    
    // Form validation
    const authForm = document.querySelector('.auth-form');
    if (authForm) {
        authForm.addEventListener('submit', (e) => {
            const password = authForm.querySelector('input[name="password"], input[name="new_password"]');
            
            if (password && password.value.length < 6) {
                e.preventDefault();
                alert('A senha deve ter pelo menos 6 caracteres');
                password.focus();
                return false;
            }
            
            // Confirm password validation could go here
        });
    }
});

function getPasswordStrength(password) {
    if (password.length < 6) {
        return { level: 'weak', color: 'hsl(0, 70%, 55%)' };
    }
    
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    
    if (score < 3) {
        return { level: 'weak', color: 'hsl(0, 70%, 55%)' };
    } else if (score < 5) {
        return { level: 'medium', color: 'hsl(35, 90%, 50%)' };
    } else {
        return { level: 'strong', color: 'hsl(120, 50%, 45%)' };
    }
}
