// assets/js/checkout.js

// ---------------------
// Global Variables & Constants
// ---------------------
const BASE_URL = "http://127.0.0.1:8000"; // Your API Base URL

// State Variables
let modalInput = "0";            // For product quantity modal
let cashModalInput = "";         // For cash received modal
let customerModalInput = "";     // For customer phone modal number pad
let selectedProduct = null;      // Product being added/edited via modal
let selectedCustomerId = null;   // ID of the selected customer
let currentOrder = [];           // Array of { product, quantity } objects
let lastOrderId = null;          // ID of the last successfully processed order
let categories = [];             // Cache for categories
let allProducts = [];            // Cache for all products

// --- DOM Element References ---
// Modals
const productModal = document.getElementById("productModal");
const cashModal = document.getElementById("cashModal");
const customerModal = document.getElementById("customerModal");

// Product Modal Elements
const modalProductName = document.getElementById("modalProductName");
const modalProductPrice = document.getElementById("modalProductPrice");
const modalQuantityDisplay = document.getElementById("modalQuantityDisplay");
const modalQuantityEl = document.getElementById("modalQuantity");
const modalTotalEl = document.getElementById("modalTotal");
const modalConfirmBtn = document.getElementById("modalConfirm");

// Cash Modal Elements
const cashDisplay = document.getElementById("cashDisplay");
const cashReceivedInput = document.getElementById("cashReceived");
const changeDisplay = document.getElementById("changeDisplay");

// Customer Modal Elements
const customerPhoneDisplay = document.getElementById("customerPhoneDisplay");
const customerResultsArea = document.getElementById("customerResultsArea");
const addCustomerSection = document.getElementById("addCustomerSection");
const newCustomerNameInput = document.getElementById("newCustomerNameInput");
const newCustomerEmailInput = document.getElementById("newCustomerEmailInput");
const customerMessageArea = document.getElementById("customerMessageArea");

// Main Page Elements
const categoryListEl = document.getElementById("categoryList");
const productListEl = document.getElementById("productList");
const productSearchInput = document.getElementById("productSearch");
const orderItemsEl = document.getElementById("orderItems");
const orderTotalEl = document.getElementById("orderTotal");
const discountSelect = document.getElementById("discountSelect");
const taxSelect = document.getElementById("taxSelect");
const paymentMethodSelect = document.getElementById("paymentMethodSelect");
const customerDisplayInput = document.getElementById("customerDisplay");
const selectedCustomerIdInput = document.getElementById("selectedCustomerId"); // Hidden input
const checkoutBtn = document.getElementById("checkoutBtn");
const printReceiptBtn = document.getElementById("printReceiptBtn");
const clearOrderBtn = document.getElementById("clearOrderBtn");

// ---------------------
// Utility Functions
// ---------------------
/**
 * Fetches data from the API with error handling.
 * @param {string} url - The API endpoint URL.
 * @param {object} options - Fetch options (method, headers, body).
 * @returns {Promise<any>} - The JSON response data.
 * @throws {Error} - If the fetch fails or the response is not ok.
 */
async function fetchData(url, options = {}) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            let errorDetail = `HTTP error ${response.status}: ${response.statusText}`;
            try {
                // Try to get more specific error from backend response body
                const errorData = await response.json();
                errorDetail = errorData.detail || errorDetail;
            } catch (jsonError) {
                // Ignore if response is not JSON or empty
            }
            throw new Error(errorDetail);
        }
        // Handle cases with no content (like DELETE)
        if (response.status === 204) {
            return null;
        }
        return await response.json();
    } catch (error) {
        console.error(`Fetch error for ${url}:`, error);
        throw error; // Re-throw the error to be caught by the caller
    }
}

/** Debounce function to limit rapid function calls (e.g., search input) */
function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}


// ---------------------
// Initialization
// ---------------------
document.addEventListener('DOMContentLoaded', initializeCheckout);

