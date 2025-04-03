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
let currentOrder = [];           // Array of { product: {}, quantity: number } objects
let lastOrderId = null;          // ID of the last successfully processed order
let categories = [];             // Cache for categories
let allProducts = [];            // Cache for all products

// --- DOM Element References ---
// Modals
const productModal = document.getElementById("productModal");
const cashModal = document.getElementById("cashModal");
const customerModal = document.getElementById("customerModal");
const loadingOverlay = document.getElementById('loadingOverlay'); // Loading Indicator
const globalErrorDisplay = document.getElementById('globalErrorDisplay'); // Error Display

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
    console.log(`Fetching ${options.method || 'GET'} ${url}`, options.body ? 'with body' : '');
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            let errorDetail = `HTTP error ${response.status}: ${response.statusText}`;
            let errorJson = null;
            try {
                // Try to get more specific error from backend response body
                errorJson = await response.json();
                errorDetail = errorJson.detail || errorDetail;
                console.error('Backend Error Detail:', errorJson);
            } catch (jsonError) {
                console.warn("Could not parse error response as JSON or response was empty.");
            }
            const error = new Error(errorDetail);
            error.status = response.status; // Attach status code to error object
            error.json = errorJson; // Attach parsed JSON error if available
            throw error;
        }
        // Handle cases with no content (like DELETE or sometimes PUT/POST)
        if (response.status === 204) {
            console.log(`Fetch successful (204 No Content) for ${url}`);
            return null;
        }
        const data = await response.json();
        console.log(`Fetch successful for ${url}`);
        return data;
    } catch (error) {
        console.error(`Fetch error for ${url}:`, error);
        // Display user-friendly message for network errors or server issues
        displayGlobalError(`Network or server error when contacting API. Please check connection or try again later. (${error.message})`);
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
    showLoadingIndicators(true, "Loading initial data..."); // Show loading state

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
        displayGlobalError(''); // Clear any previous global errors

    } catch (error) {
        console.error("Initialization failed:", error);
        // DisplayGlobalError is likely already called by fetchData, but ensure message is clear
        displayGlobalError(`Failed to initialize the checkout system. ${error.message}. Please try refreshing.`);
    } finally {
        showLoadingIndicators(false); // Hide loading state
        // Enable buttons after loading
        checkoutBtn.disabled = false;
        clearOrderBtn.disabled = false;
    }
}

function showLoadingIndicators(isLoading, message = "Processing...") {
    if (isLoading) {
        loadingOverlay.textContent = message;
        loadingOverlay.style.display = 'flex';
        // Disable key buttons during loading
        checkoutBtn.disabled = true;
        clearOrderBtn.disabled = true;
        printReceiptBtn.disabled = true;
    } else {
        loadingOverlay.style.display = 'none';
        // Re-enable buttons (except print button, which depends on lastOrderId)
        checkoutBtn.disabled = false;
        clearOrderBtn.disabled = false;
        printReceiptBtn.disabled = !lastOrderId; // Only enable if there's an order ID
    }
    console.log(`Loading state: ${isLoading}`);
}

function displayGlobalError(message) {
    if (message) {
        globalErrorDisplay.textContent = message;
        globalErrorDisplay.style.display = 'block';
    } else {
        globalErrorDisplay.style.display = 'none';
        globalErrorDisplay.textContent = '';
    }
}


function attachEventListeners() {
    // Product Search (with debounce)
    productSearchInput.addEventListener("input", debounce(handleProductSearch, 300));
    // Also handle 'Enter' key for barcode scanner emulation
    productSearchInput.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            event.preventDefault(); // Prevent form submission if it were in a form
            handleProductSearch(event); // Trigger search immediately
        }
    });


    // Modal Buttons (Confirmations)
    modalConfirmBtn.addEventListener("click", confirmProductModal);

    // Order Actions
    clearOrderBtn.addEventListener("click", handleClearOrder);
    checkoutBtn.addEventListener("click", handleCheckout);
    printReceiptBtn.addEventListener("click", handlePrintReceipt);

    // Input Triggers for Modals
    // cashReceivedInput.addEventListener("click", openCashModal); // Now handled by modal
    // customerDisplayInput.addEventListener("click", openCustomerModal); // Now handled by modal

    // Dropdown Changes affecting Total
    discountSelect.addEventListener("change", renderOrder);
    taxSelect.addEventListener("change", renderOrder);

    // Cash Input Change (manual typing - disable if using modal only)
    // cashReceivedInput.addEventListener("input", updateChangeDisplay);

    // Close Modals when clicking outside (optional but good UX)
    window.addEventListener('click', (event) => {
        if (event.target == productModal) closeProductModal();
        if (event.target == cashModal) closeCashModal();
        if (event.target == customerModal) closeCustomerModal();
    });
}

// ---------------------
// Data Loading Functions (Categories, Products, Discounts, Taxes, Payment Methods)
// ---------------------
async function loadCategories() {
    try {
        categories = await fetchData(`${BASE_URL}/categories/`);
        renderCategories();
    } catch (error) {
        categoryListEl.innerHTML = '<li>Error loading categories</li>';
        // Initialization error handling will catch this
        throw error; // Re-throw to stop initialization if critical
    }
}

