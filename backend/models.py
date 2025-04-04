# models.py

from sqlalchemy import (
    Column, Integer, String, Text, Enum, DateTime, DECIMAL, Boolean,
    ForeignKey, func, Date, Numeric, Time, Computed
)
from sqlalchemy.orm import relationship, declarative_base, column_property # Use declarative_base
import enum

# Use declarative_base() for modern SQLAlchemy
Base = declarative_base()

# ------------------------------
# Roles Table
# ------------------------------
class Role(Base):
    __tablename__ = "roles"
    role_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    role_name = Column(String(50), unique=True, nullable=False)

    # Relationship to UserRole (One Role to many UserRoles)
    user_roles = relationship("UserRole", back_populates="role")
    # Relationship to RolePermission (One Role to many RolePermissions)
    permissions = relationship("RolePermission", back_populates="role")


# ------------------------------
# Permissions Table
# ------------------------------
class Permission(Base):
    __tablename__ = "permissions"
    permission_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    permission_name = Column(String(100), unique=True, nullable=False)

    # Relationship to RolePermission (One Permission to many RolePermissions)
    roles = relationship("RolePermission", back_populates="permission")


# ------------------------------
# Categories Table
# ------------------------------
class CategoryStatusEnum(enum.Enum):
    active = "active"
    inactive = "inactive"

class Category(Base):
    __tablename__ = "categories"
    category_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    category_name = Column(String(100), nullable=False)
    description = Column(Text)
    status = Column(Enum(CategoryStatusEnum, name="status_enum"), default=CategoryStatusEnum.active)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationship to Item (One Category to many Items)
    items = relationship("Item", back_populates="category")


# ------------------------------
# Items Table
# ------------------------------
class Item(Base):
    __tablename__ = "items"
    item_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    item_name = Column(String(150), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.category_id"))
    price = Column(DECIMAL(10, 2), default=0.00)
    cost_price = Column(DECIMAL(10, 2), default=0.00)
    barcode = Column(String(50), unique=True, index=True) # Added index for faster barcode lookup
    is_perishable = Column(Boolean, default=False)
    image_url = Column(String(255))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationship back to Category
    category = relationship("Category", back_populates="items")
    # Relationship to Stock (One Item can be in many Stock records)
    stock_records = relationship("Stock", back_populates="item")
    # Relationship to SaleItem (One Item can be in many SaleItems)
    sale_items = relationship("SaleItem", back_populates="item") # <<< ADDED back_populates
    # Relationship to PurchaseOrderItem
    purchase_order_items = relationship("PurchaseOrderItem", back_populates="item")
    # Relationship to SalesReportItem
    sales_report_items = relationship("SalesReportItem", back_populates="item")


# ------------------------------
# Customers Table
# ------------------------------
class Customer(Base):
    __tablename__ = "customers"
    customer_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True) # Added index
    phone_number = Column(String(20), index=True) # Added index
    street = Column(String(255))
    city = Column(String(100))
    state = Column(String(100))
    zip_code = Column(String(20))
    loyalty_points = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationship to Sales (One Customer can have many Sales)
    sales = relationship("Sales", back_populates="customer")


# ------------------------------
# Staff Table
# ------------------------------
class StaffRole(enum.Enum):
    Admin = "Admin"
    Manager = "Manager"
    Employee = "Employee"

class StaffStatus(enum.Enum):
    active = "active"
    inactive = "inactive"

class Staff(Base):
    __tablename__ = "staff"
    staff_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False, index=True) # Added index
    role = Column(Enum(StaffRole, name="staff_role"), default=StaffRole.Employee)
    is_manager = Column(Boolean, default=False)
    phone_number = Column(String(20))
    date_of_birth = Column(Date)
    salary = Column(Numeric(10, 2), default=0.00)
    shift_start_time = Column(Time)
    shift_end_time = Column(Time)
    street = Column(String(255))
    city = Column(String(100))
    state = Column(String(100))
    zip_code = Column(String(20))
    additional_details = Column(Text)
    password_hash = Column(String(255))
    status = Column(Enum(StaffStatus, name="staff_status"), default=StaffStatus.active)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    stores_managed = relationship("Store", back_populates="manager", foreign_keys="Store.manager_id")
    sales_processed = relationship("Sales", back_populates="staff")
    user_roles = relationship("UserRole", back_populates="staff")
    attendance_records = relationship("Attendance", back_populates="staff")
    audit_logs = relationship("AuditLog", back_populates="staff")