async function initializeCheckout() {
    console.log("Initializing Checkout Page...");
    showLoadingIndicators(true); // Show loading state

    try {
        // Load initial data in parallel for faster startup
        await Promise.all([
            loadCategories(),
            loadProducts(),
            loadDiscountOptions(),
            loadTaxOptions(),
            loadPaymentMethods()
        ]);

        // Initial UI setup
        renderOrder(); // Render empty order state
        updateModalDisplay(); // Initialize product modal display state
        updateCashModalDisplay(); // Initialize cash modal display state
        updateCustomerModalDisplay(); // Initialize customer modal display state

        // Attach event listeners after initial load
        attachEventListeners();

        console.log("Checkout Page Initialized Successfully.");

    } catch (error) {
        console.error("Initialization failed:", error);
        // Display a user-friendly error message on the page
        displayGlobalError("Failed to initialize the checkout system. Please try refreshing the page.");
    } finally {
        showLoadingIndicators(false); // Hide loading state
    }
}

function showLoadingIndicators(isLoading) {
    // Add simple visual cues, like disabling buttons or showing spinners
    // Example:
    checkoutBtn.disabled = isLoading;
    clearOrderBtn.disabled = isLoading;
    // You could add overlay divs etc.
    console.log(`Loading state: ${isLoading}`);
}

function displayGlobalError(message) {
    // Example: Display error in a dedicated div or alert
    alert(`Error: ${message}`);
    // Or update a specific element:
    // const errorContainer = document.getElementById('errorContainer');
    // if (errorContainer) errorContainer.textContent = message;
}


function attachEventListeners() {
    // Product Search (with debounce)
    productSearchInput.addEventListener("input", debounce(handleProductSearch, 300));

    // Modal Buttons (Confirmations)
    modalConfirmBtn.addEventListener("click", confirmProductModal);

    // Order Actions
    clearOrderBtn.addEventListener("click", handleClearOrder);
    checkoutBtn.addEventListener("click", handleCheckout);
    printReceiptBtn.addEventListener("click", handlePrintReceipt);

    // Input Triggers for Modals
    cashReceivedInput.addEventListener("click", openCashModal);
    customerDisplayInput.addEventListener("click", openCustomerModal);

    // Dropdown Changes affecting Total
    discountSelect.addEventListener("change", renderOrder);
    taxSelect.addEventListener("change", renderOrder);

    // Cash Input Change (manual typing)
    cashReceivedInput.addEventListener("input", updateChangeDisplay);

    // --- Add listeners for dynamically created elements if needed, or use event delegation ---
    // Example: If category list items were added differently, you'd use delegation:
    // categoryListEl.addEventListener('click', (event) => {
    //   if (event.target.tagName === 'LI') {
    //     handleCategoryClick(event.target);
    //   }
    // });
}

// ---------------------
// Data Loading Functions (Categories, Products, Discounts, Taxes, Payment Methods)
// ---------------------
async function loadCategories() {
    categories = await fetchData(`${BASE_URL}/categories/`);
    renderCategories();
}

async function loadProducts() {
    allProducts = await fetchData(`${BASE_URL}/items/`);
    // Simulate stock if backend doesn't provide it (REMOVE IN PRODUCTION if joined)
    allProducts.forEach(p => {
        if (p.current_stock === undefined) {
            p.current_stock = Math.floor(Math.random() * 50) + 10; // Placeholder stock
        }
    });
    renderProducts(allProducts); // Initial render
}

async function loadDiscountOptions() {
    const activeDiscounts = await fetchData(`${BASE_URL}/discounts/?status=active`);
    discountSelect.innerHTML = `<option value="0" data-type="fixed_amount">No Discount</option>`;
    activeDiscounts.forEach(d => {
        const option = document.createElement("option");
        option.dataset.type = d.discount_type; // Store type for calculation
        option.value = d.discount_value;
        option.textContent = `${d.discount_name} (${d.discount_type === "percentage" ? `${d.discount_value}%` : `Rs ${parseFloat(d.discount_value).toFixed(2)}`})`;
        discountSelect.appendChild(option);
    });
}

