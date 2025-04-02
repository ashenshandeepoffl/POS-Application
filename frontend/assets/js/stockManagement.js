"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const API_BASE_URL = "http://127.0.0.1:8000";

    // DOM Elements
    const stockTableBody = document.getElementById("stockTableBody");
    const addStockBtn = document.getElementById("addStockBtn");
    const viewHistoryBtn = document.getElementById("viewHistoryBtn"); // Added
    const storeFilterSelect = document.getElementById("storeFilter");
    const itemFilterInput = document.getElementById("itemFilter");
    const itemFilterDatalist = document.getElementById("itemListForFilter");
    const lowStockFilterCheckbox = document.getElementById("lowStockFilter");
    const resetFiltersBtn = document.getElementById("resetFiltersBtn");
    const noStockMessage = document.getElementById("noStockMessage");
    const stockTable = document.getElementById("stockTable");

    // Stock Form Modal Elements
    const stockFormModal = document.getElementById("stockFormModal");
    const closeStockModal = document.getElementById("closeStockModal");
    const stockForm = document.getElementById("stockForm");
    const modalTitle = document.getElementById("modalTitle");
    const stockIdInput = document.getElementById("stockId");
    const storeIdSelect = document.getElementById("storeIdSelect"); // Changed to select
    const itemIdSelect = document.getElementById("itemIdSelect"); // Changed to select
    const formError = document.getElementById("formError");
    const saveStockBtn = document.getElementById("saveStockBtn");
    const cancelStockFormBtn = document.getElementById("cancelStockForm");

    // Delete Modal Elements
    const deleteConfirmModal = document.getElementById("deleteConfirmModal");
    const closeDeleteModal = document.getElementById("closeDeleteModal");
    const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
    const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
    const deleteConfirmMessage = document.getElementById("deleteConfirmMessage");
    const deleteError = document.getElementById("deleteError");

    // Toast Notification
    const toastNotification = document.getElementById("toastNotification");

    // State
    let allStockData = []; // Cache for client-side sort/filter
    let storesList = []; // Cache store data
    let itemsList = []; // Cache item data
    let stockToDeleteId = null;
    let currentSortColumn = 'stock_id';
    let currentSortDirection = 'asc';

    // --- Utility Functions ---
    async function fetchData(endpoint, options = {}) {
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
            const isJson = response.headers.get('content-type')?.includes('application/json');
            if (!response.ok) {
                let errorData = { detail: `HTTP error! Status: ${response.status}` };
                if (isJson) try { errorData = await response.json(); } catch (e) { /* ignore */ }
                console.error(`Error fetching ${endpoint}: ${response.status}`, errorData);
                throw new Error(errorData.detail || `Request failed with status ${response.status}`);
            }
            if (response.status === 204) return null;
            if (isJson) return await response.json();
            return await response.text();
        } catch (error) {
            console.error(`Network/fetch error for ${endpoint}:`, error);
            throw error;
        }
    }

    function showToast(message, type = 'info') { /* ... (same as before) ... */ }
    function showLoading(colSpan) { /* ... (same as before) ... */ }
    function showNoItemsMessage(element, message = "No records found.") { /* ... (similar to before) ... */ }
    function hideNoItemsMessage(element) { /* ... (similar to before) ... */ }
    function displayFormError(errorElement, message) { /* ... (same as before) ... */ }
    function clearFormError(errorElement) { /* ... (same as before) ... */ }
    function formatDate(dateString) { /* ... (same as before) ... */ }
    function formatDateTime(dateString) {
         if (!dateString) return "-";
        try { return new Date(dateString).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short'}); }
        catch(e) { return dateString; }
    }

    // --- Initial Data Loading ---
    async function loadInitialData() {
        showLoading(8);
        try {
            // Fetch stores, items, and stock concurrently
            const [stores, items, stock] = await Promise.all([
                fetchData("/stores/?status=active"), // Fetch only active stores for dropdowns
                fetchData("/items/"), // Fetch all items for dropdowns
                fetchData("/stock/")  // Fetch initial stock (consider filtering later)
            ]);

            storesList = stores || [];
            itemsList = items || [];
            allStockData = stock || [];

            populateStoreOptions();
            populateItemOptions();
            filterAndRenderStock(); // Initial render

        } catch (error) {
            showToast(`Error loading initial data: ${error.message}`, "error");
            showNoItemsMessage(noStockMessage, "Error loading stock data.");
        }
    }

    function populateStoreOptions() {
        const storeSelects = [storeFilterSelect, storeIdSelect]; // All store dropdowns
        storeSelects.forEach(select => {
            if (!select) return;
            // Clear existing options except the placeholder
            const firstOption = select.options[0];
            select.innerHTML = '';
            if (firstOption && firstOption.value === '') select.appendChild(firstOption); // Keep "All Stores" or "-- Select Store --"

            storesList.forEach(store => {
                const option = document.createElement('option');
                option.value = store.store_id;
                option.textContent = `${store.store_name} (ID: ${store.store_id})`;
                select.appendChild(option);
            });
        });
    }

    function populateItemOptions() {
         // Populate modal dropdown
         if (itemIdSelect) {
            itemIdSelect.innerHTML = '<option value="">-- Select Item --</option>';
            itemsList.forEach(item => {
                const option = document.createElement('option');
                option.value = item.item_id;
                option.textContent = `${item.item_name} (ID: ${item.item_id})`;
                itemIdSelect.appendChild(option);
            });
         }
         // Populate filter datalist
         if (itemFilterDatalist) {
             itemFilterDatalist.innerHTML = '';
             itemsList.forEach(item => {
                const option = document.createElement('option');
                option.value = item.item_name; // Use name for datalist value
                itemFilterDatalist.appendChild(option);
             });
         }
    }


    // --- Stock Data Filtering, Sorting, Rendering ---
    async function loadStock() { // Renamed to be clearer, fetches based on filters
        showLoading(8);
        const storeId = storeFilterSelect.value;
        const itemName = itemFilterInput.value.trim().toLowerCase();
        const showLowStock = lowStockFilterCheckbox.checked;

        // --- BACKEND FILTERING (Preferred) ---
        // Build query parameters based on filters
        const params = new URLSearchParams();
        if (storeId) params.append('store_id', storeId);
        if (showLowStock) params.append('low_stock', 'true');
        // Backend needs to handle item name filtering if desired
        // if (itemName) params.append('item_name_like', itemName); // Example

        try {
             // **Important**: Assumes backend '/stock/' endpoint is updated
             // to accept 'store_id' and 'low_stock' query parameters.
            const url = `/stock/?${params.toString()}`;
            console.log("Fetching stock from:", url); // Log URL for debugging
            const stock = await fetchData(url);
            allStockData = stock || [];

             // If backend doesn't filter by item name, do it client-side
             if (itemName && !params.has('item_name_like')) { // Check if backend handled it
                 allStockData = allStockData.filter(stockItem => {
                     const item = itemsList.find(i => i.item_id === stockItem.item_id);
                     return item && item.item_name.toLowerCase().includes(itemName);
                 });
             }

            sortAndRenderStock(allStockData);
        } catch (error) {
             showToast(`Error loading stock: ${error.message}`, "error");
             showNoItemsMessage(noStockMessage);
        }

        // --- CLIENT-SIDE FILTERING (Alternative if backend filtering is not possible/complex) ---
        /*
        try {
            // Fetch ALL stock if filtering client-side
            const stock = await fetchData("/stock/");
            allStockData = stock || [];

            let filteredData = allStockData;
            if (storeId) {
                filteredData = filteredData.filter(s => s.store_id == storeId);
            }
            if (itemName) {
                filteredData = filteredData.filter(stockItem => {
                     const item = itemsList.find(i => i.item_id === stockItem.item_id);
                     return item && item.item_name.toLowerCase().includes(itemName);
                 });
            }
            if (showLowStock) {
                filteredData = filteredData.filter(s => s.quantity < s.min_stock_level);
            }
            sortAndRenderStock(filteredData);

        } catch (error) {
             showToast(`Error loading stock: ${error.message}`, "error");
             showNoItemsMessage(noStockMessage);
        }
        */
    }

    function sortAndRenderStock(dataToSort) {
        // Find store and item names for sorting comparison
         const dataWithNames = dataToSort.map(stockItem => {
             const store = storesList.find(s => s.store_id === stockItem.store_id);
             const item = itemsList.find(i => i.item_id === stockItem.item_id);
             return {
                 ...stockItem,
                 store_name: store ? store.store_name : `ID: ${stockItem.store_id}`,
                 item_name: item ? item.item_name : `ID: ${stockItem.item_id}`
             };
         });

        const sortedData = [...dataWithNames].sort((a, b) => {
            let valA = a[currentSortColumn];
            let valB = b[currentSortColumn];

            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            if (['stock_id', 'quantity', 'min_stock_level', 'cost'].includes(currentSortColumn)) {
                valA = parseFloat(valA || 0);
                valB = parseFloat(valB || 0);
            }
            // Add date handling if sorting by date columns
            if (currentSortColumn === 'expiry_date' || currentSortColumn === 'manufacture_date' || currentSortColumn === 'last_updated') {
                valA = valA ? new Date(valA).getTime() : 0; // Convert date string to timestamp
                valB = valB ? new Date(valB).getTime() : 0;
            }

            let comparison = 0;
            if (valA > valB) comparison = 1;
            else if (valA < valB) comparison = -1;

            return currentSortDirection === 'desc' ? (comparison * -1) : comparison;
        });

        renderStockTable(sortedData); // Render uses the enriched data with names
        updateSortIcons();
    }

     function updateSortIcons() { /* ... (same as storeManagement.js) ... */ }

    function renderStockTable(stockItems) {
        if(!stockTableBody) return;
        stockTableBody.innerHTML = "";

        if (!stockItems || stockItems.length === 0) {
            showNoItemsMessage(noStockMessage);
            return;
        }
        hideNoItemsMessage(noStockMessage);

        const today = new Date();
        today.setHours(0,0,0,0); // Set time to start of day for comparison

        stockItems.forEach((stock) => {
            const isLowStock = stock.quantity < stock.min_stock_level;
            let expiryClass = '';
            let expiryDateFormatted = '-';
            if(stock.expiry_date) {
                try {
                    const expiry = new Date(stock.expiry_date);
                    expiryDateFormatted = expiry.toLocaleDateString('en-CA'); // YYYY-MM-DD format
                    if (expiry < today) {
                         expiryClass = 'expired-stock';
                    }
                } catch(e) { expiryDateFormatted = 'Invalid Date'; }
            }

            const tr = document.createElement("tr");
            tr.dataset.stockId = stock.stock_id;
            tr.innerHTML = `
                <td>#${stock.stock_id}</td>
                <td>${stock.store_name}</td> <!-- Use name from enriched data -->
                <td>${stock.item_name}</td> <!-- Use name from enriched data -->
                <td class="text-right ${isLowStock ? 'low-stock' : ''}">${stock.quantity}</td>
                <td class="text-right">${stock.min_stock_level}</td>
                <td class="text-right">Rs ${parseFloat(stock.cost || 0).toFixed(2)}</td>
                <td class="${expiryClass}">${expiryDateFormatted}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn-icon edit" title="Edit Stock">
                            <ion-icon name="create-outline"></ion-icon>
                        </button>
                         <button class="action-btn-icon history" title="View History">
                             <ion-icon name="timer-outline"></ion-icon>
                         </button>
                        <button class="action-btn-icon delete" title="Delete Stock Record">
                            <ion-icon name="trash-outline"></ion-icon>
                        </button>
                    </div>
                </td>
            `;
            stockTableBody.appendChild(tr);
        });
        attachStockActions();
    }

    // --- Event Listeners ---

    // Filters
    storeFilterSelect.addEventListener('change', loadStock);
    itemFilterInput.addEventListener('change', loadStock); // Trigger on change (after leaving input) or use 'input'
    lowStockFilterCheckbox.addEventListener('change', loadStock);
    resetFiltersBtn.addEventListener('click', () => {
        storeFilterSelect.value = '';
        itemFilterInput.value = '';
        lowStockFilterCheckbox.checked = false;
        loadStock(); // Reload with default filters
    });

    // Sorting
     stockTable.querySelectorAll('thead th[data-column]').forEach(th => {
         th.addEventListener('click', () => {
             const column = th.dataset.column;
             if (currentSortColumn === column) {
                 currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
             } else {
                 currentSortColumn = column;
                 currentSortDirection = 'asc';
             }
             sortAndRenderStock(allStockData); // Sort current client-side data
         });
     });

    // Add Stock Button
    addStockBtn.addEventListener("click", () => {
        openStockModal(); // Open in Add mode
    });

     // View History Button (Redirects to separate history page - adjust URL)
     if(viewHistoryBtn) {
         viewHistoryBtn.addEventListener("click", () => {
             window.location.href = 'stockHistory.html'; // Or the correct page name
         });
     }


    // --- Modal Handling ---
    async function openStockModal(stockId = null) {
        clearFormError(formError);
        stockForm.reset();
        stockIdInput.value = stockId || '';

        // Enable/disable fields based on mode
        storeIdSelect.disabled = !!stockId; // Disable store selection on edit
        itemIdSelect.disabled = !!stockId; // Disable item selection on edit


        if (stockId) {
            // --- EDIT MODE ---
            modalTitle.textContent = "Update Stock Record";
            try {
                 // Fetch fresh data for editing
                 const stock = await fetchData(`/stock/${stockId}`);
                 if (!stock) {
                     showToast("Could not load stock details.", "error");
                     return;
                 }
                // Pre-fill form
                // Ensure dropdowns have the value before setting
                if (storeIdSelect.querySelector(`option[value="${stock.store_id}"]`)) {
                    storeIdSelect.value = stock.store_id;
                } else { storeIdSelect.value = ""; console.warn(`Store ID ${stock.store_id} not found in dropdown.`); }

                if (itemIdSelect.querySelector(`option[value="${stock.item_id}"]`)) {
                     itemIdSelect.value = stock.item_id;
                 } else { itemIdSelect.value = ""; console.warn(`Item ID ${stock.item_id} not found in dropdown.`); }

                document.getElementById("quantity").value = stock.quantity;
                document.getElementById("minStockLevel").value = stock.min_stock_level;
                document.getElementById("cost").value = parseFloat(stock.cost || 0).toFixed(2);
                document.getElementById("location").value = stock.location || "";
                document.getElementById("measurementUnit").value = stock.measurement_unit || "";
                document.getElementById("batchNumber").value = stock.batch_number || "";
                document.getElementById("manufactureDate").value = stock.manufacture_date || "";
                document.getElementById("expiryDate").value = stock.expiry_date || "";

             } catch (error) {
                 showToast(`Error fetching stock details: ${error.message}`, "error");
                 return; // Don't open modal
             }
        } else {
            // --- ADD MODE ---
            modalTitle.textContent = "Add New Stock Record";
            // Set defaults if needed
             document.getElementById("minStockLevel").value = 5; // Default min level
        }
        stockFormModal.style.display = "block";
    }

    // Close modal logic
    closeStockModal.addEventListener("click", () => stockFormModal.style.display = "none");
    cancelStockFormBtn.addEventListener("click", () => stockFormModal.style.display = "none");
    window.addEventListener("click", (event) => {
        if (event.target == stockFormModal) stockFormModal.style.display = "none";
        if (event.target == deleteConfirmModal) deleteConfirmModal.style.display = "none";
    });

    // Handle Add/Edit form submission
    stockForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        clearFormError(formError);

        const isUpdate = !!stockIdInput.value;
        const stockId = stockIdInput.value;
        const method = isUpdate ? "PUT" : "POST";
        const url = isUpdate ? `/stock/${stockId}` : "/stock/";

        saveStockBtn.disabled = true;
        saveStockBtn.textContent = isUpdate ? "Saving..." : "Adding...";

        const formData = new FormData(stockForm);
        const payload = {
            // For ADD, read directly from selects
            // For UPDATE, read from selects BUT backend ignores them anyway based on our previous change
            store_id: parseInt(formData.get('store_id'), 10),
            item_id: parseInt(formData.get('item_id'), 10),
            quantity: parseInt(formData.get('quantity'), 10),
            cost: parseFloat(formData.get('cost')),
            min_stock_level: parseInt(formData.get('min_stock_level'), 10),
            location: formData.get('location') || null,
            measurement_unit: formData.get('measurement_unit') || null,
            batch_number: formData.get('batch_number') || null,
            manufacture_date: formData.get('manufacture_date') || null,
            expiry_date: formData.get('expiry_date') || null,
        };

        // Validation
        if (!payload.store_id || !payload.item_id || isNaN(payload.quantity) || payload.quantity < 0 || isNaN(payload.cost) || payload.cost < 0 || isNaN(payload.min_stock_level) || payload.min_stock_level < 0) {
            displayFormError(formError, "Store, Item, valid Quantity, Cost, and Min Stock Level are required.");
            saveStockBtn.disabled = false;
            saveStockBtn.textContent = isUpdate ? "Save Stock" : "Add Stock";
            return;
        }
        // Prevent adding duplicate stock record (backend should handle this too)
        if (!isUpdate) {
            const exists = allStockData.some(s => s.store_id === payload.store_id && s.item_id === payload.item_id);
            if (exists) {
                 displayFormError(formError, "Stock record for this Item in this Store already exists. Use Edit to update quantity.");
                 saveStockBtn.disabled = false;
                 saveStockBtn.textContent = "Add Stock";
                 return;
            }
        }

        try {
            const result = await fetchData(url, {
                method: method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
             if (result || method === 'PUT') { // Allow successful PUT (200/204)
                stockFormModal.style.display = "none";
                showToast(`Stock ${isUpdate ? 'updated' : 'added'} successfully!`, 'success');
                loadStock(); // Reload data based on current filters
            }
        } catch (error) {
            displayFormError(formError, `Error: ${error.message}`);
        } finally {
            saveStockBtn.disabled = false;
            saveStockBtn.textContent = isUpdate ? "Save Stock" : "Add Stock";
        }
    });

    // --- Delete Handling ---
    function attachStockActions() {
        stockTableBody.querySelectorAll('.action-btn-icon.edit').forEach(btn => {
            const row = btn.closest('tr');
            const stockId = row.dataset.stockId;
            btn.addEventListener('click', () => openStockModal(stockId));
        });

        stockTableBody.querySelectorAll('.action-btn-icon.delete').forEach(btn => {
            const row = btn.closest('tr');
            const stockId = row.dataset.stockId;
            const storeName = row.cells[1].textContent;
            const itemName = row.cells[2].textContent;
            btn.addEventListener('click', () => promptForDelete(stockId, storeName, itemName));
        });

         stockTableBody.querySelectorAll('.action-btn-icon.history').forEach(btn => {
            const row = btn.closest('tr');
            const stockId = row.dataset.stockId;
             // Redirect to history page, passing stock_id or item_id/store_id
             btn.addEventListener('click', () => {
                 // Find item_id and store_id from the stock record if needed
                 const stockItem = allStockData.find(s => s.stock_id == stockId);
                 if (stockItem) {
                     // Example: Redirect passing item_id
                     window.location.href = `stockHistory.html?item_id=${stockItem.item_id}&store_id=${stockItem.store_id}`;
                     // Or just pass stock_id:
                     // window.location.href = `stockHistory.html?stock_id=${stockId}`;
                 }
             });
        });
    }

    function promptForDelete(id, storeName, itemName) {
        stockToDeleteId = id;
        deleteConfirmMessage.textContent = `Are you sure you want to delete the stock record (ID: ${id}) for "${itemName}" at "${storeName}"? This only deletes the record; adjust quantity manually if needed.`;
        clearFormError(deleteError);
        deleteConfirmModal.style.display = "block";
    }

    closeDeleteModal.addEventListener('click', () => deleteConfirmModal.style.display = "none");
    cancelDeleteBtn.addEventListener('click', () => deleteConfirmModal.style.display = "none");

    confirmDeleteBtn.addEventListener('click', async () => {
        if (!stockToDeleteId) return;

        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.textContent = 'Deleting...';
        clearFormError(deleteError);

        try {
            await fetchData(`/stock/${stockToDeleteId}`, { method: "DELETE" });
            deleteConfirmModal.style.display = "none";
            showToast('Stock record deleted successfully!', 'success');
            stockToDeleteId = null;
            loadStock(); // Reload data
        } catch (error) {
             displayFormError(deleteError, `Error: ${error.message}`);
        } finally {
             confirmDeleteBtn.disabled = false;
             confirmDeleteBtn.textContent = 'Delete Stock Record';
        }
    });

    // --- Initial Load ---
    loadInitialData();

}); // End DOMContentLoaded