# ------------------------------
# Stores Table
# ------------------------------
class StoreStatus(enum.Enum):
    active = "active"
    inactive = "inactive"

class Store(Base):
    __tablename__ = "stores"
    store_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    store_name = Column(String(100), nullable=False)
    street = Column(String(255))
    city = Column(String(100))
    state = Column(String(100))
    zip_code = Column(String(20))
    contact_number = Column(String(20))
    manager_id = Column(Integer, ForeignKey("staff.staff_id", ondelete="SET NULL"), nullable=True)
    status = Column(Enum(StoreStatus, name="store_status"), default=StoreStatus.active)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    manager = relationship("Staff", back_populates="stores_managed", foreign_keys=[manager_id])
    stocks = relationship("Stock", back_populates="store", cascade="all, delete-orphan")
    sales = relationship("Sales", back_populates="store")
    attendance_records = relationship("Attendance", back_populates="store")
    sales_reports = relationship("SalesReport", back_populates="store")
    purchase_orders = relationship("PurchaseOrder", back_populates="store")


# ------------------------------
# Updated Stock Model
# ------------------------------
class Stock(Base):
    __tablename__ = "stock"
    stock_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.store_id", ondelete="CASCADE"), nullable=False) # Cascade delete
    item_id = Column(Integer, ForeignKey("items.item_id", ondelete="CASCADE"), nullable=False) # Cascade delete
    quantity = Column(Integer, default=0)
    cost = Column(DECIMAL(10, 2), default=0.00)
    min_stock_level = Column(Integer, default=5)
    location = Column(String(255))
    measurement_unit = Column(String(50))
    batch_number = Column(String(50))
    manufacture_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True)
    last_updated = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    store = relationship("Store", back_populates="stocks")
    item = relationship("Item", back_populates="stock_records") # Changed back_populates
    stock_history = relationship("StockHistory", back_populates="stock_item", cascade="all, delete-orphan")


# ------------------------------
# Sales Table
# ------------------------------
class PaymentStatusEnum(enum.Enum):
    pending = "pending"
    paid = "paid"
    cancelled = "cancelled"
    partially_paid = "partially_paid" # Added for split payments

class RefundStatusEnum(enum.Enum):
    none = "none"
    pending = "pending"
    processed = "processed"

class Sales(Base):
    __tablename__ = "sales"
    sale_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    staff_id = Column(Integer, ForeignKey("staff.staff_id", ondelete="SET NULL"), nullable=True) # Allow null staff
    customer_id = Column(Integer, ForeignKey("customers.customer_id", ondelete="SET NULL"), nullable=True) # Allow null customer
    store_id = Column(Integer, ForeignKey("stores.store_id", ondelete="RESTRICT"), nullable=False) # Don't delete store if sales exist
    sale_date = Column(DateTime, server_default=func.now()) # Keep original name
    total_amount = Column(DECIMAL(10, 2), default=0.00)
    payment_status = Column(Enum(PaymentStatusEnum, name="payment_status_enum"), default=PaymentStatusEnum.pending)
    receipt_number = Column(String(50), unique=True, nullable=True) # Allow null receipt initially
    refund_amount = Column(DECIMAL(10,2), default=0.00)
    refund_status = Column(Enum(RefundStatusEnum, name="refund_status_enum"), default=RefundStatusEnum.none)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    sale_items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan") # Changed back_populates name
    # Use SplitPayment relationship here
    payments = relationship("SplitPayment", back_populates="sale", cascade="all, delete-orphan") # <<< CHANGED TO SplitPayment
    discounts_applied = relationship("DiscountsApplied", back_populates="sale", cascade="all, delete-orphan")
    taxes_applied = relationship("TaxesApplied", back_populates="sale", cascade="all, delete-orphan")
    staff = relationship("Staff", back_populates="sales_processed")
    customer = relationship("Customer", back_populates="sales")
    store = relationship("Store", back_populates="sales")


