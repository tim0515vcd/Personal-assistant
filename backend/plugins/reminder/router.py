from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from .models import ReminderItem, ReminderLog

router = APIRouter()


class ItemCreate(BaseModel):
    name: str
    freq_days: int = 7
    category: str | None = None
    target_count: int = 1


class ItemUpdate(BaseModel):
    freq_days: int | None = None
    category: str | None = None
    last_done: date | None = None
    target_count: int | None = None


class ItemOut(BaseModel):
    id: int
    name: str
    freq_days: int
    category: str | None
    last_done: date | None
    days_since: int | None
    is_overdue: bool
    target_count: int
    current_count: int

    model_config = {"from_attributes": True}


async def _current_count(db: AsyncSession, item_id: int, freq_days: int) -> int:
    since = date.today() - timedelta(days=freq_days - 1)
    result = await db.execute(
        select(func.count()).select_from(ReminderLog).where(
            ReminderLog.item_id == item_id,
            ReminderLog.done_date >= since,
        )
    )
    return result.scalar() or 0


async def _to_out(db: AsyncSession, item: ReminderItem) -> ItemOut:
    cc = await _current_count(db, item.id, item.freq_days)
    return ItemOut(
        id=item.id,
        name=item.name,
        freq_days=item.freq_days,
        category=item.category,
        last_done=item.last_done,
        days_since=item.days_since,
        is_overdue=cc < item.target_count,
        target_count=item.target_count,
        current_count=cc,
    )


@router.get("/items", response_model=list[ItemOut])
async def list_items(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ReminderItem).order_by(ReminderItem.name))
    items = result.scalars().all()
    return [await _to_out(db, item) for item in items]


@router.post("/items", response_model=ItemOut, status_code=201)
async def create_item(body: ItemCreate, db: AsyncSession = Depends(get_db)):
    item = ReminderItem(
        name=body.name,
        freq_days=body.freq_days,
        category=body.category,
        target_count=max(1, body.target_count),
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return await _to_out(db, item)


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
    if body.target_count is not None:
        item.target_count = max(1, body.target_count)
    await db.commit()
    await db.refresh(item)
    return await _to_out(db, item)


@router.post("/items/{item_id}/done", response_model=ItemOut)
async def mark_done(item_id: int, db: AsyncSession = Depends(get_db)):
    item = await db.get(ReminderItem, item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    today = date.today()
    item.last_done = today
    db.add(ReminderLog(item_id=item_id, done_date=today))
    await db.commit()
    await db.refresh(item)
    return await _to_out(db, item)


@router.delete("/items/{item_id}", status_code=204)
async def delete_item(item_id: int, db: AsyncSession = Depends(get_db)):
    item = await db.get(ReminderItem, item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    await db.delete(item)
    await db.commit()
