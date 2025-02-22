# schemas.py
from pydantic import BaseModel, EmailStr
from typing import Optional
from enum import Enum
from datetime import date, time, datetime

# ------------------------------
# Role Schemas
# ------------------------------
class RoleBase(BaseModel):
    role_name: str

class RoleCreate(RoleBase):
    pass

class RoleResponse(RoleBase):
    role_id: int

    class Config:
        orm_mode = True


# ------------------------------
# Permission Schemas
# ------------------------------
class PermissionBase(BaseModel):
    permission_name: str

class PermissionCreate(PermissionBase):
    pass

class PermissionResponse(PermissionBase):
    permission_id: int

    class Config:
        orm_mode = True


# ------------------------------
# Category Schemas
# ------------------------------
class CategoryBase(BaseModel):
    category_name: str
    description: Optional[str] = None
    status: Optional[str] = "active"

class CategoryCreate(CategoryBase):
    pass

class CategoryResponse(CategoryBase):
    category_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


# ------------------------------
# Item Schemas
# ------------------------------
class ItemBase(BaseModel):
    item_name: str
    category_id: Optional[int] = None
    price: Optional[float] = 0.00
    stock: Optional[str] = "in_stock"
    is_perishable: Optional[bool] = False
    image_url: Optional[str] = None

class ItemCreate(ItemBase):
    pass

class ItemResponse(ItemBase):
    item_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


# ------------------------------
# Customer Schemas
# ------------------------------
class CustomerBase(BaseModel):
    full_name: str
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None
    loyalty_points: Optional[int] = 0

class CustomerCreate(CustomerBase):
    pass

class CustomerResponse(CustomerBase):
    customer_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


# ----- Staff Schemas -----
class StaffRoleEnum(str, Enum):
    Admin = "Admin"
    Manager = "Manager"
    Employee = "Employee"

class StaffStatusEnum(str, Enum):
    active = "active"
    inactive = "inactive"

class StaffBase(BaseModel):
    full_name: str
    email: EmailStr
    role: StaffRoleEnum = StaffRoleEnum.Employee
    phone_number: Optional[str] = None
    date_of_birth: Optional[date] = None
    salary: Optional[float] = 0.00
    shift_start_time: Optional[time] = None
    shift_end_time: Optional[time] = None
    address: Optional[str] = None
    additional_details: Optional[str] = None

class StaffCreate(StaffBase):
    password: str  # Plaintext password; you'll hash this in the endpoint

class StaffResponse(StaffBase):
    staff_id: int
    status: StaffStatusEnum
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


# ----- Store Schemas -----
class StoreBase(BaseModel):
    store_name: str
    location: Optional[str] = None
    contact_number: Optional[str] = None

class StoreCreate(StoreBase):
    manager_id: Optional[int] = None
    status: Optional[StaffStatusEnum] = StaffStatusEnum.active

class StoreResponse(StoreBase):
    store_id: int
    manager_id: Optional[int] = None
    status: StaffStatusEnum
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


# ----- Stock Schemas -----
class StockBase(BaseModel):
    store_id: int
    item_id: int
    quantity: Optional[int] = 0
    min_stock_level: Optional[int] = 5

class StockCreate(StockBase):
    pass

class StockResponse(StockBase):
    stock_id: int
    last_updated: datetime

    class Config:
        orm_mode = True



# ---------------
# Order Schemas
# ---------------
class OrderBase(BaseModel):
    staff_id: int
    store_id: int
    total_amount: Optional[float] = 0.00
    payment_status: Optional[str] = "pending"
    order_status: Optional[str] = "processing"
    customer_id: int

class OrderCreate(OrderBase):
    pass

class OrderResponse(OrderBase):
    order_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

# ---------------------
# OrderItem Schemas
# ---------------------
class OrderItemBase(BaseModel):
    order_id: int
    item_id: int
    quantity: Optional[int] = 1
    price: float

class OrderItemCreate(OrderItemBase):
    pass

class OrderItemResponse(OrderItemBase):
    order_item_id: int
    subtotal: float

    class Config:
        orm_mode = True

# ---------------------
# Payment Schemas
# ---------------------
class PaymentBase(BaseModel):
    order_id: int
    amount: float
    payment_method: Optional[str] = "cash"
    transaction_reference: Optional[str] = None

class PaymentCreate(PaymentBase):
    pass

class PaymentResponse(PaymentBase):
    payment_id: int
    payment_date: datetime

    class Config:
        orm_mode = True
