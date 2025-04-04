# --- Existing Imports ---
from fastapi import FastAPI, HTTPException, Depends, status, Query
from sqlalchemy.orm import Session, joinedload # Added joinedload
from typing import List, Optional
import bcrypt
import io
from fastapi.responses import StreamingResponse
from weasyprint import HTML
from sqlalchemy import func, desc, and_ # Added desc, and_
from datetime import date, datetime, timedelta # Added timedelta, datetime (ensure date is also present)

from database import engine, SessionLocal
from models import (
    Base, Role, Permission, Category, Item, Customer, Staff, Store, Stock,
    Sales, SaleItem, Payment, RolePermission, UserRole, Attendance, SalesReport,
    Discount, Tax, AuditLog, PaymentMethod, SplitPayment, StockHistory,
    DiscountsApplied, TaxesApplied, SalesReportItem, Supplier,
    PurchaseOrder, PurchaseOrderItem
)
from schemas import (
    RoleCreate, RoleResponse,
    PermissionCreate, PermissionResponse,
    CategoryCreate, CategoryResponse,
    ItemCreate, ItemResponse,
    CustomerCreate, CustomerResponse,
    StaffCreate, StaffResponse, StaffUpdate,
    StoreCreate, StoreResponse,
    StockCreate, StockResponse,
    SalesCreate, SalesResponse, SalesUpdate,
    SaleItemCreate, SaleItemResponse,
    PaymentCreate, PaymentResponse,
    RolePermissionCreate, RolePermissionResponse,
    UserRoleCreate, UserRoleResponse,
    AttendanceCreate, AttendanceResponse,
    SalesReportCreate, SalesReportResponse,
    DiscountCreate, DiscountResponse,
    TaxCreate, TaxResponse,
    AuditLogCreate, AuditLogResponse,
    PaymentMethodCreate, PaymentMethodResponse,
    SplitPaymentCreate, SplitPaymentResponse,
    StockHistoryCreate, StockHistoryResponse,
    DiscountsAppliedCreate, DiscountsAppliedResponse,
    TaxesAppliedCreate, TaxesAppliedResponse,
    SalesReportItemCreate, SalesReportItemResponse,
    SupplierCreate, SupplierResponse,
    PurchaseOrderCreate, PurchaseOrderResponse,
    PurchaseOrderItemCreate, PurchaseOrderItemResponse, 
    LowStockItemResponse, RecentSaleResponse
)
import jwt # Moved JWT import higher for consistency
from pydantic import BaseModel, EmailStr # Moved Pydantic import higher

# --- Constants ---
SECRET_KEY = "b6f4e3d2c1a8f7e9d0c3b2a1f8e7d6c5" # Keep secret management in mind for production
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Create tables (for development purposes)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="POS System API")

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- NEW: Low Stock Items ---
# CHANGE response_model here
@app.get("/stock/low", response_model=List[LowStockItemResponse])
def get_low_stock_items(limit: int = Query(10, ge=1, le=50), db: Session = Depends(get_db)):
    low_stock = db.query(
        Item.item_name,
        Stock.quantity,
        Stock.min_stock_level,
        Store.store_name # Include store name
    ).select_from(Stock)\
    .join(Item, Stock.item_id == Item.item_id)\
    .join(Store, Stock.store_id == Store.store_id) \
    .filter(Stock.quantity < Stock.min_stock_level)\
    .order_by(Stock.quantity.asc())\
    .limit(limit)\
    .all()

    # The return structure already matches LowStockItemResponse
    return [
        {
            "item_name": item.item_name,
            "store_name": item.store_name,
            "quantity": item.quantity,
            "min_stock_level": item.min_stock_level
        } for item in low_stock
    ]

# --- NEW: Recent Sales ---
@app.get("/sales/recent", response_model=List[RecentSaleResponse])
def get_recent_sales(limit: int = Query(5, ge=1, le=20), db: Session = Depends(get_db)):
    # Use parentheses for the query chain instead of backslashes
    recent_sales = (
        db.query(
            Sales.sale_id,
            Sales.created_at,
            Sales.total_amount,
            Sales.payment_status,
            Sales.customer_id, # Keep customer_id
            Staff.full_name.label("staff_name") # Join Staff for name
        )
        .join(Staff, Sales.staff_id == Staff.staff_id, isouter=True) # Use outer join in case staff deleted
        .order_by(Sales.created_at.desc()) # Indentation here should be consistent (e.g., 8 spaces)
        .limit(limit)
        .all()
    ) # Closing parenthesis for the query chain

    # Ensure the return structure matches RecentSaleResponse
    results = []
    for sale in recent_sales:
         results.append({
            "sale_id": sale.sale_id,
            "created_at": sale.created_at.strftime("%Y-%m-%d %H:%M"), # Format time
            "total_amount": float(sale.total_amount),
            "payment_status": sale.payment_status.value if sale.payment_status else 'unknown',
            "staff_name": sale.staff_name, # Comes from the join
            "customer_id": sale.customer_id
         })
    return results

