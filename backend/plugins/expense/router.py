import io
from datetime import date as DateType, date

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from .models import ExpenseAccount, ExpenseCategory, ExpenseRecord

router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────

class AccountCreate(BaseModel):
    name: str


class AccountUpdate(BaseModel):
    name: str


class AccountOut(BaseModel):
    id: int
    name: str
    is_default: bool
    record_count: int

    model_config = {"from_attributes": True}


class RecordCreate(BaseModel):
    amount: int
    category: str | None = None
    note: str | None = None
    date: DateType | None = None
    account_id: int | None = None


class RecordUpdate(BaseModel):
    amount: int | None = None
    category: str | None = None
    note: str | None = None
    date: DateType | None = None
    account_id: int | None = None


class RecordOut(BaseModel):
    id: int
    date: DateType
    amount: int
    category: str | None
    note: str | None
    account_id: int | None
    account_name: str | None

    model_config = {"from_attributes": True}


class CategoryAmount(BaseModel):
    category: str
    amount: int
    count: int


class MonthTotal(BaseModel):
    month: str
    total: int


class SummaryOut(BaseModel):
    total: int
    count: int
    prev_total: int
    by_category: list[CategoryAmount]
    monthly: list[MonthTotal]


# ── Helpers ───────────────────────────────────────────────────

def _month_range(year: int, month: int) -> tuple[date, date]:
    start = date(year, month, 1)
    end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
    return start, end


def _shift_month(year: int, month: int, delta: int) -> tuple[int, int]:
    idx = year * 12 + (month - 1) + delta
    return idx // 12, idx % 12 + 1


async def _get_or_create_default_account(db: AsyncSession) -> ExpenseAccount:
    result = await db.execute(
        select(ExpenseAccount).where(ExpenseAccount.is_default.is_(True)).limit(1)
    )
    acc = result.scalar_one_or_none()
    if acc:
        return acc
    result = await db.execute(select(ExpenseAccount).limit(1))
    acc = result.scalar_one_or_none()
    if acc:
        return acc
    acc = ExpenseAccount(name="預設", is_default=True)
    db.add(acc)
    await db.flush()
    return acc


async def _account_record_count(db: AsyncSession, account_id: int) -> int:
    cnt = await db.scalar(
        select(func.count()).select_from(ExpenseRecord)
        .where(ExpenseRecord.account_id == account_id)
    )
    return cnt or 0


async def _account_names(db: AsyncSession) -> dict[int, str]:
    result = await db.execute(select(ExpenseAccount))
    return {a.id: a.name for a in result.scalars().all()}


def _to_out(r: ExpenseRecord, names: dict[int, str]) -> RecordOut:
    return RecordOut(
        id=r.id, date=r.date, amount=r.amount, category=r.category, note=r.note,
        account_id=r.account_id,
        account_name=names.get(r.account_id) if r.account_id else None,
    )


# ── Account endpoints ─────────────────────────────────────────

@router.get("/accounts", response_model=list[AccountOut])
async def list_accounts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ExpenseAccount).order_by(ExpenseAccount.id))
    out = []
    for a in result.scalars().all():
        out.append(AccountOut(
            id=a.id, name=a.name, is_default=a.is_default,
            record_count=await _account_record_count(db, a.id),
        ))
    return out


@router.post("/accounts", response_model=AccountOut, status_code=201)
async def create_account(body: AccountCreate, db: AsyncSession = Depends(get_db)):
    total = await db.scalar(select(func.count()).select_from(ExpenseAccount))
    acc = ExpenseAccount(name=body.name.strip(), is_default=(total == 0))
    db.add(acc)
    await db.commit()
    return AccountOut(id=acc.id, name=acc.name, is_default=acc.is_default, record_count=0)


@router.patch("/accounts/{account_id}", response_model=AccountOut)
async def update_account(account_id: int, body: AccountUpdate, db: AsyncSession = Depends(get_db)):
    acc = await db.get(ExpenseAccount, account_id)
    if not acc:
        raise HTTPException(404, "Account not found")
    acc.name = body.name.strip()
    await db.commit()
    return AccountOut(
        id=acc.id, name=acc.name, is_default=acc.is_default,
        record_count=await _account_record_count(db, account_id),
    )


@router.delete("/accounts/{account_id}", status_code=204)
async def delete_account(account_id: int, db: AsyncSession = Depends(get_db)):
    acc = await db.get(ExpenseAccount, account_id)
    if not acc:
        raise HTTPException(404, "Account not found")
    if await _account_record_count(db, account_id) > 0:
        raise HTTPException(400, "Cannot delete account with records")
    if acc.is_default:
        result = await db.execute(
            select(ExpenseAccount).where(ExpenseAccount.id != account_id).limit(1)
        )
        other = result.scalar_one_or_none()
        if other:
            other.is_default = True
    await db.delete(acc)
    await db.commit()


@router.post("/accounts/{account_id}/default", response_model=AccountOut)
async def set_default_account(account_id: int, db: AsyncSession = Depends(get_db)):
    acc = await db.get(ExpenseAccount, account_id)
    if not acc:
        raise HTTPException(404, "Account not found")
    result = await db.execute(select(ExpenseAccount).where(ExpenseAccount.is_default.is_(True)))
    for a in result.scalars().all():
        a.is_default = False
    acc.is_default = True
    await db.commit()
    return AccountOut(
        id=acc.id, name=acc.name, is_default=acc.is_default,
        record_count=await _account_record_count(db, account_id),
    )