async function loadTaxOptions() {
    const activeTaxes = await fetchData(`${BASE_URL}/taxes/?status=active`);
    taxSelect.innerHTML = `<option value="0">No Tax</option>`;
    activeTaxes.forEach(t => {
        const option = document.createElement("option");
        option.value = t.tax_percentage;
        option.textContent = `${t.tax_name} (${t.tax_percentage}%)`;
        taxSelect.appendChild(option);
    });
}

async function loadPaymentMethods() {
    const paymentMethods = await fetchData(`${BASE_URL}/payment_methods/`);
    paymentMethodSelect.innerHTML = `<option value="">Select Payment Method</option>`; // Default
    paymentMethods.forEach(pm => {
        const option = document.createElement("option");
        option.value = pm.payment_method_id;
        option.textContent = pm.payment_method_name;
        paymentMethodSelect.appendChild(option);
    });
}

// ---------------------
// UI Rendering Functions (Categories, Products, Order)
// ---------------------
function renderCategories() {
    categoryListEl.innerHTML = ""; // Clear previous
    // Add "All" category
    const allLi = document.createElement("li");
    allLi.textContent = "All";
    allLi.dataset.categoryId = "";
    allLi.classList.add("active");
    allLi.addEventListener("click", () => handleCategoryClick(allLi));
    categoryListEl.appendChild(allLi);
    // Add fetched categories
    categories.forEach(cat => {
        const li = document.createElement("li");
        li.textContent = cat.category_name;
        li.dataset.categoryId = cat.category_id;
        li.addEventListener("click", () => handleCategoryClick(li));
        categoryListEl.appendChild(li);
    });
}

function renderProducts(productsToRender) {
    productListEl.innerHTML = ""; // Clear previous
    if (!productsToRender || productsToRender.length === 0) {
        productListEl.innerHTML = '<p class="no-products-message">No products found matching your criteria.</p>';
        return;
    }
    productsToRender.forEach(product => {
        const prodEl = document.createElement("div");
        prodEl.classList.add("product");
        prodEl.dataset.productId = product.item_id;
        // Ensure price is treated as a number for formatting
        const price = parseFloat(product.price);
        prodEl.innerHTML = `
            <img src="${product.image_url || 'assets/imgs/default_item.jpg'}" alt="${product.item_name}">
            <p class="product-name">${product.item_name}</p>
            <p class="product-price">Rs ${price.toFixed(2)}</p>
            ${product.current_stock !== null ? `<p class="stock">Stock: ${product.current_stock}</p>` : '<p class="stock">Stock: N/A</p>'}
        `;
        prodEl.addEventListener("click", () => openProductModal(product));
        productListEl.appendChild(prodEl);
    });
}

function renderOrder() {
    orderItemsEl.innerHTML = ""; // Clear current items
    if (currentOrder.length === 0) {
        orderItemsEl.innerHTML = '<li class="no-items">No items in order</li>';
        orderTotalEl.innerText = `Total: Rs 0.00`;
        updateChangeDisplay(); // Update change display when order is empty
        return;
    }

    currentOrder.forEach((item, index) => { // Add index if needed for specific actions
        const li = document.createElement("li");
        const itemTotal = parseFloat(item.product.price) * item.quantity;
        li.innerHTML = `
            <span>${item.product.item_name} (x ${item.quantity})</span>
            <span>Rs ${itemTotal.toFixed(2)}</span>
            <div class="order-item-controls">
                <button onclick="editOrderItem(${item.product.item_id})" title="Edit Quantity"><ion-icon name="create-outline"></ion-icon></button>
                <button onclick="removeFromOrder(${item.product.item_id})" title="Remove Item"><ion-icon name="trash-outline"></ion-icon></button>
            </div>
        `;
        orderItemsEl.appendChild(li);
    });

    // Recalculate total and update display
    const totals = calculateTotal();
    orderTotalEl.innerText = `Total: Rs ${totals.finalTotal.toFixed(2)}`;
    updateChangeDisplay(); // Update change display whenever order total changes
}


