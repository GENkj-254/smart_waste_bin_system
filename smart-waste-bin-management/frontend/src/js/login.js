// This file contains JavaScript logic for the login page, including form validation and submission to the backend authentication endpoint.

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username'); // changed from email
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('errorMessage');

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorMessage.textContent = '';

        const username = usernameInput.value;
        const password = passwordInput.value;

        if (!username || !password) {
            errorMessage.textContent = 'Please enter both username and password.';
            return;
        }

        try {
            const response = await fetch('https://smart-waste-bin-management-system.onrender.com/api/auth/login', { // use the correct backend port
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }), // updated field
            });

            const data = await response.json();

            if (response.ok) {
                // ✅ Store user data in localStorage
                localStorage.setItem('token', data.token);
                localStorage.setItem('username', data.username);
                localStorage.setItem('role', data.role);
                localStorage.setItem('lastLogin', new Date().toISOString());

                // ✅ Redirect to dashboard
                window.location.href = 'smart_waste_dashboard.html';
            } else {
                errorMessage.textContent = data.message || 'Login failed. Please try again.';
            }
        } catch (error) {
            errorMessage.textContent = 'An error occurred. Please try again later.';
            console.error(error);
        }
    });
});
