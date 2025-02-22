# main.py
from fastapi import FastAPI, HTTPException, Depends, status
from sqlalchemy.orm import Session
from typing import List
import bcrypt

from database import engine, SessionLocal
from models import Base, Role, Permission, Category, Item, Customer, Staff, Store, Stock, Order, OrderItem, Payment
from schemas import (
    RoleCreate, RoleResponse,
    PermissionCreate, PermissionResponse,
    CategoryCreate, CategoryResponse,
    ItemCreate, ItemResponse,
    CustomerCreate, CustomerResponse,   
    StaffCreate, StaffResponse,
    StoreCreate, StoreResponse,
    StockCreate, StockResponse,
    OrderCreate, OrderResponse,
    OrderItemCreate, OrderItemResponse,
    PaymentCreate, PaymentResponse
)

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
        stock=item.stock,
        is_perishable=item.is_perishable,
        image_url=item.image_url
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@app.get("/items/", response_model=List[ItemResponse])
def get_items(db: Session = Depends(get_db)):
    return db.query(Item).all()

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
    item.stock = item_update.stock
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

# ================================
# CRUD Endpoints for Customers
# ================================
@app.post("/customers/", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(customer: CustomerCreate, db: Session = Depends(get_db)):
    db_customer = Customer(
        full_name=customer.full_name,
        email=customer.email,
        phone_number=customer.phone_number,
        address=customer.address,
        loyalty_points=customer.loyalty_points
    )
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return db_customer

@app.get("/customers/", response_model=List[CustomerResponse])
def get_customers(db: Session = Depends(get_db)):
    return db.query(Customer).all()

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
    customer.address = customer_update.address
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

# ---------------- Staff Endpoints -------------------
@app.post("/staff/", response_model=StaffResponse, status_code=status.HTTP_201_CREATED)
def create_staff(staff: StaffCreate, db: Session = Depends(get_db)):
    # Check if email is already used
    existing = db.query(Staff).filter(Staff.email == staff.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    # Hash the password
    hashed_password = bcrypt.hashpw(staff.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    new_staff = Staff(
        full_name=staff.full_name,
        email=staff.email,
        role=staff.role,
        phone_number=staff.phone_number,
        date_of_birth=staff.date_of_birth,
        salary=staff.salary,
        shift_start_time=staff.shift_start_time,
        shift_end_time=staff.shift_end_time,
        address=staff.address,
        additional_details=staff.additional_details,
        password_hash=hashed_password
    )
    db.add(new_staff)
    db.commit()
    db.refresh(new_staff)
    return new_staff

@app.get("/staff/", response_model=List[StaffResponse])
def get_staff(db: Session = Depends(get_db)):
    return db.query(Staff).all()

@app.get("/staff/{staff_id}", response_model=StaffResponse)
def get_staff_by_id(staff_id: int, db: Session = Depends(get_db)):
    staff_obj = db.query(Staff).filter(Staff.staff_id == staff_id).first()
    if not staff_obj:
        raise HTTPException(status_code=404, detail="Staff not found")
    return staff_obj

@app.put("/staff/{staff_id}", response_model=StaffResponse)
def update_staff(staff_id: int, staff_update: StaffCreate, db: Session = Depends(get_db)):
    staff_obj = db.query(Staff).filter(Staff.staff_id == staff_id).first()
    if not staff_obj:
        raise HTTPException(status_code=404, detail="Staff not found")
    staff_obj.full_name = staff_update.full_name
    staff_obj.email = staff_update.email
    staff_obj.role = staff_update.role
    staff_obj.phone_number = staff_update.phone_number
    staff_obj.date_of_birth = staff_update.date_of_birth
    staff_obj.salary = staff_update.salary
    staff_obj.shift_start_time = staff_update.shift_start_time
    staff_obj.shift_end_time = staff_update.shift_end_time
    staff_obj.address = staff_update.address
    staff_obj.additional_details = staff_update.additional_details
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

# ---------------- Store Endpoints -------------------
@app.post("/stores/", response_model=StoreResponse, status_code=status.HTTP_201_CREATED)
def create_store(store: StoreCreate, db: Session = Depends(get_db)):
    new_store = Store(
        store_name=store.store_name,
        location=store.location,
        contact_number=store.contact_number,
        manager_id=store.manager_id,
        status=store.status
    )
    db.add(new_store)
    db.commit()
    db.refresh(new_store)
    return new_store

@app.get("/stores/", response_model=List[StoreResponse])
def get_stores(db: Session = Depends(get_db)):
    return db.query(Store).all()

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
    store_obj.location = store_update.location
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

# ---------------- Stock Endpoints -------------------
@app.post("/stock/", response_model=StockResponse, status_code=status.HTTP_201_CREATED)
def create_stock(stock: StockCreate, db: Session = Depends(get_db)):
    new_stock = Stock(
        store_id=stock.store_id,
        item_id=stock.item_id,
        quantity=stock.quantity,
        min_stock_level=stock.min_stock_level
    )
    db.add(new_stock)
    db.commit()
    db.refresh(new_stock)
    return new_stock

@app.get("/stock/", response_model=List[StockResponse])
def get_stock(db: Session = Depends(get_db)):
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
    stock_obj.store_id = stock_update.store_id
    stock_obj.item_id = stock_update.item_id
    stock_obj.quantity = stock_update.quantity
    stock_obj.min_stock_level = stock_update.min_stock_level
    db.commit()
    db.refresh(stock_obj)
    return stock_obj

@app.delete("/stock/{stock_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_stock(stock_id: int, db: Session = Depends(get_db)):
    stock_obj = db.query(Stock).filter(Stock.stock_id == stock_id).first()
    if not stock_obj:
        raise HTTPException(status_code=404, detail="Stock not found")
    db.delete(stock_obj)
    db.commit()
    return None

# --------------
# Order Endpoints
# --------------
@app.post("/orders/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(order: OrderCreate, db: Session = Depends(get_db)):
    db_order = Order(**order.dict())
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order

@app.get("/orders/", response_model=List[OrderResponse])
def get_orders(db: Session = Depends(get_db)):
    return db.query(Order).all()

@app.get("/orders/{order_id}", response_model=OrderResponse)
def get_order(order_id: int, db: Session = Depends(get_db)):
    db_order = db.query(Order).filter(Order.order_id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
    return db_order

@app.put("/orders/{order_id}", response_model=OrderResponse)
def update_order(order_id: int, order_update: OrderCreate, db: Session = Depends(get_db)):
    db_order = db.query(Order).filter(Order.order_id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
    for key, value in order_update.dict().items():
        setattr(db_order, key, value)
    db.commit()
    db.refresh(db_order)
    return db_order

@app.delete("/orders/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(order_id: int, db: Session = Depends(get_db)):
    db_order = db.query(Order).filter(Order.order_id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
    db.delete(db_order)
    db.commit()
    return None

# ------------------
# OrderItem Endpoints
# ------------------
@app.post("/order_items/", response_model=OrderItemResponse, status_code=status.HTTP_201_CREATED)
def create_order_item(order_item: OrderItemCreate, db: Session = Depends(get_db)):
    db_order_item = OrderItem(
        order_id=order_item.order_id,
        item_id=order_item.item_id,
        quantity=order_item.quantity,
        price=order_item.price
    )
    db.add(db_order_item)
    db.commit()
    db.refresh(db_order_item)
    return db_order_item

@app.get("/order_items/", response_model=List[OrderItemResponse])
def get_order_items(db: Session = Depends(get_db)):
    return db.query(OrderItem).all()

@app.get("/order_items/{order_item_id}", response_model=OrderItemResponse)
def get_order_item(order_item_id: int, db: Session = Depends(get_db)):
    db_order_item = db.query(OrderItem).filter(OrderItem.order_item_id == order_item_id).first()
    if not db_order_item:
        raise HTTPException(status_code=404, detail="Order item not found")
    return db_order_item

@app.put("/order_items/{order_item_id}", response_model=OrderItemResponse)
def update_order_item(order_item_id: int, order_item_update: OrderItemCreate, db: Session = Depends(get_db)):
    db_order_item = db.query(OrderItem).filter(OrderItem.order_item_id == order_item_id).first()
    if not db_order_item:
        raise HTTPException(status_code=404, detail="Order item not found")
    for key, value in order_item_update.dict().items():
        setattr(db_order_item, key, value)
    db.commit()
    db.refresh(db_order_item)
    return db_order_item

@app.delete("/order_items/{order_item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order_item(order_item_id: int, db: Session = Depends(get_db)):
    db_order_item = db.query(OrderItem).filter(OrderItem.order_item_id == order_item_id).first()
    if not db_order_item:
        raise HTTPException(status_code=404, detail="Order item not found")
    db.delete(db_order_item)
    db.commit()
    return None

# --------------
# Payment Endpoints
# --------------
@app.post("/payments/", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
def create_payment(payment: PaymentCreate, db: Session = Depends(get_db)):
    db_payment = Payment(**payment.dict())
    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)
    return db_payment

@app.get("/payments/", response_model=List[PaymentResponse])
def get_payments(db: Session = Depends(get_db)):
    return db.query(Payment).all()

@app.get("/payments/{payment_id}", response_model=PaymentResponse)
def get_payment(payment_id: int, db: Session = Depends(get_db)):
    db_payment = db.query(Payment).filter(Payment.payment_id == payment_id).first()
    if not db_payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return db_payment

@app.put("/payments/{payment_id}", response_model=PaymentResponse)
def update_payment(payment_id: int, payment_update: PaymentCreate, db: Session = Depends(get_db)):
    db_payment = db.query(Payment).filter(Payment.payment_id == payment_id).first()
    if not db_payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    for key, value in payment_update.dict().items():
        setattr(db_payment, key, value)
    db.commit()
    db.refresh(db_payment)
    return db_payment

@app.delete("/payments/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payment(payment_id: int, db: Session = Depends(get_db)):
    db_payment = db.query(Payment).filter(Payment.payment_id == payment_id).first()
    if not db_payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    db.delete(db_payment)
    db.commit()
    return None