# ------------------------------
# Sale Items Table
# ------------------------------
class SaleItem(Base):
    __tablename__ = "sale_items"
    sale_item_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    sale_id = Column(Integer, ForeignKey("sales.sale_id", ondelete="CASCADE"), nullable=False) # Ensure cascade on delete
    item_id = Column(Integer, ForeignKey("items.item_id", ondelete="RESTRICT"), nullable=False) # Prevent item deletion if in sale
    quantity = Column(Integer, default=1, nullable=False) # Ensure quantity is not null
    unit_price = Column(DECIMAL(10, 2), nullable=False)
    discount = Column(DECIMAL(10,2), default=0.00)
    tax = Column(DECIMAL(10,2), default=0.00)
    # Use column_property for computed subtotal, not persisted=True unless absolutely needed
    subtotal = column_property((unit_price * quantity) - discount + tax)

    # Relationships
    sale = relationship("Sales", back_populates="sale_items") # Changed back_populates name
    # --- THIS IS THE FIX ---
    item = relationship("Item", back_populates="sale_items") # <<< ADDED this relationship


# ------------------------------
# Payments Table (Legacy or Specific Use - SplitPayment is primary now)
# ------------------------------
class Payment(Base):
    __tablename__ = "payments"
    payment_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    sale_id = Column(Integer, ForeignKey("sales.sale_id", ondelete="CASCADE"), nullable=False)
    amount = Column(DECIMAL(10,2), nullable=False)
    payment_method_id = Column(Integer, ForeignKey("payment_methods.payment_method_id")) # FK added
    transaction_reference = Column(String(255))
    payment_date = Column(DateTime, server_default=func.now())

    # This relationship might conflict if Sales.payments points to SplitPayment.
    # Decide if you need both Payment and SplitPayment tables. If SplitPayment
    # is the standard, this table might be removed or repurposed.
    # If keeping, ensure Sales model doesn't have conflicting relationship names.
    # sale = relationship("Sales", back_populates="payments") # Be careful with name conflicts

    payment_method = relationship("PaymentMethod", back_populates="legacy_payments")


# ------------------------------
# RolePermission Table
# ------------------------------
class RolePermission(Base):
    __tablename__ = "role_permissions"
    role_permission_id = Column(Integer, primary_key=True, autoincrement=True)
    role_id = Column(Integer, ForeignKey("roles.role_id", ondelete="CASCADE"), nullable=False)
    permission_id = Column(Integer, ForeignKey("permissions.permission_id", ondelete="CASCADE"), nullable=False)

    # Relationships
    role = relationship("Role", back_populates="permissions")
    permission = relationship("Permission", back_populates="roles")


