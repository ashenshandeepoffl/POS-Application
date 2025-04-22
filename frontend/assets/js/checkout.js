// assets/js/checkout.js

"use strict";

// ---------------------
// Global Variables & Constants
// ---------------------
const BASE_URL = "http://127.0.0.1:8000"; // Your API Base URL

// State Variables
let modalInput = "0";
let cashModalInput = "";
let customerModalInput = "";
let selectedProduct = null;
let selectedCustomerId = null;
let currentOrder = []; // Array of { product: {..., quantity: backend_stock_quantity}, quantity: number_in_order }
let lastOrderId = null;
let categories = [];
let allProducts = []; // Holds products with stock quantity from backend

// --- DOM Element References ---
// (Keep all the element references from your original code)
const productModal = document.getElementById("productModal");
const cashModal = document.getElementById("cashModal");
const customerModal = document.getElementById("customerModal");
const loadingOverlay = document.getElementById('loadingOverlay');
const globalErrorDisplay = document.getElementById('globalErrorDisplay');
const modalProductName = document.getElementById("modalProductName");
const modalProductPrice = document.getElementById("modalProductPrice");
const modalQuantityDisplay = document.getElementById("modalQuantityDisplay");
const modalQuantityEl = document.getElementById("modalQuantity");
const modalTotalEl = document.getElementById("modalTotal");
const modalConfirmBtn = document.getElementById("modalConfirm");
const cashDisplay = document.getElementById("cashDisplay");
const cashReceivedInput = document.getElementById("cashReceived");
const changeDisplay = document.getElementById("changeDisplay");
const customerPhoneDisplay = document.getElementById("customerPhoneDisplay");
const customerResultsArea = document.getElementById("customerResultsArea");
const addCustomerSection = document.getElementById("addCustomerSection");
const newCustomerNameInput = document.getElementById("newCustomerNameInput");
const newCustomerEmailInput = document.getElementById("newCustomerEmailInput");
const customerMessageArea = document.getElementById("customerMessageArea");
const categoryListEl = document.getElementById("categoryList");
const productListEl = document.getElementById("productList");
const productSearchInput = document.getElementById("productSearch");
const orderItemsEl = document.getElementById("orderItems");
const orderTotalEl = document.getElementById("orderTotal");
const subtotalDisplayEl = document.getElementById("subtotalDisplay")?.querySelector('span'); // Get span inside
const discountDisplayEl = document.getElementById("discountDisplay")?.querySelector('span'); // Get span inside
const taxDisplayEl = document.getElementById("taxDisplay")?.querySelector('span'); // Get span inside
const discountSelect = document.getElementById("discountSelect");
const taxSelect = document.getElementById("taxSelect");
const paymentMethodSelect = document.getElementById("paymentMethodSelect");
const customerDisplayInput = document.getElementById("customerDisplay");
const selectedCustomerIdInput = document.getElementById("selectedCustomerId");
const checkoutBtn = document.getElementById("checkoutBtn");
const printReceiptBtn = document.getElementById("printReceiptBtn");
const clearOrderBtn = document.getElementById("clearOrderBtn");


// ---------------------
// Utility Functions
// ---------------------
// assets/js/checkout.js

async function fetchData(url, options = {}) {
    const method = options.method || 'GET';
    console.log(`Fetching ${method} ${url}`, options.body ? 'with body...' : '');
    showLoadingIndicators(true, options.loadingMsg || "Loading...");

    try {
        const response = await fetch(url, options);
        const responseClone = response.clone(); // Clone for reading body on error

        if (!response.ok) {
            let errorDetail = `HTTP error ${response.status}: ${response.statusText}`;
            let errorJson = null;
            let validationErrors = null;

            try {
                errorJson = await response.json();
                if (response.status === 422 && errorJson.detail) {
                    validationErrors = errorJson.detail;
                    // Try to format validation errors nicely
                    if (Array.isArray(validationErrors)) {
                        errorDetail = validationErrors.map(err => `${err.loc.join(' -> ')}: ${err.msg}`).join('; ');
                    } else {
                       errorDetail = JSON.stringify(validationErrors);
                    }
                    errorDetail = `Validation Error(s): ${errorDetail}`; // Prepend context
                    console.error('--- FastAPI Validation Errors ---');
                    console.error(JSON.stringify(validationErrors, null, 2));
                    console.error('--- Offending Payload (if POST/PUT) ---');
                     if (options.body) {
                       try { console.error(JSON.parse(options.body)); } catch { console.error("Could not re-parse body for logging."); }
                    }
                    console.error('--- End Validation Error Details ---');
                } else {
                    errorDetail = errorJson.detail || JSON.stringify(errorJson) || errorDetail;
                    console.error('Backend Error Detail:', errorJson);
                }
            } catch (jsonError) {
                try {
                    const textError = await responseClone.text();
                    console.warn("Could not parse error response as JSON. Response text:", textError);
                    if (textError) errorDetail = textError.substring(0, 200); // Limit length
                } catch (textParseError) {
                    console.warn("Could not parse error response as JSON or read as text.");
                }
            }
            const error = new Error(errorDetail);
            error.status = response.status;
            error.json = errorJson;
            error.validation_errors = validationErrors;
            throw error; // <<<--- RE-THROW THE ERROR ---<<<
        }

        // Handle successful responses
        if (response.status === 204) {
            console.log(`Fetch successful (204 No Content) for ${url}`);
            return null;
        }

        const data = await response.json();
        console.log(`Fetch successful for ${url}`);
        return data;

    } catch (error) { // Catches fetch errors AND errors thrown from !response.ok block
        console.error(`Fetch error during request to ${url}:`, error);
        // Display message using the error passed up or caught directly
        displayGlobalError(`API Error: ${error.message}. Please check connection or details.`);
        throw error; // <<<--- RE-THROW THE ERROR TO THE CALLER ---<<<

    } finally {
         showLoadingIndicators(false);
    }
}

