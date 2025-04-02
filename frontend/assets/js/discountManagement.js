"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const API_BASE_URL = "http://127.0.0.1:8000";

    // DOM Elements (Ensure all these IDs exist in your HTML)
    const discountsTableBody = document.getElementById("discountsTableBody");
    const addDiscountBtn = document.getElementById("addDiscountBtn");
    const statusFilterSelect = document.getElementById("statusFilter");
    const resetFiltersBtn = document.getElementById("resetFiltersBtn");
    const noDiscountsMessage = document.getElementById("noDiscountsMessage");
    const discountsTable = document.getElementById("discountsTable");
    const discountFormModal = document.getElementById("discountFormModal");
    const closeDiscountModal = document.getElementById("closeDiscountModal");
    const discountForm = document.getElementById("discountForm"); // Check this ID matches modal form
    const modalTitle = document.getElementById("modalTitle");
    const discountIdInput = document.getElementById("discountId");
    const discountTypeSelect = document.getElementById("discountType");
    const discountValueUnit = document.getElementById("discountValueUnit");
    const startDateInput = document.getElementById("startDate");
    const endDateInput = document.getElementById("endDate");
    const formError = document.getElementById("formError");
    const saveDiscountBtn = document.getElementById("saveDiscountBtn");
    const cancelDiscountFormBtn = document.getElementById("cancelDiscountForm");
    const deleteConfirmModal = document.getElementById("deleteConfirmModal");
    const closeDeleteModal = document.getElementById("closeDeleteModal");
    const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
    const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
    const deleteConfirmMessage = document.getElementById("deleteConfirmMessage");
    const deleteError = document.getElementById("deleteError");
    const toastNotification = document.getElementById("toastNotification");

    // State
    let allDiscountsData = [];
    let discountToDeleteId = null;
    let currentFilterStatus = 'active';
    let currentSortColumn = 'discount_id';
    let currentSortDirection = 'asc';

    // --- Utility Functions ---
    async function fetchData(endpoint, options = {}) {
        console.log(`Fetching: ${endpoint}`, options); // LOG JS 1: Log fetch attempt
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
            const responseText = await response.text(); // Get response body as text first
            console.log(`Response Status for ${endpoint}: ${response.status}`); // LOG JS 2: Log status

            if (!response.ok) {
                let errorDetail = `Request failed with status ${response.status}`;
                try {
                    const errorJson = JSON.parse(responseText); // Try parsing error
                    errorDetail = errorJson.detail || JSON.stringify(errorJson);
                } catch (e) {
                    errorDetail += ` - Response: ${responseText.substring(0, 100)}...`; // Show snippet if not JSON
                }
                console.error(`Error fetching ${endpoint}: ${errorDetail}`);
                throw new Error(errorDetail);
            }

            if (response.status === 204) { // Handle No Content
                console.log(`Response for ${endpoint}: 204 No Content`); // LOG JS 3: Log 204
                return null;
            }

            try {
                const jsonData = JSON.parse(responseText); // Now parse JSON if status was OK
                console.log(`Data received for ${endpoint}:`, jsonData); // LOG JS 4: Log successful data
                return jsonData;
            } catch (e) {
                console.error(`Error parsing JSON for ${endpoint}:`, e, `Response Text: ${responseText}`);
                throw new Error("Received invalid data format from server.");
            }
        } catch (error) {
            console.error(`Network/fetch error for ${endpoint}:`, error);
            throw error; // Re-throw
        }
    }

    function showToast(message, type = 'info') { /* ... (keep existing) ... */ }
    function showLoading(colSpan) { /* ... (keep existing) ... */ }
    function showNoItemsMessage(element, message = "No records found.") { /* ... (keep existing) ... */ }
    function hideNoItemsMessage(element) { /* ... (keep existing) ... */ }
    function displayFormError(errorElement, message) { /* ... (keep existing) ... */ }
    function clearFormError(errorElement) { /* ... (keep existing) ... */ }
    function formatDateForInput(dateString) { /* ... (keep existing) ... */ }

    // --- Discount Data Handling ---
    async function loadDiscounts(status = currentFilterStatus) { // Use current state if no arg passed
        console.log(`loadDiscounts called with status: '${status}'`); // LOG JS 5: Check status used
        showLoading(8);
        currentFilterStatus = status; // Update state
        try {
            const url = status ? `/discounts/?status=${status}` : "/discounts/";
            const discounts = await fetchData(url);

            if (discounts === null && url === "/discounts/") {
                // If fetching ALL returns null, it might be an issue, but could be intended if DB empty
                console.warn("Fetched all discounts and received null/empty response.");
                 allDiscountsData = [];
            } else if (Array.isArray(discounts)) {
                allDiscountsData = discounts;
            } else {
                console.error("Invalid data received, expected an array:", discounts);
                 allDiscountsData = []; // Default to empty on invalid data
                 showToast("Received invalid data from server.", "error");
            }
            sortAndRenderDiscounts(allDiscountsData);
        } catch (error) {
            showToast(`Error loading discounts: ${error.message}`, "error");
            showNoItemsMessage(noDiscountsMessage);
            allDiscountsData = []; // Ensure cache is cleared on error
            renderDiscountsTable([]); // Render empty table on error
        }
    }

    // --- Sorting ---
    function sortAndRenderDiscounts(dataToSort) {
        console.log(`Sorting ${dataToSort?.length || 0} items by ${currentSortColumn} ${currentSortDirection}`); // LOG JS 6: Check sorting input
        if (!Array.isArray(dataToSort)) {
            console.error("Cannot sort non-array data:", dataToSort);
            renderDiscountsTable([]); // Render empty if data is bad
            return;
        }
        const sortedData = [...dataToSort].sort((a, b) => { /* ... (keep existing sort logic) ... */ });
        renderDiscountsTable(sortedData);
        updateSortIcons();
    }

    function updateSortIcons() { /* ... (keep existing) ... */ }


    // --- Rendering ---
    function renderDiscountsTable(discounts) {
        console.log("Rendering table with discounts:", discounts); // LOG JS 7: Check data before render
        if(!discountsTableBody) {
            console.error("Table body #discountsTableBody not found!");
            return;
        }
        discountsTableBody.innerHTML = ""; // Clear previous

        if (!discounts || discounts.length === 0) {
            console.log("No discounts to render."); // LOG JS 8: Confirm no data case
            showNoItemsMessage(noDiscountsMessage);
            return;
        }
        hideNoItemsMessage(noDiscountsMessage);

        discounts.forEach((discount, index) => {
             // LOG JS 9: Log each item being rendered
             // console.log(`Rendering row ${index}:`, discount);
            try { // Add try-catch around rendering complex rows
                const statusClass = `status-${discount.status || 'unknown'}`;
                const valueFormatted = discount.discount_type === 'percentage'
                    ? `${parseFloat(discount.discount_value ?? 0).toFixed(1)} %`
                    : `Rs ${parseFloat(discount.discount_value ?? 0).toFixed(2)}`;
                const startDateFormatted = formatDateForInput(discount.start_date) || '-';
                const endDateFormatted = formatDateForInput(discount.end_date) || '-';

                const tr = document.createElement("tr");
                tr.dataset.discountId = discount.discount_id;
                tr.innerHTML = `
                    <td>#${discount.discount_id}</td>
                    <td>${discount.discount_name || 'N/A'}</td>
                    <td>${(discount.discount_type || '').replace('_', ' ')}</td>
                    <td class="text-right">${valueFormatted}</td>
                    <td>${startDateFormatted}</td>
                    <td>${endDateFormatted}</td>
                    <td><span class="status-badge ${statusClass}">${discount.status || 'unknown'}</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn-icon edit" title="Edit Discount">
                                <ion-icon name="create-outline"></ion-icon>
                            </button>
                            <button class="action-btn-icon delete" title="Delete Discount">
                                <ion-icon name="trash-outline"></ion-icon>
                            </button>
                        </div>
                    </td>
                `;
                discountsTableBody.appendChild(tr);
            } catch (renderError) {
                console.error(`Error rendering discount row ${index}:`, discount, renderError);
                // Maybe append an error row?
                const tr = document.createElement("tr");
                tr.innerHTML = `<td colspan="8" class="error-text">Error rendering this row</td>`;
                discountsTableBody.appendChild(tr);
            }
        });
        attachDiscountActions();
    }


     // --- Event Listeners ---

     // Filters
     statusFilterSelect.addEventListener('change', (e) => {
        // Get value, which might be "" for "All"
        const selectedStatus = e.target.value;
        loadDiscounts(selectedStatus); // Pass selected value directly
     });
     resetFiltersBtn.addEventListener('click', () => {
         statusFilterSelect.value = 'active'; // Reset dropdown to default 'active'
         loadDiscounts('active'); // Load active discounts
     });

    // Sorting
     discountsTable.querySelectorAll('thead th[data-column]').forEach(th => {
         th.addEventListener('click', () => {
             // ... (keep existing sorting logic) ...
             sortAndRenderDiscounts(allDiscountsData);
         });
     });

    // Add Discount Button
    addDiscountBtn.addEventListener("click", () => {
        openDiscountModal(); // Open in Add mode
    });

    // --- Modal Handling ---
    async function openDiscountModal(discountId = null) {
        console.log(`Opening modal for discount ID: ${discountId || 'NEW'}`); // LOG JS 10: Log modal open
        clearFormError(formError);
        discountForm.reset();
        discountIdInput.value = discountId || '';
        updateValueUnit();

        if (discountId) {
            modalTitle.textContent = "Edit Discount";
            try {
                 const discount = await fetchData(`/discounts/${discountId}`);
                 if (!discount) {
                     showToast("Could not load discount details.", "error");
                     return;
                 }
                console.log("Populating modal with data:", discount); // LOG JS 11: Log data for edit
                // Pre-fill form
                document.getElementById("discountName").value = discount.discount_name || '';
                discountTypeSelect.value = discount.discount_type || 'fixed_amount';
                document.getElementById("discountValue").value = discount.discount_value ?? '';
                startDateInput.value = formatDateForInput(discount.start_date);
                endDateInput.value = formatDateForInput(discount.end_date);
                document.getElementById("status").value = discount.status || 'active';
                updateValueUnit(); // Update unit based on loaded type

             } catch (error) {
                 showToast(`Error fetching discount details: ${error.message}`, "error");
                 return;
             }
        } else {
            modalTitle.textContent = "Add New Discount";
            document.getElementById("status").value = 'active';
        }
        discountFormModal.style.display = "block";
    }

    // Update unit hint when type changes
    discountTypeSelect.addEventListener('change', updateValueUnit);
    function updateValueUnit() {
        discountValueUnit.textContent = discountTypeSelect.value === 'percentage' ? '(%)' : '(Rs)';
    }

    // Close modal logic
    closeDiscountModal.addEventListener("click", () => discountFormModal.style.display = "none");
    cancelDiscountFormBtn.addEventListener("click", () => discountFormModal.style.display = "none");
    window.addEventListener("click", (event) => { /* ... (keep existing) ... */ });

    // Handle Add/Edit form submission
    discountForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        clearFormError(formError);
        // ... (keep existing validation logic) ...
        const isUpdate = !!discountIdInput.value;
        const discountId = discountIdInput.value;
        const method = isUpdate ? "PUT" : "POST";
        const url = isUpdate ? `/discounts/${discountId}` : "/discounts/";
        // ... (get payload) ...
        console.log(`Submitting ${method} to ${url} with payload:`, payload); // LOG JS 12: Log submit data

        // Validation
        let errors = [];
        if (!payload.discount_name) errors.push("Discount Name is required.");
        if (payload.discount_value === null || isNaN(payload.discount_value) || payload.discount_value < 0) errors.push("Valid Discount Value is required.");
        if (payload.discount_type === 'percentage' && payload.discount_value > 100) errors.push("Percentage value cannot exceed 100.");
        if (!payload.start_date) errors.push("Start Date is required.");
        if (!payload.end_date) errors.push("End Date is required.");
        if (payload.start_date && payload.end_date && payload.start_date > payload.end_date) {
            errors.push("End Date cannot be before Start Date.");
        }
        if (errors.length > 0) { /* ... (keep error display) ... */ return; }


        try {
             // ... (keep existing fetch call) ...
             const result = await fetchData(url, { /* ... options ... */ });
             console.log("Save response:", result); // LOG JS 13: Log save response
             // ... (handle success) ...
             loadDiscounts(currentFilterStatus); // Reload data using the *current* filter status
        } catch (error) {
             // ... (handle error) ...
        } finally {
             // ... (re-enable button) ...
        }
    });

    // --- Delete Handling ---
    function attachDiscountActions() {
         discountsTableBody.querySelectorAll('.action-btn-icon.edit').forEach(btn => { /* ... keep existing ... */ });
         discountsTableBody.querySelectorAll('.action-btn-icon.delete').forEach(btn => { /* ... keep existing ... */ });
     }
     function promptForDelete(id, name) { /* ... keep existing ... */ }
     closeDeleteModal.addEventListener('click', () => deleteConfirmModal.style.display = "none");
     cancelDeleteBtn.addEventListener('click', () => deleteConfirmModal.style.display = "none");
     confirmDeleteBtn.addEventListener('click', async () => { /* ... keep existing ... */ });

    // --- Initial Load ---
    console.log("Initializing Discount Management page..."); // LOG JS 0: Initial log
    loadDiscounts(currentFilterStatus); // Load active discounts initially

}); // End DOMContentLoaded