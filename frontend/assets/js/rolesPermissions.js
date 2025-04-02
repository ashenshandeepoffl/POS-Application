document.addEventListener("DOMContentLoaded", () => {
    let rolesList = [];
    let permissionsList = [];
  
    // --- Tab Switching ---
    const tabButtons = document.querySelectorAll(".tabs .tab");
    const tabContents = document.querySelectorAll(".tab-content");
  
    tabButtons.forEach(tab => {
      tab.addEventListener("click", () => {
        tabButtons.forEach(t => t.classList.remove("active"));
        tabContents.forEach(content => content.classList.remove("active"));
  
        tab.classList.add("active");
        const activeTab = tab.dataset.tab;
        document.getElementById(activeTab).classList.add("active");
  
        if (activeTab === "rolesTab") {
          loadRoles();
        } else if (activeTab === "permissionsTab") {
          loadPermissions();
        } else if (activeTab === "assignTab") {
          // Load roles, permissions, and assignments for the assign tab
          loadRoles();
          loadPermissions();
          loadAssignments();
        }
      });
    });
  
    // --- Roles Management ---
    const roleForm = document.getElementById("roleForm");
    roleForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const roleName = document.getElementById("roleName").value.trim();
      const data = { role_name: roleName };
      try {
        const response = await fetch("http://127.0.0.1:8000/roles/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error("Failed to create role");
        alert("Role created successfully!");
        roleForm.reset();
        loadRoles();
      } catch (error) {
        console.error("Error creating role:", error);
        alert("Error creating role.");
      }
    });
  
    async function loadRoles() {
      try {
        const response = await fetch("http://127.0.0.1:8000/roles/");
        if (!response.ok) throw new Error("Failed to fetch roles");
        rolesList = await response.json();
        renderRolesTable();
        populateRoleDatalist();
      } catch (error) {
        console.error("Error loading roles:", error);
      }
    }
  
    function renderRolesTable() {
      const tbody = document.getElementById("rolesTableBody");
      tbody.innerHTML = "";
      rolesList.forEach(role => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${role.role_id}</td>
          <td>${role.role_name}</td>
          <td>
            <button class="btn delete-role" data-id="${role.role_id}">Delete</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
      attachRoleDeleteEvents();
    }
  
    function attachRoleDeleteEvents() {
      document.querySelectorAll(".delete-role").forEach(btn => {
        btn.addEventListener("click", async () => {
          const roleId = btn.dataset.id;
          if (confirm("Are you sure you want to delete this role?")) {
            try {
              const response = await fetch(`http://127.0.0.1:8000/roles/${roleId}`, {
                method: "DELETE"
              });
              if (!response.ok) throw new Error("Failed to delete role");
              alert("Role deleted successfully!");
              loadRoles();
            } catch (error) {
              console.error("Error deleting role:", error);
              alert("Error deleting role.");
            }
          }
        });
      });
    }
  
    function populateRoleDatalist() {
      const datalist = document.getElementById("roleList");
      datalist.innerHTML = "";
      rolesList.forEach(role => {
        const option = document.createElement("option");
        option.value = role.role_name;
        datalist.appendChild(option);
      });
    }
  
    // --- Permissions Management ---
    const permissionForm = document.getElementById("permissionForm");
    permissionForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const permissionName = document.getElementById("permissionName").value.trim();
      const data = { permission_name: permissionName };
      try {
        const response = await fetch("http://127.0.0.1:8000/permissions/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error("Failed to create permission");
        alert("Permission created successfully!");
        permissionForm.reset();
        loadPermissions();
      } catch (error) {
        console.error("Error creating permission:", error);
        alert("Error creating permission.");
      }
    });
  
    async function loadPermissions() {
      try {
        const response = await fetch("http://127.0.0.1:8000/permissions/");
        if (!response.ok) throw new Error("Failed to fetch permissions");
        permissionsList = await response.json();
        renderPermissionsTable();
        populatePermissionDatalist();
      } catch (error) {
        console.error("Error loading permissions:", error);
      }
    }
  
    function renderPermissionsTable() {
      const tbody = document.getElementById("permissionsTableBody");
      tbody.innerHTML = "";
      permissionsList.forEach(permission => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${permission.permission_id}</td>
          <td>${permission.permission_name}</td>
          <td>
            <button class="btn delete-permission" data-id="${permission.permission_id}">Delete</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
      attachPermissionDeleteEvents();
    }
  
    function attachPermissionDeleteEvents() {
      document.querySelectorAll(".delete-permission").forEach(btn => {
        btn.addEventListener("click", async () => {
          const permissionId = btn.dataset.id;
          if (confirm("Are you sure you want to delete this permission?")) {
            try {
              const response = await fetch(`http://127.0.0.1:8000/permissions/${permissionId}`, {
                method: "DELETE"
              });
              if (!response.ok) throw new Error("Failed to delete permission");
              alert("Permission deleted successfully!");
              loadPermissions();
            } catch (error) {
              console.error("Error deleting permission:", error);
              alert("Error deleting permission.");
            }
          }
        });
      });
    }
  
    function populatePermissionDatalist() {
      const datalist = document.getElementById("permissionList");
      datalist.innerHTML = "";
      permissionsList.forEach(permission => {
        const option = document.createElement("option");
        option.value = permission.permission_name;
        datalist.appendChild(option);
      });
    }
  
    // --- Assign Permissions ---
    const assignForm = document.getElementById("assignForm");
    assignForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const assignRoleInput = document.getElementById("assignRole").value.trim();
      const assignPermissionInput = document.getElementById("assignPermission").value.trim();
  
      // Lookup role and permission IDs (case-insensitive)
      const roleObj = rolesList.find(r => r.role_name.toLowerCase() === assignRoleInput.toLowerCase());
      const permissionObj = permissionsList.find(p => p.permission_name.toLowerCase() === assignPermissionInput.toLowerCase());
  
      if (!roleObj) {
        alert("Role not found. Please select a valid role.");
        return;
      }
      if (!permissionObj) {
        alert("Permission not found. Please select a valid permission.");
        return;
      }
  
      const data = {
        role_id: roleObj.role_id,
        permission_id: permissionObj.permission_id
      };
  
      try {
        const response = await fetch("http://127.0.0.1:8000/role_permissions/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error("Failed to assign permission");
        alert("Permission assigned successfully!");
        assignForm.reset();
        loadAssignments();
      } catch (error) {
        console.error("Error assigning permission:", error);
        alert("Error assigning permission.");
      }
    });
  
    async function loadAssignments() {
      try {
        const response = await fetch("http://127.0.0.1:8000/role_permissions/");
        if (!response.ok) throw new Error("Failed to fetch assignments");
        const assignments = await response.json();
        renderAssignmentsTable(assignments);
      } catch (error) {
        console.error("Error loading assignments:", error);
      }
    }
  
    function renderAssignmentsTable(assignments) {
      const tbody = document.getElementById("assignTableBody");
      tbody.innerHTML = "";
      assignments.forEach(assignment => {
        // Lookup role and permission names
        const role = rolesList.find(r => r.role_id === assignment.role_id);
        const permission = permissionsList.find(p => p.permission_id === assignment.permission_id);
        const roleName = role ? role.role_name : assignment.role_id;
        const permissionName = permission ? permission.permission_name : assignment.permission_id;
  
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${assignment.role_permission_id}</td>
          <td>${roleName}</td>
          <td>${permissionName}</td>
          <td>
            <button class="btn delete-assignment" data-id="${assignment.role_permission_id}">Delete</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
      attachAssignmentDeleteEvents();
    }
  
    function attachAssignmentDeleteEvents() {
      document.querySelectorAll(".delete-assignment").forEach(btn => {
        btn.addEventListener("click", async () => {
          const assignId = btn.dataset.id;
          if (confirm("Are you sure you want to delete this assignment?")) {
            try {
              const response = await fetch(`http://127.0.0.1:8000/role_permissions/${assignId}`, {
                method: "DELETE"
              });
              if (!response.ok) throw new Error("Failed to delete assignment");
              alert("Assignment deleted successfully!");
              loadAssignments();
            } catch (error) {
              console.error("Error deleting assignment:", error);
              alert("Error deleting assignment.");
            }
          }
        });
      });
    }
  
    // Load initial data when the page loads (default active tab is Roles)
    loadRoles();
  });
  