document.addEventListener("DOMContentLoaded", function () {
    // Load the navigation HTML into the placeholder
    fetch("nav.html")
      .then(response => response.text())
      .then(data => {
        document.getElementById("nav-placeholder").innerHTML = data;
        highlightActiveTab();
      })
      .catch(error => console.error("Error loading navigation:", error));
  });
  
  // Function to highlight the active navigation tab
  function highlightActiveTab() {
    const navLinks = document.querySelectorAll(".navigation ul li a");
    const currentPage = window.location.pathname.split("/").pop();
    navLinks.forEach(link => {
      const href = link.getAttribute("href");
      // Compare current page with link href (defaulting to dashboard.html if empty)
      if (href === currentPage || (currentPage === "" && href === "dashboard.html")) {
        link.parentElement.classList.add("active");
      }
    });

    // Add this to your existing DOMContentLoaded listener
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            // Clear token from localStorage or sessionStorage
            localStorage.removeItem('token'); // Or sessionStorage.removeItem('token');
            // Redirect to login page
            window.location.href = 'login.html'; // Replace with your login page URL
        });
    }
  }
  