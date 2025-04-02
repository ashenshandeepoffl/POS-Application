from sqlalchemy import Column, Integer, String, Text, Enum, DateTime, DECIMAL, Boolean, ForeignKey, func, Date, Numeric, Time, Computed
from sqlalchemy.orm import relationship
import enum
from database import Base

# ------------------------------
# Roles Table
# ------------------------------
class Role(Base):
    __tablename__ = "roles"
    role_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    role_name = Column(String(50), unique=True, nullable=False)

# ------------------------------
# Permissions Table
# ------------------------------
class Permission(Base):
    __tablename__ = "permissions"
    permission_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    permission_name = Column(String(100), unique=True, nullable=False)

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
    barcode = Column(String(50), unique=True)
    is_perishable = Column(Boolean, default=False)
    image_url = Column(String(255))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    category = relationship("Category", back_populates="items")

# ------------------------------
# Customers Table
# ------------------------------
class Customer(Base):
    __tablename__ = "customers"
    customer_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True)
    phone_number = Column(String(20))
    street = Column(String(255))
    city = Column(String(100))
    state = Column(String(100))
    zip_code = Column(String(20))
    loyalty_points = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

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
    email = Column(String(100), unique=True, nullable=False)
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

    stores_managed = relationship("Store", back_populates="manager", foreign_keys="Store.manager_id")

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

    manager = relationship("Staff", back_populates="stores_managed", foreign_keys=[manager_id])
    stocks = relationship("Stock", back_populates="store")

# ------------------------------
# Updated Stock Model
# ------------------------------
class Stock(Base):
    __tablename__ = "stock"
    stock_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.store_id"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.item_id"), nullable=False)
    quantity = Column(Integer, default=0)
    cost = Column(DECIMAL(10, 2), default=0.00)
    min_stock_level = Column(Integer, default=5)
    location = Column(String(255))
    measurement_unit = Column(String(50))
    batch_number = Column(String(50))
    manufacture_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True)
    last_updated = Column(DateTime, server_default=func.now(), onupdate=func.now())

    store = relationship("Store", back_populates="stocks")
    item = relationship("Item")


# ------------------------------
# Sales Table
# ------------------------------
class PaymentStatusEnum(enum.Enum):
    pending = "pending"
    paid = "paid"
    cancelled = "cancelled"

class RefundStatusEnum(enum.Enum):
    none = "none"
    pending = "pending"
    processed = "processed"

class Sales(Base):
    __tablename__ = "sales"
    sale_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    staff_id = Column(Integer, ForeignKey("staff.staff_id"))
    customer_id = Column(Integer, ForeignKey("customers.customer_id"), nullable=True)
    store_id = Column(Integer, ForeignKey("stores.store_id"))
    sale_date = Column(DateTime, server_default=func.now())
    total_amount = Column(DECIMAL(10, 2), default=0.00)
    payment_status = Column(Enum(PaymentStatusEnum, name="payment_status_enum"), default=PaymentStatusEnum.pending)
    receipt_number = Column(String(50), unique=True)
    refund_amount = Column(DECIMAL(10,2), default=0.00)
    refund_status = Column(Enum(RefundStatusEnum, name="refund_status_enum"), default=RefundStatusEnum.none)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    sale_items = relationship("SaleItem", back_populates="sales", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="sales", cascade="all, delete-orphan")

# ------------------------------
# Sale Items Table
# ------------------------------
class SaleItem(Base):
    __tablename__ = "sale_items"
    sale_item_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    sale_id = Column(Integer, ForeignKey("sales.sale_id", ondelete="CASCADE"))
    item_id = Column(Integer, ForeignKey("items.item_id", ondelete="CASCADE"))
    quantity = Column(Integer, default=1)
    unit_price = Column(DECIMAL(10, 2), nullable=False)
    discount = Column(DECIMAL(10,2), default=0.00)
    tax = Column(DECIMAL(10,2), default=0.00)
    subtotal = Column(DECIMAL(10, 2), Computed("quantity * unit_price", persisted=True))

    sales = relationship("Sales", back_populates="sale_items")
    # Optionally, add a relationship to Item if required.

# ------------------------------
# Payments Table
# ------------------------------
class Payment(Base):
    __tablename__ = "payments"
    payment_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    sale_id = Column(Integer, ForeignKey("sales.sale_id", ondelete="CASCADE"))
    amount = Column(DECIMAL(10,2), nullable=False)
    payment_method_id = Column(Integer)  # Adjust if linking to a payment_methods table
    transaction_reference = Column(String(255))
    payment_date = Column(DateTime, server_default=func.now())

    sales = relationship("Sales", back_populates="payments")

# ------------------------------
# RolePermission Table
# ------------------------------
class RolePermission(Base):
    __tablename__ = "role_permissions"
    role_permission_id = Column(Integer, primary_key=True, autoincrement=True)
    role_id = Column(Integer, ForeignKey("roles.role_id"), nullable=False)
    permission_id = Column(Integer, ForeignKey("permissions.permission_id"), nullable=False)

