from datetime import date as DateType
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from .models import Car, FuelRecord

router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────

class CarCreate(BaseModel):
    name: str


class CarUpdate(BaseModel):
    name: str


class CarOut(BaseModel):
    id: int
    name: str
    is_default: bool
    record_count: int

    model_config = {"from_attributes": True}


class RecordCreate(BaseModel):
    odometer: int
    liters: float
    cost: int
    date: DateType | None = None
    car_id: int | None = None


class RecordOut(BaseModel):
    id: int
    date: DateType
    odometer: int
    liters: float
    cost: int
    distance: int | None
    efficiency: float | None
    car_id: int | None

    model_config = {"from_attributes": True}


class RecordUpdate(BaseModel):
    odometer: int | None = None
    liters: float | None = None
    cost: int | None = None
    date: DateType | None = None


# ── Helpers ───────────────────────────────────────────────────

def _attach_stats(records: list[FuelRecord]) -> list[RecordOut]:
    sorted_asc = sorted(records, key=lambda r: r.odometer)
    out = []
    for i, r in enumerate(sorted_asc):
        prev = sorted_asc[i - 1] if i > 0 else None
        distance = r.odometer - prev.odometer if prev else None
        efficiency = (
            round(distance / r.liters, 1)
            if distance and distance > 0 and r.liters > 0
            else None
        )
        out.append(
            RecordOut(
                id=r.id,
                date=r.date,
                odometer=r.odometer,
                liters=r.liters,
                cost=r.cost,
                distance=distance,
                efficiency=efficiency,
                car_id=r.car_id,
            )
        )
    return list(reversed(out))


async def _get_default_car_id(db: AsyncSession) -> int | None:
    result = await db.execute(select(Car).where(Car.is_default.is_(True)).limit(1))
    car = result.scalar_one_or_none()
    if car:
        return car.id
    result2 = await db.execute(select(Car).limit(1))
    car2 = result2.scalar_one_or_none()
    return car2.id if car2 else None


async def _car_record_count(db: AsyncSession, car_id: int) -> int:
    cnt = await db.scalar(
        select(func.count()).select_from(FuelRecord).where(FuelRecord.car_id == car_id)
    )
    return cnt or 0


# ── Car endpoints ─────────────────────────────────────────────

@router.get("/cars", response_model=list[CarOut])
async def list_cars(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Car))
    cars = result.scalars().all()
    out = []
    for c in cars:
        out.append(CarOut(
            id=c.id,
            name=c.name,
            is_default=c.is_default,
            record_count=await _car_record_count(db, c.id),
        ))
    return out


@router.post("/cars", response_model=CarOut, status_code=201)
async def create_car(body: CarCreate, db: AsyncSession = Depends(get_db)):
    total = await db.scalar(select(func.count()).select_from(Car))
    car = Car(name=body.name.strip(), is_default=(total == 0))
    db.add(car)
    await db.commit()
    return CarOut(id=car.id, name=car.name, is_default=car.is_default, record_count=0)


@router.patch("/cars/{car_id}", response_model=CarOut)
async def update_car(car_id: int, body: CarUpdate, db: AsyncSession = Depends(get_db)):
    car = await db.get(Car, car_id)
    if not car:
        raise HTTPException(404, "Car not found")
    car.name = body.name.strip()
    await db.commit()
    return CarOut(
        id=car.id,
        name=car.name,
        is_default=car.is_default,
        record_count=await _car_record_count(db, car_id),
    )


@router.delete("/cars/{car_id}", status_code=204)
async def delete_car(car_id: int, db: AsyncSession = Depends(get_db)):
    car = await db.get(Car, car_id)
    if not car:
        raise HTTPException(404, "Car not found")
    if await _car_record_count(db, car_id) > 0:
        raise HTTPException(400, "Cannot delete car with records")
    if car.is_default:
        result = await db.execute(select(Car).where(Car.id != car_id).limit(1))
        other = result.scalar_one_or_none()
        if other:
            other.is_default = True
    await db.delete(car)
    await db.commit()


@router.post("/cars/{car_id}/default", response_model=CarOut)
async def set_default_car(car_id: int, db: AsyncSession = Depends(get_db)):
    car = await db.get(Car, car_id)
    if not car:
        raise HTTPException(404, "Car not found")
    result = await db.execute(select(Car).where(Car.is_default.is_(True)))
    for c in result.scalars().all():
        c.is_default = False
    car.is_default = True
    await db.commit()
    return CarOut(
        id=car.id,
        name=car.name,
        is_default=car.is_default,
        record_count=await _car_record_count(db, car_id),
    )


# ── Record endpoints ──────────────────────────────────────────

@router.get("/records", response_model=list[RecordOut])
async def list_records(
    car_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    if car_id is not None:
        result = await db.execute(
            select(FuelRecord).where(FuelRecord.car_id == car_id)
        )
    else:
        result = await db.execute(select(FuelRecord))
    return _attach_stats(result.scalars().all())


@router.post("/records", response_model=RecordOut, status_code=201)
async def create_record(body: RecordCreate, db: AsyncSession = Depends(get_db)):
    from datetime import date

    car_id = body.car_id or await _get_default_car_id(db)
    record = FuelRecord(
        date=body.date or date.today(),
        odometer=body.odometer,
        liters=body.liters,
        cost=body.cost,
        car_id=car_id,
    )
    db.add(record)
    await db.commit()
    result = await db.execute(
        select(FuelRecord).where(FuelRecord.car_id == car_id)
        if car_id else select(FuelRecord)
    )
    all_records = _attach_stats(result.scalars().all())
    return next(r for r in all_records if r.id == record.id)


@router.patch("/records/{record_id}", response_model=RecordOut)
async def update_record(
    record_id: int, body: RecordUpdate, db: AsyncSession = Depends(get_db)
):
    record = await db.get(FuelRecord, record_id)
    if not record:
        raise HTTPException(404, "Record not found")
    if body.odometer is not None:
        record.odometer = body.odometer
    if body.liters is not None:
        record.liters = body.liters
    if body.cost is not None:
        record.cost = body.cost
    if body.date is not None:
        record.date = body.date
    await db.commit()
    car_id = record.car_id
    result = await db.execute(
        select(FuelRecord).where(FuelRecord.car_id == car_id)
        if car_id else select(FuelRecord)
    )
    all_records = _attach_stats(result.scalars().all())
    return next(r for r in all_records if r.id == record.id)


@router.delete("/records/{record_id}", status_code=204)
async def delete_record(record_id: int, db: AsyncSession = Depends(get_db)):
    record = await db.get(FuelRecord, record_id)
    if not record:
        raise HTTPException(404, "Record not found")
    await db.delete(record)
    await db.commit()