async function loadProducts() {
    try {
        allProducts = await fetchData(`${BASE_URL}/items/`);
        // !! IMPORTANT !! Backend should provide stock. Remove this simulation.
        allProducts.forEach(p => {
            // Example: Assuming backend provides stock in `stock_level` field
            // p.current_stock = p.stock_level !== undefined ? p.stock_level : null;
            // --- Simulation (REMOVE LATER) ---
            if (p.current_stock === undefined) {
                p.current_stock = Math.floor(Math.random() * 50) + 10; // Placeholder
            }
             // --- End Simulation ---
        });
        renderProducts(allProducts); // Initial render
    } catch (error) {
        productListEl.innerHTML = '<p class="no-products-message">Error loading products.</p>';
        throw error; // Re-throw
    }
}

async function loadDiscountOptions() {
    try {
        const activeDiscounts = await fetchData(`${BASE_URL}/discounts/?status=active`);
        discountSelect.innerHTML = `<option value="0" data-type="fixed_amount" data-id="0">No Discount</option>`;
        activeDiscounts.forEach(d => {
            const option = document.createElement("option");
            option.dataset.type = d.discount_type;
            option.value = d.discount_value;
            option.dataset.id = d.discount_id; // Store discount ID if needed later
            option.textContent = `${d.discount_name} (${d.discount_type === "percentage" ? `${d.discount_value}%` : `Rs ${parseFloat(d.discount_value).toFixed(2)}`})`;
            discountSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Failed to load discounts:", error);
        discountSelect.innerHTML = `<option value="0">Error loading discounts</option>`;
        // Optionally display a more visible error
    }
}

async function loadTaxOptions() {
    try {
        const activeTaxes = await fetchData(`${BASE_URL}/taxes/?status=active`);
        taxSelect.innerHTML = `<option value="0" data-id="0">No Tax</option>`; // Default value 0, ID 0
        activeTaxes.forEach(t => {
            const option = document.createElement("option");
            option.value = t.tax_percentage;
            option.dataset.id = t.tax_id; // Store tax ID
            option.textContent = `${t.tax_name} (${t.tax_percentage}%)`;
            taxSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Failed to load taxes:", error);
        taxSelect.innerHTML = `<option value="0">Error loading taxes</option>`;
    }
}

async function loadPaymentMethods() {
    try {
        const paymentMethods = await fetchData(`${BASE_URL}/payment_methods/`);
        paymentMethodSelect.innerHTML = `<option value="">Select Payment Method</option>`; // Default
        paymentMethods.forEach(pm => {
            const option = document.createElement("option");
            option.value = pm.payment_method_id;
            // Store name in lowercase for easy comparison later if needed
            option.dataset.name = pm.payment_method_name.toLowerCase();
            option.textContent = pm.payment_method_name;
            paymentMethodSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Failed to load payment methods:", error);
        paymentMethodSelect.innerHTML = `<option value="">Error loading methods</option>`;
    }
}

// ---------------------
// UI Rendering Functions (Categories, Products, Order)
// ---------------------
function renderCategories() {
    categoryListEl.innerHTML = ""; // Clear previous
    // Add "All" category
    const allLi = document.createElement("li");
    allLi.textContent = "All";
    allLi.dataset.categoryId = ""; // Use empty string for 'All'
    allLi.classList.add("active"); // Start with 'All' selected
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
        const price = parseFloat(product.price) || 0; // Default to 0 if price is invalid/null
        const stock = product.current_stock;
        const isLowStock = stock !== null && stock <= (product.min_stock_level || 5); // Assuming min_stock_level might be on product

        prodEl.innerHTML = `
            <img src="${product.image_url || 'assets/imgs/default_item.jpg'}" alt="${product.item_name}">
            <p class="product-name">${product.item_name}</p>
            <p class="product-price">Rs ${price.toFixed(2)}</p>
            <p class="stock ${isLowStock ? 'low-stock' : ''}">
                Stock: ${stock !== null ? stock : 'N/A'}
            </p>
        `;
        // Add low stock visual cue if needed in CSS (e.g., .product .low-stock { color: red; font-weight: bold; })
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

    currentOrder.forEach((item) => {
        const li = document.createElement("li");
        const itemPrice = parseFloat(item.product.price) || 0;
        const itemTotal = itemPrice * item.quantity;
        li.innerHTML = `
            <div class="item-info">
                <span class="item-name">${item.product.item_name}</span>
                <span class="item-qty-price">( ${item.quantity} x Rs ${itemPrice.toFixed(2)} )</span>
            </div>
            <div class="item-line-total">
                <span>Rs ${itemTotal.toFixed(2)}</span>
                <div class="order-item-controls">
                    <button onclick="editOrderItem(${item.product.item_id})" title="Edit Quantity"><ion-icon name="create-outline"></ion-icon></button>
                    <button onclick="removeFromOrder(${item.product.item_id})" title="Remove Item"><ion-icon name="trash-outline"></ion-icon></button>
                </div>
            </div>
        `;
        orderItemsEl.appendChild(li);
    });

    // Recalculate total and update display
    const totals = calculateTotal();
    orderTotalEl.innerText = `Total: Rs ${totals.finalTotal.toFixed(2)}`;
    // Add breakdown below total (optional)
    // E.g., document.getElementById('subtotalDisplay').innerText = `Subtotal: Rs ${totals.subtotal.toFixed(2)}`;
    updateChangeDisplay(); // Update change display whenever order total changes
}


// ---------------------
// Event Handlers (Search, Category Click, Clear Order, Print Receipt)
// ---------------------
function handleProductSearch(event) {
    const query = productSearchInput.value.toLowerCase().trim(); // Use the input field directly
    const activeCategoryLi = categoryListEl.querySelector("li.active");
    const activeCategoryId = activeCategoryLi ? activeCategoryLi.dataset.categoryId : "";

    console.log(`Searching products: Query='${query}', CategoryID='${activeCategoryId}'`);

    let filtered = allProducts;

    // Filter by active category first (if not 'All')
    if (activeCategoryId) {
        filtered = filtered.filter(product => product.category_id == activeCategoryId);
    }

    // Then filter by search query (name or barcode)
    if (query) {
        filtered = filtered.filter(product =>
            (product.item_name && product.item_name.toLowerCase().includes(query)) ||
            (product.barcode && product.barcode === query) // Exact match for barcode
        );
        // If barcode matches exactly, potentially add directly to cart? (Advanced)
         if (filtered.length === 1 && filtered[0].barcode === query) {
            console.log("Barcode match found:", filtered[0].item_name);
            // Optional: Automatically open modal or add qty 1?
             // openProductModal(filtered[0]); // Example: open modal
            // addToOrder(filtered[0], 1); // Example: add 1 automatically
            // productSearchInput.value = ""; // Clear search after barcode scan
         }

    }
    renderProducts(filtered);
}

function handleCategoryClick(clickedLi) {
    // Remove active class from all, add to clicked
    categoryListEl.querySelectorAll("li").forEach(li => li.classList.remove("active"));
    clickedLi.classList.add("active");

    const categoryId = clickedLi.dataset.categoryId;
    console.log(`Category selected: ID=${categoryId || 'All'}`);

    let productsToDisplay = allProducts;
    if (categoryId) {
        productsToDisplay = allProducts.filter(p => p.category_id == categoryId);
    }

    renderProducts(productsToDisplay);
    productSearchInput.value = ""; // Clear search when category changes
}

function handleClearOrder() {
    if (currentOrder.length === 0 && !cashReceivedInput.value && !customerDisplayInput.value && !selectedCustomerId) {
        console.log("Clear Order: Nothing to clear.");
        return; // Nothing to clear
    }


    // Use confirm for web, consider Electron dialogs for desktop app feel
    // const confirmed = confirm("Are you sure you want to clear the entire order and selections?");
    // if (!confirmed) return;

    // Example using Electron dialog (if in Electron context)
    // const { dialog } = require('electron').remote; // Or use IPC
    // const choice = dialog.showMessageBoxSync({
    //     type: 'question',
    //     buttons: ['Yes, Clear Order', 'Cancel'],
    //     defaultId: 1, // Index of Cancel
    //     title: 'Confirm Clear Order',
    //     message: 'Are you sure you want to clear the current order, payment, and customer selection?'
    // });
    // if (choice === 1) return; // User cancelled

    // Using standard confirm for broader compatibility:
    if (!confirm("Are you sure you want to clear the entire order and selections?")) {
        return;
    }


    console.log("Clearing order...");
    currentOrder = [];
    selectedCustomerId = null;
    lastOrderId = null; // Reset last order ID

    // Reset UI elements
    discountSelect.value = "0";
    taxSelect.value = "0";
    paymentMethodSelect.value = "";
    cashReceivedInput.value = "";
    cashModalInput = ""; // Reset modal input too
    changeDisplay.innerText = "";
    customerDisplayInput.value = "";
    customerModalInput = ""; // Reset customer modal input
    selectedCustomerIdInput.value = "";
    printReceiptBtn.style.display = "none"; // Hide print button
    printReceiptBtn.disabled = true; // Disable it too

    renderOrder(); // Update the order display (shows "No items")
    updateCashModalDisplay(); // Reset cash display if modal was open
    updateCustomerModalDisplay(); // Reset customer phone display
    console.log("Order Cleared.");
}

function handlePrintReceipt() {
    if (!lastOrderId) {
        console.warn("Print Receipt clicked but lastOrderId is null.");
        alert("No successfully completed order available to print receipt.");
        return;
    }
    console.log(`Printing receipt for Order ID: ${lastOrderId}`);
    const url = `${BASE_URL}/sales/${lastOrderId}/receipt/pdf`;

    // For Electron, opening a PDF might be handled differently for better integration
    // Option 1: Standard window.open (might open in default browser or download)
    window.open(url, "_blank");

    // Option 2: Using Electron's shell module (opens in default PDF viewer)
    // if (typeof require === 'function') { // Check if in Node.js/Electron context
    //     try {
    //         const { shell } = require('electron');
    //         shell.openExternal(url);
    //     } catch (e) {
    //         console.warn("Electron shell module not available, falling back to window.open");
    //         window.open(url, "_blank");
    //     }
    // } else {
    //     window.open(url, "_blank");
    // }

    // Option 3: Embed PDF in a new Electron window (more complex)
    // Requires setting up a new BrowserWindow and loading the URL or PDF data

    // After attempting print, maybe hide the button again? Or leave it?
    // printReceiptBtn.style.display = 'none';
}

// ---------------------
// Order Management (Add, Remove, Edit, Calculate Total)
// ---------------------
function addToOrder(product, quantity) {
    if (!product || quantity <= 0) return;

    const existingIndex = currentOrder.findIndex(item => item.product.item_id === product.item_id);
    const availableStock = product.current_stock; // Use potentially simulated stock

    // Ensure quantity is a number
    quantity = Number(quantity);
    if (isNaN(quantity)) {
        console.error("Invalid quantity passed to addToOrder:", quantity);
        return;
    }


    if (existingIndex > -1) {
        // Item exists, update quantity
        const currentQuantity = currentOrder[existingIndex].quantity;
        const newQuantity = currentQuantity + quantity;

        if (availableStock !== null && newQuantity > availableStock) {
            alert(`Cannot add ${quantity} more of ${product.item_name}. Only ${availableStock - currentQuantity} more currently in stock (Total Available: ${availableStock}).`);
            return; // Prevent adding beyond stock
        }
        currentOrder[existingIndex].quantity = newQuantity;
        console.log(`Updated quantity for ${product.item_name} to ${newQuantity}`);
    } else {
        // New item, check stock before adding
        if (availableStock !== null && quantity > availableStock) {
            alert(`Cannot add ${quantity} of ${product.item_name}. Only ${availableStock} available in stock.`);
            return; // Prevent adding beyond stock
        }
        currentOrder.push({ product: product, quantity: quantity });
        console.log(`Added ${quantity} of ${product.item_name} to order.`);
    }
    renderOrder(); // Update the displayed order list and total
}

function editOrderItem(productId) {
    const itemIndex = currentOrder.findIndex(i => i.product.item_id === productId);
    if (itemIndex > -1) {
        const itemToEdit = currentOrder[itemIndex];
        console.log(`Editing item: ${itemToEdit.product.item_name}`);
        selectedProduct = itemToEdit.product; // Set the product for the modal
        modalInput = String(itemToEdit.quantity); // Set current quantity in modal input
        updateModalDisplay(); // Update modal view based on modalInput
        productModal.style.display = "flex";

        // Mark the confirm button to indicate we are editing this specific item
        modalConfirmBtn.dataset.editingItemId = productId;
    } else {
        console.warn(`Attempted to edit item ID ${productId} but it was not found in the order.`);
    }
}

function removeFromOrder(productId) {
    const itemIndex = currentOrder.findIndex(i => i.product.item_id === productId);
    if (itemIndex > -1) {
        console.log(`Removing item: ${currentOrder[itemIndex].product.item_name}`);
        currentOrder.splice(itemIndex, 1); // Remove item from array
        renderOrder(); // Update display
    } else {
         console.warn(`Attempted to remove item ID ${productId} but it was not found in the order.`);
    }
}


function calculateTotal() {
    const subtotal = currentOrder.reduce((sum, item) => {
        const price = parseFloat(item.product.price) || 0;
        return sum + (price * item.quantity);
    }, 0);

    const discountOption = discountSelect.options[discountSelect.selectedIndex];
    const discountType = discountOption?.dataset.type; // 'percentage' or 'fixed_amount'
    const discountValue = parseFloat(discountSelect.value) || 0;

    let discountAmount = 0;
    if (discountType === 'percentage' && discountValue > 0) {
        discountAmount = subtotal * (discountValue / 100);
    } else if (discountType === 'fixed_amount' && discountValue > 0) {
        discountAmount = discountValue;
    }
    // Ensure discount doesn't exceed subtotal
    discountAmount = Math.min(discountAmount, subtotal);

    const afterDiscount = subtotal - discountAmount;

    const taxPercentage = parseFloat(taxSelect.value) || 0;
    // Calculate tax on the price *after* discount
    const taxAmount = afterDiscount * (taxPercentage / 100);

    const finalTotal = afterDiscount + taxAmount;

    // console.log(`Calc Total: Subtotal=${subtotal.toFixed(2)}, Discount=${discountAmount.toFixed(2)}, Tax=${taxAmount.toFixed(2)}, Final=${finalTotal.toFixed(2)}`);

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
    if (!product || product.item_id === undefined) {
        console.error("Invalid product data passed to openProductModal:", product);
        alert("Error: Could not load product details.");
        return;
    }
    console.log(`Opening modal for product: ${product.item_name} (ID: ${product.item_id})`);
    selectedProduct = product;
    modalInput = "1"; // Default to quantity 1 when opening for a *new* item
    modalConfirmBtn.removeAttribute('data-editing-item-id'); // Clear editing flag initially
    modalProductName.textContent = product.item_name;
    modalProductPrice.textContent = `Price: Rs ${parseFloat(product.price || 0).toFixed(2)}`;
    updateModalDisplay();
    productModal.style.display = "flex";
}

function closeProductModal() {
    console.log("Closing product modal.");
    productModal.style.display = "none";
    selectedProduct = null; // Clear selected product
    modalInput = "0"; // Reset input
    modalConfirmBtn.removeAttribute('data-editing-item-id'); // Ensure editing flag is clear
}

function modalAppend(value) {
    // Allow adding digits only
    if (!/^\d$/.test(value)) return;

    if (modalInput === "0" && value !== "0") {
        modalInput = value; // Replace leading zero unless the input is '0' itself
    } else if (modalInput.length < 4) { // Limit quantity input (e.g., max 9999)
        modalInput += value;
    } else {
        console.warn("Max quantity input length reached.");
    }
    updateModalDisplay();
}

function modalBackspace() {
    modalInput = modalInput.slice(0, -1);
    if (modalInput === "") {
        modalInput = "0"; // Default back to 0 if empty
    }
    updateModalDisplay();
}

function modalClear() {
    modalInput = "0";
    updateModalDisplay();
}

function updateModalDisplay() {
    const quantity = parseInt(modalInput) || 0; // Ensure it's a number, default 0
    modalQuantityDisplay.textContent = modalInput || "0"; // Show the input string
    modalQuantityEl.textContent = quantity; // Show the parsed number

    if (selectedProduct) {
        const price = parseFloat(selectedProduct.price) || 0;
        const total = quantity * price;
        modalTotalEl.textContent = total.toFixed(2);
    } else {
        modalTotalEl.textContent = "0.00"; // Reset if no product selected
    }
}

function confirmProductModal() {
    const quantity = parseInt(modalInput);
    if (isNaN(quantity) || quantity <= 0) {
        alert("Please enter a valid quantity (at least 1).");
        modalInput = "1"; // Reset input to 1
        updateModalDisplay();
        return;
    }

    if (!selectedProduct) {
        console.error("ConfirmProductModal called without a selectedProduct.");
        alert("Error: No product selected.");
        closeProductModal();
        return;
    }

    const editingItemId = modalConfirmBtn.dataset.editingItemId; // Check if we were editing

    // Stock check (using potentially simulated stock value)
    // IMPORTANT: Replace 'current_stock' with your actual stock field name from API
    const availableStock = selectedProduct.current_stock;
    if (availableStock !== null && availableStock !== undefined) {
        if (editingItemId) {
            // If editing, check against stock *excluding* the original quantity of this item
            const itemIndex = currentOrder.findIndex(i => i.product.item_id == editingItemId);
            const originalQuantity = (itemIndex > -1) ? currentOrder[itemIndex].quantity : 0;
            const stockNeeded = quantity - originalQuantity; // How many *more* are needed
            const currentStockExcludingThis = availableStock; // Assume backend gave current total stock

            // This logic is slightly complex. A simpler check:
            if (quantity > availableStock) {
                 alert(`Insufficient stock for ${selectedProduct.item_name}. Only ${availableStock} available.`);
                 return;
            }

        } else {
            // If adding new or increasing quantity of existing non-edited item
            const existingItem = currentOrder.find(i => i.product.item_id === selectedProduct.item_id);
            const currentOrderQty = existingItem ? existingItem.quantity : 0;
             if ((currentOrderQty + quantity) > availableStock) {
                  alert(`Insufficient stock for ${selectedProduct.item_name}. Only ${availableStock - currentOrderQty} more can be added (Total Available: ${availableStock}).`);
                  return;
             }
        }
    } else {
        console.warn(`Stock level for ${selectedProduct.item_name} is null or undefined. Skipping stock check.`);
        // Decide if you want to allow adding if stock is unknown, or block it.
        // Example: Allow adding if stock is unknown
    }


    if (editingItemId) {
        // Find the item in the order and update its quantity
        const itemIndex = currentOrder.findIndex(i => i.product.item_id == editingItemId);
        if (itemIndex > -1) {
            console.log(`Confirming edit for ${selectedProduct.item_name}: Old Qty=${currentOrder[itemIndex].quantity}, New Qty=${quantity}`);
            currentOrder[itemIndex].quantity = quantity;
            renderOrder(); // Update the order list
        } else {
             console.error(`Tried to confirm edit for item ID ${editingItemId}, but it wasn't found in the order.`);
        }
        modalConfirmBtn.removeAttribute('data-editing-item-id'); // Clear editing flag
    } else {
        // Add the item to the order (addToOrder handles existing items internally)
        console.log(`Confirming add for ${selectedProduct.item_name}: Qty=${quantity}`);
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
        alert("Add items to the order first before entering cash.");
        return;
    }
    // Pre-fill with current input value if it exists, otherwise start empty
    cashModalInput = cashReceivedInput.value || "";
    updateCashModalDisplay();
    cashModal.style.display = "flex";
}

function closeCashModal() {
    cashModal.style.display = "none";
}

function cashModalAppend(value) {
    // Allow digits and at most one decimal point
    if (!/^[\d.]$/.test(value)) return;

    if (value === '.' && cashModalInput.includes('.')) return; // Only one decimal point
    if (cashModalInput.length >= 10) return; // Limit input length

    // Handle leading zero correctly
    if (cashModalInput === "0" && value !== '.') {
        cashModalInput = value; // Replace leading zero if not entering decimal
    } else if (cashModalInput === "" && value === '.') {
        cashModalInput = "0."; // Start with 0. if decimal is first char
    } else {
        // Prevent multiple leading zeros unless it's '0.'
        if (cashModalInput === "0" && value === "0") return;
        cashModalInput += value;
    }

    // Limit decimal places (e.g., to 2) - optional
    const parts = cashModalInput.split('.');
    if (parts.length > 1 && parts[1].length > 2) {
        cashModalInput = cashModalInput.slice(0, -1); // Remove last entered digit if > 2 decimal places
        return;
    }


    updateCashModalDisplay();
}


function cashModalBackspace() {
    cashModalInput = cashModalInput.slice(0, -1);
    // Optional: if input becomes empty, reset display?
    // if (cashModalInput === "") cashModalInput = "0";
    updateCashModalDisplay();
}

function cashModalClear() {
    cashModalInput = ""; // Clear the internal state
    updateCashModalDisplay(); // Update the display (will show 0.00)
}


function updateCashModalDisplay() {
    // Display the raw input or '0.00' if empty
    cashDisplay.textContent = cashModalInput || "0.00";
}

function confirmCashModal() {
    // Use parseFloat to handle potential decimals
    const enteredValue = parseFloat(cashModalInput) || 0;
    cashReceivedInput.value = enteredValue.toFixed(2); // Set formatted value in the main input field
    closeCashModal();
    updateChangeDisplay(); // Trigger change calculation immediately
}

function updateChangeDisplay() {
    const cash = parseFloat(cashReceivedInput.value) || 0;
    const totals = calculateTotal();
    const finalTotal = totals.finalTotal;

    // Only calculate change if there's a total amount
    if (finalTotal <= 0) {
        changeDisplay.innerText = ""; // No total, no change needed
        changeDisplay.style.color = 'inherit'; // Reset color
        return;
    }

    // Only calculate if cash has been entered
    if (cash <= 0) {
        changeDisplay.innerText = ""; // No cash entered, clear change
        changeDisplay.style.color = 'inherit'; // Reset color
        return;
    }

    const change = cash - finalTotal;

    if (change >= 0) {
        changeDisplay.innerText = `Change Due: Rs ${change.toFixed(2)}`;
        changeDisplay.style.color = '#27ae60'; // Green for positive change
    } else {
        // Amount still due
        changeDisplay.innerText = `Amount Remaining: Rs ${Math.abs(change).toFixed(2)}`;
        changeDisplay.style.color = '#e74c3c'; // Red for amount due
    }
}

// ---------------------
// Customer Modal Logic
// ---------------------
function openCustomerModal() {
    console.log("Opening customer modal");
    customerModalInput = ""; // Reset phone input buffer
    updateCustomerModalDisplay(); // Update the display inside modal
    customerResultsArea.innerHTML = ""; // Clear previous search results
    addCustomerSection.style.display = "none"; // Hide add form initially
    customerMessageArea.textContent = ""; // Clear any previous messages
    newCustomerNameInput.value = ""; // Clear add form fields
    newCustomerEmailInput.value = "";
    customerModal.style.display = "flex";
}

function closeCustomerModal() {
    console.log("Closing customer modal");
    customerModal.style.display = "none";
}

function customerModalAppend(value) {
     if (!/^\d$/.test(value)) return; // Only allow digits

    if (customerModalInput.length < 15) { // Limit phone number length (adjust as needed)
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
    customerResultsArea.innerHTML = ""; // Also clear results when clearing input
    addCustomerSection.style.display = "none";
    customerMessageArea.textContent = "";
}

function updateCustomerModalDisplay() {
    // Display the entered number or a placeholder
    customerPhoneDisplay.textContent = customerModalInput || "Enter Phone Number";
}

async function searchCustomer() {
    const phoneNumber = customerModalInput.trim();
    if (!phoneNumber || phoneNumber.length < 5) { // Basic validation (adjust length if needed)
        customerMessageArea.textContent = "Please enter a valid phone number (min 5 digits).";
        customerMessageArea.style.color = "red";
        return;
    }

    console.log(`Searching for customer with phone: ${phoneNumber}`);
    customerMessageArea.textContent = "Searching...";
    customerMessageArea.style.color = "orange";
    customerResultsArea.innerHTML = '<p>Loading...</p>'; // Provide feedback
    addCustomerSection.style.display = "none"; // Hide add form during search

    try {
        // Encode the phone number for the URL query string
        const customers = await fetchData(`${BASE_URL}/customers/?phone_number=${encodeURIComponent(phoneNumber)}`);

        if (customers && customers.length > 0) {
            // Customer(s) found
            console.log("Customer(s) found:", customers);
            const cust = customers[0]; // Use the first match for simplicity
            customerResultsArea.innerHTML = `
                <div class="result-item">
                    <span>${cust.full_name || 'N/A'} (${cust.phone_number || 'N/A'})</span>
                    <button class="action-btn select-customer-btn"
                            onclick="selectCustomer(${cust.customer_id}, '${escapeSingleQuotes(cust.full_name)}', '${escapeSingleQuotes(cust.phone_number)}')">
                        Select
                    </button>
                </div>`;
            customerMessageArea.textContent = "Customer found.";
            customerMessageArea.style.color = "green";
        } else {
            // Customer not found
            console.log("Customer not found.");
            customerResultsArea.innerHTML = `<p>Customer with phone '${phoneNumber}' not found.</p>`;
            customerMessageArea.textContent = "Customer not found. You can add them below.";
            customerMessageArea.style.color = "blue";
            addCustomerSection.style.display = "block"; // Show the add form
            newCustomerNameInput.focus(); // Focus on the name input
        }
    } catch (error) {
        console.error("Error searching customer:", error);
        customerMessageArea.textContent = `Error searching: ${error.message}`;
        customerMessageArea.style.color = "red";
        customerResultsArea.innerHTML = "<p>Could not perform search. Check connection or API status.</p>";
    }
}

function selectCustomer(customerId, customerName, customerPhone) {
    console.log(`Selected Customer: ID=${customerId}, Name=${customerName}, Phone=${customerPhone}`);
    selectedCustomerId = customerId;
    selectedCustomerIdInput.value = customerId; // Update hidden input
    customerDisplayInput.value = `${customerName || 'Customer'} (${customerPhone || 'N/A'})`; // Update display input on main page
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
    // Optional: More specific phone validation if needed

    const customerData = {
        full_name: name,
        phone_number: phone,
        email: email || null, // Send null if email is empty
        // Default other fields as per your schema definition if needed
        street: null, city: null, state: null, zip_code: null, loyalty_points: 0
    };

    console.log("Attempting to add customer:", customerData);
    customerMessageArea.textContent = "Adding customer...";
    customerMessageArea.style.color = "orange";
    // Disable add button while processing?
    const addButton = addCustomerSection.querySelector('.add-btn');
    if (addButton) addButton.disabled = true;


    try {
        const newCustomer = await fetchData(`${BASE_URL}/customers/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(customerData)
        });

        console.log("Customer added successfully:", newCustomer);
        customerMessageArea.textContent = "Customer added successfully!";
        customerMessageArea.style.color = "green";
        addCustomerSection.style.display = "none"; // Hide form after success

        // Automatically select the newly added customer
        selectCustomer(newCustomer.customer_id, newCustomer.full_name, newCustomer.phone_number);

        // Optional: close modal automatically after a short delay
        // setTimeout(closeCustomerModal, 1500);

    } catch (error) {
        console.error("Error adding customer:", error);
        customerMessageArea.textContent = `Error adding customer: ${error.message || 'Unknown error'}`;
        customerMessageArea.style.color = "red";
        // Re-enable add button on failure
        if (addButton) addButton.disabled = false;
    }
}

// Helper to escape single quotes in names/phones passed to onclick handlers
function escapeSingleQuotes(str) {
    if (typeof str !== 'string') return "";
    return str.replace(/'/g, "\\'"); // Basic escaping for HTML attribute context
}


// ---------------------
// Checkout Process Logic
// ---------------------
async function handleCheckout() {
    console.log("--- Starting Checkout Process ---");
    if (currentOrder.length === 0) {
        alert("Cannot checkout with an empty order.");
        console.warn("Checkout aborted: Empty order.");
        return;
    }

    // --- Validation ---
    const totals = calculateTotal();
    const finalTotal = totals.finalTotal;
    const cashReceived = parseFloat(cashReceivedInput.value) || 0;
    const selectedPaymentMethodId = paymentMethodSelect.value;
    const selectedPaymentOption = paymentMethodSelect.options[paymentMethodSelect.selectedIndex];
    const selectedPaymentMethodName = selectedPaymentOption ? selectedPaymentOption.dataset.name : ''; // Get name from data attribute

    // 1. Payment Method Selected?
    if (!selectedPaymentMethodId) {
        alert("Please select a payment method.");
        paymentMethodSelect.focus();
        console.warn("Checkout aborted: No payment method selected.");
        return;
    }
    console.log(`Payment Method Selected: ID=${selectedPaymentMethodId}, Name=${selectedPaymentMethodName}`);

    // 2. Sufficient Cash for Cash Payment?
    // Using lowercase comparison for robustness
    if (selectedPaymentMethodName === 'cash') {
        console.log(`Cash Payment: Total=Rs ${finalTotal.toFixed(2)}, Received=Rs ${cashReceived.toFixed(2)}`);
        if (cashReceived < finalTotal) {
            alert(`Insufficient cash received (Rs ${cashReceived.toFixed(2)}) for the total amount (Rs ${finalTotal.toFixed(2)}).`);
            // openCashModal(); // Optionally re-open cash modal
            console.warn("Checkout aborted: Insufficient cash.");
            return;
        }
    } else {
        console.log(`Non-Cash Payment: Total=Rs ${finalTotal.toFixed(2)}`);
        // For non-cash, assume payment covers the full amount (e.g., card terminal handles it)
    }

    // --- Prepare Data ---
    // !! Replace placeholders with actual logged-in user/store context !!
    // This usually comes from login state (e.g., localStorage, session storage, state management)
    const staffId = parseInt(localStorage.getItem('staff_id')) || 1; // Example: Get from localStorage, default 1
    const storeId = 1; // Example: Get from context if multi-store, default 1
    console.log(`Context: StaffID=${staffId}, StoreID=${storeId}, CustomerID=${selectedCustomerId || 'None'}`);

    const saleData = {
        staff_id: staffId,
        store_id: storeId,
        customer_id: selectedCustomerId || null,
        // Backend should calculate total amount based on items + taxes/discounts applied there for consistency
        // Sending calculated total from frontend can be risky, but we'll send it as info
        total_amount: finalTotal, // Frontend calculated total (backend might recalculate)
        payment_status: "paid",   // Assume paid on checkout success
        receipt_number: null,     // Backend should generate this
        refund_amount: 0.0,
        refund_status: "none"
        // TODO: Add selected discount_id and tax_id if backend needs them at Sale level
    };

    const saleItemsData = currentOrder.map(item => ({
        item_id: item.product.item_id,
        quantity: item.quantity,
        unit_price: parseFloat(item.product.price) || 0,
        discount: 0.0, // Simplification: Backend should apply chosen discount rule
        tax: 0.0       // Simplification: Backend should apply chosen tax rule
        // sale_id will be added after Sale creation
    }));

    // Amount for the payment record:
    // For cash, it's the cash received. For others, it's the final total.
    const paymentAmount = (selectedPaymentMethodName === 'cash') ? cashReceived : finalTotal;

    const paymentDataPayload = {
        // sale_id will be added after Sale creation
        amount: paymentAmount,
        payment_method_id: parseInt(selectedPaymentMethodId),
        transaction_reference: null // Add later if needed for card/digital payments
    };

    console.log("Checkout Data Prepared:");
    console.log("Sale Data:", JSON.stringify(saleData, null, 2));
    console.log("Sale Items Data:", JSON.stringify(saleItemsData, null, 2));
    console.log("Payment Data Payload:", JSON.stringify(paymentDataPayload, null, 2));

    showLoadingIndicators(true, "Processing Checkout..."); // Indicate processing

    // --- API Calls in Sequence ---
    let createdSaleId = null;
    try {
        // Step 1: Create the Sale Record
        console.log("Step 1: Creating Sale record...");
        const newSale = await fetchData(`${BASE_URL}/sales/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(saleData)
        });
        createdSaleId = newSale.sale_id; // Store the crucial ID
        console.log(`Sale Record Created: ID = ${createdSaleId}`);

        // Step 2: Create Sale Items (Loop)
        console.log(`Step 2: Creating ${saleItemsData.length} Sale Item record(s)...`);
        let itemErrors = [];
        for (const itemData of saleItemsData) {
            itemData.sale_id = createdSaleId; // Add the created sale_id
            try {
                await fetchData(`${BASE_URL}/sale_items/`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(itemData)
                });
                 console.log(` -> Sale Item added successfully: Item ID ${itemData.item_id}`);
            } catch (itemError) {
                console.error(`Failed to add item ID ${itemData.item_id} for Sale ID ${createdSaleId}:`, itemError);
                itemErrors.push(`Item ID ${itemData.item_id}: ${itemError.message}`);
                // Decide behavior: Continue processing other items or stop?
                // Let's continue but report errors at the end.
            }
        }

        // Step 3: Create the Payment Record (Crucial)
        console.log("Step 3: Creating Payment record...");
        paymentDataPayload.sale_id = createdSaleId; // Add sale_id to payment data
        try {
            await fetchData(`${BASE_URL}/payments/`, { // Using /payments/ endpoint as per initial code
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(paymentDataPayload)
            });
            console.log("Payment Record Created successfully.");
        } catch (paymentError) {
            console.error(`CRITICAL ERROR: Failed to create payment record for Sale ID ${createdSaleId}:`, paymentError);
            // This is serious. The sale happened, items might be recorded, but payment isn't logged.
            // Alert the user strongly. They need to manually verify/record this payment.
            alert(`CRITICAL WARNING: Order ${createdSaleId} processed, but FAILED TO RECORD PAYMENT (${paymentError.message}). Please manually verify payment and contact support.`);
            // Set lastOrderId so receipt *can* be printed for investigation, but warn user.
            lastOrderId = createdSaleId;
            printReceiptBtn.style.display = "block";
            printReceiptBtn.disabled = false;
            showLoadingIndicators(false); // Hide loading
            // Do NOT clear the order automatically here, leave it for manual check.
            return; // Stop further processing like auto-clear
        }


        // --- Handle Final Outcome ---
        lastOrderId = createdSaleId; // Store the ID for receipt printing on success
        console.log(`Checkout successful for Sale ID: ${lastOrderId}`);

        if (itemErrors.length > 0) {
             // Sale and Payment succeeded, but some items failed.
             alert(`Order ${lastOrderId} processed with payment recorded, but some items failed:\n\n- ${itemErrors.join("\n- ")}\n\nPlease review the sale details.`);
             printReceiptBtn.style.display = "block"; // Allow printing receipt
             printReceiptBtn.disabled = false;
             handleClearOrder(); // Clear form for next sale, despite item errors
        } else {
            // Full success
            alert(`Order ${lastOrderId} processed successfully!`);
            printReceiptBtn.style.display = "block"; // Show print button
            printReceiptBtn.disabled = false; // Enable print button
             // Optional: Auto-print receipt?
             // handlePrintReceipt();
            handleClearOrder(); // Clear the form automatically after successful checkout
        }

    } catch (error) {
        console.error("Checkout process failed:", error);
        // An error occurred, likely during Sale or Payment creation (or fetchData itself)
        alert(`Error processing order: ${error.message || 'Unknown error occurred during checkout.'}`);
        lastOrderId = null; // Ensure print button isn't active for failed order
        printReceiptBtn.style.display = "none";
        printReceiptBtn.disabled = true;
         // Do not clear the order if checkout failed, allow user to retry or adjust.
    } finally {
        showLoadingIndicators(false); // Hide processing indicator in all cases
        console.log("--- Checkout Process Ended ---");
    }
}