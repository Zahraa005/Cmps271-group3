import asyncio
from datetime import datetime, timezone
from dateutil.rrule import rrulestr
from dateutil.tz import gettz

from PlayConnect_API import Database
from PlayConnect_API.models import Recurring_Schedule as rs_model


async def create_game_instance_from_schedule(conn, s_row, occur_dt):
    """Insert a Game_instance row using fields from schedule row/template.
    This intentionally avoids relying on a recurring_schedule_id column so it
    will work even if that column wasn't added. Idempotency is enforced by
    checking for an existing game with same host_id + start_time before insert.
    """
    tpl = s_row.get("template") if isinstance(s_row, dict) else s_row["template"]
    duration = s_row.get("duration_minutes") or (tpl.get("duration_minutes") if tpl else 90)
    location = s_row.get("location") or (tpl.get("location") if tpl else None)
    max_players = s_row.get("max_players") or (tpl.get("max_players") if tpl else None)
    skill_level = s_row.get("skill_level") or (tpl.get("skill_level") if tpl else None)
    cost = s_row.get("cost") or (tpl.get("cost") if tpl else None)
    status = s_row.get("status") or (tpl.get("status") if tpl else "open")

    q = '''
    INSERT INTO public."Game_instance" (
        host_id, sport_id, start_time, duration_minutes, location,
        skill_level, max_players, cost, status, created_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
    RETURNING game_id
    '''
    row = await conn.fetchrow(
        q,
        s_row["host_id"],
        s_row.get("sport_id"),
        occur_dt,
        duration,
        location,
        skill_level,
        max_players,
        cost,
        status,
    )
    return row


async def process_due_schedules():
    """Worker: find schedules due now (or without cached next_run), materialize instances,
    and advance the next_run cache.
    """
    async with Database.pool.acquire() as conn:
        now = datetime.now(timezone.utc)
        window = now
        rows = await rs_model.fetch_due_schedules(conn, window)
        for s in rows:
            try:
                dtstart = s["dtstart"]
                rrule_text = s["rrule"]
                rule = rrulestr(rrule_text, dtstart=dtstart)
                next_occ = rule.after(now, inc=True)
                if not next_occ:
                    # no future occurrences -> deactivate
                    await conn.execute('UPDATE public."Recurring_Schedules" SET active = FALSE, updated_at = NOW() WHERE id = $1', s["id"])
                    continue

                # If the next occurrence is due now (or in the immediate window), create it
                if next_occ <= window:
                    exists = await conn.fetchrow(
                        'SELECT 1 FROM public."Game_instance" WHERE host_id = $1 AND start_time = $2 LIMIT 1',
                        s["host_id"], next_occ
                    )
                    if not exists:
                        await create_game_instance_from_schedule(conn, s, next_occ)

                # Compute following occurrence and store in cache
                following = rule.after(next_occ)
                await rs_model.update_next_run(conn, s["id"], following)
            except Exception as e:
                print("Recurrence worker error for schedule", s["id"], e)
