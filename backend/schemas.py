# schemas.py

from pydantic import BaseModel, EmailStr, validator
from typing import Optional, List
from enum import Enum
from datetime import date, time, datetime
import enum # Keep this import

# ---------------------------
# Enumerations
# ---------------------------
# (Keep existing Enums: StaffRoleEnum, StaffStatusEnum, StoreStatusEnum, CategoryStatusEnum, PaymentStatusEnum, RefundStatusEnum, TaxStatusEnum)
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

class CategoryStatusEnum(str, Enum):
    active = "active"
    inactive = "inactive"

class PaymentStatusEnum(str, Enum):
    pending = "pending"
    paid = "paid"
    cancelled = "cancelled"
    # Consider adding: partially_paid, refunded, partially_refunded

class RefundStatusEnum(str, Enum):
    none = "none"
    pending = "pending"
    processed = "processed"

class TaxStatusEnum(str, Enum):
    active = "active"
    inactive = "inactive"

# Consider adding enums for DiscountType, DiscountStatus, AttendanceStatus, PO Status, Stock History Change Type if not already defined elsewhere or if you want stricter typing here.
class DiscountTypeEnum(str, Enum):
    fixed_amount = "fixed_amount"
    percentage = "percentage"

class DiscountStatusEnum(str, Enum):
    active = "active"
    expired = "expired"
    inactive = "inactive" # Added inactive

class ChangeTypeEnum(str, Enum):
    addition = "addition"
    removal = "removal"
    adjustment = "adjustment"

class POStatusEnum(str, Enum):
    pending = "pending"
    shipped = "shipped"
    received = "received"
    cancelled = "cancelled"


# ---------------------------
# Role Schemas
# ---------------------------
class RoleBase(BaseModel):
    role_name: str

class RoleCreate(RoleBase):
    pass

class RoleResponse(RoleBase):
    role_id: int

    class Config:
        orm_mode = True


# ---------------------------
# Permission Schemas
# ---------------------------
class PermissionBase(BaseModel):
    permission_name: str

class PermissionCreate(PermissionBase):
    pass

class PermissionResponse(PermissionBase):
    permission_id: int

    class Config:
        orm_mode = True

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
        orm_mode = True

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
        orm_mode = True

# ------------------------------
# Category Schemas
# ------------------------------
class CategoryBase(BaseModel):
    category_name: str
    description: Optional[str] = None
    status: Optional[CategoryStatusEnum] = CategoryStatusEnum.active

class CategoryCreate(CategoryBase):
    pass

class CategoryResponse(CategoryBase):
    category_id: int
    created_at: datetime
    updated_at: datetime

    @validator("status", pre=True, always=True)
    def convert_category_status(cls, v):
        if isinstance(v, enum.Enum):
            return v.value
        return v

    class Config:
        orm_mode = True

# ---------------------------
# Item Schemas
# ---------------------------
class ItemBase(BaseModel):
    item_name: str
    category_id: Optional[int] = None # Make required? Or handle null in backend
    price: Optional[float] = None # Allow null, handle in backend if required
    cost_price: Optional[float] = 0.00
    barcode: Optional[str] = None
    is_perishable: Optional[bool] = False
    image_url: Optional[str] = None

class ItemCreate(ItemBase):
    pass

class ItemResponse(ItemBase):
    item_id: int
    created_at: datetime
    updated_at: datetime
    # Optionally include category name
    # category_name: Optional[str] = None # Populate this in the endpoint if needed

    class Config:
        orm_mode = True


# ---------------------------
# Customer Schemas
# ---------------------------
class CustomerBase(BaseModel):
    full_name: str
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = None
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    loyalty_points: Optional[int] = 0

class CustomerCreate(CustomerBase):
    pass

class CustomerResponse(CustomerBase):
    customer_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


