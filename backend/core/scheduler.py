import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone="Asia/Taipei")

# 宣告受全域通知時間控制的 job ID 集合，由 register_plugin_jobs 填入
notify_controlled_jobs: set[str] = set()


def register_plugin_jobs(plugins, daily_hour: int = 9, daily_minute: int = 0) -> None:
    """從所有 plugin 收集排程設定並註冊到 APScheduler。
    daily_hour/daily_minute：套用到所有宣告 notify_controlled=True 的 cron job。
    """
    for plugin in plugins:
        for job_def in plugin.get_scheduler_jobs():
            func = job_def.pop("func")
            trigger = job_def.pop("trigger", "cron")
            job_id = job_def.pop("id", f"{plugin.name}_{func.__name__}")
            is_notify_controlled = job_def.pop("notify_controlled", False)
            try:
                if trigger == "cron":
                    if is_notify_controlled:
                        notify_controlled_jobs.add(job_id)
                        job_def["hour"] = daily_hour
                        job_def["minute"] = daily_minute
                    scheduler.add_job(
                        func,
                        CronTrigger(**job_def, timezone="Asia/Taipei"),
                        id=job_id,
                        replace_existing=True,
                    )
                    logger.info(f"Scheduled job: {job_id} ({job_def})")
                elif trigger == "interval":
                    scheduler.add_job(
                        func,
                        "interval",
                        id=job_id,
                        replace_existing=True,
                        **job_def,
                    )
            except Exception as e:
                logger.error(f"Failed to schedule {job_id}: {e}")
