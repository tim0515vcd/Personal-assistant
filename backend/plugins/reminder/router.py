from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from .models import ReminderItem

router = APIRouter()


class ItemCreate(BaseModel):
    name: str
    freq_days: int = 7
    category: str | None = None


class ItemUpdate(BaseModel):
    freq_days: int | None = None
    category: str | None = None
    last_done: date | None = None


class ItemOut(BaseModel):
    id: int
    name: str
    freq_days: int
    category: str | None
    last_done: date | None
    days_since: int | None
    is_overdue: bool

    model_config = {"from_attributes": True}


@router.get("/items", response_model=list[ItemOut])
async def list_items(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ReminderItem).order_by(ReminderItem.name))
    return result.scalars().all()


@router.post("/items", response_model=ItemOut, status_code=201)
async def create_item(body: ItemCreate, db: AsyncSession = Depends(get_db)):
    item = ReminderItem(
        name=body.name, freq_days=body.freq_days, category=body.category
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.patch("/items/{item_id}", response_model=ItemOut)
async def update_item(
    item_id: int, body: ItemUpdate, db: AsyncSession = Depends(get_db)
):
    item = await db.get(ReminderItem, item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    if body.freq_days is not None:
        item.freq_days = body.freq_days
    if body.category is not None:
        item.category = body.category
    if body.last_done is not None:
        item.last_done = body.last_done
    await db.commit()
    await db.refresh(item)
    return item


@router.post("/items/{item_id}/done", response_model=ItemOut)
async def mark_done(item_id: int, db: AsyncSession = Depends(get_db)):
    item = await db.get(ReminderItem, item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    item.last_done = date.today()
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/items/{item_id}", status_code=204)
async def delete_item(item_id: int, db: AsyncSession = Depends(get_db)):
    item = await db.get(ReminderItem, item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    await db.delete(item)
    await db.commit()