# ------------------------------
# UserRole Table
# ------------------------------
class UserRole(Base):
    __tablename__ = "user_roles"
    user_role_id = Column(Integer, primary_key=True, autoincrement=True)
    staff_id = Column(Integer, ForeignKey("staff.staff_id"), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.role_id"), nullable=False)

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
    staff_id = Column(Integer, ForeignKey("staff.staff_id"), nullable=False)
    store_id = Column(Integer, ForeignKey("stores.store_id"), nullable=False)
    check_in = Column(DateTime, nullable=True)
    check_out = Column(DateTime, nullable=True)
    total_hours = Column(DECIMAL(5, 2), Computed("TIMESTAMPDIFF(MINUTE, check_in, check_out) / 60", persisted=True))
    status = Column(Enum(AttendanceStatus, name="attendance_status_enum"), default=AttendanceStatus.present)
    remarks = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

# ------------------------------
# Sales Reports Table
# ------------------------------
class SalesReport(Base):
    __tablename__ = "sales_reports"
    report_id = Column(Integer, primary_key=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.store_id"), nullable=False)
    total_sales = Column(DECIMAL(10,2), default=0.00)
    total_orders = Column(Integer, default=0)
    top_item_id = Column(Integer, ForeignKey("items.item_id"), nullable=True)
    report_date = Column(Date, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

# ------------------------------
# Discounts Table
# ------------------------------
class DiscountType(enum.Enum):
    fixed_amount = "fixed_amount"
    percentage = "percentage"

class DiscountStatus(enum.Enum):
    active = "active"
    expired = "expired"

class Discount(Base):
    __tablename__ = "discounts"
    discount_id = Column(Integer, primary_key=True, autoincrement=True)
    discount_name = Column(String(100), nullable=False)
    discount_type = Column(Enum(DiscountType, name="discount_type_enum"), nullable=False)
    discount_value = Column(DECIMAL(10,2), nullable=False)
    start_date = Column(Date)
    end_date = Column(Date)
    status = Column(Enum(DiscountStatus, name="discount_status_enum"), default=DiscountStatus.active)

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

# ------------------------------
# Audit Logs Table
# ------------------------------
class AuditLog(Base):
    __tablename__ = "audit_logs"
    log_id = Column(Integer, primary_key=True, autoincrement=True)
    staff_id = Column(Integer, ForeignKey("staff.staff_id"), nullable=True)
    action = Column(String(255), nullable=False)
    table_name = Column(String(100))
    record_id = Column(Integer)
    old_values = Column(Text)
    new_values = Column(Text)
    timestamp = Column(DateTime, server_default=func.now())

# PaymentMethods
class PaymentMethod(Base):
    __tablename__ = "payment_methods"
    payment_method_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    payment_method_name = Column(String(100), unique=True, nullable=False)

# SplitPayments
class SplitPayment(Base):
    __tablename__ = "split_payments"
    split_payment_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    sale_id = Column(Integer, ForeignKey("sales.sale_id", ondelete="CASCADE"))
    amount = Column(DECIMAL(10, 2), nullable=False)
    payment_method_id = Column(Integer, ForeignKey("payment_methods.payment_method_id"))
    transaction_reference = Column(String(255))
    payment_date = Column(DateTime, server_default=func.now())

# StockHistory
class StockHistory(Base):
    __tablename__ = "stock_history"
    history_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    stock_id = Column(Integer, ForeignKey("stock.stock_id"), nullable=False)
    quantity_change = Column(Integer)
    change_type = Column(Enum('addition', 'removal', 'adjustment', name='change_type_enum'))
    change_date = Column(DateTime, server_default=func.now())
    reason = Column(Text)

# DiscountsApplied
class DiscountsApplied(Base):
    __tablename__ = "discounts_applied"
    discount_applied_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    sale_id = Column(Integer, ForeignKey("sales.sale_id"), nullable=False)
    discount_id = Column(Integer, ForeignKey("discounts.discount_id"), nullable=False)
    discount_amount = Column(DECIMAL(10, 2))

# TaxesApplied
class TaxesApplied(Base):
    __tablename__ = "taxes_applied"
    tax_applied_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    sale_id = Column(Integer, ForeignKey("sales.sale_id"), nullable=False)
    tax_id = Column(Integer, ForeignKey("taxes.tax_id"), nullable=False)
    tax_amount = Column(DECIMAL(10, 2))

# SalesReportItems
class SalesReportItem(Base):
    __tablename__ = "sales_report_items"
    sales_report_item_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    report_id = Column(Integer, ForeignKey("sales_reports.report_id"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.item_id"), nullable=False)
    quantity_sold = Column(Integer)
    unit_price = Column(DECIMAL(10, 2))

# Suppliers
class Supplier(Base):
    __tablename__ = "suppliers"
    supplier_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    supplier_name = Column(String(100), nullable=False)
    contact_info = Column(String(255))
    address = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

# PurchaseOrders
class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    purchase_order_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.supplier_id"), nullable=False)
    store_id = Column(Integer, ForeignKey("stores.store_id"), nullable=False)
    order_date = Column(Date)
    expected_delivery_date = Column(Date)
    status = Column(Enum('pending', 'shipped', 'received', 'cancelled', name='po_status_enum'), default='pending')
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

# PurchaseOrderItems
class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"
    purchase_order_item_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.purchase_order_id"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.item_id"), nullable=False)
    quantity = Column(Integer)
    unit_price = Column(DECIMAL(10, 2))
    measurement_unit = Column(String(50))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