// ---------------------
// Event Handlers (Search, Category Click, Clear Order, Print Receipt)
// ---------------------
function handleProductSearch(event) {
    const query = event.target.value.toLowerCase().trim();
    const activeCategoryLi = categoryListEl.querySelector("li.active");
    const activeCategoryId = activeCategoryLi ? activeCategoryLi.dataset.categoryId : "";

    let filtered = allProducts;

    // Filter by active category first (if not 'All')
    if (activeCategoryId) {
        filtered = filtered.filter(product => product.category_id == activeCategoryId);
    }

    // Then filter by search query
    if (query) {
        filtered = filtered.filter(product =>
            (product.item_name && product.item_name.toLowerCase().includes(query)) ||
            (product.barcode && product.barcode === query) // Exact match for barcode
        );
    }
    renderProducts(filtered);
}

function handleCategoryClick(clickedLi) {
    // Remove active class from all, add to clicked
    categoryListEl.querySelectorAll("li").forEach(li => li.classList.remove("active"));
    clickedLi.classList.add("active");

    const categoryId = clickedLi.dataset.categoryId;
    let productsToDisplay = allProducts;
    if (categoryId) {
        productsToDisplay = allProducts.filter(p => p.category_id == categoryId);
    }

    renderProducts(productsToDisplay);
    productSearchInput.value = ""; // Clear search when category changes
}

function handleClearOrder() {
    if (currentOrder.length === 0 && !cashReceivedInput.value && !customerDisplayInput.value) return; // Nothing to clear

    if (confirm("Are you sure you want to clear the entire order and selections?")) {
        currentOrder = [];
        selectedCustomerId = null;
        lastOrderId = null;

        // Reset UI elements
        discountSelect.value = "0";
        taxSelect.value = "0";
        paymentMethodSelect.value = "";
        cashReceivedInput.value = "";
        changeDisplay.innerText = "";
        customerDisplayInput.value = "";
        selectedCustomerIdInput.value = "";
        printReceiptBtn.style.display = "none"; // Hide print button

        renderOrder(); // Update the order display (shows "No items")
        console.log("Order Cleared.");
    }
}

function handlePrintReceipt() {
    if (!lastOrderId) {
        alert("No successfully completed order available to print receipt.");
        return;
    }
    const url = `${BASE_URL}/sales/${lastOrderId}/receipt/pdf`;
    window.open(url, "_blank"); // Open PDF in a new tab
}

// ---------------------
// Order Management (Add, Remove, Edit, Calculate Total)
// ---------------------
function addToOrder(product, quantity) {
    if (!product || quantity <= 0) return;

    const existingIndex = currentOrder.findIndex(item => item.product.item_id === product.item_id);
    const availableStock = product.current_stock; // Use potentially simulated stock

    if (existingIndex > -1) {
        // Item exists, update quantity
        const newQuantity = currentOrder[existingIndex].quantity + quantity;
        if (availableStock !== null && newQuantity > availableStock) {
            alert(`Cannot add ${quantity}. Only ${availableStock - currentOrder[existingIndex].quantity} more in stock.`);
            return; // Prevent adding beyond stock
        }
        currentOrder[existingIndex].quantity = newQuantity;
    } else {
        // New item, check stock before adding
        if (availableStock !== null && quantity > availableStock) {
            alert(`Cannot add ${quantity}. Only ${availableStock} available in stock.`);
            return; // Prevent adding beyond stock
        }
        currentOrder.push({ product, quantity });
    }
    renderOrder(); // Update the displayed order list and total
}

function editOrderItem(productId) {
    const itemIndex = currentOrder.findIndex(i => i.product.item_id === productId);
    if (itemIndex > -1) {
        const itemToEdit = currentOrder[itemIndex];
        // Remove temporarily to avoid issues if modal is cancelled, then re-add on confirm
        // A safer way might be to just pass the item data to the modal
        selectedProduct = itemToEdit.product; // Set the product for the modal
        modalInput = String(itemToEdit.quantity); // Set current quantity
        updateModalDisplay(); // Update modal view
        productModal.style.display = "flex";

        // We need a way to know we are *editing* vs adding new when confirming
        modalConfirmBtn.dataset.editingItemId = productId; // Mark as editing
    }
}