function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

function showLoadingIndicators(isLoading, message = "Processing...") {
    if (isLoading) {
        loadingOverlay.textContent = message;
        loadingOverlay.style.display = 'flex';
        checkoutBtn.disabled = true;
        clearOrderBtn.disabled = true;
        printReceiptBtn.disabled = true;
    } else {
        loadingOverlay.style.display = 'none';
        // Re-enable based on state
        checkoutBtn.disabled = currentOrder.length === 0; // Disable if order empty
        clearOrderBtn.disabled = currentOrder.length === 0 && !selectedCustomerId && !cashReceivedInput.value; // Disable if nothing to clear
        printReceiptBtn.disabled = !lastOrderId;
        printReceiptBtn.style.display = lastOrderId ? 'block' : 'none'; // Show/hide print button
    }
    // console.log(`Loading state: ${isLoading}`); // Can be noisy
}

function displayGlobalError(message) {
    if (message) {
        globalErrorDisplay.textContent = message;
        globalErrorDisplay.style.display = 'block';
        // Auto-hide after a delay?
        // setTimeout(() => displayGlobalError(''), 7000);
    } else {
        globalErrorDisplay.style.display = 'none';
        globalErrorDisplay.textContent = '';
    }
}


// ---------------------
// Initialization
// ---------------------
document.addEventListener('DOMContentLoaded', initializeCheckout);

async function initializeCheckout() {
    console.log("Initializing Checkout Page...");
    showLoadingIndicators(true, "Loading initial data...");

    try {
        await Promise.all([
            loadCategories(),
            loadProducts(), // Now loads products WITH stock
            loadDiscountOptions(),
            loadTaxOptions(),
            loadPaymentMethods()
        ]);

        renderOrder();
        updateModalDisplay();
        updateCashModalDisplay();
        updateCustomerModalDisplay();
        attachEventListeners();

        console.log("Checkout Page Initialized Successfully.");
        displayGlobalError(''); // Clear any previous global errors

    } catch (error) {
        console.error("Initialization failed:", error);
        displayGlobalError(`Failed to initialize the checkout system: ${error.message}. Please try refreshing.`);
    } finally {
        showLoadingIndicators(false); // Hide loading state AFTER potentially enabling buttons
        // Ensure correct initial button states
        checkoutBtn.disabled = currentOrder.length === 0;
        clearOrderBtn.disabled = currentOrder.length === 0 && !selectedCustomerId && !cashReceivedInput.value;
        printReceiptBtn.disabled = !lastOrderId;
        printReceiptBtn.style.display = lastOrderId ? 'block' : 'none';
    }
}

function attachEventListeners() {
    productSearchInput.addEventListener("input", debounce(handleProductSearch, 300));
    productSearchInput.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            handleProductSearch(event);
        }
    });
    modalConfirmBtn.addEventListener("click", confirmProductModal);
    clearOrderBtn.addEventListener("click", handleClearOrder);
    checkoutBtn.addEventListener("click", handleCheckout);
    printReceiptBtn.addEventListener("click", handlePrintReceipt);
    discountSelect.addEventListener("change", renderOrder);
    taxSelect.addEventListener("change", renderOrder);
    window.addEventListener('click', (event) => {
        if (event.target == productModal) closeProductModal();
        if (event.target == cashModal) closeCashModal();
        if (event.target == customerModal) closeCustomerModal();
    });
}

// ---------------------
// Data Loading Functions
// ---------------------
async function loadCategories() {
    try {
        categories = await fetchData(`${BASE_URL}/categories/`, { loadingMsg: "Loading categories..." });
        renderCategories();
    } catch (error) {
        categoryListEl.innerHTML = '<li>Error loading categories</li>';
        throw error;
    }
}