# ---------------------------
# Staff Schemas
# ---------------------------
class StaffBase(BaseModel):
    full_name: str
    email: EmailStr
    role: StaffRoleEnum = StaffRoleEnum.Employee
    is_manager: Optional[bool] = False
    phone_number: Optional[str] = None
    date_of_birth: Optional[date] = None
    salary: Optional[float] = 0.00
    shift_start_time: Optional[time] = None
    shift_end_time: Optional[time] = None
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    additional_details: Optional[str] = None
    status: Optional[StaffStatusEnum] = StaffStatusEnum.active # Added status here

class StaffCreate(StaffBase):
    password: str # Plaintext password for creation

class StaffUpdate(StaffBase): # Inherit from StaffBase which has most fields
    email: Optional[EmailStr] = None # Make email optional too for partial updates
    full_name: Optional[str] = None # Make others optional if you want partial updates
    role: Optional[StaffRoleEnum] = None
    is_manager: Optional[bool] = None
    phone_number: Optional[str] = None
    date_of_birth: Optional[date] = None
    salary: Optional[float] = None
    shift_start_time: Optional[time] = None
    shift_end_time: Optional[time] = None
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    additional_details: Optional[str] = None
    status: Optional[StaffStatusEnum] = None # Allow updating status

    password: Optional[str] = None # <<< Password is now optional

    class Config:
        orm_mode = True

class StaffResponse(StaffBase):
    staff_id: int
    # status: StaffStatusEnum # Already included in StaffBase now
    created_at: datetime
    updated_at: datetime

    @validator("role", "status", pre=True, always=True)
    def convert_enums(cls, v):
        if isinstance(v, enum.Enum):
            return v.value
        return v

    class Config:
        orm_mode = True


# ---------------------------
# Store Schemas
# ---------------------------
class StoreBase(BaseModel):
    store_name: str
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    contact_number: Optional[str] = None
    status: Optional[StoreStatusEnum] = StoreStatusEnum.active # Added status here

class StoreCreate(StoreBase):
    manager_id: Optional[int] = None

class StoreResponse(StoreBase):
    store_id: int
    manager_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    # manager_name: Optional[str] = None # Populate in endpoint if needed

    @validator("status", pre=True, always=True)
    def convert_store_status(cls, v):
        if isinstance(v, enum.Enum):
            return v.value
        return v

    class Config:
        orm_mode = True


# ---------------------------
# Stock Schemas
# ---------------------------
class StockBase(BaseModel):
    store_id: int
    item_id: int
    quantity: Optional[int] = 0
    cost: Optional[float] = 0.00 # Maybe rename to average_cost_price?
    min_stock_level: Optional[int] = 5
    location: Optional[str] = None
    measurement_unit: Optional[str] = None
    batch_number: Optional[str] = None
    manufacture_date: Optional[date] = None
    expiry_date: Optional[date] = None

class StockCreate(StockBase):
    pass

class StockResponse(StockBase):
    stock_id: int
    last_updated: datetime
    # item_name: Optional[str] = None # Populate in endpoint
    # store_name: Optional[str] = None # Populate in endpoint

    class Config:
        orm_mode = True

# ---------------------------
# Sales Schemas
# ---------------------------
class SalesBase(BaseModel):
    staff_id: int
    store_id: int
    customer_id: Optional[int] = None
    # Fields calculated during process_sale, optional here
    total_amount: Optional[float] = None
    payment_status: Optional[PaymentStatusEnum] = None
    receipt_number: Optional[str] = None
    refund_amount: Optional[float] = 0.00
    refund_status: Optional[RefundStatusEnum] = RefundStatusEnum.none
    # Add fields if you want them settable during creation explicitly
    # cash_received: Optional[float] = None # Example

class SalesCreate(SalesBase):
    # Used primarily by process_sale endpoint now
    pass

