from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from .models import CycleRecord

router = APIRouter()


class RecordIn(BaseModel):
    start_date: date
    cycle_length: int | None = None
    notes: str | None = None


class RecordUpdate(BaseModel):
    cycle_length: int | None = None
    notes: str | None = None


class RecordOut(BaseModel):
    id: int
    start_date: date
    cycle_length: int | None
    notes: str | None

    model_config = {"from_attributes": True}


@router.get("/records", response_model=list[RecordOut])
async def list_records(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CycleRecord).order_by(CycleRecord.start_date.desc())
    )
    return result.scalars().all()


@router.post("/records", response_model=RecordOut)
async def add_record(body: RecordIn, db: AsyncSession = Depends(get_db)):
    record = CycleRecord(**body.model_dump())
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.patch("/records/{record_id}", response_model=RecordOut)
async def update_record(
    record_id: int, body: RecordUpdate, db: AsyncSession = Depends(get_db)
):
    record = await db.get(CycleRecord, record_id)
    if not record:
        raise HTTPException(404, "Record not found")
    if body.cycle_length is not None:
        record.cycle_length = body.cycle_length
    if body.notes is not None:
        record.notes = body.notes
    await db.commit()
    await db.refresh(record)
    return record


@router.delete("/records/{record_id}")
async def delete_record(record_id: int, db: AsyncSession = Depends(get_db)):
    record = await db.get(CycleRecord, record_id)
    if not record:
        raise HTTPException(404, "Record not found")
    await db.delete(record)
    await db.commit()
    return {"ok": True}


@router.get("/forecast")
async def get_forecast(db: AsyncSession = Depends(get_db)):
    from core.settings_service import get_setting

    default_cycle = int(await get_setting("cycle_default_length", "28"))
    period_length = int(await get_setting("period_default_length", "8"))

    result = await db.execute(select(CycleRecord).order_by(CycleRecord.start_date))
    records = result.scalars().all()

    if not records:
        return {
            "has_data": False,
            "default_cycle": default_cycle,
            "avg_cycle": default_cycle,
            "period_length": period_length,
        }

    # 用相鄰記錄的間距計算週期長度；若有手動設定則優先採用
    lengths = []
    for i in range(len(records) - 1):
        if records[i].cycle_length is not None:
            lengths.append(records[i].cycle_length)
        else:
            delta = (records[i + 1].start_date - records[i].start_date).days
            if 15 <= delta <= 60:
                lengths.append(delta)

    avg_cycle = round(sum(lengths) / len(lengths)) if lengths else default_cycle

    last = records[-1]
    today = date.today()
    current_day = (today - last.start_date).days + 1
    next_period = last.start_date + timedelta(days=avg_cycle)
    ovulation = last.start_date + timedelta(days=avg_cycle - 14)
    fertile_start = ovulation - timedelta(days=5)
    fertile_end = ovulation + timedelta(days=1)

    period_end = last.start_date + timedelta(days=period_length - 1)
    next_period_end = next_period + timedelta(days=period_length - 1)

    return {
        "has_data": True,
        "default_cycle": default_cycle,
        "period_length": period_length,
        "last_period": last.start_date.isoformat(),
        "period_end": period_end.isoformat(),
        "current_day": current_day,
        "avg_cycle": avg_cycle,
        "next_period": next_period.isoformat(),
        "next_period_end": next_period_end.isoformat(),
        "ovulation": ovulation.isoformat(),
        "fertile_start": fertile_start.isoformat(),
        "fertile_end": fertile_end.isoformat(),
        "today": today.isoformat(),
    }
