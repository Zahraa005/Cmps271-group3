from typing import Optional, List, Any, Dict
from datetime import datetime
from PlayConnect_API import Database

TABLE = 'public."Recurring_Schedules"'

async def create_schedule(conn, *, payload: Dict[str, Any]) -> Any:
    """
    Insert a new recurring schedule. `payload` keys should match column names.
    Returns the created row (asyncpg.Record).
    """
    q = f'''
    INSERT INTO {TABLE} (
        host_id, sport_id, rrule, dtstart, next_run, timezone, template,
        duration_minutes, max_players, location, skill_level, cost, status,
        end_date, occurrences_left, active, created_at, updated_at
    ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),NOW()
    )
    RETURNING *;
    '''
    # Map payload values with defaults
    vals = [
        payload.get("host_id"),
        payload.get("sport_id"),
        payload.get("rrule"),
        payload.get("dtstart"),
        payload.get("next_run"),
        payload.get("timezone", "UTC"),
        payload.get("template"),
        payload.get("duration_minutes", 90),
        payload.get("max_players"),
        payload.get("location"),
        payload.get("skill_level"),
        payload.get("cost"),
        payload.get("status", "open"),
        payload.get("end_date"),
        payload.get("occurrences_left"),
        payload.get("active", True)
    ]
    return await conn.fetchrow(q, *vals)

async def get_schedule_by_id(conn, schedule_id: int) -> Optional[Any]:
    q = f'SELECT * FROM {TABLE} WHERE id = $1 LIMIT 1'
    return await conn.fetchrow(q, schedule_id)

async def list_schedules_for_host(conn, host_id: int) -> List[Any]:
    q = f'SELECT * FROM {TABLE} WHERE host_id = $1 ORDER BY created_at DESC'
    return await conn.fetch(q, host_id)

async def update_schedule(conn, schedule_id: int, updates: Dict[str, Any]) -> Optional[Any]:
    """
    Partial update. `updates` is a dict of column->value to set.
    """
    if not updates:
        return await get_schedule_by_id(conn, schedule_id)

    set_clauses = []
    params = []
    idx = 1
    for k, v in updates.items():
        set_clauses.append(f'{k} = ${idx}')
        idx += 1

    # add updated_at
    set_clauses.append(f'updated_at = NOW()')
    q = f'UPDATE {TABLE} SET {", ".join(set_clauses)} WHERE id = ${idx} RETURNING *'
    params.append(schedule_id)
    return await conn.fetchrow(q, *params)

async def delete_schedule(conn, schedule_id: int) -> None:
    q = f'DELETE FROM {TABLE} WHERE id = $1'
    await conn.execute(q, schedule_id)

async def fetch_due_schedules(conn, until: datetime) -> List[Any]:
    """
    Fetch active schedules whose next_run is <= until OR next_run IS NULL (so worker can compute).
    Caller should compute dtstart/rrule to decide whether to materialize.
    """
    q = f'''
    SELECT * FROM {TABLE}
    WHERE active = TRUE AND (next_run IS NULL OR next_run <= $1)
    ORDER BY COALESCE(next_run, dtstart) ASC
    '''
    return await conn.fetch(q, until)

async def update_next_run(conn, schedule_id: int, next_run: Optional[datetime]) -> None:
    q = f'UPDATE {TABLE} SET next_run = $2, updated_at = NOW() WHERE id = $1'
    await conn.execute(q, schedule_id, next_run)