class SalesResponse(SalesBase):
    sale_id: int
    sale_date: datetime # This is set by server_default=func.now() on creation
    created_at: datetime
    updated_at: datetime
    # Explicitly define the fields calculated/set by the backend
    total_amount: Optional[float] = 0.00 # Override base
    payment_status: Optional[PaymentStatusEnum] = PaymentStatusEnum.pending # Override base

    # Optional related data (populate in endpoint if needed)
    # sale_items: Optional[List['SaleItemResponse']] = []
    # payments: Optional[List['SplitPaymentResponse']] = [] # Use SplitPaymentResponse
    # staff_name: Optional[str] = None
    # customer_name: Optional[str] = None
    # store_name: Optional[str] = None

    @validator("payment_status", "refund_status", pre=True, always=True)
    def convert_sale_enums(cls, v):
        if isinstance(v, enum.Enum):
            return v.value
        return v

    class Config:
        orm_mode = True

class SalesUpdate(BaseModel): # Schema for updating existing sales (e.g., status, refund)
    payment_status: Optional[PaymentStatusEnum] = None
    receipt_number: Optional[str] = None
    refund_amount: Optional[float] = None
    refund_status: Optional[RefundStatusEnum] = None
    # Add other fields if update is allowed, e.g., customer_id

    class Config:
        orm_mode = True


# ---------------------------
# SaleItem Schemas
# ---------------------------
class SaleItemBase(BaseModel):
    # Removed sale_id, usually set contextually
    item_id: int
    quantity: int = 1
    unit_price: Optional[float] = None # Price can come from Item or be overridden
    discount: Optional[float] = 0.00
    tax: Optional[float] = 0.00

class SaleItemCreate(SaleItemBase):
    # Used within process_sale payload
    pass

class SaleItemResponse(SaleItemBase):
    sale_item_id: int
    sale_id: int # Include sale_id in response
    unit_price: float # Make non-optional in response
    subtotal: float # The computed value from the model

    # Optionally include item name
    # item_name: Optional[str] = None

    class Config:
        orm_mode = True


# ---------------------------
# PaymentMethod Schemas
# ---------------------------
class PaymentMethodBase(BaseModel):
    payment_method_name: str
    is_active: Optional[bool] = True # Added active flag

class PaymentMethodCreate(PaymentMethodBase):
    pass

class PaymentMethodResponse(PaymentMethodBase):
    payment_method_id: int

    class Config:
        orm_mode = True


# ---------------------------
# SplitPayment Schemas (Used for recording actual payment parts)
# ---------------------------
class SplitPaymentBase(BaseModel):
    # sale_id is context, amount/method required
    amount: float
    payment_method_id: int
    transaction_reference: Optional[str] = None

class SplitPaymentCreate(SplitPaymentBase):
    # Used when adding payment after initial sale, requires sale_id
    sale_id: int

class SplitPaymentResponse(SplitPaymentBase):
    split_payment_id: int
    sale_id: int # Include sale_id in response
    payment_date: datetime
    # payment_method_name: Optional[str] = None # Populate in endpoint

    class Config:
        orm_mode = True

# Note: The old Payment schema might be deprecated if SplitPayment handles everything
# If kept, it should be clarified what it represents (e.g., maybe a summary?)
class PaymentBase(BaseModel): # Legacy or Summary?
    sale_id: int
    amount: float
    payment_method_id: int # Or maybe just payment_method_name?
    transaction_reference: Optional[str] = None

class PaymentCreate(PaymentBase):
     # Used for the list in process_sale endpoint (sale_id not needed there)
     sale_id: Optional[int] = None # Made optional here

class PaymentResponse(PaymentBase):
    payment_id: int
    payment_date: datetime

    class Config:
        orm_mode = True


# ---------------------------
# Attendance Schemas
# ---------------------------
class AttendanceBase(BaseModel):
    staff_id: int
    store_id: int
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    status: Optional[str] = "present" # TODO: Use Enum? e.g., AttendanceStatusEnum
    remarks: Optional[str] = None

class AttendanceCreate(AttendanceBase):
    pass

