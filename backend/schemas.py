# schemas.py

from pydantic import BaseModel, EmailStr, validator, Field
from typing import Optional, List
from enum import Enum
from datetime import date, time, datetime
import enum as py_enum # Alias standard enum to avoid confusion

# ---------------------------
# Enumerations (Matching models.py, using str for FastAPI)
# ---------------------------
class CategoryStatusEnum(str, Enum):
    active = "active"
    inactive = "inactive"

class StaffRoleEnum(str, Enum):
    Admin = "Admin"
    Manager = "Manager"
    Employee = "Employee"

class StaffStatusEnum(str, Enum):
    active = "active"
    inactive = "inactive"

class StoreStatusEnum(str, Enum):
    active = "active"
    inactive = "inactive"

class PaymentStatusEnum(str, Enum):
    pending = "pending"
    paid = "paid"
    cancelled = "cancelled"
    partially_paid = "partially_paid"

class RefundStatusEnum(str, Enum):
    none = "none"
    pending = "pending"
    processed = "processed"

class AttendanceStatus(str, Enum):
    present = "present"
    absent = "absent"
    leave = "leave"

class DiscountTypeEnum(str, Enum):
    fixed_amount = "fixed_amount"
    percentage = "percentage"

class DiscountStatusEnum(str, Enum):
    active = "active"
    expired = "expired"
    inactive = "inactive"

class TaxStatusEnum(str, Enum):
    active = "active"
    inactive = "inactive"

class StockChangeTypeEnum(str, Enum):
    addition = "addition"
    removal = "removal"
    adjustment = "adjustment"
    initial = "initial"

class POStatusEnum(str, Enum):
    pending = "pending"
    shipped = "shipped"
    received = "received"
    cancelled = "cancelled"
    partially_received = "partially_received"

# ---------------------------
# Utility Validator
# ---------------------------
# Decorator to convert Python Enums to their string values in responses
enum_validator = validator('*', pre=True, allow_reuse=True)
def convert_enum_to_string(cls, v):
    if isinstance(v, py_enum.Enum):
        return v.value
    return v

# ---------------------------
# Role Schemas
# ---------------------------
class RoleBase(BaseModel):
    role_name: str = Field(..., max_length=50)

class RoleCreate(RoleBase):
    pass

class RoleResponse(RoleBase):
    role_id: int

    class Config:
        from_attributes = True

# ---------------------------
# Permission Schemas
# ---------------------------
class PermissionBase(BaseModel):
    permission_name: str = Field(..., max_length=100)

class PermissionCreate(PermissionBase):
    pass

class PermissionResponse(PermissionBase):
    permission_id: int

    class Config:
        from_attributes = True

# ---------------------------
# RolePermission Schemas
# ---------------------------
class RolePermissionBase(BaseModel):
    role_id: int
    permission_id: int

class RolePermissionCreate(RolePermissionBase):
    pass

class RolePermissionResponse(RolePermissionBase):
    role_permission_id: int

    class Config:
        from_attributes = True

# ---------------------------
# UserRole Schemas
# ---------------------------
class UserRoleBase(BaseModel):
    staff_id: int
    role_id: int

class UserRoleCreate(UserRoleBase):
    pass

class UserRoleResponse(UserRoleBase):
    user_role_id: int

    class Config:
        from_attributes = True

# ------------------------------
# Category Schemas
# ------------------------------
class CategoryBase(BaseModel):
    category_name: str = Field(..., max_length=100)
    description: Optional[str] = None
    status: CategoryStatusEnum = CategoryStatusEnum.active

class CategoryCreate(CategoryBase):
    pass

class CategoryResponse(CategoryBase):
    category_id: int
    created_at: datetime
    updated_at: datetime

    # Validator to convert Enums for response
    _enum_converter = enum_validator(convert_enum_to_string)

    class Config:
        from_attributes = True

