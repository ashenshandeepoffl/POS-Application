document.addEventListener("DOMContentLoaded", () => {
    // SIGNUP
    const signupForm = document.getElementById("signupForm");
    if (signupForm) {
      signupForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const fullName = document.getElementById("fullName").value.trim();
        const email = document.getElementById("email").value.trim();
        const accountType = document.getElementById("accountType").value;
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirmPassword").value;
  
        // Basic check
        if (password !== confirmPassword) {
          alert("Passwords do not match!");
          return;
        }
  
        alert(
          `Signup successful!\nName: ${fullName}\nEmail: ${email}\nType: ${accountType}`
        );
        // Redirect to dashboard or login
        window.location.href = "dashboard.html";
      });
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    console.log("Dashboard Loaded");

    // Chart Initialization (Example)
    if (document.getElementById('overviewChart')) {
        const ctx = document.getElementById('overviewChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ["Jan", "Feb", "Mar", "Apr", "May"],
                datasets: [{
                    label: "Revenue",
                    data: [5, 10, 15, 20, 25],
                    borderColor: "blue",
                    fill: false
                }]
            }
        });
    }

    // Sidebar Toggle for Mobile
    const sidebar = document.querySelector(".sidebar");
    const toggleBtn = document.createElement("button");
    toggleBtn.innerHTML = "☰";
    toggleBtn.classList.add("toggle-btn");
    document.body.appendChild(toggleBtn);

    toggleBtn.addEventListener("click", () => {
        sidebar.classList.toggle("collapsed");
    });

    // Highlight active menu item
    document.querySelectorAll(".sidebar-nav ul li").forEach(item => {
        item.addEventListener("click", function() {
            document.querySelectorAll(".sidebar-nav ul li").forEach(el => el.classList.remove("active"));
            this.classList.add("active");
        });
    });

    // Button Hover Effect
    document.querySelectorAll("button").forEach(btn => {
        btn.addEventListener("mouseenter", () => {
            btn.style.transform = "scale(1.05)";
        });
        btn.addEventListener("mouseleave", () => {
            btn.style.transform = "scale(1)";
        });
    });
});

document.addEventListener("DOMContentLoaded", () => {
  console.log("Dashboard Loaded");

  // Modal Toggle
  const modal = document.querySelector(".modal");
  const openModalBtn = document.querySelector(".add-category");
  const closeModalBtn = document.querySelector(".close");

  openModalBtn.addEventListener("click", () => {
      modal.classList.add("show");
  });

  closeModalBtn.addEventListener("click", () => {
      modal.classList.remove("show");
  });

  window.addEventListener("click", (e) => {
      if (e.target === modal) {
          modal.classList.remove("show");
      }
  });
})

document.addEventListener("DOMContentLoaded", function () {
  const loginForm = document.getElementById("loginForm");

  if (loginForm) {
    loginForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;

      if (!email || !password) {
        alert("Please enter both email and password.");
        return;
      }

      try {
        const response = await fetch("http://127.0.0.1:8000/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
          alert("Login failed: " + (data.detail || "Invalid credentials"));
          return;
        }

        // Token and user details
        localStorage.setItem("authToken", data.token);
        localStorage.setItem("userRole", data.role);
        localStorage.setItem("isManager", data.is_manager);
        localStorage.setItem("fullName", data.full_name);

        // Correct redirection
        if (data.is_manager || data.role.toLowerCase() === "Employee") {
          window.location.href = "dashboard.html";
        } else {
          window.location.href = "cashiersDashboard.html";
        }
      } catch (error) {
        console.error("Login error:", error);
        alert("Server error. Please try again later.");
      }
    });
  }
});
