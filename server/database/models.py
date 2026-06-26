from sqlalchemy import Column, Integer, String, Text, JSON, DateTime
from sqlalchemy.sql import func
from .connection import Base

class PurchaseOrderRecord(Base):
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    file_hash = Column(String, unique=True, index=True)
    pdf_file_path = Column(String) 
    
    po_number = Column(String, index=True)
    vendor_name = Column(String, index=True)
    vendor_contact_address = Column(Text)
    effective_date = Column(String)
    lapse_expiry_date = Column(String)
    total_value = Column(String)
    conditions_of_agreement = Column(Text)
    conditions_of_payment = Column(Text)
    authorising_signatory = Column(String)
    
    line_items = Column(JSON)
    source_quotes = Column(JSON)
    
    custom_extracted_data = Column(JSON, default={})

    status = Column(String, default="Pending Review") 
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class CustomField(Base):
    __tablename__ = "custom_fields"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True) 
    description = Column(String) 
    example = Column(String, nullable=True) 
    created_at = Column(DateTime(timezone=True), server_default=func.now())