# ---------------------------
# Item Schemas
# ---------------------------
class ItemBase(BaseModel):
    item_name: str = Field(..., max_length=150)
    category_id: Optional[int] = None
    price: Optional[float] = Field(None, ge=0) # Price >= 0
    cost_price: Optional[float] = Field(0.00, ge=0) # Cost >= 0
    barcode: Optional[str] = Field(None, max_length=50)
    is_perishable: Optional[bool] = False
    image_url: Optional[str] = Field(None, max_length=255)

class ItemCreate(ItemBase):
    pass

class ItemResponse(ItemBase):
    item_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Response schema for the GET /items/ endpoint including stock
class ItemWithStockResponse(ItemResponse):
    quantity: Optional[int] = None
    min_stock_level: Optional[int] = None # Added min_stock_level

    class Config:
        from_attributes = True

# ---------------------------
# Customer Schemas
# ---------------------------
class CustomerBase(BaseModel):
    full_name: str = Field(..., max_length=100)
    email: Optional[EmailStr] = Field(None, max_length=100)
    phone_number: Optional[str] = Field(None, max_length=20)
    street: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    zip_code: Optional[str] = Field(None, max_length=20)
    loyalty_points: Optional[int] = Field(0, ge=0) # Points >= 0

class CustomerCreate(CustomerBase):
    pass

class CustomerResponse(CustomerBase):
    customer_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ---------------------------
# Staff Schemas
# ---------------------------
class StaffBase(BaseModel):
    full_name: str = Field(..., max_length=100)
    email: EmailStr = Field(..., max_length=100)
    role: StaffRoleEnum = StaffRoleEnum.Employee
    is_manager: Optional[bool] = False
    phone_number: Optional[str] = Field(None, max_length=20)
    date_of_birth: Optional[date] = None
    salary: Optional[float] = Field(0.00, ge=0) # Salary >= 0
    shift_start_time: Optional[time] = None
    shift_end_time: Optional[time] = None
    street: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    zip_code: Optional[str] = Field(None, max_length=20)
    additional_details: Optional[str] = None
    status: StaffStatusEnum = StaffStatusEnum.active

class StaffCreate(StaffBase):
    password: str # Required on creation

class StaffUpdate(BaseModel): # Separate schema for update, all fields optional
    full_name: Optional[str] = Field(None, max_length=100)
    email: Optional[EmailStr] = Field(None, max_length=100)
    role: Optional[StaffRoleEnum] = None
    is_manager: Optional[bool] = None
    phone_number: Optional[str] = Field(None, max_length=20)
    date_of_birth: Optional[date] = None
    salary: Optional[float] = Field(None, ge=0)
    shift_start_time: Optional[time] = None
    shift_end_time: Optional[time] = None
    street: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    zip_code: Optional[str] = Field(None, max_length=20)
    additional_details: Optional[str] = None
    status: Optional[StaffStatusEnum] = None
    password: Optional[str] = None # Optional on update

class StaffResponse(StaffBase):
    staff_id: int
    created_at: datetime
    updated_at: datetime
    # Note: password_hash is deliberately excluded from response

    # Validator to convert Enums for response
    _enum_converter = enum_validator(convert_enum_to_string)

    class Config:
        from_attributes = True

# ---------------------------
# Store Schemas
# ---------------------------
class StoreBase(BaseModel):
    store_name: str = Field(..., max_length=100)
    street: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    zip_code: Optional[str] = Field(None, max_length=20)
    contact_number: Optional[str] = Field(None, max_length=20)
    status: StoreStatusEnum = StoreStatusEnum.active

class StoreCreate(StoreBase):
    manager_id: Optional[int] = None

class StoreResponse(StoreBase):
    store_id: int
    manager_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    # Validator to convert Enums for response
    _enum_converter = enum_validator(convert_enum_to_string)

    class Config:
        from_attributes = True

# ---------------------------
# Stock Schemas
# ---------------------------
class StockBase(BaseModel):
    store_id: int
    item_id: int
    quantity: int = Field(0, ge=0) # Quantity cannot be negative
    cost: Optional[float] = Field(0.00, ge=0)
    min_stock_level: int = Field(5, ge=0)
    location: Optional[str] = Field(None, max_length=255)
    measurement_unit: Optional[str] = Field(None, max_length=50)
    batch_number: Optional[str] = Field(None, max_length=50)
    manufacture_date: Optional[date] = None
    expiry_date: Optional[date] = None

