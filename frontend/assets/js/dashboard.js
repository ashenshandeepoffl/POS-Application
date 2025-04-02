"use strict"; // Enforce stricter parsing and error handling

// --- Configuration ---
const API_BASE_URL = "http://127.0.0.1:8000"; // Ensure this matches your backend address

// --- Chart Instances ---
let salesTrendChartInstance = null;
let categorySalesChartInstance = null;
let paymentMethodChartInstance = null;

// --- Chart Colors ---
const chartColors = [
    '#2a2185', '#4e47a8', '#6a6fdc', '#8d87ff', '#b0aaff',
    '#d4cfff', '#7a5195', '#bc5090', '#ef5675', '#ff764a', '#ffa600' // Added more colors
];

// --- Utility Functions ---

/**
 * Fetches data from a specified API endpoint.
 * @param {string} endpoint - The API endpoint (e.g., "/dashboard/summary").
 * @returns {Promise<object|null>} - The JSON data or null if an error occurred.
 */
async function fetchData(endpoint) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        if (!response.ok) {
            console.error(`HTTP error! Status: ${response.status} for ${endpoint}`);
            // You could display a user-friendly error message here
            return null;
        }
        // Check if response is actually JSON
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
             return await response.json();
        } else {
            console.warn(`Received non-JSON response from ${endpoint}`);
            return null; // Or handle text response if expected
        }

    } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error);
        // Display error to user if needed
        return null;
    }
}

/**
 * Updates the text content of an element safely.
 * @param {string} id - The ID of the element.
 * @param {string|number} text - The text to display.
 * @param {string} [defaultValue='-'] - The value to display if text is null or undefined.
 */
function updateElementText(id, text, defaultValue = '-') {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = (text !== null && text !== undefined) ? text : defaultValue;
    } else {
        console.warn(`Element with ID '${id}' not found.`);
    }
}

/**
 * Formats a number as currency (Rs).
 * @param {number|null|undefined} value - The number to format.
 * @returns {string} - The formatted currency string (e.g., "Rs 1,234.50").
 */
function formatCurrency(value) {
    if (value === null || value === undefined || isNaN(value)) {
        return "Rs 0.00";
    }
    // Using Intl.NumberFormat for better localization if needed in the future
    return `Rs ${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Displays a message in a table body.
 * @param {string} tableBodySelector - CSS selector for the table body (tbody).
 * @param {string} message - The message to display.
 * @param {number} colSpan - The number of columns the message should span.
 */
function showTableMessage(tableBodySelector, message, colSpan) {
    const tableBody = document.querySelector(tableBodySelector);
    if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="${colSpan}" class="no-data-text">${message}</td></tr>`;
    }
}

/**
 * Hides chart placeholder and shows canvas
 * @param {string} canvasId - ID of the canvas element
 */
function showChartCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    const placeholder = document.getElementById(`${canvasId}Placeholder`);
    if (canvas && placeholder) {
        canvas.style.display = 'block'; // Or remove display: none if that's used
        placeholder.style.display = 'none';
        // Add attribute to indicate canvas has content (for CSS)
        canvas.setAttribute('data-placeholder', 'false');
    }
}

/**
 * Shows chart placeholder and hides canvas
 * @param {string} canvasId - ID of the canvas element
 * @param {string} message - Message to display in placeholder
 */
function showChartPlaceholder(canvasId, message = "No data available.") {
    const canvas = document.getElementById(canvasId);
    const placeholder = document.getElementById(`${canvasId}Placeholder`);
    if (canvas && placeholder) {
        canvas.style.display = 'none';
        placeholder.textContent = message;
        placeholder.style.display = 'flex'; // Use flex to center text
         // Remove attribute to let CSS hide placeholder if needed
        canvas.removeAttribute('data-placeholder');
    }
}

// --- Data Fetching and UI Update Functions ---

// 1. Fetch and Update Dashboard Summary Cards
async function fetchDashboardSummary() {
    const data = await fetchData("/dashboard/summary");
    if (!data) {
        // Handle error state for cards if needed
        console.error("Failed to load summary data for cards.");
        // You might want to show 'Error' or 'N/A' in the cards
        return;
    }

    updateElementText("categoriesCount", data.categories_count ?? 0);
    updateElementText("itemsCount", data.items_count ?? 0);
    updateElementText("customersCount", data.customers_count ?? 0);
    updateElementText("staffCount", data.staff_count ?? 0);
    updateElementText("storesCount", data.stores_count ?? 0);
    updateElementText("totalSales", formatCurrency(data.total_sales));
    updateElementText("totalOrders", data.total_orders ?? 0);
    updateElementText("lowStockCount", data.low_stock_count ?? 0);
    updateElementText("pendingPOCount", data.pending_purchase_orders_count ?? 0);

    if (data.top_item && data.top_item.item_name) {
        updateElementText("topItem", `${data.top_item.item_name} (${data.top_item.total_quantity ?? 0})`);
    } else {
        updateElementText("topItem", "N/A");
    }
}