# ================================
# CRUD Endpoints for Roles
# ================================
@app.post("/roles/", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def create_role(role: RoleCreate, db: Session = Depends(get_db)):
    db_role = Role(role_name=role.role_name)
    db.add(db_role)
    db.commit()
    db.refresh(db_role)
    return db_role

@app.get("/roles/", response_model=List[RoleResponse])
def get_roles(db: Session = Depends(get_db)):
    return db.query(Role).all()

@app.get("/roles/{role_id}", response_model=RoleResponse)
def get_role(role_id: int, db: Session = Depends(get_db)):
    role = db.query(Role).filter(Role.role_id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return role

@app.put("/roles/{role_id}", response_model=RoleResponse)
def update_role(role_id: int, role_update: RoleCreate, db: Session = Depends(get_db)):
    role = db.query(Role).filter(Role.role_id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    role.role_name = role_update.role_name
    db.commit()
    db.refresh(role)
    return role

@app.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(role_id: int, db: Session = Depends(get_db)):
    role = db.query(Role).filter(Role.role_id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    db.delete(role)
    db.commit()
    return None

# ================================
# CRUD Endpoints for Permissions
# ================================
@app.post("/permissions/", response_model=PermissionResponse, status_code=status.HTTP_201_CREATED)
def create_permission(permission: PermissionCreate, db: Session = Depends(get_db)):
    db_permission = Permission(permission_name=permission.permission_name)
    db.add(db_permission)
    db.commit()
    db.refresh(db_permission)
    return db_permission

@app.get("/permissions/", response_model=List[PermissionResponse])
def get_permissions(db: Session = Depends(get_db)):
    return db.query(Permission).all()

@app.get("/permissions/{permission_id}", response_model=PermissionResponse)
def get_permission(permission_id: int, db: Session = Depends(get_db)):
    permission = db.query(Permission).filter(Permission.permission_id == permission_id).first()
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")
    return permission

@app.put("/permissions/{permission_id}", response_model=PermissionResponse)
def update_permission(permission_id: int, permission_update: PermissionCreate, db: Session = Depends(get_db)):
    permission = db.query(Permission).filter(Permission.permission_id == permission_id).first()
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")
    permission.permission_name = permission_update.permission_name
    db.commit()
    db.refresh(permission)
    return permission

@app.delete("/permissions/{permission_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_permission(permission_id: int, db: Session = Depends(get_db)):
    permission = db.query(Permission).filter(Permission.permission_id == permission_id).first()
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")
    db.delete(permission)
    db.commit()
    return None

# ================================
# CRUD Endpoints for Categories
# ================================
@app.post("/categories/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(category: CategoryCreate, db: Session = Depends(get_db)):
    db_category = Category(
        category_name=category.category_name,
        description=category.description,
        status=category.status
    )
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

@app.get("/categories/", response_model=List[CategoryResponse])
def get_categories(db: Session = Depends(get_db)):
    return db.query(Category).all()

@app.get("/categories/{category_id}", response_model=CategoryResponse)
def get_category(category_id: int, db: Session = Depends(get_db)):
    category = db.query(Category).filter(Category.category_id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category

@app.put("/categories/{category_id}", response_model=CategoryResponse)
def update_category(category_id: int, category_update: CategoryCreate, db: Session = Depends(get_db)):
    category = db.query(Category).filter(Category.category_id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    category.category_name = category_update.category_name
    category.description = category_update.description
    category.status = category_update.status
    db.commit()
    db.refresh(category)
    return category

@app.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    category = db.query(Category).filter(Category.category_id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(category)
    db.commit()
    return None

# ================================
# CRUD Endpoints for Items
# ================================
@app.post("/items/", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
def create_item(item: ItemCreate, db: Session = Depends(get_db)):
    db_item = Item(
        item_name=item.item_name,
        category_id=item.category_id,
        price=item.price,
        cost_price=item.cost_price,
        barcode=item.barcode,
        is_perishable=item.is_perishable,
        image_url=item.image_url
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@app.get("/items/", response_model=List[ItemResponse])
def get_items(
    category_id: Optional[int] = None, # <<< ADD category_id parameter here
    db: Session = Depends(get_db)
):
    query = db.query(Item).options(joinedload(Item.category)) # Eager load category for context if needed

    # --- ADD Filtering Logic ---
    if category_id is not None: # Use 'is not None' to allow filtering for category_id=0 if valid
        query = query.filter(Item.category_id == category_id)
    # --- End Filtering Logic ---

    # Consider adding sorting (e.g., by name) and pagination here
    items = query.order_by(Item.item_name).all()
    return items

@app.get("/items/{item_id}", response_model=ItemResponse)
def get_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.item_id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@app.put("/items/{item_id}", response_model=ItemResponse)
def update_item(item_id: int, item_update: ItemCreate, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.item_id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.item_name = item_update.item_name
    item.category_id = item_update.category_id
    item.price = item_update.price
    item.cost_price = item_update.cost_price
    item.barcode = item_update.barcode
    item.is_perishable = item_update.is_perishable
    item.image_url = item_update.image_url
    db.commit()
    db.refresh(item)
    return item

@app.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.item_id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return None

@app.get("/items/barcode/{barcode}", response_model=ItemResponse)
def get_item_by_barcode(barcode: str, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.barcode == barcode).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found for given barcode")
    return item

# ================================
# CRUD Endpoints for Customers
# ================================
@app.post("/customers/", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(customer: CustomerCreate, db: Session = Depends(get_db)):
    db_customer = Customer(
        full_name=customer.full_name,
        email=customer.email,
        phone_number=customer.phone_number,
        street=customer.street,
        city=customer.city,
        state=customer.state,
        zip_code=customer.zip_code,
        loyalty_points=customer.loyalty_points
    )
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return db_customer

@app.get("/customers/", response_model=List[CustomerResponse])
def get_customers(phone_number: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Customer)
    if phone_number:
        query = query.filter(Customer.phone_number == phone_number)
    return query.all()

@app.get("/customers/{customer_id}", response_model=CustomerResponse)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer

@app.put("/customers/{customer_id}", response_model=CustomerResponse)
def update_customer(customer_id: int, customer_update: CustomerCreate, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    customer.full_name = customer_update.full_name
    customer.email = customer_update.email
    customer.phone_number = customer_update.phone_number
    customer.street = customer_update.street
    customer.city = customer_update.city
    customer.state = customer_update.state
    customer.zip_code = customer_update.zip_code
    customer.loyalty_points = customer_update.loyalty_points
    db.commit()
    db.refresh(customer)
    return customer

@app.delete("/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    db.delete(customer)
    db.commit()
    return None

# ================================
# Staff Endpoints
# ================================
@app.post("/staff/", response_model=StaffResponse, status_code=status.HTTP_201_CREATED)
def create_staff(staff: StaffCreate, db: Session = Depends(get_db)):
    existing = db.query(Staff).filter(Staff.email == staff.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed_password = bcrypt.hashpw(staff.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    new_staff = Staff(
        full_name=staff.full_name,
        email=staff.email,
        role=staff.role,
        is_manager=staff.is_manager,
        phone_number=staff.phone_number,
        date_of_birth=staff.date_of_birth,
        salary=staff.salary,
        shift_start_time=staff.shift_start_time,
        shift_end_time=staff.shift_end_time,
        street=staff.street,
        city=staff.city,
        state=staff.state,
        zip_code=staff.zip_code,
        additional_details=staff.additional_details,
        password_hash=hashed_password
    )
    db.add(new_staff)
    db.commit()
    db.refresh(new_staff)
    return new_staff

@app.get("/staff/", response_model=List[StaffResponse])
def get_staff(
    status: Optional[str] = Query(None, enum=["active", "inactive"]), # <<< Accept 'status' query param
    db: Session = Depends(get_db)
):
    query = db.query(Staff)

    # --- ADD Filtering Logic ---
    if status: # If status is provided (either 'active' or 'inactive')
        query = query.filter(Staff.status == status)
    # If status is None (meaning '/staff/' was called without ?status=...),
    # it will return ALL staff (both active and inactive).-

    # You might want pagination here for large staff lists
    staff_list = query.order_by(Staff.full_name).all()
    return staff_list

@app.get("/staff/{staff_id}", response_model=StaffResponse)
def get_staff_by_id(staff_id: int, db: Session = Depends(get_db)):
    staff_obj = db.query(Staff).filter(Staff.staff_id == staff_id).first()
    if not staff_obj:
        raise HTTPException(status_code=404, detail="Staff not found")
    return staff_obj

# Use StaffUpdate schema here
@app.put("/staff/{staff_id}", response_model=StaffResponse)
def update_staff(staff_id: int, staff_update: StaffUpdate, db: Session = Depends(get_db)): # <<< Use StaffUpdate
    staff_obj = db.query(Staff).filter(Staff.staff_id == staff_id).first()
    if not staff_obj:
        raise HTTPException(status_code=404, detail="Staff not found")

    # Check email uniqueness if changed and provided
    if staff_update.email and staff_update.email != staff_obj.email:
        if db.query(Staff).filter(Staff.email == staff_update.email, Staff.staff_id != staff_id).first():
            raise HTTPException(status_code=400, detail="Email already registered.")

    # Get update data, excluding unset fields and password (handle password separately)
    update_data = staff_update.dict(exclude_unset=True, exclude={'password'})

    for key, value in update_data.items():
        # Optional: Add extra validation here if needed
        setattr(staff_obj, key, value)

    # Only update password if provided *in the update payload*
    if staff_update.password:
        hashed_password = bcrypt.hashpw(staff_update.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        staff_obj.password_hash = hashed_password

    db.commit()
    db.refresh(staff_obj)
    return staff_obj

@app.delete("/staff/{staff_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_staff(staff_id: int, db: Session = Depends(get_db)):
    staff_obj = db.query(Staff).filter(Staff.staff_id == staff_id).first()
    if not staff_obj:
        raise HTTPException(status_code=404, detail="Staff not found")
    db.delete(staff_obj)
    db.commit()
    return None

@app.get("/staff/me", response_model=StaffResponse)
def get_my_staff(staff_id: int, db: Session = Depends(get_db)):
    staff = db.query(Staff).filter(Staff.staff_id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    return staff

# ================================
# Store Endpoints
# ================================
@app.post("/stores/", response_model=StoreResponse, status_code=status.HTTP_201_CREATED)
def create_store(store: StoreCreate, db: Session = Depends(get_db)):
    new_store = Store(
        store_name=store.store_name,
        street=store.street,
        city=store.city,
        state=store.state,
        zip_code=store.zip_code,
        contact_number=store.contact_number,
        manager_id=store.manager_id,
        status=store.status
    )
    db.add(new_store)
    db.commit()
    db.refresh(new_store)
    return new_store

@app.get("/stores/", response_model=List[StoreResponse])
def get_stores(
    status: Optional[str] = Query(None, enum=["active", "inactive"]), # <<< Accept 'status' query param
    db: Session = Depends(get_db)
):
    query = db.query(Store).options(joinedload(Store.manager)) # Eager load manager info if needed for display

    # --- ADD Filtering Logic ---
    if status: # If status is provided (either 'active' or 'inactive')
        query = query.filter(Store.status == status)
    # If status is None (meaning '/stores/' was called without ?status=..., or with ?status=''),
    # it will return ALL stores (both active and inactive).
    # --- End Filtering Logic ---

    # Consider pagination for large numbers of stores
    stores_list = query.order_by(Store.store_name).all()
    return stores_list # Fix: Return the list here

@app.get("/stores/{store_id}", response_model=StoreResponse)
def get_store_by_id(store_id: int, db: Session = Depends(get_db)):
    store_obj = db.query(Store).filter(Store.store_id == store_id).first()
    if not store_obj:
        raise HTTPException(status_code=404, detail="Store not found")
    return store_obj

@app.put("/stores/{store_id}", response_model=StoreResponse)
def update_store(store_id: int, store_update: StoreCreate, db: Session = Depends(get_db)):
    store_obj = db.query(Store).filter(Store.store_id == store_id).first()
    if not store_obj:
        raise HTTPException(status_code=404, detail="Store not found")
    store_obj.store_name = store_update.store_name
    store_obj.street = store_update.street
    store_obj.city = store_update.city
    store_obj.state = store_update.state
    store_obj.zip_code = store_update.zip_code
    store_obj.contact_number = store_update.contact_number
    store_obj.manager_id = store_update.manager_id
    store_obj.status = store_update.status
    db.commit()
    db.refresh(store_obj)
    return store_obj

@app.delete("/stores/{store_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_store(store_id: int, db: Session = Depends(get_db)):
    store_obj = db.query(Store).filter(Store.store_id == store_id).first()
    if not store_obj:
        raise HTTPException(status_code=404, detail="Store not found")
    db.delete(store_obj)
    db.commit()
    return None

# ================================
# Stock Endpoints
# ================================
@app.post("/stock/", response_model=StockResponse, status_code=status.HTTP_201_CREATED)
def create_stock(stock: StockCreate, db: Session = Depends(get_db)):
    new_stock = Stock(
        store_id=stock.store_id,
        item_id=stock.item_id,
        quantity=stock.quantity,
        cost=stock.cost,
        min_stock_level=stock.min_stock_level,
        location=stock.location,
        measurement_unit=stock.measurement_unit,
        batch_number=stock.batch_number,
        manufacture_date=stock.manufacture_date,
        expiry_date=stock.expiry_date
    )
    db.add(new_stock)
    db.commit()
    db.refresh(new_stock)
    # --- Optionally log stock history ---
    # history_entry = StockHistory(stock_id=new_stock.stock_id, quantity_change=new_stock.quantity, change_type='addition', reason='Initial stock creation')
    # db.add(history_entry)
    # db.commit()
    # ---
    return new_stock

@app.get("/stock/", response_model=List[StockResponse])
def get_stock(db: Session = Depends(get_db)):
    # Consider adding filters like store_id, item_id
    return db.query(Stock).all()

@app.get("/stock/{stock_id}", response_model=StockResponse)
def get_stock_by_id(stock_id: int, db: Session = Depends(get_db)):
    stock_obj = db.query(Stock).filter(Stock.stock_id == stock_id).first()
    if not stock_obj:
        raise HTTPException(status_code=404, detail="Stock not found")
    return stock_obj

@app.put("/stock/{stock_id}", response_model=StockResponse)
def update_stock(stock_id: int, stock_update: StockCreate, db: Session = Depends(get_db)):
    stock_obj = db.query(Stock).filter(Stock.stock_id == stock_id).first()
    if not stock_obj:
        raise HTTPException(status_code=404, detail="Stock not found")

    old_quantity = stock_obj.quantity
    change_reason = "Stock update" # Default reason

    stock_obj.store_id = stock_update.store_id
    stock_obj.item_id = stock_update.item_id
    stock_obj.quantity = stock_update.quantity
    stock_obj.cost = stock_update.cost
    stock_obj.min_stock_level = stock_update.min_stock_level
    stock_obj.location = stock_update.location
    stock_obj.measurement_unit = stock_update.measurement_unit
    stock_obj.batch_number = stock_update.batch_number
    stock_obj.manufacture_date = stock_update.manufacture_date
    stock_obj.expiry_date = stock_update.expiry_date
    db.commit()
    db.refresh(stock_obj)

    # --- Optionally log stock history ---
    # quantity_diff = stock_update.quantity - old_quantity
    # if quantity_diff != 0:
    #     change_type = 'addition' if quantity_diff > 0 else 'removal' if quantity_diff < 0 else 'adjustment' # adjustment might need manual trigger
    #     history_entry = StockHistory(stock_id=stock_obj.stock_id, quantity_change=quantity_diff, change_type=change_type, reason=change_reason)
    #     db.add(history_entry)
    #     db.commit()
    # ---
    return stock_obj

@app.delete("/stock/{stock_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_stock(stock_id: int, db: Session = Depends(get_db)):
    stock_obj = db.query(Stock).filter(Stock.stock_id == stock_id).first()
    if not stock_obj:
        raise HTTPException(status_code=404, detail="Stock not found")
    # --- Optionally log stock history ---
    # history_entry = StockHistory(stock_id=stock_obj.stock_id, quantity_change=-stock_obj.quantity, change_type='removal', reason='Stock record deleted')
    # db.add(history_entry)
    # ---
    db.delete(stock_obj)
    db.commit()
    return None

# ================================
# Sales Endpoints
# ================================
@app.post("/sales/", response_model=SalesResponse, status_code=status.HTTP_201_CREATED)
def create_sales(sales: SalesCreate, db: Session = Depends(get_db)):
    db_sales = Sales(**sales.dict())
    db.add(db_sales)
    db.commit()
    db.refresh(db_sales)
    return db_sales

@app.get("/sales/", response_model=List[SalesResponse])
def get_sales(db: Session = Depends(get_db)):
    # Consider adding filters (date range, store_id, status) and pagination
    return db.query(Sales).order_by(desc(Sales.created_at)).all()

@app.get("/sales/{sale_id}", response_model=SalesResponse)
def get_sales_by_id(sale_id: int, db: Session = Depends(get_db)):
    sales_obj = db.query(Sales)\
                  .options(joinedload(Sales.sale_items), joinedload(Sales.payments))\
                  .filter(Sales.sale_id == sale_id).first() # Eager load related items/payments
    if not sales_obj:
        raise HTTPException(status_code=404, detail="Sales record not found")
    return sales_obj

@app.put("/sales/{sale_id}", response_model=SalesResponse)
def update_sales(sale_id: int, sales_update: SalesUpdate, db: Session = Depends(get_db)):
    sales_obj = db.query(Sales).filter(Sales.sale_id == sale_id).first()
    if not sales_obj:
        raise HTTPException(status_code=404, detail="Sales record not found")
    update_data = sales_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(sales_obj, key, value)
    db.commit()
    db.refresh(sales_obj)
    return sales_obj

@app.delete("/sales/{sale_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sales(sale_id: int, db: Session = Depends(get_db)):
    sales_obj = db.query(Sales).filter(Sales.sale_id == sale_id).first()
    if not sales_obj:
        raise HTTPException(status_code=404, detail="Sales record not found")
    # Careful: Deleting a sale might require reversing stock changes, handling payments etc.
    # Consider soft delete (adding a 'deleted' flag) or a more complex cancellation logic.
    db.delete(sales_obj)
    db.commit()
    return None

# Process Sale (Simplified - assumes items are passed correctly)
# TODO: Consider making this transactional
@app.post("/process_sale/", response_model=SalesResponse) # Changed PUT to POST as it creates resources
def process_sale(sale_data: SalesCreate, sale_items: List[SaleItemCreate], payments_data: List[PaymentCreate], db: Session = Depends(get_db)):
    # 1. Create the Sale record
    db_sale = Sales(**sale_data.dict())
    db.add(db_sale)
    db.commit()
    db.refresh(db_sale)

    total_calculated_amount = 0.0
    total_tax_calculated = 0.0
    total_discount_calculated = 0.0

    # 2. Process Sale Items and Update Stock
    for item_data in sale_items:
        # Verify item exists
        item = db.query(Item).filter(Item.item_id == item_data.item_id).first()
        if not item:
             db.rollback() # Rollback sale creation
             raise HTTPException(status_code=404, detail=f"Item with ID {item_data.item_id} not found")

        # Use item's current price if not provided in request (or validate if provided)
        unit_price = item_data.unit_price if item_data.unit_price is not None else item.price
        if unit_price is None: # Ensure price is set
             db.rollback()
             raise HTTPException(status_code=400, detail=f"Price not set for item {item.item_name}")

        subtotal = item_data.quantity * float(unit_price)
        # TODO: Add logic for applying discounts/taxes based on rules if needed
        tax_amount = item_data.tax if item_data.tax is not None else 0.0 # Example default
        discount_amount = item_data.discount if item_data.discount is not None else 0.0 # Example default

        item_total = subtotal - discount_amount + tax_amount
        total_calculated_amount += item_total
        total_tax_calculated += tax_amount
        total_discount_calculated += discount_amount

        db_sale_item = SaleItem(
            sale_id=db_sale.sale_id,
            item_id=item_data.item_id,
            quantity=item_data.quantity,
            unit_price=unit_price,
            discount=discount_amount,
            tax=tax_amount
            # subtotal is computed
        )
        db.add(db_sale_item)

        # Decrement stock
        stock_record = db.query(Stock).filter(
            Stock.store_id == db_sale.store_id,
            Stock.item_id == item_data.item_id
        ).with_for_update().first() # Lock row for update

        if not stock_record or stock_record.quantity < item_data.quantity:
            db.rollback() # Rollback sale and items
            raise HTTPException(status_code=400, detail=f"Insufficient stock for item {item.item_name} (ID: {item_data.item_id})")

        old_stock_qty = stock_record.quantity
        stock_record.quantity -= item_data.quantity
        db.add(stock_record)

        # --- Add Stock History ---
        history_entry = StockHistory(
            stock_id=stock_record.stock_id,
            quantity_change=-item_data.quantity,
            change_type='removal',
            reason=f'Sale ID: {db_sale.sale_id}'
        )
        db.add(history_entry)
        # ---

    # 3. Update Sale with calculated total
    db_sale.total_amount = total_calculated_amount
    # db_sale.total_tax = total_tax_calculated # Add these fields to Sales model if needed
    # db_sale.total_discount = total_discount_calculated # Add these fields to Sales model if needed

    # 4. Process Payments (Handle Split Payments)
    total_paid = 0.0
    for payment_data in payments_data:
        # Validate payment method
        pm = db.query(PaymentMethod).filter(PaymentMethod.payment_method_id == payment_data.payment_method_id).first()
        if not pm:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Invalid Payment Method ID: {payment_data.payment_method_id}")

        db_payment = SplitPayment( # Using SplitPayment model to store each part
             sale_id=db_sale.sale_id,
             amount=payment_data.amount,
             payment_method_id=payment_data.payment_method_id,
             transaction_reference=payment_data.transaction_reference
        )
        db.add(db_payment)
        total_paid += payment_data.amount

    # 5. Update Payment Status
    # Using a small tolerance for floating point comparison
    if abs(total_paid - total_calculated_amount) < 0.01:
         db_sale.payment_status = 'paid'
    elif total_paid > 0:
         db_sale.payment_status = 'pending' # Or introduce 'partially_paid' status
    else:
         db_sale.payment_status = 'pending'

    db.add(db_sale) # Add again to save changes to total_amount and payment_status
    db.commit() # Commit transaction
    db.refresh(db_sale)
    return db_sale


# ================================
# SaleItem Endpoints
# ================================
@app.post("/sale_items/", response_model=SaleItemResponse, status_code=status.HTTP_201_CREATED)
def create_sale_item(sale_item: SaleItemCreate, db: Session = Depends(get_db)):
    # Note: This endpoint might be less useful now with process_sale handling items.
    # Keep it if you need to add items individually AFTER a sale is created, but be cautious.
    # Ensure Sale exists
    sale_record = db.query(Sales).filter(Sales.sale_id == sale_item.sale_id).first()
    if not sale_record:
        raise HTTPException(status_code=404, detail="Sale record not found")

    # Ensure Item exists
    item = db.query(Item).filter(Item.item_id == sale_item.item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail=f"Item with ID {sale_item.item_id} not found")

    # Use item's price if not provided
    unit_price = sale_item.unit_price if sale_item.unit_price is not None else item.price
    if unit_price is None:
         raise HTTPException(status_code=400, detail=f"Price not set or provided for item {item.item_name}")

    db_sale_item = SaleItem(
        sale_id=sale_item.sale_id,
        item_id=sale_item.item_id,
        quantity=sale_item.quantity,
        unit_price=unit_price,
        discount=sale_item.discount,
        tax=sale_item.tax
    )
    db.add(db_sale_item)
    db.commit()
    db.refresh(db_sale_item)

    # --- Update Stock (Use with caution outside process_sale) ---
    stock_record = db.query(Stock).filter(
        Stock.store_id == sale_record.store_id,
        Stock.item_id == sale_item.item_id
    ).with_for_update().first()
    if stock_record:
        if stock_record.quantity < db_sale_item.quantity:
             # Decide how to handle this - maybe rollback item creation or just warn?
             # db.rollback() # Rollback item creation
             raise HTTPException(status_code=400, detail=f"Insufficient stock for item {item.item_name} (ID: {sale_item.item_id}) - Sale Item created but stock NOT updated.")
        else:
            old_stock_qty = stock_record.quantity
            stock_record.quantity -= db_sale_item.quantity
            db.add(stock_record)
             # --- Log History ---
            history_entry = StockHistory(
                stock_id=stock_record.stock_id,
                quantity_change=-db_sale_item.quantity,
                change_type='removal',
                reason=f'Sale ID: {sale_record.sale_id} (Item added separately)'
            )
            db.add(history_entry)
             # ---
            db.commit() # Commit stock update separately or part of a larger transaction
    else:
        # Item added to sale, but no stock record found to decrement - Log or raise error?
        print(f"Warning: No stock record found for item {sale_item.item_id} in store {sale_record.store_id} during separate item addition.")
        # raise HTTPException(status_code=404, detail="Stock record not found for the item")

    return db_sale_item

@app.get("/sale_items/", response_model=List[SaleItemResponse])
def get_sale_items(sale_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(SaleItem)
    if sale_id:
        query = query.filter(SaleItem.sale_id == sale_id)
    return query.all()

@app.get("/sale_items/{sale_item_id}", response_model=SaleItemResponse)
def get_sale_item(sale_item_id: int, db: Session = Depends(get_db)):
    db_sale_item = db.query(SaleItem).filter(SaleItem.sale_item_id == sale_item_id).first()
    if not db_sale_item:
        raise HTTPException(status_code=404, detail="Sale item not found")
    return db_sale_item

@app.put("/sale_items/{sale_item_id}", response_model=SaleItemResponse)
def update_sale_item(sale_item_id: int, sale_item_update: SaleItemCreate, db: Session = Depends(get_db)):
    db_sale_item = db.query(SaleItem).filter(SaleItem.sale_item_id == sale_item_id).first()
    if not db_sale_item:
        raise HTTPException(status_code=404, detail="Sale item not found")

    # --- Complex: Updating requires recalculating totals and potentially stock adjustment ---
    # This is simplified and DANGEROUS without proper handling
    print("Warning: Updating sale items directly is complex. Consider cancelling/refunding and creating a new sale.")
    original_quantity = db_sale_item.quantity

    for key, value in sale_item_update.dict(exclude={'sale_id'}).items(): # Don't change sale_id
        setattr(db_sale_item, key, value)

    db.commit()
    db.refresh(db_sale_item)

    # --- Attempt stock adjustment (needs careful review) ---
    # quantity_diff = sale_item_update.quantity - original_quantity
    # if quantity_diff != 0:
    #     # Find stock record, adjust, log history... Needs Sale.store_id
    #     pass
    # --- Recalculate Sale Total ---
    # sale = db.query(Sales).filter(Sales.sale_id == db_sale_item.sale_id).first()
    # Recalculate sale.total_amount based on ALL items
    # Update sale.payment_status
    # db.commit()

    return db_sale_item

@app.delete("/sale_items/{sale_item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sale_item(sale_item_id: int, db: Session = Depends(get_db)):
    db_sale_item = db.query(SaleItem).filter(SaleItem.sale_item_id == sale_item_id).first()
    if not db_sale_item:
        raise HTTPException(status_code=404, detail="Sale item not found")

    # --- Complex: Deleting requires recalculating totals and potentially reversing stock ---
    print("Warning: Deleting sale items directly is complex. Consider cancelling/refunding.")
    original_quantity = db_sale_item.quantity
    sale_id = db_sale_item.sale_id
    item_id = db_sale_item.item_id

    db.delete(db_sale_item)
    db.commit()

    # --- Attempt stock reversal (needs careful review) ---
    # sale = db.query(Sales).filter(Sales.sale_id == sale_id).first()
    # if sale:
    #    stock_record = db.query(Stock).filter(Stock.store_id == sale.store_id, Stock.item_id == item_id).first()
    #    if stock_record:
    #        stock_record.quantity += original_quantity # Add back stock
    #        # Log history...
    #        db.commit()
    # --- Recalculate Sale Total ---
    # Recalculate sale.total_amount based on remaining items
    # Update sale.payment_status
    # db.commit()

    return None

# ================================
# Payment Endpoints (Legacy/Direct - Now handled by SplitPayment via process_sale)
# ================================
# These might be deprecated or repurposed if all payments go via SplitPayment
@app.post("/payments/", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
def create_payment(payment: PaymentCreate, db: Session = Depends(get_db)):
    print("Note: Direct /payments/ endpoint might be deprecated. Use /process_sale or /split_payments.")
    db_payment = Payment(**payment.dict())
    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)
    # TODO: Update Sale payment_status based on this payment
    return db_payment

@app.get("/payments/", response_model=List[PaymentResponse])
def get_payments(sale_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(Payment)
    if sale_id:
        query = query.filter(Payment.sale_id == sale_id)
    return query.all()

@app.get("/payments/{payment_id}", response_model=PaymentResponse)
def get_payment(payment_id: int, db: Session = Depends(get_db)):
    db_payment = db.query(Payment).filter(Payment.payment_id == payment_id).first()
    if not db_payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return db_payment

# Updating/Deleting direct payments also needs complex logic to update Sale status
@app.put("/payments/{payment_id}", response_model=PaymentResponse)
def update_payment(payment_id: int, payment_update: PaymentCreate, db: Session = Depends(get_db)):
    db_payment = db.query(Payment).filter(Payment.payment_id == payment_id).first()
    if not db_payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    for key, value in payment_update.dict().items():
        setattr(db_payment, key, value)
    db.commit()
    db.refresh(db_payment)
    # TODO: Recalculate Sale payment_status
    return db_payment

@app.delete("/payments/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payment(payment_id: int, db: Session = Depends(get_db)):
    db_payment = db.query(Payment).filter(Payment.payment_id == payment_id).first()
    if not db_payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    db.delete(db_payment)
    db.commit()
    # TODO: Recalculate Sale payment_status
    return None

# ================================
# Payment Methods Endpoints
# ================================
@app.post("/payment_methods/", response_model=PaymentMethodResponse, status_code=status.HTTP_201_CREATED)
def create_payment_method(pm: PaymentMethodCreate, db: Session = Depends(get_db)):
    db_pm = PaymentMethod(payment_method_name=pm.payment_method_name)
    db.add(db_pm)
    db.commit()
    db.refresh(db_pm)
    return db_pm

@app.get("/payment_methods/", response_model=List[PaymentMethodResponse])
def get_payment_methods(db: Session = Depends(get_db)):
    return db.query(PaymentMethod).all()

@app.get("/payment_methods/{payment_method_id}", response_model=PaymentMethodResponse)
def get_payment_method(payment_method_id: int, db: Session = Depends(get_db)):
    pm = db.query(PaymentMethod).filter(PaymentMethod.payment_method_id == payment_method_id).first()
    if not pm:
        raise HTTPException(status_code=404, detail="Payment method not found")
    return pm

@app.put("/payment_methods/{payment_method_id}", response_model=PaymentMethodResponse)
def update_payment_method(payment_method_id: int, pm_update: PaymentMethodCreate, db: Session = Depends(get_db)):
    pm = db.query(PaymentMethod).filter(PaymentMethod.payment_method_id == payment_method_id).first()
    if not pm:
        raise HTTPException(status_code=404, detail="Payment method not found")
    pm.payment_method_name = pm_update.payment_method_name
    db.commit()
    db.refresh(pm)
    return pm

@app.delete("/payment_methods/{payment_method_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payment_method(payment_method_id: int, db: Session = Depends(get_db)):
    pm = db.query(PaymentMethod).filter(PaymentMethod.payment_method_id == payment_method_id).first()
    if not pm:
        raise HTTPException(status_code=404, detail="Payment method not found")
    # Check if method is used in SplitPayments before deleting?
    db.delete(pm)
    db.commit()
    return None

# ================================
# Split Payments Endpoints (Mainly for viewing/management, creation via process_sale)
# ================================
@app.post("/split_payments/", response_model=SplitPaymentResponse, status_code=status.HTTP_201_CREATED)
def create_split_payment(sp: SplitPaymentCreate, db: Session = Depends(get_db)):
    # Use this if adding payment AFTER the initial sale process
    db_sp = SplitPayment(**sp.dict())
    db.add(db_sp)
    db.commit()
    db.refresh(db_sp)
    # TODO: Update Sale payment_status
    return db_sp

@app.get("/split_payments/", response_model=List[SplitPaymentResponse])
def get_split_payments(sale_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(SplitPayment)
    if sale_id:
        query = query.filter(SplitPayment.sale_id == sale_id)
    return query.all()

@app.get("/split_payments/{split_payment_id}", response_model=SplitPaymentResponse)
def get_split_payment(split_payment_id: int, db: Session = Depends(get_db)):
    sp = db.query(SplitPayment).filter(SplitPayment.split_payment_id == split_payment_id).first()
    if not sp:
        raise HTTPException(status_code=404, detail="Split payment not found")
    return sp

@app.put("/split_payments/{split_payment_id}", response_model=SplitPaymentResponse)
def update_split_payment(split_payment_id: int, sp_update: SplitPaymentCreate, db: Session = Depends(get_db)):
    sp = db.query(SplitPayment).filter(SplitPayment.split_payment_id == split_payment_id).first()
    if not sp:
        raise HTTPException(status_code=404, detail="Split payment not found")
    for key, value in sp_update.dict().items():
        setattr(sp, key, value)
    db.commit()
    db.refresh(sp)
    # TODO: Recalculate Sale payment_status
    return sp

@app.delete("/split_payments/{split_payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_split_payment(split_payment_id: int, db: Session = Depends(get_db)):
    sp = db.query(SplitPayment).filter(SplitPayment.split_payment_id == split_payment_id).first()
    if not sp:
        raise HTTPException(status_code=404, detail="Split payment not found")
    db.delete(sp)
    db.commit()
    # TODO: Recalculate Sale payment_status
    return None

# ================================
# Stock History Endpoints
# ================================
@app.post("/stock_history/", response_model=StockHistoryResponse, status_code=status.HTTP_201_CREATED)
def create_stock_history(sh: StockHistoryCreate, db: Session = Depends(get_db)):
    # Mostly for manual adjustments, sales/purchases should log automatically
    db_sh = StockHistory(**sh.dict())
    db.add(db_sh)
    db.commit()
    db.refresh(db_sh)
    # --- If it's a manual adjustment, update the Stock table too ---
    # stock = db.query(Stock).filter(Stock.stock_id == sh.stock_id).first()
    # if stock:
    #     stock.quantity += sh.quantity_change
    #     db.commit()
    # ---
    return db_sh

@app.get("/stock_history/", response_model=List[StockHistoryResponse])
def get_stock_history(stock_id: Optional[int] = None, item_id: Optional[int] = None, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(StockHistory)
    if stock_id:
        query = query.filter(StockHistory.stock_id == stock_id)
    elif item_id: # If filtering by item_id, need to join with Stock
        query = query.join(Stock, StockHistory.stock_id == Stock.stock_id)\
                     .filter(Stock.item_id == item_id)
    return query.order_by(desc(StockHistory.change_date)).limit(limit).all()

# GET/PUT/DELETE for individual history items might not be necessary unless correcting logs
@app.get("/stock_history/{history_id}", response_model=StockHistoryResponse)
def get_stock_history_item(history_id: int, db: Session = Depends(get_db)):
    sh = db.query(StockHistory).filter(StockHistory.history_id == history_id).first()
    if not sh:
        raise HTTPException(status_code=404, detail="Stock history record not found")
    return sh

# ================================
# RolePermission & UserRole Endpoints
# ================================
# (Keep existing CRUD for RolePermission and UserRole)
# ... existing endpoints ...
@app.post("/role_permissions/", response_model=RolePermissionResponse, status_code=status.HTTP_201_CREATED)
def create_role_permission(rp: RolePermissionCreate, db: Session = Depends(get_db)):
    db_rp = RolePermission(**rp.dict())
    db.add(db_rp)
    db.commit()
    db.refresh(db_rp)
    return db_rp

@app.get("/role_permissions/", response_model=List[RolePermissionResponse])
def get_role_permissions(db: Session = Depends(get_db)):
    return db.query(RolePermission).all()

@app.get("/role_permissions/{rp_id}", response_model=RolePermissionResponse)
def get_role_permission(rp_id: int, db: Session = Depends(get_db)):
    db_rp = db.query(RolePermission).filter(RolePermission.role_permission_id == rp_id).first()
    if not db_rp:
        raise HTTPException(status_code=404, detail="RolePermission not found")
    return db_rp

@app.put("/role_permissions/{rp_id}", response_model=RolePermissionResponse)
def update_role_permission(rp_id: int, rp_update: RolePermissionCreate, db: Session = Depends(get_db)):
    db_rp = db.query(RolePermission).filter(RolePermission.role_permission_id == rp_id).first()
    if not db_rp:
        raise HTTPException(status_code=404, detail="RolePermission not found")
    for key, value in rp_update.dict().items():
        setattr(db_rp, key, value)
    db.commit()
    db.refresh(db_rp)
    return db_rp

@app.delete("/role_permissions/{rp_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role_permission(rp_id: int, db: Session = Depends(get_db)):
    db_rp = db.query(RolePermission).filter(RolePermission.role_permission_id == rp_id).first()
    if not db_rp:
        raise HTTPException(status_code=404, detail="RolePermission not found")
    db.delete(db_rp)
    db.commit()
    return None

@app.post("/user_roles/", response_model=UserRoleResponse, status_code=status.HTTP_201_CREATED)
def create_user_role(ur: UserRoleCreate, db: Session = Depends(get_db)):
    db_ur = UserRole(**ur.dict())
    db.add(db_ur)
    db.commit()
    db.refresh(db_ur)
    return db_ur

@app.get("/user_roles/", response_model=List[UserRoleResponse])
def get_user_roles(staff_id: Optional[int] = None, role_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(UserRole)
    if staff_id:
        query = query.filter(UserRole.staff_id == staff_id)
    if role_id:
        query = query.filter(UserRole.role_id == role_id)
    return query.all()

@app.get("/user_roles/{ur_id}", response_model=UserRoleResponse)
def get_user_role(ur_id: int, db: Session = Depends(get_db)):
    db_ur = db.query(UserRole).filter(UserRole.user_role_id == ur_id).first()
    if not db_ur:
        raise HTTPException(status_code=404, detail="UserRole not found")
    return db_ur

@app.put("/user_roles/{ur_id}", response_model=UserRoleResponse)
def update_user_role(ur_id: int, ur_update: UserRoleCreate, db: Session = Depends(get_db)):
    db_ur = db.query(UserRole).filter(UserRole.user_role_id == ur_id).first()
    if not db_ur:
        raise HTTPException(status_code=404, detail="UserRole not found")
    for key, value in ur_update.dict().items():
        setattr(db_ur, key, value)
    db.commit()
    db.refresh(db_ur)
    return db_ur

@app.delete("/user_roles/{ur_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user_role(ur_id: int, db: Session = Depends(get_db)):
    db_ur = db.query(UserRole).filter(UserRole.user_role_id == ur_id).first()
    if not db_ur:
        raise HTTPException(status_code=404, detail="UserRole not found")
    db.delete(db_ur)
    db.commit()
    return None

# ================================
# Attendance Endpoints
# ================================
# (Keep existing CRUD)
# ... existing endpoints ...
@app.post("/attendance/", response_model=AttendanceResponse, status_code=status.HTTP_201_CREATED)
def create_attendance(attendance: AttendanceCreate, db: Session = Depends(get_db)):
    db_attendance = Attendance(**attendance.dict())
    db.add(db_attendance)
    db.commit()
    db.refresh(db_attendance)
    return db_attendance

@app.get("/attendance/", response_model=List[AttendanceResponse])
def get_attendance_list(db: Session = Depends(get_db)):
    return db.query(Attendance).all()

@app.get("/attendance/{attendance_id}", response_model=AttendanceResponse)
def get_attendance(attendance_id: int, db: Session = Depends(get_db)):
    att = db.query(Attendance).filter(Attendance.attendance_id == attendance_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    return att

@app.put("/attendance/{attendance_id}", response_model=AttendanceResponse)
def update_attendance(attendance_id: int, attendance_update: AttendanceCreate, db: Session = Depends(get_db)):
    att = db.query(Attendance).filter(Attendance.attendance_id == attendance_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    for key, value in attendance_update.dict().items():
        setattr(att, key, value)
    db.commit()
    db.refresh(att)
    return att

@app.delete("/attendance/{attendance_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attendance(attendance_id: int, db: Session = Depends(get_db)):
    att = db.query(Attendance).filter(Attendance.attendance_id == attendance_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    db.delete(att)
    db.commit()
    return None

# ================================
# SalesReport Endpoints
# ================================
# (Keep existing CRUD)
# ... existing endpoints ...
@app.post("/sales_reports/", response_model=SalesReportResponse, status_code=status.HTTP_201_CREATED)
def create_sales_report(report: SalesReportCreate, db: Session = Depends(get_db)):
    db_report = SalesReport(**report.dict())
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report

@app.get("/sales_reports/", response_model=List[SalesReportResponse])
def get_sales_reports(db: Session = Depends(get_db)):
    return db.query(SalesReport).all()

@app.get("/sales_reports/{report_id}", response_model=SalesReportResponse)
def get_sales_report(report_id: int, db: Session = Depends(get_db)):
    rep = db.query(SalesReport).filter(SalesReport.report_id == report_id).first()
    if not rep:
        raise HTTPException(status_code=404, detail="Sales report not found")
    return rep

@app.put("/sales_reports/{report_id}", response_model=SalesReportResponse)
def update_sales_report(report_id: int, report_update: SalesReportCreate, db: Session = Depends(get_db)):
    rep = db.query(SalesReport).filter(SalesReport.report_id == report_id).first()
    if not rep:
        raise HTTPException(status_code=404, detail="Sales report not found")
    for key, value in report_update.dict().items():
        setattr(rep, key, value)
    db.commit()
    db.refresh(rep)
    return rep

@app.delete("/sales_reports/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sales_report(report_id: int, db: Session = Depends(get_db)):
    rep = db.query(SalesReport).filter(SalesReport.report_id == report_id).first()
    if not rep:
        raise HTTPException(status_code=404, detail="Sales report not found")
    db.delete(rep)
    db.commit()
    return None

# ================================
# Discount & Tax Endpoints
# ================================
# (Keep existing CRUD for Discounts and Taxes)
# ... existing endpoints ...
@app.get("/discounts/", response_model=List[DiscountResponse])
def get_discounts(
    status: Optional[str] = Query(None, enum=["active", "expired"]),
    db: Session = Depends(get_db)
):
    print(f"--- Fetching discounts with status: {status} ---") # LOG 1: Check received status
    try:
        query = db.query(Discount)

        # --- Filtering Logic ---
        if status:
            print(f"Applying filter: Discount.status == '{status}'") # LOG 2: Confirm filter application
            query = query.filter(Discount.status == status)
        # --- End Filtering Logic ---

        # Add sorting
        discounts_list = query.order_by(desc(Discount.end_date)).all()

        print(f"Found {len(discounts_list)} discounts matching criteria.") # LOG 3: Check how many were found

        # --- DEBUG: Print first few results if list isn't empty ---
        # if discounts_list:
        #     print("First few results:", [d.__dict__ for d in discounts_list[:3]]) # Log actual data
        # ---

        return discounts_list # Pydantic handles serialization via DiscountResponse

    except Exception as e:
        print(f"!!! EXCEPTION in get_discounts: {e}") # LOG 4: Catch unexpected errors
        raise HTTPException(status_code=500, detail="Internal server error while fetching discounts.")


# --- Check POST /discounts/ endpoint with LOGGING ---
@app.post("/discounts/", response_model=DiscountResponse, status_code=status.HTTP_201_CREATED)
def create_discount(discount: DiscountCreate, db: Session = Depends(get_db)):
    print(f"--- Received payload to create discount: {discount.dict()} ---") # LOG 5: Check received data
    try:
        # Add validation if needed (e.g., start_date <= end_date) - Pydantic can do some
        db_discount = Discount(**discount.dict())
        db.add(db_discount)
        db.commit()
        db.refresh(db_discount)
        print(f"--- Successfully created discount ID: {db_discount.discount_id} ---") # LOG 6: Confirm creation
        return db_discount
    except Exception as e:
        db.rollback() # Rollback on error
        print(f"!!! EXCEPTION in create_discount: {e}") # LOG 7: Catch unexpected errors
        # Raise specific errors if possible (e.g., constraint violation)
        raise HTTPException(status_code=500, detail=f"Internal server error creating discount: {e}")


@app.get("/discounts/{discount_id}", response_model=DiscountResponse)
def get_discount(discount_id: int, db: Session = Depends(get_db)):
    db_discount = db.query(Discount).filter(Discount.discount_id == discount_id).first()
    if not db_discount:
        raise HTTPException(status_code=404, detail="Discount not found")
    return db_discount

@app.put("/discounts/{discount_id}", response_model=DiscountResponse)
def update_discount(discount_id: int, discount_update: DiscountCreate, db: Session = Depends(get_db)):
    db_discount = db.query(Discount).filter(Discount.discount_id == discount_id).first()
    if not db_discount:
        raise HTTPException(status_code=404, detail="Discount not found")
    for key, value in discount_update.dict().items():
        setattr(db_discount, key, value)
    db.commit()
    db.refresh(db_discount)
    return db_discount

@app.delete("/discounts/{discount_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_discount(discount_id: int, db: Session = Depends(get_db)):
    db_discount = db.query(Discount).filter(Discount.discount_id == discount_id).first()
    if not db_discount:
        raise HTTPException(status_code=404, detail="Discount not found")
    db.delete(db_discount)
    db.commit()
    return None

@app.post("/taxes/", response_model=TaxResponse, status_code=status.HTTP_201_CREATED)
def create_tax(tax: TaxCreate, db: Session = Depends(get_db)):
    db_tax = Tax(**tax.dict())
    db.add(db_tax)
    db.commit()
    db.refresh(db_tax)
    return db_tax

@app.get("/taxes/", response_model=List[TaxResponse])
def get_taxes(
    status: Optional[str] = Query(None, enum=["active", "inactive"]), # <<< Accept status
    db: Session = Depends(get_db)
):
    query = db.query(Tax)
    if status:
        query = query.filter(Tax.status == status) # <<< Apply filter
    taxes_list = query.order_by(Tax.tax_name).all() # Add sorting if desired
    return taxes_list

@app.get("/taxes/{tax_id}", response_model=TaxResponse)
def get_tax(tax_id: int, db: Session = Depends(get_db)):
    db_tax = db.query(Tax).filter(Tax.tax_id == tax_id).first()
    if not db_tax:
        raise HTTPException(status_code=404, detail="Tax not found")
    return db_tax

@app.put("/taxes/{tax_id}", response_model=TaxResponse)
def update_tax(tax_id: int, tax_update: TaxCreate, db: Session = Depends(get_db)):
    db_tax = db.query(Tax).filter(Tax.tax_id == tax_id).first()
    if not db_tax:
        raise HTTPException(status_code=404, detail="Tax not found")
    for key, value in tax_update.dict().items():
        setattr(db_tax, key, value)
    db.commit()
    db.refresh(db_tax)
    return db_tax

@app.delete("/taxes/{tax_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tax(tax_id: int, db: Session = Depends(get_db)):
    db_tax = db.query(Tax).filter(Tax.tax_id == tax_id).first()
    if not db_tax:
        raise HTTPException(status_code=404, detail="Tax not found")
    db.delete(db_tax)
    db.commit()
    return None

# ================================
# Applied Discounts/Taxes Endpoints (Mainly for viewing/reporting)
# ================================
# (Keep existing CRUD for DiscountsApplied and TaxesApplied)
# ... existing endpoints ...
@app.post("/discounts_applied/", response_model=DiscountsAppliedResponse, status_code=status.HTTP_201_CREATED)
def create_discounts_applied(da: DiscountsAppliedCreate, db: Session = Depends(get_db)):
    db_da = DiscountsApplied(**da.dict())
    db.add(db_da)
    db.commit()
    db.refresh(db_da)
    return db_da

@app.get("/discounts_applied/", response_model=List[DiscountsAppliedResponse])
def get_discounts_applied(db: Session = Depends(get_db)):
    return db.query(DiscountsApplied).all()

@app.get("/discounts_applied/{discount_applied_id}", response_model=DiscountsAppliedResponse)
def get_discounts_applied_item(discount_applied_id: int, db: Session = Depends(get_db)):
    da = db.query(DiscountsApplied).filter(DiscountsApplied.discount_applied_id == discount_applied_id).first()
    if not da:
        raise HTTPException(status_code=404, detail="Discounts applied record not found")
    return da

@app.put("/discounts_applied/{discount_applied_id}", response_model=DiscountsAppliedResponse)
def update_discounts_applied(discount_applied_id: int, da_update: DiscountsAppliedCreate, db: Session = Depends(get_db)):
    da = db.query(DiscountsApplied).filter(DiscountsApplied.discount_applied_id == discount_applied_id).first()
    if not da:
        raise HTTPException(status_code=404, detail="Discounts applied record not found")
    for key, value in da_update.dict().items():
        setattr(da, key, value)
    db.commit()
    db.refresh(da)
    return da

@app.delete("/discounts_applied/{discount_applied_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_discounts_applied(discount_applied_id: int, db: Session = Depends(get_db)):
    da = db.query(DiscountsApplied).filter(DiscountsApplied.discount_applied_id == discount_applied_id).first()
    if not da:
        raise HTTPException(status_code=404, detail="Discounts applied record not found")
    db.delete(da)
    db.commit()
    return None

@app.post("/taxes_applied/", response_model=TaxesAppliedResponse, status_code=status.HTTP_201_CREATED)
def create_taxes_applied(ta: TaxesAppliedCreate, db: Session = Depends(get_db)):
    db_ta = TaxesApplied(**ta.dict())
    db.add(db_ta)
    db.commit()
    db.refresh(db_ta)
    return db_ta

@app.get("/taxes_applied/", response_model=List[TaxesAppliedResponse])
def get_taxes_applied(db: Session = Depends(get_db)):
    return db.query(TaxesApplied).all()

@app.get("/taxes_applied/{tax_applied_id}", response_model=TaxesAppliedResponse)
def get_taxes_applied_item(tax_applied_id: int, db: Session = Depends(get_db)):
    ta = db.query(TaxesApplied).filter(TaxesApplied.tax_applied_id == tax_applied_id).first()
    if not ta:
        raise HTTPException(status_code=404, detail="Taxes applied record not found")
    return ta

@app.put("/taxes_applied/{tax_applied_id}", response_model=TaxesAppliedResponse)
def update_taxes_applied(tax_applied_id: int, ta_update: TaxesAppliedCreate, db: Session = Depends(get_db)):
    ta = db.query(TaxesApplied).filter(TaxesApplied.tax_applied_id == tax_applied_id).first()
    if not ta:
        raise HTTPException(status_code=404, detail="Taxes applied record not found")
    for key, value in ta_update.dict().items():
        setattr(ta, key, value)
    db.commit()
    db.refresh(ta)
    return ta

@app.delete("/taxes_applied/{tax_applied_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_taxes_applied(tax_applied_id: int, db: Session = Depends(get_db)):
    ta = db.query(TaxesApplied).filter(TaxesApplied.tax_applied_id == tax_applied_id).first()
    if not ta:
        raise HTTPException(status_code=404, detail="Taxes applied record not found")
    db.delete(ta)
    db.commit()
    return None

# ================================
# SalesReportItem Endpoints
# ================================
# (Keep existing CRUD)
# ... existing endpoints ...
@app.post("/sales_report_items/", response_model=SalesReportItemResponse, status_code=status.HTTP_201_CREATED)
def create_sales_report_item(sri: SalesReportItemCreate, db: Session = Depends(get_db)):
    db_sri = SalesReportItem(**sri.dict())
    db.add(db_sri)
    db.commit()
    db.refresh(db_sri)
    return db_sri

@app.get("/sales_report_items/", response_model=List[SalesReportItemResponse])
def get_sales_report_items(db: Session = Depends(get_db)):
    return db.query(SalesReportItem).all()

@app.get("/sales_report_items/{sales_report_item_id}", response_model=SalesReportItemResponse)
def get_sales_report_item(sales_report_item_id: int, db: Session = Depends(get_db)):
    sri = db.query(SalesReportItem).filter(SalesReportItem.sales_report_item_id == sales_report_item_id).first()
    if not sri:
        raise HTTPException(status_code=404, detail="Sales report item not found")
    return sri

@app.put("/sales_report_items/{sales_report_item_id}", response_model=SalesReportItemResponse)
def update_sales_report_item(sales_report_item_id: int, sri_update: SalesReportItemCreate, db: Session = Depends(get_db)):
    sri = db.query(SalesReportItem).filter(SalesReportItem.sales_report_item_id == sales_report_item_id).first()
    if not sri:
        raise HTTPException(status_code=404, detail="Sales report item not found")
    for key, value in sri_update.dict().items():
        setattr(sri, key, value)
    db.commit()
    db.refresh(sri)
    return sri

@app.delete("/sales_report_items/{sales_report_item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sales_report_item(sales_report_item_id: int, db: Session = Depends(get_db)):
    sri = db.query(SalesReportItem).filter(SalesReportItem.sales_report_item_id == sales_report_item_id).first()
    if not sri:
        raise HTTPException(status_code=404, detail="Sales report item not found")
    db.delete(sri)
    db.commit()
    return None

# ================================
# Supplier & Purchase Order Endpoints
# ================================
# (Keep existing CRUD for Suppliers, PurchaseOrders, PurchaseOrderItems)
# ... existing endpoints ...
@app.post("/suppliers/", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
def create_supplier(supplier: SupplierCreate, db: Session = Depends(get_db)):
    db_supplier = Supplier(**supplier.dict())
    db.add(db_supplier)
    db.commit()
    db.refresh(db_supplier)
    return db_supplier

@app.get("/suppliers/", response_model=List[SupplierResponse])
def get_suppliers(db: Session = Depends(get_db)):
    return db.query(Supplier).all()

@app.get("/suppliers/{supplier_id}", response_model=SupplierResponse)
def get_supplier(supplier_id: int, db: Session = Depends(get_db)):
    supplier = db.query(Supplier).filter(Supplier.supplier_id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier

@app.put("/suppliers/{supplier_id}", response_model=SupplierResponse)
def update_supplier(supplier_id: int, supplier_update: SupplierCreate, db: Session = Depends(get_db)):
    supplier = db.query(Supplier).filter(Supplier.supplier_id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    for key, value in supplier_update.dict().items():
        setattr(supplier, key, value)
    db.commit()
    db.refresh(supplier)
    return supplier

@app.delete("/suppliers/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supplier(supplier_id: int, db: Session = Depends(get_db)):
    supplier = db.query(Supplier).filter(Supplier.supplier_id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    db.delete(supplier)
    db.commit()
    return None

@app.post("/purchase_orders/", response_model=PurchaseOrderResponse, status_code=status.HTTP_201_CREATED)
def create_purchase_order(po: PurchaseOrderCreate, db: Session = Depends(get_db)):
    db_po = PurchaseOrder(**po.dict())
    db.add(db_po)
    db.commit()
    db.refresh(db_po)
    return db_po

@app.get("/purchase_orders/", response_model=List[PurchaseOrderResponse])
def get_purchase_orders(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(PurchaseOrder)
    if status:
        query = query.filter(PurchaseOrder.status == status)
    return query.order_by(desc(PurchaseOrder.created_at)).all()

@app.get("/purchase_orders/{purchase_order_id}", response_model=PurchaseOrderResponse)
def get_purchase_order(purchase_order_id: int, db: Session = Depends(get_db)):
    po = db.query(PurchaseOrder)\
           .options(joinedload(PurchaseOrder.items))\
           .filter(PurchaseOrder.purchase_order_id == purchase_order_id).first() # Eager load items
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return po

@app.put("/purchase_orders/{purchase_order_id}", response_model=PurchaseOrderResponse)
def update_purchase_order(purchase_order_id: int, po_update: PurchaseOrderCreate, db: Session = Depends(get_db)):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.purchase_order_id == purchase_order_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    original_status = po.status
    update_data = po_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(po, key, value)

    # --- Logic for receiving PO and updating stock ---
    if po.status == 'received' and original_status != 'received':
        # Get PO Items
        po_items = db.query(PurchaseOrderItem).filter(PurchaseOrderItem.purchase_order_id == po.purchase_order_id).all()
        for poi in po_items:
            # Find or create stock record for the item in the target store
            stock_record = db.query(Stock).filter(
                Stock.store_id == po.store_id,
                Stock.item_id == poi.item_id
            ).with_for_update().first()

            if not stock_record:
                 # If stock record doesn't exist, create it (or decide how to handle)
                 item = db.query(Item).filter(Item.item_id == poi.item_id).first()
                 if not item:
                     db.rollback()
                     raise HTTPException(status_code=404, detail=f"Item {poi.item_id} not found for PO Item.")
                 stock_record = Stock(
                     store_id=po.store_id,
                     item_id=poi.item_id,
                     quantity=poi.quantity,
                     cost=poi.unit_price, # Use PO unit price as cost? Or item's cost_price?
                     min_stock_level=5 # Default or from item settings
                     # Set other fields like measurement_unit if available
                 )
                 db.add(stock_record)
                 db.flush() # Get the stock_id for history
                 print(f"Created new stock record for item {poi.item_id} in store {po.store_id}")
            else:
                 stock_record.quantity += poi.quantity
                 # Update cost price? Maybe average cost? Needs business logic.
                 # stock_record.cost = poi.unit_price
                 db.add(stock_record)

            # --- Log Stock History ---
            history_entry = StockHistory(
                stock_id=stock_record.stock_id,
                quantity_change=poi.quantity,
                change_type='addition',
                reason=f'PO Received: {po.purchase_order_id}'
            )
            db.add(history_entry)
            # ---

    db.commit()
    db.refresh(po)
    return po

@app.delete("/purchase_orders/{purchase_order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_purchase_order(purchase_order_id: int, db: Session = Depends(get_db)):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.purchase_order_id == purchase_order_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    # Consider implications: Should related PO items be deleted? What about received stock?
    # Maybe soft delete or prevent deletion if status is 'received'.
    if po.status == 'received':
        raise HTTPException(status_code=400, detail="Cannot delete a received Purchase Order.")

    db.delete(po) # Cascading delete for items might need setup in model
    db.commit()
    return None

@app.post("/purchase_order_items/", response_model=PurchaseOrderItemResponse, status_code=status.HTTP_201_CREATED)
def create_purchase_order_item(poi: PurchaseOrderItemCreate, db: Session = Depends(get_db)):
    db_poi = PurchaseOrderItem(**poi.dict())
    db.add(db_poi)
    db.commit()
    db.refresh(db_poi)
    return db_poi

@app.get("/purchase_order_items/", response_model=List[PurchaseOrderItemResponse])
def get_purchase_order_items(purchase_order_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(PurchaseOrderItem)
    if purchase_order_id:
        query = query.filter(PurchaseOrderItem.purchase_order_id == purchase_order_id)
    return query.all()

@app.get("/purchase_order_items/{purchase_order_item_id}", response_model=PurchaseOrderItemResponse)
def get_purchase_order_item(purchase_order_item_id: int, db: Session = Depends(get_db)):
    poi = db.query(PurchaseOrderItem).filter(PurchaseOrderItem.purchase_order_item_id == purchase_order_item_id).first()
    if not poi:
        raise HTTPException(status_code=404, detail="Purchase order item not found")
    return poi

@app.put("/purchase_order_items/{purchase_order_item_id}", response_model=PurchaseOrderItemResponse)
def update_purchase_order_item(purchase_order_item_id: int, poi_update: PurchaseOrderItemCreate, db: Session = Depends(get_db)):
    poi = db.query(PurchaseOrderItem).filter(PurchaseOrderItem.purchase_order_item_id == purchase_order_item_id).first()
    if not poi:
        raise HTTPException(status_code=404, detail="Purchase order item not found")
    # Prevent updates if PO is already received?
    po = db.query(PurchaseOrder).filter(PurchaseOrder.purchase_order_id == poi.purchase_order_id).first()
    if po and po.status == 'received':
         raise HTTPException(status_code=400, detail="Cannot update items on a received Purchase Order.")

    for key, value in poi_update.dict().items():
        setattr(poi, key, value)
    db.commit()
    db.refresh(poi)
    return poi

@app.delete("/purchase_order_items/{purchase_order_item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_purchase_order_item(purchase_order_item_id: int, db: Session = Depends(get_db)):
    poi = db.query(PurchaseOrderItem).filter(PurchaseOrderItem.purchase_order_item_id == purchase_order_item_id).first()
    if not poi:
        raise HTTPException(status_code=404, detail="Purchase order item not found")
    # Prevent deletion if PO is already received?
    po = db.query(PurchaseOrder).filter(PurchaseOrder.purchase_order_id == poi.purchase_order_id).first()
    if po and po.status == 'received':
         raise HTTPException(status_code=400, detail="Cannot delete items from a received Purchase Order.")

    db.delete(poi)
    db.commit()
    return None

# ================================
# Audit Log Endpoints
# ================================
# (Keep existing CRUD)
# ... existing endpoints ...
@app.post("/audit_logs/", response_model=AuditLogResponse, status_code=status.HTTP_201_CREATED)
def create_audit_log(audit_log: AuditLogCreate, db: Session = Depends(get_db)):
    db_audit_log = AuditLog(**audit_log.dict())
    db.add(db_audit_log)
    db.commit()
    db.refresh(db_audit_log)
    return db_audit_log

@app.get("/audit_logs/", response_model=List[AuditLogResponse])
def get_audit_logs(limit: int = 100, db: Session = Depends(get_db)):
    return db.query(AuditLog).order_by(desc(AuditLog.timestamp)).limit(limit).all()

# GET/PUT/DELETE for individual logs usually not needed/allowed
@app.get("/audit_logs/{log_id}", response_model=AuditLogResponse)
def get_audit_log(log_id: int, db: Session = Depends(get_db)):
    db_audit_log = db.query(AuditLog).filter(AuditLog.log_id == log_id).first()
    if not db_audit_log:
        raise HTTPException(status_code=404, detail="Audit log not found")
    return db_audit_log


# ================================
# Authentication
# ================================
class LoginSchema(BaseModel):
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    token: str
    staff_id: int
    role: str
    # Optionally add full_name, is_manager etc.
    full_name: str
    is_manager: bool

    class Config:
        orm_mode = True

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta if expires_delta else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

@app.post("/login", response_model=LoginResponse)
def login(login_data: LoginSchema, db: Session = Depends(get_db)):
    print(f"--- LOGIN ATTEMPT: Email='{login_data.email}' ---") # DEBUG
    staff = db.query(Staff).filter(Staff.email == login_data.email).first()

    if not staff:
        print(f"--- LOGIN FAILED: Staff not found for email '{login_data.email}' ---") # DEBUG
        raise HTTPException(status_code=401, detail="Invalid email, password, or inactive account")

    print(f"--- LOGIN: Found staff - ID={staff.staff_id}, Name='{staff.full_name}', Status='{staff.status}' ---") # DEBUG

    # Explicitly check status FIRST
    # Compare the Enum's .value attribute to the string 'active'
    if staff.status.value != 'active': # <<< CORRECTED LINE
        print(f"--- LOGIN FAILED: Staff status is '{staff.status}' (value: '{staff.status.value}'), not 'active' ---") # Enhanced DEBUG
        raise HTTPException(status_code=401, detail="Invalid email, password, or inactive account")
    
    # Now check password
    password_bytes = login_data.password.encode('utf-8')
    hash_bytes = staff.password_hash.encode('utf-8')
    print(f"--- LOGIN: Comparing password. Raw length: {len(login_data.password)}, Hash from DB: {staff.password_hash[:10]}... ---") # DEBUG - Log length, don't log raw pw!

    password_matches = bcrypt.checkpw(password_bytes, hash_bytes)
    print(f"--- LOGIN: bcrypt.checkpw result: {password_matches} ---") # DEBUG

    if not password_matches:
        print(f"--- LOGIN FAILED: Password check failed for user '{login_data.email}' ---") # DEBUG
        raise HTTPException(status_code=401, detail="Invalid email or password") # Specific message for password fail

    # If checks pass, create token and return success
    print(f"--- LOGIN SUCCESS: User '{login_data.email}' authenticated. Creating token... ---") # DEBUG
    access_token = create_access_token(
        data={
            "sub": staff.email,
            "staff_id": staff.staff_id,
            "role": staff.role.value, # Make sure role has a .value if it's an Enum
            "is_manager": staff.is_manager
            }
    )
    return LoginResponse(
        token=access_token,
        staff_id=staff.staff_id,
        role=staff.role.value, # Use .value if Enum
        full_name=staff.full_name,
        is_manager=staff.is_manager
    )


# ================================
# Dashboard & Reporting Endpoints (UPDATED/NEW)
# ================================

# --- Existing Basic Metrics ---
@app.get("/dashboard/metrics")
def get_dashboard_metrics(db: Session = Depends(get_db)):
    # This is fine, but might be redundant if summary has the same counts
    return {
        "categories": db.query(Category).count(),
        "items": db.query(Item).count(),
        "customers": db.query(Customer).count(),
        "staff": db.query(Staff).count(),
        "stores": db.query(Store).count()
    }

# --- Enhanced Dashboard Summary (REPLACES OLD ONE) ---
@app.get("/dashboard/summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    categories_count = db.query(Category).count()
    items_count = db.query(Item).count()
    customers_count = db.query(Customer).count()
    staff_count = db.query(Staff).count()
    stores_count = db.query(Store).count()

    # Today's Sales and Orders (Direct calculation)
    today = date.today()
    today_sales_data = db.query(
        func.sum(Sales.total_amount).label("total_sales"),
        func.count(Sales.sale_id).label("total_orders")
    ).filter(func.date(Sales.created_at) == today).first()

    total_sales = today_sales_data.total_sales if today_sales_data and today_sales_data.total_sales else 0.00
    total_orders = today_sales_data.total_orders if today_sales_data and today_sales_data.total_orders else 0

    # Top Item (Today)
    top_item_data = (
        db.query(
            Item.item_name, # Select name directly
            func.sum(SaleItem.quantity).label("total_quantity")
            )
        .join(Sales, SaleItem.sale_id == Sales.sale_id)
        .join(Item, SaleItem.item_id == Item.item_id) # Join Item table
        .filter(func.date(Sales.created_at) == today) # Filter for today
        .group_by(Item.item_id, Item.item_name) # Group by id and name
        .order_by(desc("total_quantity"))
        .first()
    )
    top_item = None
    if top_item_data:
         top_item = {
            # "item_id": top_item_data.item_id, # Not needed if name is selected
            "item_name": top_item_data.item_name,
            "total_quantity": float(top_item_data.total_quantity)
         }

    # Low Stock Count
    low_stock_count = db.query(Stock).filter(Stock.quantity < Stock.min_stock_level).count()

    # Pending Purchase Orders Count
    pending_po_count = db.query(PurchaseOrder).filter(PurchaseOrder.status == 'pending').count()

    return {
        "categories_count": categories_count,
        "items_count": items_count,
        "customers_count": customers_count,
        "staff_count": staff_count,
        "stores_count": stores_count,
        "total_sales": float(total_sales),
        "total_orders": total_orders,
        "top_item": top_item,
        "low_stock_count": low_stock_count,
        "pending_purchase_orders_count": pending_po_count # Added
    }

# --- NEW: Sales Trend (Last N Days) ---
@app.get("/reports/sales_over_time")
def get_sales_over_time(days: int = Query(7, ge=1, le=365), db: Session = Depends(get_db)):
    end_date = datetime.utcnow().date() # Use UTC or local time consistently
    start_date = end_date - timedelta(days=days - 1)

    # Query sales grouped by date
    sales_data = db.query(
        func.date(Sales.created_at).label("sale_date"),
        func.sum(Sales.total_amount).label("daily_total")
    ).filter(
        func.date(Sales.created_at) >= start_date,
        func.date(Sales.created_at) <= end_date
    ).group_by(
        func.date(Sales.created_at)
    ).order_by(
        func.date(Sales.created_at) # Order by date
    ).all()

    # Create a dictionary mapping dates (as strings) to sales totals
    sales_dict = { (start_date + timedelta(days=i)).strftime("%Y-%m-%d"): 0.0 for i in range(days) }

    # Populate the dictionary with actual sales data
    for record in sales_data:
        date_str = record.sale_date.strftime("%Y-%m-%d")
        if date_str in sales_dict: # Check if the date is within our range
            sales_dict[date_str] = float(record.daily_total)

    # Extract labels and data in the correct order
    labels = sorted(sales_dict.keys())
    data = [sales_dict[label] for label in labels]

    return {"labels": labels, "data": data}

# --- NEW: Sales by Category ---
@app.get("/reports/sales_by_category")
def get_sales_by_category(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    # Default to today if no dates provided
    if start_date is None:
        start_date = date.today()
    if end_date is None:
        end_date = date.today()

    category_sales_query = db.query(
        Category.category_name,
        func.sum(SaleItem.subtotal).label("total_sales") # Use computed subtotal
    ).select_from(SaleItem)\
    .join(Item, SaleItem.item_id == Item.item_id)\
    .join(Category, Item.category_id == Category.category_id)\
    .join(Sales, SaleItem.sale_id == Sales.sale_id)\
    .filter(func.date(Sales.created_at) >= start_date)\
    .filter(func.date(Sales.created_at) <= end_date)\
    .group_by(Category.category_name)\
    .order_by(desc("total_sales"))

    category_sales = category_sales_query.all()

    labels = [cs.category_name for cs in category_sales]
    data = [float(cs.total_sales) for cs in category_sales]

    return {"labels": labels, "data": data}

# --- NEW: Payment Method Distribution ---
@app.get("/reports/payment_methods_distribution")
def get_payment_distribution(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    if start_date is None:
        start_date = date.today()
    if end_date is None:
        end_date = date.today()

    payment_data_query = db.query(
        PaymentMethod.payment_method_name,
        func.sum(SplitPayment.amount).label("total_amount")
    ).select_from(SplitPayment)\
    .join(PaymentMethod, SplitPayment.payment_method_id == PaymentMethod.payment_method_id)\
    .join(Sales, SplitPayment.sale_id == Sales.sale_id)\
    .filter(func.date(Sales.created_at) >= start_date)\
    .filter(func.date(Sales.created_at) <= end_date)\
    .group_by(PaymentMethod.payment_method_name)\
    .order_by(desc("total_amount"))

    payment_data = payment_data_query.all()

    labels = [pd.payment_method_name for pd in payment_data]
    data = [float(pd.total_amount) for pd in payment_data]

    return {"labels": labels, "data": data}


# --- NEW: Low Stock Items ---
@app.get("/stock/low", response_model=List[dict]) # Return a list of dictionaries
def get_low_stock_items(limit: int = Query(10, ge=1, le=50), db: Session = Depends(get_db)):
    low_stock = db.query(
        Item.item_name,
        Stock.quantity,
        Stock.min_stock_level,
        Store.store_name # Include store name
    ).select_from(Stock)\
    .join(Item, Stock.item_id == Item.item_id)\
    .join(Store, Stock.store_id == Store.store_id) \
    .filter(Stock.quantity < Stock.min_stock_level)\
    .order_by(Stock.quantity.asc())\
    .limit(limit)\
    .all()

    return [
        {
            "item_name": item.item_name,
            "store_name": item.store_name,
            "quantity": item.quantity,
            "min_stock_level": item.min_stock_level
        } for item in low_stock
    ]

# --- NEW: Recent Sales ---
@app.get("/sales/recent", response_model=List[dict]) # Return a list of dictionaries
def get_recent_sales(limit: int = Query(5, ge=1, le=20), db: Session = Depends(get_db)):
    recent_sales = db.query(
            Sales.sale_id,
            Sales.created_at,
            Sales.total_amount,
            Sales.payment_status,
            Sales.staff_id,
            Sales.customer_id, # Optionally join Customer for name
            Staff.full_name.label("staff_name") # Join Staff for name
        )\
        .join(Staff, Sales.staff_id == Staff.staff_id) \
        .order_by(Sales.created_at.desc())\
        .limit(limit)\
        .all()

    return [
        {
            "sale_id": sale.sale_id,
            "created_at": sale.created_at.strftime("%Y-%m-%d %H:%M"), # Format time
            "total_amount": float(sale.total_amount),
            "payment_status": sale.payment_status.value if sale.payment_status else 'unknown',
            "staff_name": sale.staff_name,
            "customer_id": sale.customer_id # Add customer name here if joined
        } for sale in recent_sales
    ]

# ================================
# Other Utility Endpoints
# ================================

@app.get("/menu/categories")
def get_menu_categories(db: Session = Depends(get_db)):
    # This endpoint seems fine for listing categories with item counts
    categories = (
        db.query(
            Category.category_id,
            Category.category_name,
            Category.description,
            func.count(Item.item_id).label("item_count")
        )
        .outerjoin(Item, Category.category_id == Item.category_id)
        .filter(Category.status == 'active') # Only show active categories
        .group_by(Category.category_id, Category.category_name, Category.description)
        .order_by(Category.category_name)
        .all()
    )
    return [
        {
            "category_id": cat.category_id,
            "category_name": cat.category_name,
            "description": cat.description,
            "item_count": cat.item_count
        }
        for cat in categories
    ]

@app.get("/search")
def global_search(q: str = Query(..., min_length=2), db: Session = Depends(get_db)):
    limit = 10 # Limit search results
    staff_results = db.query(Staff).filter(
        (Staff.full_name.ilike(f"%{q}%")) | (Staff.email.ilike(f"%{q}%"))
    ).limit(limit // 2).all() # Limit staff results

    item_results = db.query(Item).filter(
        Item.item_name.ilike(f"%{q}%") | Item.barcode.ilike(f"%{q}%") # Search barcode too
    ).limit(limit // 2).all() # Limit item results

    customer_results = db.query(Customer).filter(
         (Customer.full_name.ilike(f"%{q}%")) | (Customer.phone_number.ilike(f"%{q}%"))
    ).limit(limit // 2).all() # Limit customer results

    suggestions = []
    for s in staff_results:
        suggestions.append({"type": "Staff", "label": f"{s.full_name} ({s.email})", "id": s.staff_id, "url": "staff.html"}) # Add ID
    for i in item_results:
        suggestions.append({"type": "Item", "label": f"{i.item_name} (Barcode: {i.barcode or 'N/A'})", "id": i.item_id, "url": "inventory.html"}) # Add ID
    for c in customer_results:
        suggestions.append({"type": "Customer", "label": f"{c.full_name} ({c.phone_number or 'N/A'})", "id": c.customer_id, "url": "customers.html"}) # Add ID

    return suggestions[:limit] # Ensure total limit isn't exceeded

# ================================
# Receipt and PDF Endpoints
# ================================
# (Keep existing generate_receipt and get_receipt_pdf)
# ... existing endpoints ...
@app.get("/sales/{sale_id}/receipt", response_model=dict)
def generate_receipt(sale_id: int, db: Session = Depends(get_db)):
    # Eager load related data
    sale = db.query(Sales)\
        .options(
            joinedload(Sales.sale_items).joinedload(SaleItem.item), # Load items within sale_items
            joinedload(Sales.payments) # Assuming payments relationship exists (check models.py)
        )\
        .filter(Sales.sale_id == sale_id).first()

    if not sale:
        raise HTTPException(status_code=404, detail="Sales record not found")

    items_detail = []
    calculated_total = 0.0
    total_tax = 0.0
    total_discount = 0.0

    for si in sale.sale_items:
        subtotal = si.quantity * float(si.unit_price)
        tax_amount = float(si.tax)
        discount_amount = float(si.discount)
        item_total = subtotal - discount_amount + tax_amount

        calculated_total += item_total
        total_tax += tax_amount
        total_discount += discount_amount

        items_detail.append({
            "item_name": si.item.item_name if si.item else "Unknown Item",
            "quantity": si.quantity,
            "unit_price": float(si.unit_price),
            "discount": discount_amount,
            "tax": tax_amount,
            "subtotal": item_total # Line item total after tax/discount
        })

    # Calculate total paid from SplitPayments
    total_paid = sum(float(p.amount) for p in sale.payments) # Assuming 'payments' is the relationship name for SplitPayment

    # Use calculated total if sale.total_amount seems off, or preferably rely on sale.total_amount
    final_total = float(sale.total_amount) # Trust the stored total amount
    balance = total_paid - final_total

    receipt = {
        "sale_id": sale.sale_id,
        "receipt_number": sale.receipt_number,
        "checkout_time": sale.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        "total_amount": final_total,
        "total_tax": total_tax,
        "total_discount": total_discount,
        "total_paid": total_paid, # Use sum from split payments
        "balance": balance,
        "payment_status": sale.payment_status.value if sale.payment_status else 'unknown',
        "items": items_detail,
        # Optionally add Staff Name, Customer Name
        # "staff_name": sale.staff.full_name if sale.staff else "N/A",
        # "customer_name": sale.customer.full_name if sale.customer else "N/A"
    }
    return receipt

@app.get("/sales/{sale_id}/receipt/pdf")
def get_receipt_pdf(sale_id: int, db: Session = Depends(get_db)):
    # Use the data generated by the JSON endpoint
    receipt_data = generate_receipt(sale_id, db)

    # Build table rows
    rows = ""
    for item in receipt_data["items"]:
        rows += f"""
              <tr>
                <td>{item['item_name']}</td>
                <td style="text-align: center;">{item['quantity']}</td>
                <td style="text-align: right;">Rs {item['unit_price']:.2f}</td>
                <td style="text-align: right;">Rs {item['subtotal']:.2f}</td>
              </tr>
        """

    html_content = f"""
    <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt #{receipt_data['receipt_number'] or receipt_data['sale_id']}</title>
        <style>
          body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10px; margin: 0; padding: 0; color: #333; }}
          .receipt {{ max-width: 300px; margin: auto; padding: 15px; border: 1px solid #eee; }}
          .header {{ text-align: center; margin-bottom: 15px; }}
          .header h1 {{ font-size: 16px; margin-bottom: 2px; font-weight: 600; }}
          .header p {{ margin: 2px 0; font-size: 9px; color: #555; }}
          table {{ width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 10px; }}
          th, td {{ padding: 4px 2px; border-bottom: 1px dotted #ccc; text-align: left; vertical-align: top; }}
          th {{ font-size: 10px; font-weight: 600; border-bottom: 1px solid #555;}}
          .summary {{ margin-top: 15px; font-size: 10px; border-top: 1px solid #555; padding-top: 8px;}}
          .summary p {{ margin: 4px 0; display: flex; justify-content: space-between; }}
          .summary p span:first-child {{ font-weight: 500; }}
          .summary .total {{ font-weight: bold; font-size: 11px; }}
          .footer {{ text-align: center; margin-top: 15px; font-size: 9px; color: #777; border-top: 1px dotted #ccc; padding-top: 8px;}}
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <h1>My POS System</h1>
            <p>123 Store Street, City, ST 12345</p>
            <p>Phone: (123) 456-7890</p>
            <hr style="border: none; border-top: 1px dotted #ccc; margin: 5px 0;">
            <p>Sale ID: {receipt_data['sale_id']}</p>
            <p>Receipt #: {receipt_data['receipt_number'] or 'N/A'}</p>
            <p>Date: {receipt_data['checkout_time']}</p>
             <!-- <p>Cashier: {receipt_data.get('staff_name', 'N/A')}</p> -->
             <!-- <p>Customer: {receipt_data.get('customer_name', 'Walk-in')}</p> -->
          </div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Price</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows}
            </tbody>
          </table>
          <div class="summary">
            <p><span>Subtotal:</span> <span>Rs {(receipt_data['total_amount'] + receipt_data['total_discount'] - receipt_data['total_tax']):.2f}</span></p>
            <p><span>Discounts:</span> <span>- Rs {receipt_data['total_discount']:.2f}</span></p>
            <p><span>Tax:</span> <span>+ Rs {receipt_data['total_tax']:.2f}</span></p>
            <p class="total"><span>Total Amount:</span> <span>Rs {receipt_data['total_amount']:.2f}</span></p>
            <hr style="border: none; border-top: 1px dotted #ccc; margin: 5px 0;">
            <p><span>Total Paid:</span> <span>Rs {receipt_data['total_paid']:.2f}</span></p>
            <p><span>Balance/Change:</span> <span>Rs {receipt_data['balance']:.2f}</span></p>
            <p><span>Payment Status:</span> <span>{receipt_data['payment_status'].upper()}</span></p>
             <!-- Add payment method details if needed -->
          </div>
          <div class="footer">
            <p>Thank you for your purchase!</p>
            <p>Visit again!</p>
             <!-- Add barcode/QR code area if needed -->
          </div>
        </div>
      </body>
    </html>
    """
    pdf_bytes = HTML(string=html_content).write_pdf()
    return StreamingResponse(io.BytesIO(pdf_bytes),
                             media_type="application/pdf",
                             headers={"Content-Disposition": f"inline; filename=receipt_{sale_id}.pdf"}) # Use inline to display in browser

# ================================
# Sales Report PDF Endpoint
# ================================
@app.get("/sales_report/pdf")
def download_sales_report(period: str = Query("daily", enum=["daily", "weekly", "monthly", "yearly"]), db: Session = Depends(get_db)):

    query_base = db.query(
        func.sum(Sales.total_amount).label("total_sales"),
        func.count(Sales.sale_id).label("total_orders")
    )

    if period == "daily":
        results = query_base.add_column(func.date(Sales.created_at).label("period"))\
                            .group_by(func.date(Sales.created_at))\
                            .order_by(func.date(Sales.created_at).desc())\
                            .all()
        period_label = "Date"
    elif period == "weekly":
        # Use DATE_FORMAT for weekly reports in MySQL
        results = query_base.add_column(func.date_format(Sales.created_at, "%Y-W%U").label("period"))\
                            .group_by(func.date_format(Sales.created_at, "%Y-W%U"))\
                            .order_by(func.date_format(Sales.created_at, "%Y-W%U").desc())\
                            .all()
        period_label = "Week (YYYY-Www)"
    elif period == "monthly":
        # Use DATE_FORMAT for monthly reports in MySQL
        results = query_base.add_column(func.date_format(Sales.created_at, "%Y-%m").label("period"))\
                            .group_by(func.date_format(Sales.created_at, "%Y-%m"))\
                            .order_by(func.date_format(Sales.created_at, "%Y-%m").desc())\
                            .all()
        period_label = "Month (YYYY-MM)"
    elif period == "yearly":
        # Use DATE_FORMAT for yearly reports in MySQL
        results = query_base.add_column(func.date_format(Sales.created_at, "%Y").label("period"))\
                            .group_by(func.date_format(Sales.created_at, "%Y"))\
                            .order_by(func.date_format(Sales.created_at, "%Y").desc())\
                            .all()
        period_label = "Year (YYYY)"

    html_content = f"""
    <html>
      <head>
        <meta charset="utf-8">
        <title>{period.capitalize()} Sales Report</title>
        <style>
          @page {{ size: A4; margin: 1.5cm; }}
          body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; color: #333; }}
          h1 {{ text-align: center; color: #2a2185; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 25px; font-size: 18px;}}
          table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
          th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
          th {{ background-color: #f2f2f7; font-weight: 600; font-size: 12px; }}
          td {{ font-size: 11px; }}
          tr:nth-child(even) {{ background-color: #f9f9f9; }}
          .total-row td {{ font-weight: bold; background-color: #e9e9f2; border-top: 2px solid #aaa; }}
          .text-right {{ text-align: right; }}
          .footer {{ position: fixed; bottom: -1cm; left: 0; right: 0; text-align: center; font-size: 9px; color: #888; }}
          .header-info {{ margin-bottom: 20px; font-size: 10px; color: #555;}}
          .header-info p {{ margin: 3px 0; }}
        </style>
      </head>
      <body>
        <!-- <div class="footer">Page <span class="page"></span> of <span class="topage"></span></div> -->
        <h1>{period.capitalize()} Sales Report</h1>
        <div class="header-info">
            <p>Report Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
            <!-- Add Store Name if filtering by store -->
        </div>
        <table>
          <thead>
            <tr>
              <th>{period_label}</th>
              <th class="text-right">Total Sales (Rs)</th>
              <th class="text-right">Total Orders</th>
            </tr>
          </thead>
          <tbody>
    """
    grand_total_sales = 0.0
    grand_total_orders = 0
    for row in results:
        grand_total_sales += float(row.total_sales) if row.total_sales else 0 # Convert to float
        grand_total_orders += row.total_orders if row.total_orders else 0
        html_content += f"""
            <tr>
              <td>{row.period}</td>
              <td class="text-right">{row.total_sales:.2f}</td>
              <td class="text-right">{row.total_orders}</td>
            </tr>
        """

    # Add a total row
    html_content += f"""
          </tbody>
          <tfoot>
            <tr class="total-row">
                <td>Grand Total</td>
                <td class="text-right">{grand_total_sales:.2f}</td>
                <td class="text-right">{grand_total_orders}</td>
            </tr>
          </tfoot>
        </table>
      </body>
    </html>
    """
    pdf_bytes = HTML(string=html_content).write_pdf()
    return StreamingResponse(io.BytesIO(pdf_bytes),
                             media_type="application/pdf",
                             headers={"Content-Disposition": f"inline; filename={period}_sales_report.pdf"}) # Use inline

@app.get("/reports/sales/summary/pdf")
def get_sales_summary_pdf(
    start_date: date = Query(..., description="Start date for the report (YYYY-MM-DD)"),
    end_date: date = Query(..., description="End date for the report (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """
    Generates a sales summary PDF report for a custom date range.
    """

    # Query the database for sales data within the specified date range
    sales_data = db.query(
        func.sum(Sales.total_amount).label("total_sales"),
        func.count(Sales.sale_id).label("total_orders")
    ).filter(
        Sales.sale_date >= start_date,
        Sales.sale_date <= end_date
    ).first()

    total_sales = sales_data.total_sales if sales_data else 0.0
    total_orders = sales_data.total_orders if sales_data else 0

    # Query the database for sales data within the specified date range
    sales_by_category = db.query(
        Category.category_name,
        func.sum(SaleItem.quantity).label("total_quantity")
    ).join(Item, SaleItem.item_id == Item.item_id).join(Category, Item.category_id == Category.category_id).join(Sales, SaleItem.sale_id == Sales.sale_id).filter(Sales.sale_date >= start_date,Sales.sale_date <= end_date).group_by(Category.category_name).all()

    # Generate HTML content for the PDF report
    html_content = f"""
    <html>
    <head>
    <meta charset="utf-8">
    <title>Sales Summary Report ({start_date} - {end_date})</title>
    <style>
      @page {{ size: A4; margin: 1.5cm; }}
      body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; color: #333; }}
      h1 {{ text-align: center; color: #2a2185; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 25px; font-size: 18px;}}
      table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
      th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
      th {{ background-color: #f2f2f7; font-weight: 600; font-size: 12px; }}
      td {{ font-size: 11px; }}
      tr:nth-child(even) {{ background-color: #f9f9f9; }}
      .total-row td {{ font-weight: bold; background-color: #e9e9f2; border-top: 2px solid #aaa; }}
      .text-right {{ text-align: right; }}
      .footer {{ position: fixed; bottom: -1cm; left: 0; right: 0; text-align: center; font-size: 9px; color: #888; }}
      .header-info {{ margin-bottom: 20px; font-size: 10px; color: #555;}}
      .header-info p {{ margin: 3px 0; }}
    </style>
    </head>
    <body>
    <h1>Sales Summary Report</h1>
    <div class="header-info">
        <p>Report Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        <p>Date Range: {start_date} - {end_date}</p>
    </div>
    <table>
    <thead>
        <tr>
            <th>Metric</th>
            <th class="text-right">Value</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>Total Sales</td>
            <td class="text-right">{total_sales:.2f}</td>
        </tr>
        <tr>
            <td>Total Orders</td>
            <td class="text-right">{total_orders}</td>
        </tr>
    </tbody>
    </table>
    <h2>Sales By Category</h2>
    <table>
        <thead>
            <tr>
                <th>Category</th>
                <th>Quantity Sold</th>
            </tr>
        </thead>
        <tbody>
    """

    for cat in sales_by_category:
        html_content += f"""
            <tr>
                <td>{cat.category_name}</td>
                <td>{cat.total_quantity}</td>
            </tr>
        """

    html_content += """
        </tbody>
    </table>
    </body>
    </html>
    """

    # Generate the PDF
    pdf_bytes = HTML(string=html_content).write_pdf()
    return StreamingResponse(io.BytesIO(pdf_bytes),
                             media_type="application/pdf",
                             headers={"Content-Disposition": f"inline; filename=sales_summary_{start_date}_{end_date}.pdf"})

from fastapi import Query

@app.get("/reports/stock/level/pdf")
def get_stock_level_pdf(
    status_filter: Optional[str] = Query(None, description="Filter by stock status (e.g., 'low')"),
    db: Session = Depends(get_db)
):
    """
    Generates a stock level PDF report, optionally filtered by stock status.
    """

    query = db.query(
        Item.item_name,
        Stock.quantity,
        Stock.min_stock_level,
        Store.store_name
    ).join(Stock, Item.item_id == Stock.item_id)\
     .join(Store, Stock.store_id == Store.store_id)

    if status_filter == "low":
        query = query.filter(Stock.quantity < Stock.min_stock_level)

    stock_data = query.all()

    # Generate HTML content for the PDF report
    html_content = f"""
    <html>
    <head>
    <meta charset="utf-8">
    <title>Stock Level Report</title>
    <style>
      @page {{ size: A4; margin: 1.5cm; }}
      body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; color: #333; }}
      h1 {{ text-align: center; color: #2a2185; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 25px; font-size: 18px;}}
      table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
      th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
      th {{ background-color: #f2f2f7; font-weight: 600; font-size: 12px; }}
      td {{ font-size: 11px; }}
      tr:nth-child(even) {{ background-color: #f9f9f9; }}
      .total-row td {{ font-weight: bold; background-color: #e9e9f2; border-top: 2px solid #aaa; }}
      .text-right {{ text-align: right; }}
      .footer {{ position: fixed; bottom: -1cm; left: 0; right: 0; text-align: center; font-size: 9px; color: #888; }}
      .header-info {{ margin-bottom: 20px; font-size: 10px; color: #555;}}
      .header-info p {{ margin: 3px 0; }}
    </style>
    </head>
    <body>
    <h1>Stock Level Report</h1>
    <div class="header-info">
        <p>Report Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        {'<p>Status Filter: Low Stock</p>' if status_filter == 'low' else ''}
    </div>
    <table>
    <thead>
        <tr>
            <th>Item Name</th>
            <th>Store Name</th>
            <th>Quantity</th>
            <th>Minimum Stock Level</th>
        </tr>
    </thead>
    <tbody>
    """

    for item in stock_data:
        html_content += f"""
        <tr>
            <td>{item.item_name}</td>
            <td>{item.store_name}</td>
            <td>{item.quantity}</td>
            <td>{item.min_stock_level}</td>
        </tr>
        """

    html_content += """
    </tbody>
    </table>
    </body>
    </html>
    """

    # Generate the PDF
    pdf_bytes = HTML(string=html_content).write_pdf()
    return StreamingResponse(io.BytesIO(pdf_bytes),
                             media_type="application/pdf",
                             headers={"Content-Disposition": f"inline; filename=stock_level_report.pdf"})
# --- END OF FILE ---