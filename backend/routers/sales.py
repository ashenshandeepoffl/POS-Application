from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List
from models import Sales, SaleItem, Stock, StockHistory
from schemas import SalesCreate, SaleItemCreate, SalesResponse
from database import SessionLocal

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/sales/full", response_model=SalesResponse)
def create_sale_full(
    sale: SalesCreate,
    sale_items: List[SaleItemCreate],
    db: Session = Depends(get_db)
):
    # Create the sale record first
    db_sale = Sales(**sale.dict())
    db.add(db_sale)
    db.commit()
    db.refresh(db_sale)

    # Calculate total value of all sale items for allocation purposes
    total_items_value = sum(item.quantity * item.unit_price for item in sale_items)
    
    # Process each sale item
    for item in sale_items:
        # Allocate discount and tax proportionally (if provided in sale)
        # (Ensure your SalesCreate schema has discount_global and tax_global if needed.)
        proportion = (item.quantity * item.unit_price) / total_items_value if total_items_value > 0 else 0
        allocated_discount = sale.discount_global * proportion if hasattr(sale, "discount_global") else 0.0
        allocated_tax = sale.tax_global * proportion if hasattr(sale, "tax_global") else 0.0

        sale_item_data = item.dict()
        sale_item_data["discount"] = allocated_discount
        sale_item_data["tax"] = allocated_tax

        db_sale_item = SaleItem(sale_id=db_sale.sale_id, **sale_item_data)
        db.add(db_sale_item)

        # Update stock: Find the stock record for this item in the given store.
        stock_obj = db.query(Stock).filter(
            Stock.item_id == item.item_id,
            Stock.store_id == db_sale.store_id
        ).first()
        if not stock_obj:
            raise HTTPException(status_code=404, detail=f"Stock record not found for item {item.item_id}")
        if stock_obj.quantity < item.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for item {item.item_id}")
        stock_obj.quantity -= item.quantity

        # Log stock history
        history = StockHistory(
            stock_id=stock_obj.stock_id,
            quantity_change=-item.quantity,
            change_type="sale",  # You might want to use an enum for change_type
            reason=f"Sale ID {db_sale.sale_id}"
        )
        db.add(history)
    
    db.commit()
    return db_sale