// 2. Fetch and Render Sales Trend Chart (Last 7 Days)
async function renderSalesTrendChart() {
    const canvasId = 'salesTrendChart';
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) {
        console.error(`Canvas with ID '${canvasId}' not found.`);
        return;
    }

    showChartPlaceholder(canvasId, "Loading Chart..."); // Show loading state

    const data = await fetchData("/reports/sales_over_time?days=7");

    if (!data || !data.labels || !data.data || data.labels.length === 0) {
         console.warn("No data or invalid data for sales trend chart");
         showChartPlaceholder(canvasId, "No sales data for the last 7 days.");
         if (salesTrendChartInstance) salesTrendChartInstance.destroy();
         salesTrendChartInstance = null;
         return;
    }

    if (salesTrendChartInstance) {
        salesTrendChartInstance.destroy(); // Destroy previous instance
    }

    salesTrendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Daily Sales',
                data: data.data,
                borderColor: 'var(--blue)',
                backgroundColor: 'rgba(42, 33, 133, 0.1)',
                borderWidth: 2.5, // Slightly thicker line
                tension: 0.4, // Smoother curve
                fill: true,
                pointBackgroundColor: 'var(--blue)', // Point color
                pointRadius: 4, // Point size
                pointHoverRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Important for chart area sizing
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) { return formatCurrency(value).replace('Rs ', ''); }, // Format ticks
                         font: { size: 10 } // Smaller font for ticks
                    },
                    grid: {
                         color: 'rgba(0, 0, 0, 0.05)' // Lighter grid lines
                    }
                },
                 x: {
                     ticks: { font: { size: 10 } },
                     grid: { display: false } // Hide vertical grid lines
                 }
            },
            plugins: {
                legend: { display: false }, // Hide legend for single dataset
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    titleFont: { size: 12 },
                    bodyFont: { size: 11 },
                    padding: 10,
                    cornerRadius: 4,
                    displayColors: false, // Hide color box in tooltip
                    callbacks: {
                         title: function(tooltipItems) {
                             // Format date in title
                             return tooltipItems[0].label ? new Date(tooltipItems[0].label + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
                         },
                        label: function(context) {
                            return `Sales: ${formatCurrency(context.parsed.y)}`;
                        }
                    }
                }
            },
            interaction: { // Improve hover interaction
                 mode: 'index',
                 intersect: false,
            },
        }
    });
    showChartCanvas(canvasId); // Show canvas now that chart is ready
}

// 3. Fetch and Render Category Sales Chart (Today)
async function renderCategorySalesChart() {
    const canvasId = 'categorySalesChart';
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    showChartPlaceholder(canvasId, "Loading Chart...");

    const data = await fetchData("/reports/sales_by_category"); // Fetches today's data by default

    if (!data || !data.labels || !data.data || data.labels.length === 0) {
         console.warn("No data or invalid data for category sales chart.");
         showChartPlaceholder(canvasId, "No category sales data for today.");
         if (categorySalesChartInstance) categorySalesChartInstance.destroy();
         categorySalesChartInstance = null;
         return;
     }

    if (categorySalesChartInstance) {
        categorySalesChartInstance.destroy();
    }

    categorySalesChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Sales by Category',
                data: data.data,
                backgroundColor: chartColors.slice(0, data.labels.length),
                borderColor: 'var(--white)',
                borderWidth: 2.5, // Thicker border
                hoverOffset: 8, // More pronounced hover effect
                hoverBorderColor: 'var(--lightgray)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%', // Make doughnut hole larger/smaller
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                         padding: 15, // Adjusted padding
                         boxWidth: 10, // Smaller box
                         font: { size: 10 } // Smaller font
                    }
                },
                tooltip: {
                     backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    titleFont: { size: 12 },
                    bodyFont: { size: 11 },
                    padding: 10,
                    cornerRadius: 4,
                    displayColors: true, // Show color box
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) { label += ': '; }
                            if (context.parsed !== null) {
                                label += formatCurrency(context.parsed);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
     showChartCanvas(canvasId);
}

