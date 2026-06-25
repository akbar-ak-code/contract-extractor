# database/models.py
from sqlalchemy import Column, Integer, String, Text, JSON, DateTime
from sqlalchemy.sql import func
from .connection import Base

class PurchaseOrderRecord(Base):
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    
    # 🔐 NEW: The SHA-256 Cryptographic Hash for Deduplication
    file_hash = Column(String, unique=True, index=True)
    
    # 📁 The critical column for your Reference feature!
    pdf_file_path = Column(String) 
    
    # 📝 Extracted AI Fields
    po_number = Column(String, index=True)
    vendor_name = Column(String, index=True)
    vendor_contact_address = Column(Text)
    effective_date = Column(String)
    lapse_expiry_date = Column(String)
    total_value = Column(String)
    conditions_of_agreement = Column(Text)
    conditions_of_payment = Column(Text)
    authorising_signatory = Column(String)
    
    # Nested Tabular Data
    line_items = Column(JSON)

    # Source Quotes for the UI Reference Feature
    source_quotes = Column(JSON)

    # Human-in-the-Loop Workflow Tracking
    status = Column(String, default="Pending Review") 
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())