class AttendanceResponse(AttendanceBase):
    attendance_id: int
    total_hours: Optional[float] = None # Computed
    created_at: datetime
    # staff_name: Optional[str] = None # Populate in endpoint
    # store_name: Optional[str] = None # Populate in endpoint

    class Config:
        orm_mode = True


# ---------------------------
# SalesReport Schemas
# ---------------------------
class SalesReportBase(BaseModel):
    store_id: int
    report_date: date
    total_sales: Optional[float] = 0.00
    total_orders: Optional[int] = 0
    top_item_id: Optional[int] = None

class SalesReportCreate(SalesReportBase):
    pass

class SalesReportResponse(SalesReportBase):
    report_id: int
    created_at: datetime
    # top_item_name: Optional[str] = None # Populate in endpoint
    # store_name: Optional[str] = None # Populate in endpoint

    class Config:
        orm_mode = True

# ---------------------------
# SalesReportItem Schemas
# ---------------------------
class SalesReportItemBase(BaseModel):
    report_id: int
    item_id: int
    quantity_sold: int
    unit_price: float # Price at the time of sale for the report?

class SalesReportItemCreate(SalesReportItemBase):
    pass

class SalesReportItemResponse(SalesReportItemBase):
    sales_report_item_id: int
    # item_name: Optional[str] = None # Populate in endpoint

    class Config:
        orm_mode = True

# ---------------------------
# Discount Schemas
# ---------------------------
class DiscountBase(BaseModel):
    discount_name: str
    discount_type: DiscountTypeEnum # Use Enum
    discount_value: float
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[DiscountStatusEnum] = DiscountStatusEnum.active # Use Enum

class DiscountCreate(DiscountBase):
    pass

class DiscountResponse(DiscountBase):
    discount_id: int

    @validator("discount_type", "status", pre=True, always=True)
    def convert_discount_enums(cls, v):
        if isinstance(v, enum.Enum):
            return v.value
        return v

    class Config:
        orm_mode = True


# ---------------------------
# Tax Schemas
# ---------------------------
class TaxBase(BaseModel):
    tax_name: str
    tax_percentage: float
    status: Optional[TaxStatusEnum] = TaxStatusEnum.active # Enum already defined

class TaxCreate(TaxBase):
    pass

class TaxResponse(TaxBase):
    tax_id: int

    @validator("status", pre=True, always=True)
    def convert_tax_status(cls, v):
        if isinstance(v, enum.Enum):
            return v.value
        return v

    class Config:
        orm_mode = True


# ---------------------------
# AuditLog Schemas
# ---------------------------
class AuditLogBase(BaseModel):
    staff_id: Optional[int] = None # User who performed the action
    action: str # e.g., CREATE, UPDATE, DELETE, LOGIN_SUCCESS, LOGIN_FAIL
    table_name: Optional[str] = None # Table affected
    record_id: Optional[int] = None # ID of the record affected
    old_values: Optional[str] = None # JSON string?
    new_values: Optional[str] = None # JSON string?
    details: Optional[str] = None # Added general details field

class AuditLogCreate(AuditLogBase):
    pass

class AuditLogResponse(AuditLogBase):
    log_id: int
    timestamp: datetime
    # staff_name: Optional[str] = None # Populate in endpoint

    class Config:
        orm_mode = True


# ---------------------------
# StockHistory Schemas
# ---------------------------
class StockHistoryBase(BaseModel):
    stock_id: int
    quantity_change: int
    change_type: ChangeTypeEnum # Use Enum
    reason: Optional[str] = None # e.g., "Sale ID: 123", "PO Received: 45", "Manual Adjustment", "Stock Count Correction"

class StockHistoryCreate(StockHistoryBase):
    pass

