"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const API_BASE_URL = "http://127.0.0.1:8000";

    // DOM Elements
    const salesTableBody = document.getElementById("salesTableBody");
    const goToPOSBtn = document.getElementById("goToPOSBtn"); // Renamed button
    const exportSalesBtn = document.getElementById("exportSalesBtn");
    const noSalesMessage = document.getElementById("noSalesMessage");
    const salesTable = document.getElementById("salesTable");

    // Filters
    const startDateFilter = document.getElementById("startDateFilter");
    const endDateFilter = document.getElementById("endDateFilter");
    const storeFilterSelect = document.getElementById("storeFilter");
    const staffFilterSelect = document.getElementById("staffFilter");
    const paymentStatusFilter = document.getElementById("paymentStatusFilter");
    const applyFiltersBtn = document.getElementById("applyFiltersBtn");
    const resetFiltersBtn = document.getElementById("resetFiltersBtn");

    // Details Modal Elements
    const saleDetailsModal = document.getElementById("saleDetailsModal");
    const closeDetailsModal = document.getElementById("closeDetailsModal");
    const closeDetailsModalBottom = document.getElementById("closeDetailsModalBottom");
    const detailsModalTitle = document.getElementById("detailsModalTitle");
    const saleDetailsBody = document.getElementById("saleDetailsBody");
    const printReceiptBtn = document.getElementById("printReceiptBtn");
    // const cancelSaleBtn = document.getElementById("cancelSaleBtn"); // If implementing cancellation

    // Pagination Elements
    const paginationControls = document.getElementById("paginationControls");
    const prevPageBtn = document.getElementById("prevPageBtn");
    const nextPageBtn = document.getElementById("nextPageBtn");
    const pageInfo = document.getElementById("pageInfo");
    const limitSelect = document.getElementById("limitSelect");

    // Toast Notification
    const toastNotification = document.getElementById("toastNotification");

    // State
    let allSalesData = []; // Complete data from last fetch (for client-side sort)
    let staffList = []; // Cache for names
    let storeList = []; // Cache for names
    let currentPage = 1;
    let limit = 15;
    let totalSalesCount = 0; // Need count from backend for pagination
    let currentSortColumn = 'created_at'; // Default sort by date
    let currentSortDirection = 'desc';

    // --- Utility Functions (Keep from previous examples) ---
    async function fetchData(endpoint, options = {}, returnCount = false) {
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
            const isJson = response.headers.get('content-type')?.includes('application/json');

            // Get count from headers if present (X-Total-Count)
            const countHeader = response.headers.get('X-Total-Count');
            const count = countHeader ? parseInt(countHeader, 10) : 0;

            if (!response.ok) {
                let errorData = { detail: `HTTP error! Status: ${response.status}` };
                if (isJson) try { errorData = await response.json(); } catch (e) { /* ignore */ }
                console.error(`Error fetching ${endpoint}: ${response.status}`, errorData);
                throw new Error(errorData.detail || `Request failed with status ${response.status}`);
            }
            if (response.status === 204) return returnCount ? { data: null, count } : null;
            const data = isJson ? await response.json() : await response.text();
            return returnCount ? { data, count } : data;
        } catch (error) {
            console.error(`Network/fetch error for ${endpoint}:`, error);
            throw error;
        }
    }
    function showToast(message, type = 'info') { /* ... */ }
    function showLoading(colSpan) { /* ... */ }
    function showNoItemsMessage(element, message = "No records found.") { /* ... */ }
    function hideNoItemsMessage(element) { /* ... */ }
    function displayFormError(errorElement, message) { /* ... */ }
    function clearFormError(errorElement) { /* ... */ }
    function formatDateTime(dateString) { /* ... */ }
    function formatCurrency(value) { /* ... */ }

    // --- Initial Data Loading for Filters ---
    async function loadFilterOptions() {
        try {
            const [stores, staff] = await Promise.all([
                fetchData("/stores/?status=active"),
                fetchData("/staff/?status=active")
            ]);
            storesList = stores || [];
            staffList = staff || [];

            populateSelect(storeFilterSelect, storesList, 'store_id', 'store_name', "All Stores");
            populateSelect(staffFilterSelect, staffList, 'staff_id', 'full_name', "All Staff");

        } catch (error) {
            console.error("Error loading filter options:", error);
            showToast("Error loading filters.", "error");
        }
    }

    function populateSelect(selectElement, items, valueKey, textKey, defaultOptionText) {
        if (!selectElement) return;
        selectElement.innerHTML = `<option value="">${defaultOptionText}</option>`;
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item[valueKey];
            option.textContent = item[textKey];
            selectElement.appendChild(option);
        });
    }

    // --- Sales Data Handling ---
    async function loadSales() {
        showLoading(8);
        const offset = (currentPage - 1) * limit;

        // Build query params
        const params = new URLSearchParams();
        params.append('limit', limit);
        params.append('offset', offset);
        if (storeFilterSelect.value) params.append('store_id', storeFilterSelect.value);
        if (staffFilterSelect.value) params.append('staff_id', staffFilterSelect.value);
        if (paymentStatusFilter.value) params.append('payment_status', paymentStatusFilter.value);
        if (startDateFilter.value) params.append('start_date', startDateFilter.value);
        if (endDateFilter.value) params.append('end_date', endDateFilter.value);
        // Add sorting params if needed for backend sorting
        // params.append('sort_by', currentSortColumn);
        // params.append('sort_dir', currentSortDirection);

        try {
            // **Important**: Assumes backend '/sales/' endpoint is updated to accept
            // these filters and pagination params, and returns 'X-Total-Count' header.
            const { data, count } = await fetchData(`/sales/?${params.toString()}`, {}, true); // Pass true for returnCount

            allSalesData = data || []; // Cache for sorting IF backend doesn't sort
            totalSalesCount = count; // Store total count for pagination

            // If backend doesn't sort, sort client-side:
            sortAndRenderSales(allSalesData);
            updatePagination();

        } catch (error) {
            showToast(`Error loading sales: ${error.message}`, "error");
            showNoItemsMessage(noSalesMessage);
            updatePagination(true); // Update pagination even on error
        }
    }

    // --- Sorting ---
    function sortAndRenderSales(dataToSort) {
        // Enrich with names before sorting/rendering if backend doesn't join
        const dataWithNames = dataToSort.map(sale => {
             const staff = staffList.find(s => s.staff_id === sale.staff_id);
             const store = storeList.find(s => s.store_id === sale.store_id);
             // const customer = customerList.find(c => c.customer_id === sale.customer_id); // Load customers if needed
             return {
                 ...sale,
                 staff_name: staff ? staff.full_name : `ID: ${sale.staff_id}`,
                 store_name: store ? store.store_name : `ID: ${sale.store_id}`,
                 // customer_name: customer ? customer.full_name : 'Walk-in'
             };
         });

        const sortedData = [...dataWithNames].sort((a, b) => {
            let valA = a[currentSortColumn];
            let valB = b[currentSortColumn];

            if (currentSortColumn === 'created_at') {
                 valA = valA ? new Date(valA).getTime() : 0;
                 valB = valB ? new Date(valB).getTime() : 0;
            } else if (currentSortColumn === 'total_amount') {
                valA = parseFloat(valA || 0);
                valB = parseFloat(valB || 0);
            } else if (currentSortColumn === 'sale_id') {
                 valA = parseInt(valA || 0);
                 valB = parseInt(valB || 0);
            } else if (typeof valA === 'string') { // Handle string fields like names, status
                 valA = valA?.toLowerCase() || '';
                 valB = valB?.toLowerCase() || '';
            }

            let comparison = 0;
            if (valA > valB) comparison = 1;
            else if (valA < valB) comparison = -1;

            return currentSortDirection === 'desc' ? (comparison * -1) : comparison;
        });

        renderSalesTable(sortedData);
        updateSortIcons();
    }

    function updateSortIcons() { /* ... (same as storeManagement.js) ... */ }

    // --- Rendering ---
    function renderSalesTable(sales) {
        if (!salesTableBody) return;
        salesTableBody.innerHTML = "";

        if (!sales || sales.length === 0) {
            showNoItemsMessage(noSalesMessage);
            return;
        }
        hideNoItemsMessage(noSalesMessage);

        sales.forEach(sale => {
            const paymentStatus = sale.payment_status || 'unknown';
            const statusClass = `status-${paymentStatus}`;

            const tr = document.createElement("tr");
            tr.dataset.saleId = sale.sale_id; // Store ID on row
            tr.innerHTML = `
                <td>#${sale.sale_id}</td>
                <td>${sale.receipt_number || "-"}</td>
                <td>${formatDateTime(sale.created_at)}</td>
                <td>${sale.staff_name || '-'}</td>
                <td>${sale.store_name || '-'}</td>
                <td class="text-right">${formatCurrency(sale.total_amount)}</td>
                <td><span class="status-badge ${statusClass}">${paymentStatus}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn-icon view" title="View Details">
                            <ion-icon name="eye-outline"></ion-icon>
                        </button>
                        <button class="action-btn-icon receipt" title="Print Receipt">
                            <ion-icon name="print-outline"></ion-icon>
                        </button>
                         <!-- <button class="action-btn-icon cancel" title="Cancel Sale">
                             <ion-icon name="close-circle-outline"></ion-icon>
                         </button> -->
                    </div>
                </td>
            `;
            salesTableBody.appendChild(tr);
        });
        attachSaleActions();
    }

    // --- Pagination ---
    function updatePagination(isError = false) {
         if (!paginationControls) return;
         if (isError || totalSalesCount === 0) {
             pageInfo.textContent = 'Page 0 of 0';
             prevPageBtn.disabled = true;
             nextPageBtn.disabled = true;
             paginationControls.style.display = 'none'; // Hide if no data/error
             return;
         }

         paginationControls.style.display = 'flex'; // Show if data exists
         const totalPages = Math.ceil(totalSalesCount / limit);
         pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
         prevPageBtn.disabled = currentPage <= 1;
         nextPageBtn.disabled = currentPage >= totalPages;
    }

    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadSales();
        }
    });

    nextPageBtn.addEventListener('click', () => {
         const totalPages = Math.ceil(totalSalesCount / limit);
         if (currentPage < totalPages) {
             currentPage++;
             loadSales();
         }
    });

     limitSelect.addEventListener('change', (e) => {
         limit = parseInt(e.target.value, 10);
         currentPage = 1; // Reset to first page
         loadSales();
     });

    // --- Actions & Modals ---
    function attachSaleActions() {
        salesTableBody.querySelectorAll('.action-btn-icon.view').forEach(btn => {
            const row = btn.closest('tr');
            const saleId = row.dataset.saleId;
            btn.addEventListener('click', () => openDetailsModal(saleId));
        });

        salesTableBody.querySelectorAll('.action-btn-icon.receipt').forEach(btn => {
             const row = btn.closest('tr');
             const saleId = row.dataset.saleId;
            btn.addEventListener('click', () => window.open(`${API_BASE_URL}/sales/${saleId}/receipt/pdf`, '_blank'));
        });

        // Add listener for cancel button if implemented
        // salesTableBody.querySelectorAll('.action-btn-icon.cancel').forEach(btn => { ... });
    }

    async function openDetailsModal(saleId) {
         detailsModalTitle.textContent = `Sale Details (ID: ${saleId})`;
         saleDetailsBody.innerHTML = `<p class="loading-text">Loading details...</p>`;
         printReceiptBtn.dataset.saleId = saleId; // Store id on button
         // cancelSaleBtn.dataset.saleId = saleId; // If implementing cancel
         saleDetailsModal.style.display = "block";

        try {
            // Fetch detailed sale info, including items and payments
            const sale = await fetchData(`/sales/${saleId}`); // Assumes endpoint returns nested data
            if (!sale) throw new Error("Sale data not found.");

             // Find related names (could be pre-joined by backend)
             const staffName = staffList.find(s => s.staff_id === sale.staff_id)?.full_name || 'N/A';
             const storeName = storeList.find(s => s.store_id === sale.store_id)?.store_name || 'N/A';
             // Load customers if needed: const customer = await fetchData(`/customers/${sale.customer_id}`);
             const customerName = sale.customer_id ? `ID: ${sale.customer_id}` : 'Walk-in'; // Placeholder

             let itemsHtml = '<tr><td colspan="5">No items found for this sale.</td></tr>';
             if (sale.sale_items && sale.sale_items.length > 0) {
                 itemsHtml = sale.sale_items.map(item => `
                    <tr>
                        <td>${item.item?.item_name || `Item ID: ${item.item_id}`}</td>
                        <td class="text-right">${item.quantity}</td>
                        <td class="text-right">${formatCurrency(item.unit_price)}</td>
                        <td class="text-right">${formatCurrency(item.discount)}</td>
                        <td class="text-right">${formatCurrency(item.tax)}</td>
                        <td class="text-right">${formatCurrency(item.subtotal)}</td>
                    </tr>
                 `).join('');
             }

             // Assuming payments are nested; adjust if structure differs
             let paymentsHtml = '<li>No payment details found.</li>';
             if (sale.payments && sale.payments.length > 0) {
                 paymentsHtml = sale.payments.map(p => `
                    <li>
                        ${p.payment_method?.payment_method_name || `Method ID: ${p.payment_method_id}`}:
                        <strong>${formatCurrency(p.amount)}</strong>
                        ${p.transaction_reference ? ` (Ref: ${p.transaction_reference})` : ''}
                        @ ${formatDateTime(p.payment_date)}
                    </li>
                 `).join('');
             }
             const totalPaid = sale.payments ? sale.payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) : 0;

             saleDetailsBody.innerHTML = `
                <div class="detail-grid">
                    <div class="detail-item"><strong>Receipt #:</strong> <span>${sale.receipt_number || '-'}</span></div>
                    <div class="detail-item"><strong>Date:</strong> <span>${formatDateTime(sale.created_at)}</span></div>
                    <div class="detail-item"><strong>Store:</strong> <span>${storeName}</span></div>
                    <div class="detail-item"><strong>Staff:</strong> <span>${staffName}</span></div>
                    <div class="detail-item"><strong>Customer:</strong> <span>${customerName}</span></div>
                    <div class="detail-item"><strong>Payment Status:</strong> <span><span class="status-badge status-${sale.payment_status}">${sale.payment_status}</span></span></div>
                </div>

                <h4>Items Sold</h4>
                <div class="table-wrapper details-table-wrapper">
                    <table class="details-table">
                         <thead>
                             <tr>
                                 <th>Item</th>
                                 <th class="text-right">Qty</th>
                                 <th class="text-right">Unit Price</th>
                                 <th class="text-right">Discount</th>
                                 <th class="text-right">Tax</th>
                                 <th class="text-right">Line Total</th>
                            </tr>
                        </thead>
                        <tbody>${itemsHtml}</tbody>
                    </table>
                </div>

                <h4>Payment Details</h4>
                <ul class="payment-list">${paymentsHtml}</ul>

                <div class="totals-section">
                     <div><span>Subtotal:</span> <span>${formatCurrency(sale.total_amount - totalTax + totalDiscount)}</span></div> <!-- Approx subtotal -->
                     <div><span>Total Discount:</span> <span>-${formatCurrency(totalDiscount)}</span></div>
                     <div><span>Total Tax:</span> <span>+${formatCurrency(totalTax)}</span></div>
                     <div class="grand-total"><strong>Total Amount:</strong> <strong>${formatCurrency(sale.total_amount)}</strong></div>
                     <hr>
                     <div><strong>Total Paid:</strong> <strong>${formatCurrency(totalPaid)}</strong></div>
                     <div><strong>Balance Due:</strong> <strong>${formatCurrency(sale.total_amount - totalPaid)}</strong></div>
                 </div>
            `;
             // Calculate totals from items if needed (more accurate)
             const totalTax = sale.sale_items?.reduce((sum, i) => sum + parseFloat(i.tax || 0), 0) ?? 0;
             const totalDiscount = sale.sale_items?.reduce((sum, i) => sum + parseFloat(i.discount || 0), 0) ?? 0;
             // Update totals display if needed

        } catch (error) {
            saleDetailsBody.innerHTML = `<p class="error-text">Error loading details: ${error.message}</p>`;
        }
    }

    // Close Details Modal
    closeDetailsModal.addEventListener('click', () => saleDetailsModal.style.display = "none");
    closeDetailsModalBottom.addEventListener('click', () => saleDetailsModal.style.display = "none");

    // Print Receipt Button in Modal
    printReceiptBtn.addEventListener('click', (e) => {
        const saleId = e.target.dataset.saleId;
        if (saleId) {
             window.open(`${API_BASE_URL}/sales/${saleId}/receipt/pdf`, '_blank');
        }
    });

    // --- Event Listeners ---
    goToPOSBtn.addEventListener("click", () => {
        window.location.href = "checkout.html"; // Navigate to POS page
    });

    applyFiltersBtn.addEventListener('click', () => {
         currentPage = 1; // Reset to first page when applying filters
         loadSales();
    });

    resetFiltersBtn.addEventListener('click', () => {
        startDateFilter.value = '';
        endDateFilter.value = '';
        storeFilterSelect.value = '';
        staffFilterSelect.value = '';
        paymentStatusFilter.value = '';
        currentPage = 1;
        loadSales();
    });

    // --- Initial Load ---
    loadFilterOptions().then(() => {
        loadSales(); // Load initial sales data after filters are populated
    });

}); // End DOMContentLoaded