function removeFromOrder(productId) {
    currentOrder = currentOrder.filter(i => i.product.item_id !== productId);
    renderOrder(); // Update display
}

function calculateTotal() {
    const subtotal = currentOrder.reduce((sum, item) => {
        return sum + (parseFloat(item.product.price) * item.quantity);
    }, 0);

    const discountOption = discountSelect.options[discountSelect.selectedIndex];
    const discountType = discountOption?.dataset.type;
    const discountValue = parseFloat(discountSelect.value) || 0;

    let discountAmount = 0;
    if (discountType === 'percentage' && discountValue > 0) {
        discountAmount = subtotal * (discountValue / 100);
    } else if (discountValue > 0) { // Fixed amount
        discountAmount = discountValue;
    }

    const afterDiscount = Math.max(subtotal - discountAmount, 0); // Ensure not negative

    const taxPercentage = parseFloat(taxSelect.value) || 0;
    const taxAmount = afterDiscount * (taxPercentage / 100);

    const finalTotal = afterDiscount + taxAmount;

    return {
        subtotal: subtotal,
        discountAmount: discountAmount,
        taxAmount: taxAmount,
        finalTotal: finalTotal
    };
}


// ---------------------
// Product Modal Logic
// ---------------------
function openProductModal(product) {
    selectedProduct = product;
    modalInput = "1"; // Default to quantity 1 when opening
    modalConfirmBtn.removeAttribute('data-editing-item-id'); // Clear editing flag
    modalProductName.textContent = product.item_name;
    modalProductPrice.textContent = `Price: Rs ${parseFloat(product.price).toFixed(2)}`;
    updateModalDisplay();
    productModal.style.display = "flex";
}

function closeProductModal() {
    productModal.style.display = "none";
    selectedProduct = null; // Clear selected product
    modalInput = "0"; // Reset input
    modalConfirmBtn.removeAttribute('data-editing-item-id'); // Clear editing flag
}

function modalAppend(value) {
    if (modalInput === "0" && value !== "0") {
        modalInput = value; // Replace leading zero
    } else if (modalInput.length < 4) { // Limit quantity (e.g., 9999)
        modalInput += value;
    }
    updateModalDisplay();
}

function modalBackspace() {
    modalInput = modalInput.slice(0, -1);
    if (modalInput === "") {
        modalInput = "0"; // Show 0 if empty
    }
    updateModalDisplay();
}

function modalClear() {
    modalInput = "0";
    updateModalDisplay();
}

function updateModalDisplay() {
    const quantity = parseInt(modalInput) || 0;
    modalQuantityDisplay.textContent = modalInput || "0";
    modalQuantityEl.textContent = quantity;
    if (selectedProduct) {
        const total = quantity * parseFloat(selectedProduct.price);
        modalTotalEl.textContent = total.toFixed(2);
    } else {
        modalTotalEl.textContent = "0.00";
    }
}

function confirmProductModal() {
    const quantity = parseInt(modalInput) || 0;
    const editingItemId = modalConfirmBtn.dataset.editingItemId; // Check if we were editing

    if (!selectedProduct || quantity <= 0) {
        alert("Please enter a valid quantity (at least 1).");
        return;
    }
    // Stock check (using potentially simulated stock value)
    if (selectedProduct.current_stock !== null && quantity > selectedProduct.current_stock) {
        alert(`Insufficient stock. Only ${selectedProduct.current_stock} available.`);
        return;
    }

    if (editingItemId) {
        // Find the item in the order and update its quantity
        const itemIndex = currentOrder.findIndex(i => i.product.item_id == editingItemId);
        if (itemIndex > -1) {
            currentOrder[itemIndex].quantity = quantity;
            renderOrder(); // Update the order list
        }
        modalConfirmBtn.removeAttribute('data-editing-item-id'); // Clear editing flag
    } else {
        // Add the item to the order (will handle existing items internally)
        addToOrder(selectedProduct, quantity);
    }

    closeProductModal(); // Close modal on successful confirm
}