# ------------------------------
# UserRole Table
# ------------------------------
class UserRole(Base):
    __tablename__ = "user_roles"
    user_role_id = Column(Integer, primary_key=True, autoincrement=True)
    staff_id = Column(Integer, ForeignKey("staff.staff_id", ondelete="CASCADE"), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.role_id", ondelete="CASCADE"), nullable=False)

    # Relationships
    staff = relationship("Staff", back_populates="user_roles")
    role = relationship("Role", back_populates="user_roles")


# ------------------------------
# Attendance Table
# ------------------------------
class AttendanceStatus(enum.Enum):
    present = "present"
    absent = "absent"
    leave = "leave"

class Attendance(Base):
    __tablename__ = "attendance"
    attendance_id = Column(Integer, primary_key=True, autoincrement=True)
    staff_id = Column(Integer, ForeignKey("staff.staff_id", ondelete="CASCADE"), nullable=False)
    store_id = Column(Integer, ForeignKey("stores.store_id", ondelete="CASCADE"), nullable=False)
    check_in = Column(DateTime, nullable=True)
    check_out = Column(DateTime, nullable=True)
    # total_hours = Column(DECIMAL(5, 2), Computed("TIMESTAMPDIFF(MINUTE, check_in, check_out) / 60", persisted=True)) # Check syntax for DB
    status = Column(Enum(AttendanceStatus, name="attendance_status_enum"), default=AttendanceStatus.present)
    remarks = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    staff = relationship("Staff", back_populates="attendance_records")
    store = relationship("Store", back_populates="attendance_records")


# ------------------------------
# Sales Reports Table (Consider making this a view or generated dynamically)
# ------------------------------
class SalesReport(Base):
    __tablename__ = "sales_reports"
    report_id = Column(Integer, primary_key=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.store_id"), nullable=False)
    total_sales = Column(DECIMAL(10,2), default=0.00)
    total_orders = Column(Integer, default=0)
    top_item_id = Column(Integer, ForeignKey("items.item_id"), nullable=True) # Optional FK
    report_date = Column(Date, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    store = relationship("Store", back_populates="sales_reports")
    # top_item = relationship("Item") # If needed
    report_items = relationship("SalesReportItem", back_populates="sales_report", cascade="all, delete-orphan")


# ------------------------------
# Discounts Table
# ------------------------------
class DiscountType(enum.Enum):
    fixed_amount = "fixed_amount"
    percentage = "percentage"

class DiscountStatus(enum.Enum):
    active = "active"
    expired = "expired"
    inactive = "inactive" # Added

class Discount(Base):
    __tablename__ = "discounts"
    discount_id = Column(Integer, primary_key=True, autoincrement=True)
    discount_name = Column(String(100), nullable=False)
    discount_type = Column(Enum(DiscountType, name="discount_type_enum"), nullable=False)
    discount_value = Column(DECIMAL(10,2), nullable=False)
    start_date = Column(Date)
    end_date = Column(Date)
    status = Column(Enum(DiscountStatus, name="discount_status_enum"), default=DiscountStatus.active)

    # Relationship
    applied_instances = relationship("DiscountsApplied", back_populates="discount")


# ------------------------------
# Taxes Table
# ------------------------------
class TaxStatus(enum.Enum):
    active = "active"
    inactive = "inactive"

class Tax(Base):
    __tablename__ = "taxes"
    tax_id = Column(Integer, primary_key=True, autoincrement=True)
    tax_name = Column(String(100), nullable=False)
    tax_percentage = Column(DECIMAL(5,2), nullable=False)
    status = Column(Enum(TaxStatus, name="tax_status_enum"), default=TaxStatus.active)

    # Relationship
    applied_instances = relationship("TaxesApplied", back_populates="tax")


# ------------------------------
# Audit Logs Table
# ------------------------------
class AuditLog(Base):
    __tablename__ = "audit_logs"
    log_id = Column(Integer, primary_key=True, autoincrement=True)
    staff_id = Column(Integer, ForeignKey("staff.staff_id"), nullable=True) # Staff might be null for system actions
    action = Column(String(255), nullable=False)
    table_name = Column(String(100))
    record_id = Column(Integer)
    old_values = Column(Text) # Consider JSON type if DB supports it
    new_values = Column(Text) # Consider JSON type if DB supports it
    timestamp = Column(DateTime, server_default=func.now())

    # Relationship
    staff = relationship("Staff", back_populates="audit_logs")


# ------------------------------
# PaymentMethods Table
# ------------------------------
class PaymentMethod(Base):
    __tablename__ = "payment_methods"
    payment_method_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    payment_method_name = Column(String(100), unique=True, nullable=False)

    # Relationships
    split_payments = relationship("SplitPayment", back_populates="payment_method")
    legacy_payments = relationship("Payment", back_populates="payment_method") # If using legacy table


# ------------------------------
# SplitPayments Table
# ------------------------------
class SplitPayment(Base):
    __tablename__ = "split_payments"
    split_payment_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    sale_id = Column(Integer, ForeignKey("sales.sale_id", ondelete="CASCADE"), nullable=False)
    amount = Column(DECIMAL(10, 2), nullable=False)
    payment_method_id = Column(Integer, ForeignKey("payment_methods.payment_method_id"), nullable=False)
    transaction_reference = Column(String(255))
    payment_date = Column(DateTime, server_default=func.now())

    # Relationships
    sale = relationship("Sales", back_populates="payments")
    payment_method = relationship("PaymentMethod", back_populates="split_payments")


# ------------------------------
# StockHistory Table
# ------------------------------
class StockChangeType(enum.Enum):
    addition = "addition"
    removal = "removal"
    adjustment = "adjustment"
    initial = "initial" # Added for clarity

class StockHistory(Base):
    __tablename__ = "stock_history"
    history_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    stock_id = Column(Integer, ForeignKey("stock.stock_id", ondelete="CASCADE"), nullable=False)
    quantity_change = Column(Integer, nullable=False)
    change_type = Column(Enum(StockChangeType, name='change_type_enum'), nullable=False)
    change_date = Column(DateTime, server_default=func.now())
    reason = Column(Text)
    related_sale_id = Column(Integer, ForeignKey("sales.sale_id"), nullable=True) # Optional link
    related_po_id = Column(Integer, ForeignKey("purchase_orders.purchase_order_id"), nullable=True) # Optional link

    # Relationships
    stock_item = relationship("Stock", back_populates="stock_history")
    # sale = relationship("Sales") # Optional
    # purchase_order = relationship("PurchaseOrder") # Optional


# ------------------------------
# DiscountsApplied Table
# ------------------------------
class DiscountsApplied(Base):
    __tablename__ = "discounts_applied"
    discount_applied_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    sale_id = Column(Integer, ForeignKey("sales.sale_id", ondelete="CASCADE"), nullable=False)
    discount_id = Column(Integer, ForeignKey("discounts.discount_id", ondelete="SET NULL"), nullable=True) # Allow discount deletion
    discount_amount = Column(DECIMAL(10, 2), nullable=False)

    # Relationships
    sale = relationship("Sales", back_populates="discounts_applied")
    discount = relationship("Discount", back_populates="applied_instances")


# ------------------------------
# TaxesApplied Table
# ------------------------------
class TaxesApplied(Base):
    __tablename__ = "taxes_applied"
    tax_applied_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    sale_id = Column(Integer, ForeignKey("sales.sale_id", ondelete="CASCADE"), nullable=False)
    tax_id = Column(Integer, ForeignKey("taxes.tax_id", ondelete="SET NULL"), nullable=True) # Allow tax deletion
    tax_amount = Column(DECIMAL(10, 2), nullable=False)

    # Relationships
    sale = relationship("Sales", back_populates="taxes_applied")
    tax = relationship("Tax", back_populates="applied_instances")


# ------------------------------
# SalesReportItems Table (Connects SalesReport to Items)
# ------------------------------
class SalesReportItem(Base):
    __tablename__ = "sales_report_items"
    sales_report_item_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    report_id = Column(Integer, ForeignKey("sales_reports.report_id", ondelete="CASCADE"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.item_id", ondelete="CASCADE"), nullable=False)
    quantity_sold = Column(Integer, nullable=False)
    total_revenue = Column(DECIMAL(10, 2), nullable=False) # Renamed from unit_price for clarity

    # Relationships
    sales_report = relationship("SalesReport", back_populates="report_items")
    item = relationship("Item", back_populates="sales_report_items")


# ------------------------------
# Suppliers Table
# ------------------------------
class Supplier(Base):
    __tablename__ = "suppliers"
    supplier_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    supplier_name = Column(String(100), nullable=False)
    contact_person = Column(String(100)) # Added
    contact_info = Column(String(255)) # Can be phone/email
    address = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationship
    purchase_orders = relationship("PurchaseOrder", back_populates="supplier")


# ------------------------------
# PurchaseOrders Table
# ------------------------------
class POStatus(enum.Enum):
    pending = "pending"
    shipped = "shipped"
    received = "received"
    cancelled = "cancelled"
    partially_received = "partially_received" # Added

class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    purchase_order_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.supplier_id", ondelete="RESTRICT"), nullable=False)
    store_id = Column(Integer, ForeignKey("stores.store_id", ondelete="RESTRICT"), nullable=False)
    order_date = Column(Date, server_default=func.current_date()) # Default to today
    expected_delivery_date = Column(Date)
    total_cost = Column(DECIMAL(12, 2), default=0.00) # Added total cost
    status = Column(Enum(POStatus, name='po_status_enum'), default=POStatus.pending)
    notes = Column(Text) # Added notes
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    supplier = relationship("Supplier", back_populates="purchase_orders")
    store = relationship("Store", back_populates="purchase_orders")
    items = relationship("PurchaseOrderItem", back_populates="purchase_order", cascade="all, delete-orphan")


# ------------------------------
# PurchaseOrderItems Table
# ------------------------------
class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"
    purchase_order_item_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.purchase_order_id", ondelete="CASCADE"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.item_id", ondelete="RESTRICT"), nullable=False) # Prevent item delete if on PO
    quantity_ordered = Column(Integer, nullable=False) # Renamed
    quantity_received = Column(Integer, default=0) # Added received quantity
    unit_price = Column(DECIMAL(10, 2), nullable=False)
    measurement_unit = Column(String(50))
    # Removed created/updated - less relevant for PO items themselves

    # Relationships
    purchase_order = relationship("PurchaseOrder", back_populates="items")
    item = relationship("Item", back_populates="purchase_order_items")