"use strict";

document.addEventListener("DOMContentLoaded", () => {
    console.log("Tax Management DOM Loaded. Initializing..."); // LOG 0
    const API_BASE_URL = "http://127.0.0.1:8000";

    // DOM Elements (Double-check these IDs exactly match your HTML)
    const taxesTableBody = document.getElementById("taxesTableBody");
    const addTaxBtn = document.getElementById("addTaxBtn");
    const statusFilterSelect = document.getElementById("statusFilter");
    const resetFiltersBtn = document.getElementById("resetFiltersBtn");
    const noTaxesMessage = document.getElementById("noTaxesMessage");
    const taxesTable = document.getElementById("taxesTable");

    const taxFormModal = document.getElementById("taxFormModal");
    const closeTaxModal = document.getElementById("closeTaxModal");
    const taxForm = document.getElementById("taxForm");
    const modalTitle = document.getElementById("modalTitle");
    const taxIdInput = document.getElementById("taxId");
    const taxNameInput = document.getElementById("taxName");
    const taxPercentageInput = document.getElementById("taxPercentage");
    const statusSelect = document.getElementById("status");
    const formError = document.getElementById("formError");
    const saveTaxBtn = document.getElementById("saveTaxBtn");
    const cancelTaxFormBtn = document.getElementById("cancelTaxForm");

    const deleteConfirmModal = document.getElementById("deleteConfirmModal");
    const closeDeleteModal = document.getElementById("closeDeleteModal");
    const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
    const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
    const deleteConfirmMessage = document.getElementById("deleteConfirmMessage");
    const deleteError = document.getElementById("deleteError");

    const toastNotification = document.getElementById("toastNotification");

    // State
    let allTaxesData = [];
    let taxToDeleteId = null;
    let currentFilterStatus = 'active';
    let currentSortColumn = 'tax_id';
    let currentSortDirection = 'asc';

    // --- Check if essential elements exist ---
    if (!taxesTableBody || !addTaxBtn || !statusFilterSelect || !taxFormModal || !taxForm || !deleteConfirmModal) {
        console.error("CRITICAL: One or more essential DOM elements not found. Aborting script execution.");
        alert("Error initializing page elements. Please check the console (F12).");
        return; // Stop script if core elements are missing
    }

    // --- Utility Functions ---
    async function fetchData(endpoint, options = {}) {
        console.log(`[Fetch Start] Endpoint: ${endpoint}`, "Options:", options); // LOG JS 1
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
            const responseText = await response.text(); // Read text FIRST
            console.log(`[Fetch Status] Endpoint: ${endpoint}, Status: ${response.status}`); // LOG JS 2

            if (!response.ok) {
                let errorDetail = `Request failed (${response.status})`;
                try {
                    const errorJson = JSON.parse(responseText);
                    errorDetail = errorJson.detail || JSON.stringify(errorJson);
                } catch (e) { errorDetail += `: ${responseText.substring(0, 150)}...`; }
                console.error(`[Fetch Error] ${endpoint}: ${errorDetail}`);
                throw new Error(errorDetail);
            }

            if (response.status === 204) {
                console.log(`[Fetch Success] ${endpoint}: 204 No Content`); // LOG JS 3
                return null;
            }

            try {
                const jsonData = JSON.parse(responseText); // Parse only if OK and not 204
                console.log(`[Fetch Success] Data for ${endpoint}:`, jsonData); // LOG JS 4
                return jsonData;
            } catch (e) {
                console.error(`[Fetch Error] JSON Parse Failed for ${endpoint}:`, e, `Response Text: ${responseText}`);
                throw new Error("Received invalid data format from server.");
            }
        } catch (error) {
            console.error(`[Fetch Network Error] ${endpoint}:`, error);
            throw error;
        }
    }

    function showToast(message, type = 'info') {
         if (!toastNotification) return;
         toastNotification.textContent = message;
         toastNotification.className = `toast show ${type}`;
         setTimeout(() => { toastNotification.className = 'toast'; }, 3500); // Slightly longer duration
     }
     function showLoading(colSpan) {
         if (taxesTableBody) taxesTableBody.innerHTML = `<tr><td colspan="${colSpan}" class="loading-text">Loading... Please wait.</td></tr>`;
         hideNoItemsMessage(noTaxesMessage);
     }
     function showNoItemsMessage(element, message = "No records found.") {
        if (element) { element.textContent = message; element.style.display = 'block'; }
        if (taxesTableBody) taxesTableBody.innerHTML = ''; // Clear table too
     }
     function hideNoItemsMessage(element) { if (element) element.style.display = 'none'; }
     function displayFormError(errorElement, message) { if (errorElement) { errorElement.textContent = message; errorElement.style.display = 'block'; }}
     function clearFormError(errorElement) { if (errorElement) { errorElement.textContent = ''; errorElement.style.display = 'none'; }}

    // --- Tax Data Handling ---
    async function loadTaxes(status = currentFilterStatus) {
        console.log(`[LoadTaxes] Called with status: '${status || "All"}'`); // LOG JS 5
        showLoading(5); // Update colspan if table columns change
        currentFilterStatus = status; // Update state
        try {
            // Ensure backend endpoint for taxes accepts status filter correctly
            const url = status ? `/taxes/?status=${status}` : "/taxes/";
            const taxes = await fetchData(url);

            if (Array.isArray(taxes)) {
                allTaxesData = taxes;
                console.log(`[LoadTaxes] Successfully loaded ${taxes.length} taxes.`); // LOG JS 5b
            } else {
                console.warn("[LoadTaxes] Received non-array data, setting to empty array:", taxes);
                allTaxesData = [];
                // Only show error if data wasn't explicitly null (which could be valid for empty results)
                if (taxes !== null) {
                    showToast("Received unexpected data format for taxes.", "error");
                }
            }
            // Always attempt to render, even if empty, to show "No items" message
            sortAndRenderTaxes(allTaxesData);

        } catch (error) {
            console.error("[LoadTaxes] Error:", error); // Log the specific error
            showToast(`Error loading taxes: ${error.message || 'Unknown error'}`, "error");
            showNoItemsMessage(noTaxesMessage, "Failed to load taxes. Check connection or server status.");
            allTaxesData = []; // Clear cache on error
            renderTaxesTable([]); // Clear table
        }
    }

    // --- Sorting ---
    function sortAndRenderTaxes(dataToSort) {
         console.log(`[SortAndRender] Sorting ${dataToSort?.length ?? 0} items by ${currentSortColumn} ${currentSortDirection}`); // LOG JS 6
        if (!Array.isArray(dataToSort)) {
            console.error("[SortAndRender] Cannot sort non-array data:", dataToSort);
            renderTaxesTable([]); return;
        }
        const sortedData = [...dataToSort].sort((a, b) => {
            let valA = a[currentSortColumn]; let valB = b[currentSortColumn];
            if (currentSortColumn === 'tax_percentage') { valA = parseFloat(valA || 0); valB = parseFloat(valB || 0); }
            else if (currentSortColumn === 'tax_id') { valA = parseInt(valA || 0); valB = parseInt(valB || 0); }
            else if (typeof valA === 'string') { valA = valA?.toLowerCase() || ''; valB = valB?.toLowerCase() || ''; }
            let comparison = (valA > valB) ? 1 : (valA < valB) ? -1 : 0;
            return currentSortDirection === 'desc' ? (comparison * -1) : comparison;
        });
        renderTaxesTable(sortedData);
        updateSortIcons();
    }

    function updateSortIcons() {
         if (!taxesTable) return;
         taxesTable.querySelectorAll('thead th[data-column]').forEach(th => {
             th.classList.remove('sort-asc', 'sort-desc');
             const icon = th.querySelector('.sort-icon');
             if (icon) icon.innerHTML = '';
             if (th.dataset.column === currentSortColumn && currentSortDirection !== 'none') {
                 th.classList.add(currentSortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
                 if (icon) icon.innerHTML = currentSortDirection === 'asc' ? '▲' : '▼';
             }
         });
     }

    // --- Rendering ---
    function renderTaxesTable(taxes) {
        console.log("[Render] Rendering table..."); // LOG JS 7
        if (!taxesTableBody) { console.error("Table body not found for rendering."); return; }
        taxesTableBody.innerHTML = "";

        if (!taxes || taxes.length === 0) {
            console.log("[Render] No taxes to display."); // LOG JS 8
            showNoItemsMessage(noTaxesMessage); return;
        }
        hideNoItemsMessage(noTaxesMessage);

        taxes.forEach((tax, index) => {
            // console.log(`[Render] Row ${index}:`, tax); // LOG JS 9 (Optional - can be noisy)
            try {
                const statusClass = `status-${tax.status || 'unknown'}`;
                const percentageFormatted = `${parseFloat(tax.tax_percentage ?? 0).toFixed(2)} %`;
                const tr = document.createElement("tr");
                tr.dataset.taxId = tax.tax_id;
                tr.innerHTML = `
                    <td>#${tax.tax_id}</td>
                    <td>${tax.tax_name || 'N/A'}</td>
                    <td class="text-right">${percentageFormatted}</td>
                    <td><span class="status-badge ${statusClass}">${tax.status || 'unknown'}</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn-icon edit" title="Edit Tax" data-action="edit">
                                <ion-icon name="create-outline"></ion-icon>
                            </button>
                            <button class="action-btn-icon delete" title="Delete Tax" data-action="delete">
                                <ion-icon name="trash-outline"></ion-icon>
                            </button>
                        </div>
                    </td>
                `;
                taxesTableBody.appendChild(tr);
            } catch (renderError) { /* ... (keep error handling) ... */ }
        });
        // Event listeners are now handled by delegation, no need to re-attach here
    }

     // --- Event Listeners ---
     statusFilterSelect.addEventListener('change', (e) => { loadTaxes(e.target.value); });
     resetFiltersBtn.addEventListener('click', () => { statusFilterSelect.value = 'active'; loadTaxes('active'); });
     addTaxBtn.addEventListener("click", () => { openTaxModal(); }); // Add new

     // Sorting Listener
     if (taxesTable) {
         taxesTable.querySelector('thead')?.addEventListener('click', (event) => {
             const header = event.target.closest('th[data-column]');
             if (!header) return;
             const column = header.dataset.column;
             if (currentSortColumn === column) {
                 currentSortDirection = currentSortDirection === 'asc' ? 'desc' : (currentSortDirection === 'desc' ? 'none' : 'asc');
             } else {
                 currentSortColumn = column;
                 currentSortDirection = 'asc';
             }
             if (currentSortDirection === 'none') currentSortColumn = null; // Reset column if direction is none
             sortAndRenderTaxes(allTaxesData);
         });
     }

    // --- Modal Handling ---
    async function openTaxModal(taxId = null) {
        console.log(`[OpenModal] For ID: ${taxId || 'NEW'}`); // LOG JS 10
        clearFormError(formError);
        taxForm.reset();
        taxIdInput.value = taxId || '';

        if (taxId) {
            modalTitle.textContent = "Edit Tax";
            try {
                 const tax = await fetchData(`/taxes/${taxId}`);
                 if (!tax) { showToast("Could not load tax details.", "error"); return; }
                 console.log("[OpenModal] Populating edit form:", tax); // LOG JS 11
                 taxNameInput.value = tax.tax_name || '';
                 taxPercentageInput.value = tax.tax_percentage ?? '';
                 statusSelect.value = tax.status || 'active';
             } catch (error) { showToast(`Error fetching tax: ${error.message}`, "error"); return; }
        } else {
            modalTitle.textContent = "Add New Tax";
            statusSelect.value = 'active'; // Default
        }
        taxFormModal.style.display = "block";
    }

    // Close modal logic
    closeTaxModal.addEventListener("click", () => taxFormModal.style.display = "none");
    cancelTaxFormBtn.addEventListener("click", () => taxFormModal.style.display = "none");
    window.addEventListener("click", (event) => { /* ... (keep existing window click logic) ... */ });

    // Handle Add/Edit form submission
    taxForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        console.log("[Submit] Form submitted."); // LOG JS 12
        clearFormError(formError);

        const isUpdate = !!taxIdInput.value;
        const taxId = taxIdInput.value;
        const method = isUpdate ? "PUT" : "POST";
        const url = isUpdate ? `/taxes/${taxId}` : "/taxes/";

        saveTaxBtn.disabled = true;
        saveTaxBtn.textContent = isUpdate ? "Saving..." : "Creating...";

        const payload = {
            tax_name: taxNameInput.value.trim(),
            tax_percentage: parseFloat(taxPercentageInput.value),
            status: statusSelect.value
        };
        console.log(`[Submit] Payload for ${method} ${url}:`, payload); // LOG JS 13

        // Validation
        let errors = [];
        if (!payload.tax_name) errors.push("Tax Name is required.");
        if (isNaN(payload.tax_percentage) || payload.tax_percentage < 0 || payload.tax_percentage > 100) { errors.push("Percentage must be between 0 and 100."); }
        if (errors.length > 0) {
            displayFormError(formError, errors.join(' '));
            saveTaxBtn.disabled = false;
            saveTaxBtn.textContent = isUpdate ? "Save Tax" : "Create Tax";
            return;
        }

        try {
            const result = await fetchData(url, { method: method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            console.log("[Submit] Save response:", result); // LOG JS 14
            taxFormModal.style.display = "none";
            showToast(`Tax ${isUpdate ? 'updated' : 'created'} successfully!`, 'success');
            loadTaxes(currentFilterStatus); // Reload current view
        } catch (error) {
            displayFormError(formError, `Error: ${error.message}`);
        } finally {
            saveTaxBtn.disabled = false;
            saveTaxBtn.textContent = isUpdate ? "Save Tax" : "Create Tax";
        }
    });


    // --- Delete Handling (Event Delegation) ---
    taxesTableBody.addEventListener('click', (event) => {
        const target = event.target;
        const actionButton = target.closest('.action-btn-icon[data-action]'); // Find button with data-action
        if (!actionButton) return;

        const row = actionButton.closest('tr');
        const taxId = row?.dataset.taxId; // Use optional chaining
        const action = actionButton.dataset.action;

        if (!taxId) {
            console.error("Could not find tax ID for action.");
            return;
        }

        console.log(`[Action Click] Action: ${action}, ID: ${taxId}`); // LOG JS 15

        if (action === 'edit') {
            openTaxModal(taxId);
        } else if (action === 'delete') {
            const taxName = row.cells[1]?.textContent || `ID ${taxId}`; // Get name or use ID
            promptForDelete(taxId, taxName);
        }
    });

    function promptForDelete(id, name) { /* ... keep existing ... */ }
    closeDeleteModal.addEventListener('click', () => deleteConfirmModal.style.display = "none");
    cancelDeleteBtn.addEventListener('click', () => deleteConfirmModal.style.display = "none");
    confirmDeleteBtn.addEventListener('click', async () => {
        if (!taxToDeleteId) return;
        console.log(`[Delete] Confirming delete for ID: ${taxToDeleteId}`); // LOG JS 16
        // ... (rest of delete logic - keep existing fetch, toast, reload/update cache) ...
         try {
             await fetchData(`/taxes/${taxToDeleteId}`, { method: "DELETE" });
             deleteConfirmModal.style.display = "none";
             showToast('Tax deleted successfully!', 'success');
             const deletedId = taxToDeleteId;
             taxToDeleteId = null;
             allTaxesData = allTaxesData.filter(t => t.tax_id != deletedId);
             sortAndRenderTaxes(allTaxesData);
         } catch (error) {
              displayFormError(deleteError, `Error: ${error.message}`);
         } finally {
              confirmDeleteBtn.disabled = false;
              confirmDeleteBtn.textContent = 'Delete Tax';
         }
    });

    // --- Initial Load ---
    loadTaxes(currentFilterStatus);

}); // End DOMContentLoaded