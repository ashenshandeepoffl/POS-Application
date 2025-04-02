document.addEventListener("DOMContentLoaded", function () {
    const contentContainer = document.getElementById("content-container");
    const navItems = document.querySelectorAll(".navigation ul li a");

    // Function to load pages dynamically
    function loadPage(page) {
        fetch(`${page}.html`)
            .then(response => {
                if (!response.ok) throw new Error("Page not found.");
                return response.text();
            })
            .then(data => {
                contentContainer.innerHTML = data;
                console.log(`Page ${page} loaded successfully`);
            })
            .catch(error => {
                contentContainer.innerHTML = "<h2>Page Not Found</h2>";
                console.error("Error loading page:", error);
            });
    }

    // Handle menu clicks
    navItems.forEach(item => {
        item.addEventListener("click", function (event) {
            event.preventDefault();
            const page = this.getAttribute("data-target");

            // ✅ FIX: Refresh page when clicking Dashboard
            if (page === "dashboard") {
                location.reload(); // Refresh the entire page
                return;
            }

            if (page) {
                loadPage(page);
            }

            // Remove active class from all and set the clicked one as active
            navItems.forEach(nav => nav.parentElement.classList.remove("active"));
            this.parentElement.classList.add("active");
        });
    });

    // Sidebar Toggle
    let toggle = document.querySelector(".toggle");
    let navigation = document.querySelector(".navigation");
    let main = document.querySelector(".main");

    toggle.onclick = function () {
        navigation.classList.toggle("active");
        main.classList.toggle("active");
    };
});