class StockCreate(StockBase):
    pass

class StockResponse(StockBase):
    stock_id: int
    last_updated: datetime

    class Config:
        from_attributes = True

# ---------------------------
# Sales Schemas
# ---------------------------
class SalesBase(BaseModel):
    # Fields typically required when *creating* a sale context initially
    staff_id: int
    store_id: int
    customer_id: Optional[int] = None

class SalesCreate(SalesBase):
    # Inherits fields from SalesBase, used in ProcessSalePayload
    pass

class SalesUpdate(BaseModel): # For updating existing sales
    payment_status: Optional[PaymentStatusEnum] = None
    receipt_number: Optional[str] = Field(None, max_length=50)
    refund_amount: Optional[float] = Field(None, ge=0)
    refund_status: Optional[RefundStatusEnum] = None
    # Add other updatable fields if needed (e.g., customer_id)
    customer_id: Optional[int] = None

class SalesResponse(SalesBase): # Shows state after creation/retrieval
    sale_id: int
    sale_date: datetime
    total_amount: float = Field(0.00) # Should reflect final calculated amount
    payment_status: PaymentStatusEnum = PaymentStatusEnum.pending
    receipt_number: Optional[str] = None
    refund_amount: Optional[float] = Field(0.00)
    refund_status: Optional[RefundStatusEnum] = RefundStatusEnum.none
    created_at: datetime
    updated_at: datetime
    # Optional related data (populate in endpoint if needed, ensure corresponding schemas exist)
    # sale_items: List['SaleItemResponse'] = []
    # payments: List['SplitPaymentResponse'] = []

    # Validator to convert Enums for response
    _enum_converter = enum_validator(convert_enum_to_string)

    class Config:
        from_attributes = True

# ---------------------------
# SaleItem Schemas
# ---------------------------
class SaleItemBase(BaseModel): # Used in ProcessSalePayload
    item_id: int
    quantity: int = Field(..., gt=0) # Quantity must be at least 1
    unit_price: Optional[float] = Field(None, ge=0) # Price must be non-negative
    discount: Optional[float] = Field(0.00, ge=0)
    tax: Optional[float] = Field(0.00, ge=0)

class SaleItemCreate(SaleItemBase): # Used for direct POST /sale_items/
    sale_id: int # Required when creating individually

class SaleItemResponse(SaleItemBase):
    sale_item_id: int
    sale_id: int
    unit_price: float # Should be non-optional in response
    subtotal: Optional[float] = None # Add if needed, or rely on calculation

    class Config:
        from_attributes = True

# ---------------------------
# PaymentMethod Schemas
# ---------------------------
class PaymentMethodBase(BaseModel):
    payment_method_name: str = Field(..., max_length=100)
    # Consider adding is_active if needed
    # is_active: bool = True

class PaymentMethodCreate(PaymentMethodBase):
    pass

class PaymentMethodResponse(PaymentMethodBase):
    payment_method_id: int

    class Config:
        from_attributes = True

# ---------------------------
# SplitPayment Schemas
# ---------------------------
class SplitPaymentBase(BaseModel):
    amount: float = Field(..., gt=0) # Amount must be positive
    payment_method_id: int
    transaction_reference: Optional[str] = Field(None, max_length=255)

class SplitPaymentCreate(SplitPaymentBase):
    sale_id: int # Required when creating individually

class SplitPaymentResponse(SplitPaymentBase):
    split_payment_id: int
    sale_id: int
    payment_date: datetime

    class Config:
        from_attributes = True

# ---------------------------
# Payment Schemas (Legacy/Direct - used in current ProcessSalePayload)
# ---------------------------
class PaymentBase(BaseModel):
    # sale_id: Optional[int] = None # Not usually needed in payload list
    amount: float = Field(..., gt=0)
    payment_method_id: int
    transaction_reference: Optional[str] = Field(None, max_length=255)

class PaymentCreate(PaymentBase):
    pass # No extra fields needed for creation payload