// 4. Fetch and Render Payment Method Chart (Today)
async function renderPaymentMethodChart() {
     const canvasId = 'paymentMethodChart';
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    showChartPlaceholder(canvasId, "Loading Chart...");

    const data = await fetchData("/reports/payment_methods_distribution"); // Fetches today's data

     if (!data || !data.labels || !data.data || data.labels.length === 0) {
         console.warn("No data or invalid data for payment method chart.");
          showChartPlaceholder(canvasId, "No payment data for today.");
         if (paymentMethodChartInstance) paymentMethodChartInstance.destroy();
         paymentMethodChartInstance = null;
         return;
     }

    if (paymentMethodChartInstance) {
        paymentMethodChartInstance.destroy();
    }

    paymentMethodChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Payment Methods',
                data: data.data,
                backgroundColor: chartColors.slice(0, data.labels.length).reverse(), // Reverse colors for variety
                borderColor: 'var(--white)',
                borderWidth: 2.5,
                hoverOffset: 8,
                hoverBorderColor: 'var(--lightgray)'
            }]
        },
         options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                 legend: {
                    position: 'bottom',
                    labels: {
                         padding: 15, // Adjusted padding
                         boxWidth: 10, // Smaller box
                         font: { size: 10 } // Smaller font
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    titleFont: { size: 12 },
                    bodyFont: { size: 11 },
                    padding: 10,
                    cornerRadius: 4,
                     displayColors: true,
                    callbacks: {
                        label: function(context) {
                             let label = context.label || '';
                            if (label) { label += ': '; }
                            if (context.parsed !== null) {
                                label += formatCurrency(context.parsed);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
     showChartCanvas(canvasId);
}


// 5. Fetch and Populate Recent Sales Table
async function populateRecentSalesTable() {
    const tableBody = document.querySelector("#recentSalesTable tbody");
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="5" class="loading-text">Loading...</td></tr>`; // Show loading state

    const data = await fetchData("/sales/recent?limit=5");

    tableBody.innerHTML = ''; // Clear loading/previous rows

    if (!data || data.length === 0) {
        showTableMessage("#recentSalesTable tbody", "No recent sales found.", 5);
        return;
    }

    data.forEach(sale => {
        const row = tableBody.insertRow();
        const paymentStatus = sale.payment_status || 'unknown'; // Handle null status
        row.innerHTML = `
            <td>${sale.sale_id}</td>
            <td>${sale.created_at}</td>
            <td class="text-right">${formatCurrency(sale.total_amount)}</td>
            <td><span class="status-badge status-${paymentStatus}">${paymentStatus}</span></td>
            <td>${sale.staff_name || 'N/A'}</td>
        `;
    });
}

// 6. Fetch and Populate Low Stock Table
async function populateLowStockTable() {
    const tableBody = document.querySelector("#lowStockTable tbody");
     if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="4" class="loading-text">Loading...</td></tr>`;

    const data = await fetchData("/stock/low?limit=5");

    tableBody.innerHTML = ''; // Clear loading/previous rows

    if (!data || data.length === 0) {
        showTableMessage("#lowStockTable tbody", "No items are low on stock.", 4);
        return;
    }

    data.forEach(item => {
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td>${item.item_name || 'N/A'}</td>
            <td>${item.store_name || 'N/A'}</td>
            <td class="low-stock-qty">${item.quantity}</td>
            <td>${item.min_stock_level}</td>
        `;
    });
}


// --- Initial Load Event Listener ---
document.addEventListener("DOMContentLoaded", () => {
    console.log("Dashboard DOM Loaded. Initializing...");

    // Ensure Navigation and Topbar are loaded (if using JS loading)
    // Example: Assuming nav.js and topbar.js handle their respective loading

    // Fetch all dashboard data concurrently
    Promise.all([
        fetchDashboardSummary(),
        renderSalesTrendChart(),
        renderCategorySalesChart(),
        renderPaymentMethodChart(),
        populateRecentSalesTable(),
        populateLowStockTable()
    ]).then(() => {
        console.log("Dashboard data loaded.");
    }).catch(error => {
        console.error("Error loading dashboard components:", error);
    });

    // Add event listener for sidebar toggle
    const toggleButton = document.querySelector('.toggle'); // Adjust selector if needed
    const navigation = document.querySelector('.navigation'); // Adjust selector
    const mainContent = document.querySelector('.main'); // Adjust selector

    if (toggleButton && navigation && mainContent) {
        toggleButton.addEventListener('click', () => {
            navigation.classList.toggle('active');
            mainContent.classList.toggle('active');
            // Optional: Force charts to resize after sidebar animation completes
            setTimeout(() => {
                // Check if chart instances exist before trying to resize
                if(window.Chart && window.Chart.instances) {
                    Object.values(window.Chart.instances).forEach(chart => {
                        chart.resize();
                    });
                }
                // Fallback if the above doesn't work reliably
                // if(salesTrendChartInstance) salesTrendChartInstance.resize();
                // if(categorySalesChartInstance) categorySalesChartInstance.resize();
                // if(paymentMethodChartInstance) paymentMethodChartInstance.resize();
            }, 450); // Delay slightly longer than CSS transition (adjust if needed)
        });
    } else {
        console.warn("Toggle button, navigation, or main content element not found for toggle functionality.");
    }
});