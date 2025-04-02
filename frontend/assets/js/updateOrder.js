document.addEventListener("DOMContentLoaded", () => {
    let staffList = [];
    let storeList = [];
    let customerList = [];
    let orderId = null;
  
    // Get orderId from URL query parameters
    const params = new URLSearchParams(window.location.search);
    orderId = params.get("order_id");
    if (!orderId) {
      alert("No order ID provided.");
      window.location.href = "orderManagement.html";
    }
  
    // Load order details and prefill form
    async function loadOrderDetails() {
      try {
        const response = await fetch(`http://127.0.0.1:8000/orders/${orderId}`);
        if (!response.ok) throw new Error("Failed to fetch order details");
        const order = await response.json();
        populateForm(order);
      } catch (error) {
        console.error("Error loading order details:", error);
        alert("Error loading order details.");
      }
    }
  
    // Populate the update form with the order details
    function populateForm(order) {
      document.getElementById("totalAmount").value = parseFloat(order.total_amount).toFixed(2);
      document.getElementById("paymentStatus").value = order.payment_status;
      document.getElementById("orderStatus").value = order.order_status;
      // After loading the datalists, set the names for staff, store, and customer.
      setTimeout(() => {
        const staff = staffList.find(s => s.staff_id === order.staff_id);
        const store = storeList.find(s => s.store_id === order.store_id);
        const customer = customerList.find(c => c.customer_id === order.customer_id);
        document.getElementById("orderStaff").value = staff ? staff.full_name : "";
        document.getElementById("orderStore").value = store ? store.store_name : "";
        document.getElementById("orderCustomer").value = customer ? customer.full_name : "";
      }, 500);
    }
  
    // Load datalists for staff, stores, and customers
    async function loadStaffOptions() {
      try {
        const response = await fetch("http://127.0.0.1:8000/staff/");
        if (!response.ok) throw new Error("Failed to fetch staff");
        staffList = await response.json();
        const datalist = document.getElementById("staffList");
        datalist.innerHTML = "";
        staffList.forEach(staff => {
          const option = document.createElement("option");
          option.value = staff.full_name;
          datalist.appendChild(option);
        });
      } catch (error) {
        console.error("Error loading staff options:", error);
      }
    }
  
    async function loadStoreOptions() {
      try {
        const response = await fetch("http://127.0.0.1:8000/stores/");
        if (!response.ok) throw new Error("Failed to fetch stores");
        storeList = await response.json();
        const datalist = document.getElementById("storeList");
        datalist.innerHTML = "";
        storeList.forEach(store => {
          const option = document.createElement("option");
          option.value = store.store_name;
          datalist.appendChild(option);
        });
      } catch (error) {
        console.error("Error loading store options:", error);
      }
    }
  
    async function loadCustomerOptions() {
      try {
        const response = await fetch("http://127.0.0.1:8000/customers/");
        if (!response.ok) throw new Error("Failed to fetch customers");
        customerList = await response.json();
        const datalist = document.getElementById("customerList");
        datalist.innerHTML = "";
        customerList.forEach(customer => {
          const option = document.createElement("option");
          option.value = customer.full_name;
          datalist.appendChild(option);
        });
      } catch (error) {
        console.error("Error loading customer options:", error);
      }
    }
  
    // Handle form submission for updating the order
    const updateForm = document.getElementById("updateOrderForm");
    updateForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const staffInput = document.getElementById("orderStaff").value.trim();
      const storeInput = document.getElementById("orderStore").value.trim();
      const customerInput = document.getElementById("orderCustomer").value.trim();
      const totalAmount = document.getElementById("totalAmount").value.trim();
      const paymentStatus = document.getElementById("paymentStatus").value;
      const orderStatus = document.getElementById("orderStatus").value;
  
      const staffObj = staffList.find(s => s.full_name.toLowerCase() === staffInput.toLowerCase());
      const storeObj = storeList.find(s => s.store_name.toLowerCase() === storeInput.toLowerCase());
      const customerObj = customerList.find(c => c.full_name.toLowerCase() === customerInput.toLowerCase());
  
      if (!staffObj) {
        alert("Staff not found. Please select a valid staff.");
        return;
      }
      if (!storeObj) {
        alert("Store not found. Please select a valid store.");
        return;
      }
      if (!customerObj) {
        alert("Customer not found. Please select a valid customer.");
        return;
      }
  
      const data = {
        staff_id: staffObj.staff_id,
        store_id: storeObj.store_id,
        customer_id: customerObj.customer_id,
        total_amount: parseFloat(totalAmount),
        payment_status: paymentStatus,
        order_status: orderStatus
      };
  
      try {
        const response = await fetch(`http://127.0.0.1:8000/orders/${orderId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error("Failed to update order");
        alert("Order updated successfully!");
        window.location.href = "orderManagement.html";
      } catch (error) {
        console.error("Error updating order:", error);
        alert("Error updating order.");
      }
    });
  
    // Load initial data on page load
    loadStaffOptions();
    loadStoreOptions();
    loadCustomerOptions();
    loadOrderDetails();
  });
  