class PaymentResponse(PaymentBase):
    payment_id: int
    sale_id: int # Include sale_id in response
    payment_date: datetime

    class Config:
        from_attributes = True

# ---------------------------
# Attendance Schemas
# ---------------------------
class AttendanceBase(BaseModel):
    staff_id: int
    store_id: int
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    status: AttendanceStatus = AttendanceStatus.present
    remarks: Optional[str] = None

class AttendanceCreate(AttendanceBase):
    pass

class AttendanceResponse(AttendanceBase):
    attendance_id: int
    # total_hours: Optional[float] = None # Computed property might not map directly
    created_at: datetime

    # Validator to convert Enums for response
    _enum_converter = enum_validator(convert_enum_to_string)

    class Config:
        from_attributes = True

# ---------------------------
# SalesReport Schemas (Check if this table is actually used/populated)
# ---------------------------
class SalesReportBase(BaseModel):
    store_id: int
    report_date: date
    total_sales: float = 0.00
    total_orders: int = 0
    top_item_id: Optional[int] = None

class SalesReportCreate(SalesReportBase):
    pass

class SalesReportResponse(SalesReportBase):
    report_id: int
    created_at: datetime

    class Config:
        from_attributes = True

# ---------------------------
# SalesReportItem Schemas (Check if used)
# ---------------------------
class SalesReportItemBase(BaseModel):
    report_id: int
    item_id: int
    quantity_sold: int = Field(..., gt=0)
    total_revenue: float = Field(..., ge=0) # Renamed from unit_price

class SalesReportItemCreate(SalesReportItemBase):
    pass

class SalesReportItemResponse(SalesReportItemBase):
    sales_report_item_id: int

    class Config:
        from_attributes = True

# ---------------------------
# Discount Schemas
# ---------------------------
class DiscountBase(BaseModel):
    discount_name: str = Field(..., max_length=100)
    discount_type: DiscountTypeEnum
    discount_value: float = Field(..., ge=0) # Value must be non-negative
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: DiscountStatusEnum = DiscountStatusEnum.active

class DiscountCreate(DiscountBase):
    pass

class DiscountResponse(DiscountBase):
    discount_id: int

    # Validator to convert Enums for response
    _enum_converter = enum_validator(convert_enum_to_string)

    class Config:
        from_attributes = True

# ---------------------------
# Tax Schemas
# ---------------------------
class TaxBase(BaseModel):
    tax_name: str = Field(..., max_length=100)
    tax_percentage: float = Field(..., ge=0) # Percentage >= 0
    status: TaxStatusEnum = TaxStatusEnum.active

class TaxCreate(TaxBase):
    pass

class TaxResponse(TaxBase):
    tax_id: int

    # Validator to convert Enums for response
    _enum_converter = enum_validator(convert_enum_to_string)

    class Config:
        from_attributes = True

# ---------------------------
# AuditLog Schemas
# ---------------------------
class AuditLogBase(BaseModel):
    staff_id: Optional[int] = None
    action: str = Field(..., max_length=255)
    table_name: Optional[str] = Field(None, max_length=100)
    record_id: Optional[int] = None
    old_values: Optional[str] = None # Consider Json type if needed
    new_values: Optional[str] = None # Consider Json type if needed

class AuditLogCreate(AuditLogBase):
    pass

class AuditLogResponse(AuditLogBase):
    log_id: int
    timestamp: datetime

    class Config:
        from_attributes = True

# ---------------------------
# StockHistory Schemas
# ---------------------------
class StockHistoryBase(BaseModel):
    stock_id: int
    quantity_change: int # Can be positive or negative
    change_type: StockChangeTypeEnum
    reason: Optional[str] = None
    related_sale_id: Optional[int] = None
    related_po_id: Optional[int] = None

class StockHistoryCreate(StockHistoryBase):
    pass

class StockHistoryResponse(StockHistoryBase):
    history_id: int
    change_date: datetime

    # Validator to convert Enums for response
    _enum_converter = enum_validator(convert_enum_to_string)

    class Config:
        from_attributes = True