async function loadProducts() {
    try {
        // Fetches items including stock 'quantity' from the modified backend endpoint
        allProducts = await fetchData(`${BASE_URL}/items/`, { loadingMsg: "Loading products..." });
        // Backend now provides stock quantity, no simulation needed.
        // Ensure field name matches backend (e.g., 'quantity')
        renderProducts(allProducts);
    } catch (error) {
        productListEl.innerHTML = '<p class="no-products-message">Error loading products.</p>';
        throw error;
    }
}

async function loadDiscountOptions() {
    try {
        const activeDiscounts = await fetchData(`${BASE_URL}/discounts/?status=active`, { loadingMsg: "Loading discounts..." });
        discountSelect.innerHTML = `<option value="0" data-type="fixed_amount" data-id="0">No Discount</option>`;
        activeDiscounts.forEach(d => {
            const option = document.createElement("option");
            option.dataset.type = d.discount_type;
            option.value = d.discount_value;
            option.dataset.id = d.discount_id;
            option.textContent = `${d.discount_name} (${d.discount_type === "percentage" ? `${d.discount_value}%` : `Rs ${parseFloat(d.discount_value).toFixed(2)}`})`;
            discountSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Failed to load discounts:", error);
        discountSelect.innerHTML = `<option value="0">Error loading discounts</option>`;
    }
}

async function loadTaxOptions() {
    try {
        const activeTaxes = await fetchData(`${BASE_URL}/taxes/?status=active`, { loadingMsg: "Loading taxes..." });
        taxSelect.innerHTML = `<option value="0" data-id="0">No Tax</option>`;
        activeTaxes.forEach(t => {
            const option = document.createElement("option");
            option.value = t.tax_percentage;
            option.dataset.id = t.tax_id;
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
        const paymentMethods = await fetchData(`${BASE_URL}/payment_methods/`, { loadingMsg: "Loading payment methods..." });
        paymentMethodSelect.innerHTML = `<option value="">Select Payment Method</option>`;
        paymentMethods.forEach(pm => {
            const option = document.createElement("option");
            option.value = pm.payment_method_id;
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
// UI Rendering Functions
// ---------------------
function renderCategories() {
    categoryListEl.innerHTML = "";
    const allLi = document.createElement("li");
    allLi.textContent = "All";
    allLi.dataset.categoryId = "";
    allLi.classList.add("active");
    allLi.addEventListener("click", () => handleCategoryClick(allLi));
    categoryListEl.appendChild(allLi);
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
        productListEl.innerHTML = '<p class="no-products-message">No products found.</p>';
        return;
    }
    productsToRender.forEach(product => {
        const prodEl = document.createElement("div");
        prodEl.classList.add("product");
        prodEl.dataset.productId = product.item_id;

        const price = parseFloat(product.price) || 0;
        // Use the 'quantity' field directly from the backend API response
        const stock = (product.quantity !== null && product.quantity !== undefined) ? product.quantity : null;
        const minStock = product.min_stock_level || 5; // Use default if not provided
        const isLowStock = stock !== null && stock < minStock; // Correct low stock check

        prodEl.innerHTML = `
            <img src="${product.image_url || 'assets/imgs/default_item.jpg'}" alt="${product.item_name}">
            <p class="product-name">${product.item_name}</p>
            <p class="product-price">Rs ${price.toFixed(2)}</p>
            <p class="stock ${isLowStock ? 'low-stock' : ''}">
                Stock: ${stock !== null ? stock : 'N/A'}
            </p>
        `;
        if (stock === 0) {
            prodEl.classList.add('out-of-stock'); // Add class if needed for styling
            prodEl.title = "Out of Stock"; // Tooltip
            // Optionally prevent click if out of stock
            // prodEl.style.opacity = '0.6';
            // prodEl.style.cursor = 'not-allowed';
        } else {
            prodEl.addEventListener("click", () => openProductModal(product));
        }

        productListEl.appendChild(prodEl);
    });
}

function renderOrder() {
    orderItemsEl.innerHTML = "";
    const totals = calculateTotal(); // Calculate totals first

    if (currentOrder.length === 0) {
        orderItemsEl.innerHTML = '<li class="no-items">No items in order</li>';
        orderTotalEl.innerText = `Rs 0.00`; // Only show final total here
        // Clear breakdown
        if (subtotalDisplayEl) subtotalDisplayEl.textContent = 'Rs 0.00';
        if (discountDisplayEl) discountDisplayEl.textContent = '- Rs 0.00';
        if (taxDisplayEl) taxDisplayEl.textContent = '+ Rs 0.00';
    } else {
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
        // Update breakdown display
         if (subtotalDisplayEl) subtotalDisplayEl.textContent = `Rs ${totals.subtotal.toFixed(2)}`;
         if (discountDisplayEl) discountDisplayEl.textContent = `- Rs ${totals.discountAmount.toFixed(2)}`;
         if (taxDisplayEl) taxDisplayEl.textContent = `+ Rs ${totals.taxAmount.toFixed(2)}`;
         orderTotalEl.innerText = `Rs ${totals.finalTotal.toFixed(2)}`;
    }

    updateChangeDisplay();
    // Update button states based on order content
    checkoutBtn.disabled = currentOrder.length === 0;
    clearOrderBtn.disabled = currentOrder.length === 0 && !selectedCustomerId && !cashReceivedInput.value;
}


// ---------------------
// Event Handlers
// ---------------------
function handleProductSearch(event) {
    const query = productSearchInput.value.toLowerCase().trim();
    const activeCategoryLi = categoryListEl.querySelector("li.active");
    const activeCategoryId = activeCategoryLi ? activeCategoryLi.dataset.categoryId : "";

    console.log(`Searching products: Query='${query}', CategoryID='${activeCategoryId}'`);

    let filtered = allProducts;

    if (activeCategoryId) {
        filtered = filtered.filter(product => product.category_id == activeCategoryId);
    }

    if (query) {
        const potentialBarcode = filtered.find(product => product.barcode === query);

        if (potentialBarcode && event.type === 'keypress' && event.key === 'Enter') {
             // Exact barcode match on Enter key press
             console.log("Barcode match found:", potentialBarcode.item_name);
             openProductModal(potentialBarcode); // Open modal for barcode scan
             productSearchInput.value = ""; // Clear search after barcode scan
             productSearchInput.blur(); // Lose focus to prevent accidental rescans
             filtered = []; // Prevent showing only this item in the list after modal opens
        } else {
             // Filter by name or partial barcode
             filtered = filtered.filter(product =>
                (product.item_name && product.item_name.toLowerCase().includes(query)) ||
                (product.barcode && product.barcode.includes(query)) // Allow partial barcode match for text search
            );
        }
    }
    renderProducts(filtered);
}


function handleCategoryClick(clickedLi) {
    categoryListEl.querySelectorAll("li").forEach(li => li.classList.remove("active"));
    clickedLi.classList.add("active");
    const categoryId = clickedLi.dataset.categoryId;
    console.log(`Category selected: ID=${categoryId || 'All'}`);
    let productsToDisplay = categoryId
        ? allProducts.filter(p => p.category_id == categoryId)
        : allProducts;
    renderProducts(productsToDisplay);
    productSearchInput.value = "";
}

function handleClearOrder() {
    const anythingToClear = currentOrder.length > 0 ||
                           selectedCustomerId ||
                           cashReceivedInput.value ||
                           discountSelect.value !== "0" ||
                           taxSelect.value !== "0" ||
                           paymentMethodSelect.value !== "";

    if (!anythingToClear) {
        console.log("Clear Order: Nothing significant to clear.");
        return;
    }

    if (!confirm("Are you sure you want to clear the entire order and selections?")) {
        return;
    }

    console.log("Clearing order state...");
    currentOrder = [];
    selectedCustomerId = null;
    lastOrderId = null; // Reset the printable order ID

    // Reset UI elements
    discountSelect.value = "0";
    taxSelect.value = "0";
    paymentMethodSelect.value = "";
    cashReceivedInput.value = "";
    cashModalInput = "";
    changeDisplay.innerText = "";
    changeDisplay.style.color = 'inherit';
    customerDisplayInput.value = "";
    customerModalInput = "";
    selectedCustomerIdInput.value = "";
    customerMessageArea.textContent = "";
    customerResultsArea.innerHTML = "";
    addCustomerSection.style.display = "none";
    newCustomerNameInput.value = "";
    newCustomerEmailInput.value = "";
    displayGlobalError(''); // Clear global errors

    // Reset buttons to initial state
    printReceiptBtn.style.display = "none";
    printReceiptBtn.disabled = true;

    renderOrder(); // Update the order display (shows "No items", updates button states)
    updateCashModalDisplay();
    updateCustomerModalDisplay();
    console.log("Order State Cleared.");

    productSearchInput.focus();
}


function handlePrintReceipt() {
    if (!lastOrderId) {
        console.warn("Print Receipt clicked but lastOrderId is null.");
        alert("No completed order available to print receipt.");
        return;
    }
    console.log(`Attempting to print receipt for Order ID: ${lastOrderId}`);
    const url = `${BASE_URL}/sales/${lastOrderId}/receipt/pdf`;
    const pdfWindow = window.open(url, "_blank");
    if (!pdfWindow || pdfWindow.closed || typeof pdfWindow.closed === 'undefined') {
        console.warn("window.open might have been blocked by a pop-up blocker.");
        alert("Could not open receipt window. Please check if your browser is blocking pop-ups for this site.");
    } else {
        console.log("Receipt window opened (or attempted).");
    }
}

// ---------------------
// Order Management
// ---------------------
function addToOrder(product, quantity) {
    if (!product || quantity <= 0) return;

    const existingIndex = currentOrder.findIndex(item => item.product.item_id === product.item_id);
    // Use the stock quantity from the product object (fetched from backend)
    const availableStock = (product.quantity !== null && product.quantity !== undefined) ? product.quantity : Infinity; // Treat null stock as infinite? Or handle differently?

    quantity = Number(quantity);
    if (isNaN(quantity)) {
        console.error("Invalid quantity passed to addToOrder:", quantity);
        return;
    }

    if (existingIndex > -1) { // Item exists, update quantity
        const currentQuantity = currentOrder[existingIndex].quantity;
        const newQuantity = currentQuantity + quantity;
        if (newQuantity > availableStock) {
            alert(`Cannot add ${quantity} more of ${product.item_name}. Only ${availableStock - currentQuantity} more in stock (Total Available: ${availableStock}).`);
            return;
        }
        currentOrder[existingIndex].quantity = newQuantity;
        console.log(`Updated quantity for ${product.item_name} to ${newQuantity}`);
    } else { // New item
        if (quantity > availableStock) {
            alert(`Cannot add ${quantity} of ${product.item_name}. Only ${availableStock} available in stock.`);
            return;
        }
        // Store the product object itself which now includes the backend stock `quantity`
        currentOrder.push({ product: product, quantity: quantity });
        console.log(`Added ${quantity} of ${product.item_name} to order.`);
    }
    renderOrder();
}


function editOrderItem(productId) {
    const itemIndex = currentOrder.findIndex(i => i.product.item_id === productId);
    if (itemIndex > -1) {
        const itemToEdit = currentOrder[itemIndex];
        console.log(`Editing item: ${itemToEdit.product.item_name}`);
        selectedProduct = itemToEdit.product;
        modalInput = String(itemToEdit.quantity);
        updateModalDisplay();
        productModal.style.display = "flex";
        modalConfirmBtn.dataset.editingItemId = productId; // Mark as editing
    } else {
        console.warn(`Attempted to edit item ID ${productId} but it was not found in the order.`);
    }
}

function removeFromOrder(productId) {
    const itemIndex = currentOrder.findIndex(i => i.product.item_id === productId);
    if (itemIndex > -1) {
        console.log(`Removing item: ${currentOrder[itemIndex].product.item_name}`);
        currentOrder.splice(itemIndex, 1);
        renderOrder();
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
    const discountType = discountOption?.dataset.type;
    const discountValue = parseFloat(discountSelect.value) || 0;

    let discountAmount = 0;
    if (discountType === 'percentage' && discountValue > 0) {
        discountAmount = subtotal * (discountValue / 100);
    } else if (discountType === 'fixed_amount' && discountValue > 0) {
        discountAmount = discountValue;
    }
    discountAmount = Math.min(discountAmount, subtotal); // Cannot discount more than subtotal

    const afterDiscount = subtotal - discountAmount;

    const taxPercentage = parseFloat(taxSelect.value) || 0;
    const taxAmount = afterDiscount * (taxPercentage / 100); // Tax on discounted amount

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
    if (!product || product.item_id === undefined) {
        console.error("Invalid product data passed to openProductModal:", product);
        alert("Error: Could not load product details.");
        return;
    }
     // Check stock before opening modal if desired
     const stock = (product.quantity !== null && product.quantity !== undefined) ? product.quantity : Infinity;
     if (stock <= 0) {
         alert(`${product.item_name} is out of stock.`);
         return;
     }

    console.log(`Opening modal for product: ${product.item_name} (ID: ${product.item_id}, Stock: ${stock})`);
    selectedProduct = product;
    modalInput = "1";
    modalConfirmBtn.removeAttribute('data-editing-item-id');
    modalProductName.textContent = product.item_name;
    modalProductPrice.textContent = `Price: Rs ${parseFloat(product.price || 0).toFixed(2)}`;
    updateModalDisplay();
    productModal.style.display = "flex";
}

function closeProductModal() {
    productModal.style.display = "none";
    selectedProduct = null;
    modalInput = "0";
    modalConfirmBtn.removeAttribute('data-editing-item-id');
}

function modalAppend(value) {
    if (!/^\d$/.test(value)) return;
    if (modalInput === "0" && value !== "0") {
        modalInput = value;
    } else if (modalInput !== "0" && modalInput.length < 4) { // Prevent adding if already '0' unless it's the first digit
        modalInput += value;
    } else if (modalInput === "0" && value === "0") {
         // Do nothing if input is '0' and user presses '0' again
    } else if (modalInput.length >= 4) {
         console.warn("Max quantity input length reached.");
    }
    updateModalDisplay();
}

function modalBackspace() {
    modalInput = modalInput.slice(0, -1);
    if (modalInput === "") {
        modalInput = "0";
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
        const price = parseFloat(selectedProduct.price) || 0;
        const total = quantity * price;
        modalTotalEl.textContent = total.toFixed(2);
    } else {
        modalTotalEl.textContent = "0.00";
    }
}


function confirmProductModal() {
    const quantity = parseInt(modalInput);
    if (isNaN(quantity) || quantity <= 0) {
        alert("Please enter a valid quantity (at least 1).");
        modalInput = "1";
        updateModalDisplay();
        return;
    }

    if (!selectedProduct) {
        console.error("ConfirmProductModal called without a selectedProduct.");
        alert("Error: No product selected.");
        closeProductModal();
        return;
    }

    const editingItemId = modalConfirmBtn.dataset.editingItemId;
    // Get available stock from the selected product object
    const availableStock = (selectedProduct.quantity !== null && selectedProduct.quantity !== undefined) ? selectedProduct.quantity : Infinity;

    // Stock Check
    if (editingItemId) {
        // If editing, the entered quantity is the *new total* quantity for this item
        if (quantity > availableStock) {
             alert(`Insufficient stock for ${selectedProduct.item_name}. Only ${availableStock} available.`);
             modalInput = String(availableStock > 0 ? availableStock : 1); // Reset to max possible or 1
             updateModalDisplay();
             return;
        }
        // Find the item in the order and update its quantity
        const itemIndex = currentOrder.findIndex(i => i.product.item_id == editingItemId);
        if (itemIndex > -1) {
            console.log(`Confirming edit for ${selectedProduct.item_name}: Old Qty=${currentOrder[itemIndex].quantity}, New Qty=${quantity}`);
            currentOrder[itemIndex].quantity = quantity;
            renderOrder();
        } else {
             console.error(`Tried to confirm edit for item ID ${editingItemId}, but it wasn't found.`);
        }
        modalConfirmBtn.removeAttribute('data-editing-item-id');
    } else {
        // If adding new or adding more to an existing item (not via edit button)
        const existingItem = currentOrder.find(i => i.product.item_id === selectedProduct.item_id);
        const currentOrderQty = existingItem ? existingItem.quantity : 0;

        if ((currentOrderQty + quantity) > availableStock) {
            alert(`Insufficient stock for ${selectedProduct.item_name}. Only ${availableStock - currentOrderQty} more can be added (Total Available: ${availableStock}).`);
            // Adjust quantity to max possible if trying to add too many
            const maxAddable = availableStock - currentOrderQty;
            modalInput = String(maxAddable > 0 ? maxAddable : 1); // Suggest max addable or 1
            updateModalDisplay();
             return;
        }
        // Add the item to the order (addToOrder handles merging quantities)
        console.log(`Confirming add for ${selectedProduct.item_name}: Qty=${quantity}`);
        addToOrder(selectedProduct, quantity);
    }

    closeProductModal();
}


// ---------------------
// Cash Modal Logic
// ---------------------
// openCashModal, closeCashModal, cashModalAppend, cashModalBackspace, updateCashModalDisplay, confirmCashModal, updateChangeDisplay
// (Keep these functions as they are in your provided JS - they seem correct)
function openCashModal() {
    const totals = calculateTotal();
    if (totals.finalTotal <= 0 && currentOrder.length === 0) {
        alert("Add items to the order first.");
        return;
    }
    cashModalInput = cashReceivedInput.value || "";
    updateCashModalDisplay();
    cashModal.style.display = "flex";
}

function closeCashModal() {
    cashModal.style.display = "none";
}

function cashModalAppend(value) {
    if (!/^[\d.]$/.test(value)) return;
    if (value === '.' && cashModalInput.includes('.')) return;
    if (cashModalInput.length >= 10) return;

    if (cashModalInput === "0" && value !== '.') {
        cashModalInput = value;
    } else if (cashModalInput === "" && value === '.') {
        cashModalInput = "0.";
    } else {
        if (cashModalInput === "0" && value === "0") return;
        cashModalInput += value;
    }

    const parts = cashModalInput.split('.');
    if (parts.length > 1 && parts[1].length > 2) {
        cashModalInput = cashModalInput.slice(0, -1);
        return;
    }
    updateCashModalDisplay();
}


function cashModalBackspace() {
    cashModalInput = cashModalInput.slice(0, -1);
    updateCashModalDisplay();
}

function updateCashModalDisplay() {
    cashDisplay.textContent = cashModalInput || "0.00";
}

function confirmCashModal() {
    const enteredValue = parseFloat(cashModalInput) || 0;
    cashReceivedInput.value = enteredValue.toFixed(2);
    closeCashModal();
    updateChangeDisplay();
}

function updateChangeDisplay() {
    const cash = parseFloat(cashReceivedInput.value) || 0;
    const totals = calculateTotal();
    const finalTotal = totals.finalTotal;

    if (finalTotal <= 0 || cash <= 0) {
        changeDisplay.innerText = "";
        changeDisplay.style.color = 'inherit';
        return;
    }

    const change = cash - finalTotal;

    if (change >= 0) {
        changeDisplay.innerText = `Change Due: Rs ${change.toFixed(2)}`;
        changeDisplay.style.color = '#27ae60'; // Green
    } else {
        changeDisplay.innerText = `Amount Remaining: Rs ${Math.abs(change).toFixed(2)}`;
        changeDisplay.style.color = '#e74c3c'; // Red
    }
}

// ---------------------
// Customer Modal Logic
// ---------------------
// openCustomerModal, closeCustomerModal, customerModalAppend, customerModalBackspace, customerModalClear, updateCustomerModalDisplay, searchCustomer, selectCustomer, addCustomer, escapeSingleQuotes
// (Keep these functions as they are in your provided JS - they seem correct)
function openCustomerModal() {
    console.log("Opening customer modal");
    customerModalInput = "";
    updateCustomerModalDisplay();
    customerResultsArea.innerHTML = "";
    addCustomerSection.style.display = "none";
    customerMessageArea.textContent = "";
    newCustomerNameInput.value = "";
    newCustomerEmailInput.value = "";
    customerModal.style.display = "flex";
}

function closeCustomerModal() {
    console.log("Closing customer modal");
    customerModal.style.display = "none";
}

function customerModalAppend(value) {
     if (!/^\d$/.test(value)) return;
    if (customerModalInput.length < 15) {
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
    customerResultsArea.innerHTML = "";
    addCustomerSection.style.display = "none";
    customerMessageArea.textContent = "";
}

function updateCustomerModalDisplay() {
    customerPhoneDisplay.textContent = customerModalInput || "Enter Phone Number";
}

async function searchCustomer() {
    const phoneNumber = customerModalInput.trim();
    if (!phoneNumber || phoneNumber.length < 5) {
        customerMessageArea.textContent = "Please enter a valid phone number (min 5 digits).";
        customerMessageArea.style.color = "red";
        return;
    }

    console.log(`Searching for customer with phone: ${phoneNumber}`);
    customerMessageArea.textContent = "Searching...";
    customerMessageArea.style.color = "orange";
    customerResultsArea.innerHTML = '<p>Loading...</p>';
    addCustomerSection.style.display = "none";

    try {
        const customers = await fetchData(`${BASE_URL}/customers/?phone_number=${encodeURIComponent(phoneNumber)}`, { loadingMsg: "Searching customer..."});

        if (customers && customers.length > 0) {
            console.log("Customer(s) found:", customers);
            const cust = customers[0];
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
            console.log("Customer not found.");
            customerResultsArea.innerHTML = `<p>Customer with phone '${phoneNumber}' not found.</p>`;
            customerMessageArea.textContent = "Customer not found. You can add them below.";
            customerMessageArea.style.color = "blue";
            addCustomerSection.style.display = "block";
            newCustomerNameInput.focus();
        }
    } catch (error) {
        console.error("Error searching customer:", error);
        customerMessageArea.textContent = `Error searching: ${error.message}`;
        customerMessageArea.style.color = "red";
        customerResultsArea.innerHTML = "<p>Search failed. Check connection.</p>";
    }
}

function selectCustomer(customerId, customerName, customerPhone) {
    console.log(`Selected Customer: ID=${customerId}, Name=${customerName}, Phone=${customerPhone}`);
    selectedCustomerId = customerId;
    selectedCustomerIdInput.value = customerId;
    customerDisplayInput.value = `${customerName || 'Customer'} (${customerPhone || 'N/A'})`;
    closeCustomerModal();
}

async function addCustomer() {
    const name = newCustomerNameInput.value.trim();
    const phone = customerModalInput.trim();
    const email = newCustomerEmailInput.value.trim();

    if (!name || !phone) {
        customerMessageArea.textContent = "Full Name and Phone Number are required.";
        customerMessageArea.style.color = "red";
        return;
    }

    const customerData = {
        full_name: name, phone_number: phone, email: email || null,
        street: null, city: null, state: null, zip_code: null, loyalty_points: 0
    };

    console.log("Attempting to add customer:", customerData);
    customerMessageArea.textContent = "Adding customer...";
    customerMessageArea.style.color = "orange";
    const addButton = addCustomerSection.querySelector('.add-btn');
    if (addButton) addButton.disabled = true;


    try {
        const newCustomer = await fetchData(`${BASE_URL}/customers/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(customerData),
            loadingMsg: "Adding customer..."
        });

        console.log("Customer added successfully:", newCustomer);
        customerMessageArea.textContent = "Customer added successfully!";
        customerMessageArea.style.color = "green";
        addCustomerSection.style.display = "none";
        selectCustomer(newCustomer.customer_id, newCustomer.full_name, newCustomer.phone_number);
         // setTimeout(closeCustomerModal, 1500); // Optional auto-close

    } catch (error) {
        console.error("Error adding customer:", error);
        customerMessageArea.textContent = `Error adding customer: ${error.message || 'Unknown error'}`;
        customerMessageArea.style.color = "red";
    } finally {
         if (addButton) addButton.disabled = false;
    }
}

function escapeSingleQuotes(str) {
    if (typeof str !== 'string') return "";
    return str.replace(/'/g, "\\'");
}


// ---------------------
// Checkout Process Logic
// ---------------------
// assets/js/checkout.js

// ... (keep other functions like initialization, rendering, modals etc.) ...

async function handleCheckout() {
    console.log("--- Starting Checkout Process ---");
    displayGlobalError(''); // Clear previous errors

    // --- Basic Frontend Validations (Keep these) ---
    if (currentOrder.length === 0) {
        alert("Cannot checkout with an empty order.");
        console.warn("Checkout aborted: Empty order.");
        return;
    }
    const totals = calculateTotal();
    const finalTotal = totals.finalTotal;
    const cashReceived = parseFloat(cashReceivedInput.value) || 0;
    const selectedPaymentMethodId = paymentMethodSelect.value;
    const selectedPaymentOption = paymentMethodSelect.options[paymentMethodSelect.selectedIndex];
    const selectedPaymentMethodName = selectedPaymentOption?.dataset.name || '';

    if (!selectedPaymentMethodId) {
        alert("Please select a payment method.");
        paymentMethodSelect.focus();
        console.warn("Checkout aborted: No payment method selected.");
        return;
    }
    if (selectedPaymentMethodName === 'cash' && cashReceived < finalTotal) {
        alert(`Insufficient cash received (Rs ${cashReceived.toFixed(2)}) for the total amount (Rs ${finalTotal.toFixed(2)}).`);
        console.warn("Checkout aborted: Insufficient cash.");
        return;
    }
    // --- End Basic Frontend Validations ---


    // --- Prepare Data (Keep this) ---
    const staffId = parseInt(localStorage.getItem('staff_id')) || 1;
    const storeId = 1; // Example: Hardcoded store ID
    const saleDataForBackend = { /* ... as before ... */
        staff_id: staffId,
        store_id: storeId,
        customer_id: selectedCustomerId || null,
    };
    const saleItemsForBackend = currentOrder.map(item => ({ /* ... as before ... */
        item_id: item.product.item_id,
        quantity: item.quantity,
        unit_price: parseFloat(item.product.price) || 0,
        discount: 0.0, // Placeholder
        tax: 0.0       // Placeholder
    }));
    const paymentDataForBackend = [{ /* ... as before ... */
        amount: finalTotal,
        payment_method_id: parseInt(selectedPaymentMethodId),
        transaction_reference: null
    }];
    const processSalePayload = {
        sale_data: saleDataForBackend,
        sale_items: saleItemsForBackend,
        payments_data: paymentDataForBackend
    };
    console.log("Checkout Payload Prepared for /process_sale:", JSON.stringify(processSalePayload, null, 2));
    // --- End Prepare Data ---


    // --- Process Sale ---
    showLoadingIndicators(true, "Processing Checkout..."); // Show loading overlay

    try {
        console.log("Attempting checkout via /process_sale/");
        const processedSale = await fetchData(`${BASE_URL}/process_sale/`, {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify(processSalePayload),
             loadingMsg: "Processing Checkout..." // Custom loading message for fetchData
        });

        // --- !! IMPORTANT CHECK !! ---
        // Although fetchData now throws, this check adds an extra layer of safety
        // in case fetchData's error handling changes or misses something.
        // Primarily, it ensures we don't proceed if fetchData somehow returned
        // undefined or an object without sale_id after a seemingly "successful" fetch.
        if (!processedSale || typeof processedSale.sale_id === 'undefined') {
            console.error("Checkout process failed: Invalid response received from /process_sale/ endpoint even after fetch.", processedSale);
            // Throw an error to be caught by the catch block below
            throw new Error("Received invalid or incomplete response from server after processing sale.");
        }
        // --- End Check ---

        // If the check passes, proceed with success logic
        lastOrderId = processedSale.sale_id; // Now safe to access
        console.log(`Checkout successful! Sale ID: ${lastOrderId}, Status: ${processedSale.payment_status}`);

        const printConfirmed = confirm(`Order ${lastOrderId} processed successfully! Print receipt?`);
        if (printConfirmed) {
            handlePrintReceipt();
        }
        handleClearOrder(); // Clear the form for the next sale

    } catch (error) { // Catches errors thrown by fetchData or the check above
        console.error("Checkout process failed in handleCheckout catch block:", error);
        // The alert will display the specific error message (e.g., validation details, 500 error, network error)
        // The message "Error processing order: ..." comes from the Error object's message property.
        alert(`Error processing order: ${error.message || 'Unknown error occurred.'}. Please check details or retry.`);
        lastOrderId = null; // Ensure print isn't possible for failed order
        // Do NOT clear the order automatically on failure.
    } finally {
        showLoadingIndicators(false); // Hide loading overlay regardless of outcome
        console.log("--- Checkout Process Ended ---");
    }
}

// ... (rest of checkout.js remains the same) ...