// ---------------------
// Cash Modal Logic
// ---------------------
function openCashModal() {
    const totals = calculateTotal();
    if (totals.finalTotal <= 0 && currentOrder.length === 0) {
        alert("Add items to the order first.");
        return;
    }
    cashModalInput = cashReceivedInput.value || ""; // Keep current value or start empty
    updateCashModalDisplay();
    cashModal.style.display = "flex";
}

function closeCashModal() {
    cashModal.style.display = "none";
}

function cashModalAppend(value) {
    if (value === '.' && cashModalInput.includes('.')) return; // Only one decimal point
    if (cashModalInput.length >= 10) return; // Limit length
    if (cashModalInput === "" && value === '.') {
        cashModalInput = "0."; // Start with 0. if decimal is first
    } else {
        cashModalInput += value;
    }
    updateCashModalDisplay();
}

function cashModalBackspace() {
    cashModalInput = cashModalInput.slice(0, -1);
    updateCashModalDisplay();
}

function cashModalClear() {
    cashModalInput = "";
    updateCashModalDisplay();
}

function updateCashModalDisplay() {
    cashDisplay.textContent = cashModalInput || "0.00";
}

function confirmCashModal() {
    const enteredValue = parseFloat(cashModalInput) || 0;
    cashReceivedInput.value = enteredValue.toFixed(2); // Set formatted value
    closeCashModal();
    updateChangeDisplay(); // Trigger change calculation immediately
}

function updateChangeDisplay() {
    const cash = parseFloat(cashReceivedInput.value) || 0;
    const totals = calculateTotal();
    const finalTotal = totals.finalTotal;

    if (finalTotal <= 0) {
        changeDisplay.innerText = ""; // No total, no change needed
        return;
    }

    if (cash <= 0) {
        changeDisplay.innerText = ""; // No cash entered, clear change
        return;
    }

    const change = cash - finalTotal;

    if (change >= 0) {
        changeDisplay.innerText = `Change: Rs ${change.toFixed(2)}`;
        changeDisplay.style.color = '#27ae60'; // Green for change
    } else {
        changeDisplay.innerText = `Amount Due: Rs ${Math.abs(change).toFixed(2)}`;
        changeDisplay.style.color = '#e74c3c'; // Red for amount due
    }
}

// ---------------------
// Customer Modal Logic
// ---------------------
function openCustomerModal() {
    customerModalInput = ""; // Reset phone input
    updateCustomerModalDisplay();
    customerResultsArea.innerHTML = ""; // Clear previous results
    addCustomerSection.style.display = "none"; // Hide add form initially
    customerMessageArea.textContent = ""; // Clear any previous messages
    newCustomerNameInput.value = ""; // Clear add form fields
    newCustomerEmailInput.value = "";
    customerModal.style.display = "flex";
}

function closeCustomerModal() {
    customerModal.style.display = "none";
}

function customerModalAppend(value) {
    if (customerModalInput.length < 15) { // Limit phone number length
        customerModalInput += value;
        updateCustomerModalDisplay();
    }
}

function customerModalBackspace() {
    customerModalInput = customerModalInput.slice(0, -1);
    updateCustomerModalDisplay();
}

function customerModalClear() {
    customerModalInput = "";
    updateCustomerModalDisplay();
}

function updateCustomerModalDisplay() {
    customerPhoneDisplay.textContent = customerModalInput || "Enter Phone Number";
}

