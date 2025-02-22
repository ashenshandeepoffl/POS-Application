# models.py
from sqlalchemy import Column, Integer, String, Text, Enum, DateTime, DECIMAL, Boolean, ForeignKey, func, Date, Numeric, Time, Computed
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

import enum 
from database import Base


Base = declarative_base()

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
class Category(Base):
    __tablename__ = "categories"
    category_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    category_name = Column(String(100), nullable=False)
    description = Column(Text)
    status = Column(Enum('active', 'inactive', name='status_enum'), default='active')
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationship to items
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
    stock = Column(Enum('in_stock', 'out_of_stock', name='stock_enum'), default='in_stock')
    is_perishable = Column(Boolean, default=False)
    image_url = Column(String(255))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationship to category
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
    address = Column(Text)
    loyalty_points = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())



# ----- Staff Model -----
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
    email = Column(String(100), nullable=False, unique=True)
    role = Column(Enum(StaffRole, name="staff_role"), default=StaffRole.Employee)
    phone_number = Column(String(20))
    date_of_birth = Column(Date)
    salary = Column(Numeric(10, 2), default=0.00)
    shift_start_time = Column(Time)
    shift_end_time = Column(Time)
    address = Column(Text)
    additional_details = Column(Text)
    password_hash = Column(String(255))
    status = Column(Enum(StaffStatus, name="staff_status"), default=StaffStatus.active)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationship: A staff member can manage many stores.
    stores_managed = relationship("Store", back_populates="manager", foreign_keys="Store.manager_id")


# ----- Store Model -----
class Store(Base):
    __tablename__ = "stores"
    store_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    store_name = Column(String(100), nullable=False)
    location = Column(Text)
    contact_number = Column(String(20))
    manager_id = Column(Integer, ForeignKey("staff.staff_id", ondelete="SET NULL"), nullable=True)
    # Here we re-use the same status enum for simplicity.
    status = Column(Enum(StaffStatus, name="store_status"), default=StaffStatus.active)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    manager = relationship("Staff", back_populates="stores_managed", foreign_keys=[manager_id])
    stocks = relationship("Stock", back_populates="store")


# ----- Stock Model -----
class Stock(Base):
    __tablename__ = "stock"
    stock_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.store_id"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.item_id"), nullable=False)
    quantity = Column(Integer, default=0)
    min_stock_level = Column(Integer, default=5)
    last_updated = Column(DateTime, server_default=func.now(), onupdate=func.now())

    store = relationship("Store", back_populates="stocks")
    # Assume that an Item model exists; if not, create a simple placeholder.
    item = relationship("Item")


# Enumerations for orders and payments
class PaymentStatusEnum(enum.Enum):
    pending = "pending"
    paid = "paid"
    cancelled = "cancelled"

class OrderStatusEnum(enum.Enum):
    processing = "processing"
    completed = "completed"
    cancelled = "cancelled"

class PaymentMethodEnum(enum.Enum):
    cash = "cash"
    credit_card = "credit_card"
    debit_card = "debit_card"
    mobile_payment = "mobile_payment"

# ----------------
# Order Model
# ----------------
class Order(Base):
    __tablename__ = "orders"
    order_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    staff_id = Column(Integer, ForeignKey("staff.staff_id"))
    store_id = Column(Integer, ForeignKey("stores.store_id"))
    total_amount = Column(DECIMAL(10, 2), default=0.00)
    payment_status = Column(Enum(PaymentStatusEnum, name="payment_status_enum"), default=PaymentStatusEnum.pending)
    order_status = Column(Enum(OrderStatusEnum, name="order_status_enum"), default=OrderStatusEnum.processing)
    customer_id = Column(Integer, ForeignKey("customers.customer_id"))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships to order_items and payments
    order_items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="order", cascade="all, delete-orphan")

# ----------------
# OrderItem Model
# ----------------
class OrderItem(Base):
    __tablename__ = "order_items"
    order_item_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.order_id", ondelete="CASCADE"))
    item_id = Column(Integer, ForeignKey("items.item_id", ondelete="CASCADE"))
    quantity = Column(Integer, default=1)
    price = Column(DECIMAL(10, 2), nullable=False)
    subtotal = Column(DECIMAL(10, 2), Computed("quantity * price", persisted=True))

    order = relationship("Order", back_populates="order_items")
    # If an Item model exists, you can add:
    # item = relationship("Item")

# ----------------
# Payment Model
# ----------------
class Payment(Base):
    __tablename__ = "payments"
    payment_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.order_id", ondelete="CASCADE"))
    amount = Column(DECIMAL(10, 2), nullable=False)
    payment_method = Column(Enum(PaymentMethodEnum, name="payment_method_enum"), default=PaymentMethodEnum.cash)
    transaction_reference = Column(String(255))
    payment_date = Column(DateTime, server_default=func.now())

    order = relationship("Order", back_populates="payments")