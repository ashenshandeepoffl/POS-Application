document.addEventListener('DOMContentLoaded', () => {
    // Get references to DOM elements
    const dateElement = document.getElementById('current-date');
    const timeElement = document.getElementById('current-time');
    const logoutButton = document.getElementById('logout-button');
    const cashierNameElement = document.getElementById('cashier-name');
    const yearElement = document.getElementById('current-year');

    // Function to update date and time display
    function updateDateTime() {
        const now = new Date();

        // Format Date (e.g., Tuesday, July 26, 2024)
        const dateOptions = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        if (dateElement) {
            dateElement.textContent = now.toLocaleDateString(undefined, dateOptions);
        }

        // Format Time (e.g., 02:15:30 PM)
        const timeOptions = {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true // Use true for AM/PM format
        };
        if (timeElement) {
            timeElement.textContent = now.toLocaleTimeString(undefined, timeOptions);
        }
    }

    // Function to set the welcome message using stored name
    function setWelcomeMessage() {
        if (cashierNameElement) {
            const fullName = localStorage.getItem('fullName');
            if (fullName) {
                cashierNameElement.textContent = `Welcome, ${fullName}!`;
            } else {
                cashierNameElement.textContent = 'Welcome, Cashier!'; // Fallback
            }
        }
    }

    // Function to set the current year in the footer
     function setFooterYear() {
        if (yearElement) {
            yearElement.textContent = new Date().getFullYear();
        }
    }

    // Add event listener for the logout button
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            console.log('Logout initiated...');

            // Clear authentication tokens and user info from localStorage
            localStorage.removeItem('authToken');
            localStorage.removeItem('userRole');
            localStorage.removeItem('isManager');
            localStorage.removeItem('fullName');
            // Add any other relevant items stored during login

            console.log('User data cleared from local storage.');

            // Redirect to the login page
            window.location.href = 'login.html';
        });
    } else {
        console.error('Logout button element not found!');
    }

    // --- Initial Page Setup ---
    setWelcomeMessage();
    setFooterYear();
    updateDateTime(); // Update immediately when the page loads
    setInterval(updateDateTime, 1000); // Update the time every second

    // --- Optional: Access Control Check ---
    // Uncomment and adapt if needed to prevent managers from accessing this page
    /*
    const isManager = localStorage.getItem('isManager') === 'true';
    const authToken = localStorage.getItem('authToken');

    if (!authToken) {
        console.warn('No authentication token found. Redirecting to login.');
        // window.location.href = 'login.html';
    } else if (isManager) {
        console.warn('Manager detected on cashier dashboard. Redirecting to manager dashboard.');
        // window.location.href = 'dashboard.html';
    }
    */

});