# ── Category endpoints ────────────────────────────────────────

@router.get("/categories", response_model=list[str])
async def list_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ExpenseCategory).order_by(ExpenseCategory.sort_order, ExpenseCategory.id)
    )
    return [c.name for c in result.scalars().all()]


# ── Record endpoints ──────────────────────────────────────────

@router.get("/records", response_model=list[RecordOut])
async def list_records(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    account_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    start, end = _month_range(year, month)
    q = select(ExpenseRecord).where(ExpenseRecord.date >= start, ExpenseRecord.date < end)
    if account_id is not None:
        q = q.where(ExpenseRecord.account_id == account_id)
    q = q.order_by(ExpenseRecord.date.desc(), ExpenseRecord.id.desc())
    result = await db.execute(q)
    names = await _account_names(db)
    return [_to_out(r, names) for r in result.scalars().all()]


@router.post("/records", response_model=RecordOut, status_code=201)
async def create_record(body: RecordCreate, db: AsyncSession = Depends(get_db)):
    if body.account_id is not None:
        if not await db.get(ExpenseAccount, body.account_id):
            raise HTTPException(404, "Account not found")
        account_id = body.account_id
    else:
        account_id = (await _get_or_create_default_account(db)).id
    record = ExpenseRecord(
        date=body.date or date.today(),
        amount=body.amount,
        category=(body.category or "").strip() or None,
        note=(body.note or "").strip() or None,
        account_id=account_id,
    )
    db.add(record)
    await db.commit()
    return _to_out(record, await _account_names(db))


@router.patch("/records/{record_id}", response_model=RecordOut)
async def update_record(record_id: int, body: RecordUpdate, db: AsyncSession = Depends(get_db)):
    record = await db.get(ExpenseRecord, record_id)
    if not record:
        raise HTTPException(404, "Record not found")
    if body.amount is not None:
        record.amount = body.amount
    if body.category is not None:
        record.category = body.category.strip() or None
    if body.note is not None:
        record.note = body.note.strip() or None
    if body.date is not None:
        record.date = body.date
    if body.account_id is not None:
        if not await db.get(ExpenseAccount, body.account_id):
            raise HTTPException(404, "Account not found")
        record.account_id = body.account_id
    await db.commit()
    return _to_out(record, await _account_names(db))


@router.delete("/records/{record_id}", status_code=204)
async def delete_record(record_id: int, db: AsyncSession = Depends(get_db)):
    record = await db.get(ExpenseRecord, record_id)
    if not record:
        raise HTTPException(404, "Record not found")
    await db.delete(record)
    await db.commit()


# ── Summary ───────────────────────────────────────────────────

@router.get("/summary", response_model=SummaryOut)
async def summary(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    account_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    # 一次抓近 6 個月（含當月），在 Python 端彙總
    six_ago_y, six_ago_m = _shift_month(year, month, -5)
    window_start, _ = _month_range(six_ago_y, six_ago_m)
    _, window_end = _month_range(year, month)

    q = select(ExpenseRecord).where(
        ExpenseRecord.date >= window_start, ExpenseRecord.date < window_end
    )
    if account_id is not None:
        q = q.where(ExpenseRecord.account_id == account_id)
    result = await db.execute(q)
    records = result.scalars().all()

    cur_start, _ = _month_range(year, month)
    prev_y, prev_m = _shift_month(year, month, -1)
    prev_start, prev_end = _month_range(prev_y, prev_m)

    total = 0
    count = 0
    prev_total = 0
    by_cat: dict[str, list[int]] = {}
    monthly: dict[str, int] = {}
    for i in range(6):
        my, mm = _shift_month(six_ago_y, six_ago_m, i)
        monthly[f"{my:04d}-{mm:02d}"] = 0

    for r in records:
        m = r.date.strftime("%Y-%m")
        if m in monthly:
            monthly[m] += r.amount
        if prev_start <= r.date < prev_end:
            prev_total += r.amount
        if r.date >= cur_start:
            total += r.amount
            count += 1
            cat = r.category or "（未分類）"
            entry = by_cat.setdefault(cat, [0, 0])
            entry[0] += r.amount
            entry[1] += 1

    by_category = sorted(
        (CategoryAmount(category=c, amount=v[0], count=v[1]) for c, v in by_cat.items()),
        key=lambda x: x.amount, reverse=True,
    )
    return SummaryOut(
        total=total, count=count, prev_total=prev_total,
        by_category=by_category,
        monthly=[MonthTotal(month=m, total=t) for m, t in monthly.items()],
    )


# ── Excel import / export ─────────────────────────────────────

@router.post("/import")
async def import_excel(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    from .excel_io import import_workbook

    content = await file.read()
    try:
        return await import_workbook(db, content)
    except Exception as e:
        raise HTTPException(400, f"匯入失敗：{e}")


@router.get("/export")
async def export_excel(db: AsyncSession = Depends(get_db)):
    from .excel_io import export_workbook

    data = await export_workbook(db)
    filename = f"expense_{date.today().isoformat()}.xlsx"
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