async function searchCustomer() {
    const phoneNumber = customerModalInput.trim();
    if (!phoneNumber || phoneNumber.length < 5) { // Basic validation
        customerMessageArea.textContent = "Please enter a valid phone number (at least 5 digits).";
        customerMessageArea.style.color = "red";
        return;
    }

    customerMessageArea.textContent = "Searching...";
    customerMessageArea.style.color = "orange";
    customerResultsArea.innerHTML = ""; // Clear previous results
    addCustomerSection.style.display = "none"; // Hide add form

    try {
        // Encode the phone number for the URL query string
        const customers = await fetchData(`${BASE_URL}/customers/?phone_number=${encodeURIComponent(phoneNumber)}`);

        if (customers.length > 0) {
            // Customer(s) found
            const cust = customers[0]; // Use the first match
            customerResultsArea.innerHTML = `
                <div class="result-item">
                    <span>${cust.full_name} (${cust.phone_number})</span>
                    <button class="action-btn select-customer-btn"
                            onclick="selectCustomer(${cust.customer_id}, '${escapeSingleQuotes(cust.full_name)}', '${escapeSingleQuotes(cust.phone_number)}')">
                        Select
                    </button>
                </div>`;
            customerMessageArea.textContent = "Customer found.";
            customerMessageArea.style.color = "green";
        } else {
            // Customer not found
            customerResultsArea.innerHTML = `<p>Customer with phone '${phoneNumber}' not found.</p>`;
            customerMessageArea.textContent = "You can add this customer below.";
            customerMessageArea.style.color = "blue";
            addCustomerSection.style.display = "block"; // Show the add form
        }
    } catch (error) {
        customerMessageArea.textContent = `Error searching: ${error.message}`;
        customerMessageArea.style.color = "red";
        customerResultsArea.innerHTML = "<p>Could not perform search.</p>";
    }
}

function selectCustomer(customerId, customerName, customerPhone) {
    console.log(`Selected Customer: ID=${customerId}, Name=${customerName}`);
    selectedCustomerId = customerId;
    selectedCustomerIdInput.value = customerId; // Update hidden input
    customerDisplayInput.value = `${customerName} (${customerPhone})`; // Update display input on main page
    closeCustomerModal();
}