# ---------------------------
# DiscountsApplied Schemas
# ---------------------------
class DiscountsAppliedBase(BaseModel):
    sale_id: int
    discount_id: int
    discount_amount: float = Field(..., ge=0)

class DiscountsAppliedCreate(DiscountsAppliedBase):
    pass

class DiscountsAppliedResponse(DiscountsAppliedBase):
    discount_applied_id: int

    class Config:
        from_attributes = True

# ---------------------------
# TaxesApplied Schemas
# ---------------------------
class TaxesAppliedBase(BaseModel):
    sale_id: int
    tax_id: int
    tax_amount: float = Field(..., ge=0)

class TaxesAppliedCreate(TaxesAppliedBase):
    pass

class TaxesAppliedResponse(TaxesAppliedBase):
    tax_applied_id: int

    class Config:
        from_attributes = True

# ---------------------------
# Supplier Schemas
# ---------------------------
class SupplierBase(BaseModel):
    supplier_name: str = Field(..., max_length=100)
    contact_person: Optional[str] = Field(None, max_length=100)
    contact_info: Optional[str] = Field(None, max_length=255)
    address: Optional[str] = None
    # Consider adding is_active if needed
    # is_active: bool = True

class SupplierCreate(SupplierBase):
    pass

class SupplierResponse(SupplierBase):
    supplier_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ---------------------------
# PurchaseOrder Schemas
# ---------------------------
class PurchaseOrderBase(BaseModel):
    supplier_id: int
    store_id: int
    order_date: Optional[date] = None # Can default in backend
    expected_delivery_date: Optional[date] = None
    status: POStatusEnum = POStatusEnum.pending
    notes: Optional[str] = None
    # total_cost might be calculated, not part of base create

class PurchaseOrderCreate(PurchaseOrderBase):
    pass

class PurchaseOrderResponse(PurchaseOrderBase):
    purchase_order_id: int
    total_cost: float = Field(0.00) # Include calculated cost in response
    created_at: datetime
    updated_at: datetime
    # Optional related data
    # items: List['PurchaseOrderItemResponse'] = []

    # Validator to convert Enums for response
    _enum_converter = enum_validator(convert_enum_to_string)

    class Config:
        from_attributes = True

# ---------------------------
# PurchaseOrderItem Schemas
# ---------------------------
class PurchaseOrderItemBase(BaseModel):
    item_id: int
    quantity_ordered: int = Field(..., gt=0) # Renamed and must be > 0
    unit_price: float = Field(..., ge=0) # Cost price >= 0
    measurement_unit: Optional[str] = Field(None, max_length=50)

class PurchaseOrderItemCreate(PurchaseOrderItemBase):
    purchase_order_id: int # Required when creating individually

class PurchaseOrderItemResponse(PurchaseOrderItemBase):
    purchase_order_item_id: int
    purchase_order_id: int
    quantity_received: int = Field(0, ge=0) # Include received quantity

    class Config:
        from_attributes = True

# ---------------------------
# Special Payload Schemas
# ---------------------------
class ProcessSalePayload(BaseModel):
    sale_data: SalesCreate
    sale_items: List[SaleItemBase] # Items don't have sale_id yet
    payments_data: List[PaymentCreate] # List of payments made

    class Config:
        from_attributes = True # Not strictly needed for payload, but harmless

class LoginSchema(BaseModel):
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    token: str
    staff_id: int
    role: str # Send enum value as string
    full_name: str
    is_manager: bool

    class Config:
        from_attributes = True # Map from Staff object

# --- Dashboard Specific Response Schemas ---
class LowStockItemResponse(BaseModel):
    item_name: str
    store_name: str
    quantity: int
    min_stock_level: int

    class Config:
        from_attributes = True

class RecentSaleResponse(BaseModel):
    sale_id: int
    created_at: str # Keep as string as it's pre-formatted
    total_amount: float
    payment_status: str # Send enum value as string
    staff_name: Optional[str] = None
    customer_id: Optional[int] = None
    # Optional: add customer_name if needed
    # customer_name: Optional[str] = None

    class Config:
        from_attributes = True