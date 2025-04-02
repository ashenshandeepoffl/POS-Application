document.addEventListener("DOMContentLoaded", () => {
  // Load the top bar HTML into the placeholder with id "topbar-placeholder"
  fetch("topbar.html")
    .then(response => response.text())
    .then(data => {
      document.getElementById("topbar-placeholder").innerHTML = data;
      initializeTopbarSearch();
    })
    .catch(error => console.error("Error loading top bar:", error));
});

function initializeTopbarSearch() {
  const searchInput = document.getElementById("globalSearch");
  const suggestionsBox = document.getElementById("searchSuggestions");

  let debounceTimeout;

  searchInput.addEventListener("input", function() {
    const query = this.value.trim();

    clearTimeout(debounceTimeout);
    if (query.length === 0) {
      suggestionsBox.innerHTML = "";
      suggestionsBox.style.display = "none";
      return;
    }

    debounceTimeout = setTimeout(() => {
      fetch(`/search?q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            suggestionsBox.innerHTML = "";
            data.forEach(item => {
              const div = document.createElement("div");
              div.classList.add("suggestion");
              div.textContent = item.label;
              div.addEventListener("click", () => {
                // Navigate to the URL provided by the suggestion
                window.location.href = item.url;
              });
              suggestionsBox.appendChild(div);
            });
            suggestionsBox.style.display = "block";
          } else {
            suggestionsBox.innerHTML = "";
            suggestionsBox.style.display = "none";
          }
        })
        .catch(err => {
          console.error("Error fetching search suggestions:", err);
          suggestionsBox.innerHTML = "";
          suggestionsBox.style.display = "none";
        });
    }, 300); // 300ms debounce delay
  });

  // Hide suggestions when clicking outside the search box
  document.addEventListener("click", function(e) {
    if (!searchInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
      suggestionsBox.style.display = "none";
    }
  });
}