class StockHistoryResponse(StockHistoryBase):
    history_id: int
    change_date: datetime
    # item_name: Optional[str] = None # Populate in endpoint
    # store_name: Optional[str] = None # Populate in endpoint

    @validator("change_type", pre=True, always=True)
    def convert_change_type(cls, v):
        if isinstance(v, enum.Enum):
            return v.value
        return v

    class Config:
        orm_mode = True


# ---------------------------
# DiscountsApplied Schemas
# ---------------------------
class DiscountsAppliedBase(BaseModel):
    sale_id: int
    discount_id: int
    discount_amount: float

class DiscountsAppliedCreate(DiscountsAppliedBase):
    pass

class DiscountsAppliedResponse(DiscountsAppliedBase):
    discount_applied_id: int
    # discount_name: Optional[str] = None # Populate in endpoint

    class Config:
        orm_mode = True


# ---------------------------
# TaxesApplied Schemas
# ---------------------------
class TaxesAppliedBase(BaseModel):
    sale_id: int
    tax_id: int
    tax_amount: float

class TaxesAppliedCreate(TaxesAppliedBase):
    pass

class TaxesAppliedResponse(TaxesAppliedBase):
    tax_applied_id: int
    # tax_name: Optional[str] = None # Populate in endpoint

    class Config:
        orm_mode = True

# ---------------------------
# Supplier Schemas
# ---------------------------
class SupplierBase(BaseModel):
    supplier_name: str
    contact_info: Optional[str] = None
    address: Optional[str] = None
    is_active: Optional[bool] = True # Added active flag

class SupplierCreate(SupplierBase):
    pass

class SupplierResponse(SupplierBase):
    supplier_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


# ---------------------------
# PurchaseOrder Schemas
# ---------------------------
class PurchaseOrderBase(BaseModel):
    supplier_id: int
    store_id: int
    order_date: Optional[date] = None
    expected_delivery_date: Optional[date] = None
    status: Optional[POStatusEnum] = POStatusEnum.pending # Use Enum
    notes: Optional[str] = None # Added notes field

class PurchaseOrderCreate(PurchaseOrderBase):
    pass

class PurchaseOrderResponse(PurchaseOrderBase):
    purchase_order_id: int
    created_at: datetime
    updated_at: datetime
    # supplier_name: Optional[str] = None # Populate in endpoint
    # store_name: Optional[str] = None # Populate in endpoint
    # items: Optional[List['PurchaseOrderItemResponse']] = [] # Populate in endpoint

    @validator("status", pre=True, always=True)
    def convert_po_status(cls, v):
        if isinstance(v, enum.Enum):
            return v.value
        return v

    class Config:
        orm_mode = True


# ---------------------------
# PurchaseOrderItem Schemas
# ---------------------------
class PurchaseOrderItemBase(BaseModel):
    # purchase_order_id is context
    item_id: int
    quantity: int
    unit_price: float # Cost price from supplier for this PO
    measurement_unit: Optional[str] = None

class PurchaseOrderItemCreate(PurchaseOrderItemBase):
    # Used when creating items for a specific PO
    purchase_order_id: int

class PurchaseOrderItemResponse(PurchaseOrderItemBase):
    purchase_order_item_id: int
    purchase_order_id: int # Include PO id in response
    created_at: datetime
    updated_at: datetime
    # item_name: Optional[str] = None # Populate in endpoint

    class Config:
        orm_mode = True


# --- NEW Schemas for Dashboard Endpoints (Added at the end) ---

class LowStockItemResponse(BaseModel):
    item_name: str
    store_name: str
    quantity: int
    min_stock_level: int

    class Config:
        orm_mode = True # Good practice

class RecentSaleResponse(BaseModel):
    sale_id: int
    created_at: str # Keep as string since we format it in the endpoint
    total_amount: float
    payment_status: str # Keep as string (enum value)
    staff_name: Optional[str] = None # Mark as optional if staff might be deleted/null
    customer_id: Optional[int] = None # Customer is optional on sales

    class Config:
        orm_mode = True