async function addCustomer() {
    const name = newCustomerNameInput.value.trim();
    const phone = customerModalInput.trim(); // Phone comes from the number pad entry
    const email = newCustomerEmailInput.value.trim();

    if (!name || !phone) {
        customerMessageArea.textContent = "Full Name and Phone Number are required to add.";
        customerMessageArea.style.color = "red";
        return;
    }

    const customerData = {
        full_name: name,
        phone_number: phone,
        email: email || null, // Send null if email is empty
        // Default other fields if needed by your schema
        street: null, city: null, state: null, zip_code: null, loyalty_points: 0
    };

    customerMessageArea.textContent = "Adding customer...";
    customerMessageArea.style.color = "orange";

    try {
        const newCustomer = await fetchData(`${BASE_URL}/customers/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(customerData)
        });

        customerMessageArea.textContent = "Customer added successfully!";
        customerMessageArea.style.color = "green";
        addCustomerSection.style.display = "none"; // Hide form after success

        // Automatically select the newly added customer
        selectCustomer(newCustomer.customer_id, newCustomer.full_name, newCustomer.phone_number);

        // Optional: close modal automatically after a short delay
        // setTimeout(closeCustomerModal, 1500);

    } catch (error) {
        customerMessageArea.textContent = `Error adding customer: ${error.message}`;
        customerMessageArea.style.color = "red";
    }
}

// Helper to escape single quotes in names/phones passed to onclick handlers
function escapeSingleQuotes(str) {
    if (!str) return "";
    return str.replace(/'/g, "\\'");
}


// ---------------------
// Checkout Process Logic
// ---------------------
async function handleCheckout() {
    if (currentOrder.length === 0) {
        alert("Cannot checkout with an empty order.");
        return;
    }

    // --- Validation ---
    const totals = calculateTotal();
    const finalTotal = totals.finalTotal;
    const cashReceived = parseFloat(cashReceivedInput.value) || 0;
    const selectedPaymentMethodId = paymentMethodSelect.value;
    const selectedPaymentMethodText = paymentMethodSelect.options[paymentMethodSelect.selectedIndex]?.text.toLowerCase();

    if (!selectedPaymentMethodId) {
        alert("Please select a payment method.");
        paymentMethodSelect.focus();
        return;
    }

    // Validate cash received only if 'Cash' is the selected method
    if (selectedPaymentMethodText === 'cash' && cashReceived < finalTotal) {
        alert(`Insufficient cash received (Rs ${cashReceived.toFixed(2)}) for the total amount (Rs ${finalTotal.toFixed(2)}).`);
        cashReceivedInput.focus();
        return;
    }

    // --- Prepare Data ---
    // !! Replace placeholders with actual logged-in user/store context !!
    const staffId = 1; // Placeholder
    const storeId = 1; // Placeholder

    const saleData = {
        staff_id: staffId,
        store_id: storeId,
        customer_id: selectedCustomerId || null,
        total_amount: finalTotal,
        payment_status: "paid", // Assume paid on checkout
        receipt_number: null, // Backend might generate this
        refund_amount: 0.0,
        refund_status: "none"
        // Optionally add cash_received, payment_method_id if extending Sales schema
    };

    const saleItemsData = currentOrder.map(item => ({
        // sale_id will be set after Sale creation
        item_id: item.product.item_id,
        quantity: item.quantity,
        unit_price: parseFloat(item.product.price),
        discount: 0.0, // Simplification: Apply discount/tax at Sale level or backend
        tax: 0.0      // Simplification: Apply discount/tax at Sale level or backend
    }));

    console.log("Attempting Checkout...");
    console.log("Sale Data:", saleData);
    console.log("Sale Items Data:", saleItemsData);
    showLoadingIndicators(true); // Indicate processing

    // --- API Calls ---
    try {
        // 1. Create the Sale Record
        const newSale = await fetchData(`${BASE_URL}/sales/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(saleData)
        });
        lastOrderId = newSale.sale_id; // Store ID for receipt printing
        console.log("Sale Record Created:", newSale);

        // 2. Create Sale Items (Backend likely handles stock deduction)
        let itemErrors = [];
        for (const itemData of saleItemsData) {
            itemData.sale_id = newSale.sale_id; // Add the created sale_id
            try {
                await fetchData(`${BASE_URL}/sale_items/`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(itemData)
                });
            } catch (itemError) {
                console.error(`Failed to add item ID ${itemData.item_id}:`, itemError);
                itemErrors.push(`Item ID ${itemData.item_id}: ${itemError.message}`);
                // Decide on behavior: continue or stop? Continue allows partial success recording.
            }
        }

        // 3. Create the Payment Record (Crucial for reconciliation)
        const paymentData = {
            sale_id: newSale.sale_id,
            // Amount should reflect what was actually paid/tendered for this method
            // For cash, could be cashReceived; for others, likely finalTotal
            amount: (selectedPaymentMethodText === 'cash') ? cashReceived : finalTotal,
            payment_method_id: parseInt(selectedPaymentMethodId),
            // transaction_reference: could be added for card payments later
        };
        try {
            await fetchData(`${BASE_URL}/payments/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(paymentData)
            });
            console.log("Payment Record Created:", paymentData);
        } catch (paymentError) {
            console.error("Failed to create payment record:", paymentError);
            // This is serious - sale happened but payment isn't logged properly.
            alert(`CRITICAL WARNING: Order ${lastOrderId} processed, but failed to record payment (${paymentError.message}). Please manually verify.`);
            // Still proceed to show success/print, but with a strong warning.
        }


        // --- Handle Outcome ---
        if (itemErrors.length > 0) {
            alert(`Order ${lastOrderId} processed, but with errors adding some items:\n\n- ${itemErrors.join("\n- ")}\n\nPlease review the sale details.`);
            // Don't fully clear? Or clear but warn? Let's clear but warn.
            handleClearOrder(); // Clear form for next sale
        } else {
            // Full success
            alert(`Order ${lastOrderId} processed successfully!`);
            printReceiptBtn.style.display = "block"; // Show print button
            handleClearOrder(); // Clear the form automatically after successful checkout
        }

    } catch (error) {
        console.error("Checkout failed:", error);
        alert(`Error processing order: ${error.message}`);
        lastOrderId = null; // Ensure print button isn't active for failed order
        printReceiptBtn.style.display = "none";
    } finally {
        showLoadingIndicators(false); // Hide processing indicator
    }
}