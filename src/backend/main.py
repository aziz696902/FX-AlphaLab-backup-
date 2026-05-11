"""FastAPI application entry point for FX-AlphaLab backend.

Usage:
    uvicorn src.backend.main:app --port 8000

CRITICAL: Do NOT use --reload with MT5. The MT5 connection must be initialized
in a single process and cannot be re-initialized on file changes. This will cause
crashes and resource leaks. Use --reload only for frontend development without
live trading enabled.
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from src.backend.routers import (
    admin as admin_router,
)
from src.backend.routers import (
    auth,
    chat,
    google_oauth,
    inference,
    live_data,
    mt5,
    narrate,
    ohlcv,
    reports,
    signals,
    trades,
    trading,
)
from src.backend.scheduler import SchedulerService
from src.backend.schemas.admin import TriggerResult
from src.ingestion.orchestrator import CollectionOrchestrator
from src.live.candle_feed import CandleFeed, connection_manager
from src.live.mt5_connection import mt5_connection
from src.live.position_tracker import PositionTracker
from src.live.trade_executor import TradeExecutor
from src.shared.config import Config
from src.shared.config.sources import load_sources_config

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown hooks.

    Startup:
    - Load sources configuration from config/sources.yaml
    - Instantiate CollectionOrchestrator
    - Create and start SchedulerService
    - Initialize MT5 connection (if MT5 credentials configured)
    - Create and start CandleFeed and PositionTracker tasks

    Shutdown:
    - Gracefully shut down background tasks
    - Close MT5 connection
    - Shut down the scheduler
    """
    # ── Startup ─────────────────────────────────────────────────────────────
    logger.info("Starting FX-AlphaLab backend")

    # Load sources configuration
    config_path = Config.ROOT_DIR / "config" / "sources.yaml"
    try:
        sources_config = load_sources_config(config_path)
        logger.info(f"Loaded sources config from {config_path}")
    except Exception as e:
        logger.error(f"Failed to load sources config: {e}")
        raise

    # Create collection orchestrator
    try:
        orchestrator = CollectionOrchestrator(config=sources_config, root=Config.ROOT_DIR)
        logger.info("Instantiated CollectionOrchestrator")
    except Exception as e:
        logger.error(f"Failed to instantiate CollectionOrchestrator: {e}")
        raise

    # Create and start scheduler
    try:
        scheduler = SchedulerService(config=sources_config, orchestrator=orchestrator)
        scheduler.start()
        logger.info("Scheduler service started")
    except Exception as e:
        logger.error(f"Failed to start scheduler: {e}")
        raise

    # Store services on app.state for tests and routes to access
    app.state.orchestrator = orchestrator
    app.state.scheduler = scheduler

    # ── MT5 Live Trading Layer Initialization ──────────────────────────────
    mt5_tasks = []
    try:
        if Config.MT5_LOGIN and Config.MT5_PASSWORD and Config.MT5_SERVER:
            logger.info("Initializing MT5 connection...")
            try:
                await mt5_connection.initialize()
                logger.info("MT5 connection initialized successfully")

                # Create trade executor singleton
                import src.live.trade_executor as te_module

                te_module.trade_executor = TradeExecutor(mt5_connection)

                # Create and start CandleFeed task
                import src.live.candle_feed as cf_module

                cf_module.candle_feed = CandleFeed(mt5_connection, connection_manager)
                candle_feed_task = asyncio.create_task(cf_module.candle_feed.run())
                mt5_tasks.append(("candle_feed", candle_feed_task, cf_module.candle_feed))
                logger.info("CandleFeed task started")

                # Create and start PositionTracker task
                import src.live.position_tracker as pt_module

                pt_module.position_tracker = PositionTracker(mt5_connection)
                position_tracker_task = asyncio.create_task(pt_module.position_tracker.run())
                mt5_tasks.append(
                    ("position_tracker", position_tracker_task, pt_module.position_tracker)
                )
                logger.info("PositionTracker task started")

                # Broadcast connection status to all clients
                await connection_manager.broadcast(
                    "positions",
                    {
                        "type": "status",
                        "state": "connected",
                        "message": "MT5 live trading connected",
                    },
                )

            except Exception as e:
                logger.error(f"Failed to initialize MT5 connection: {e}")
                # Continue without live trading if MT5 not available
                logger.info("Continuing without live trading support")
        else:
            logger.info("MT5 credentials not configured. Live trading disabled.")

    except Exception as e:
        logger.error(f"Unexpected error during MT5 initialization: {e}")

    # Store MT5 tasks for shutdown
    app.state.mt5_tasks = mt5_tasks

    yield

    # ── Shutdown ────────────────────────────────────────────────────────────
    logger.info("Shutting down FX-AlphaLab backend")

    # Shut down MT5 background tasks
    try:
        if hasattr(app.state, "mt5_tasks"):
            for task_name, task, controller in app.state.mt5_tasks:
                logger.info(f"Stopping {task_name}...")
                controller.stop()
                # Give task 2s to finish gracefully
                try:
                    await asyncio.wait_for(task, timeout=2.0)
                except asyncio.TimeoutError:
                    logger.warning(f"{task_name} did not finish within 2s, cancelling")
                    task.cancel()
                logger.info(f"{task_name} stopped")
    except Exception:
        logger.exception("Error shutting down MT5 tasks")

    # Close MT5 connection
    try:
        if mt5_connection._initialized:
            await mt5_connection.shutdown()
            logger.info("MT5 connection closed")
    except Exception:
        logger.exception("Error closing MT5 connection")

    # Shut down scheduler
    if hasattr(app.state, "scheduler") and app.state.scheduler is not None:
        try:
            app.state.scheduler.shutdown()
            logger.info("Scheduler service shut down")
        except Exception:
            logger.exception("Error while shutting down scheduler")

    # Close orchestrator if present
    if hasattr(app.state, "orchestrator") and app.state.orchestrator is not None:
        try:
            if hasattr(app.state.orchestrator, "close"):
                app.state.orchestrator.close()
                logger.info("Orchestrator closed")
        except Exception:
            logger.exception("Error while closing orchestrator")


app = FastAPI(
    title="FX-AlphaLab API",
    description="Multi-agent FX signal pipeline — coordinator reports, signals, and trades.",
    version="0.1.0",
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["GET", "POST", "PATCH", "DELETE", "WEBSOCKET"],
    allow_headers=["*"],
)

app.include_router(admin_router.router)
app.include_router(reports.router)
app.include_router(signals.router)
app.include_router(trades.router)
app.include_router(auth.router)
app.include_router(google_oauth.router)
app.include_router(inference.router)
app.include_router(ohlcv.router)
app.include_router(live_data.router)
app.include_router(trading.router)
app.include_router(mt5.router)
app.include_router(chat.router)
app.include_router(narrate.router)


@app.post("/admin/trigger/{source_id}", tags=["admin"], response_model=TriggerResult)
def admin_trigger(source_id: str):
    """Admin endpoint to trigger a collection for a given source_id.

    The orchestrator instance is stored on `app.state.orchestrator`.
    """
    if not hasattr(app.state, "orchestrator") or app.state.orchestrator is None:
        raise HTTPException(status_code=500, detail="Orchestrator not available")

    orchestrator = app.state.orchestrator

    if source_id not in orchestrator.config.sources:
        raise HTTPException(status_code=422, detail=f"Unknown source: {source_id!r}")

    result = orchestrator.run_source(source_id, force=True)

    if result.error is not None:
        raise HTTPException(status_code=500, detail=result.error)

    return TriggerResult(
        source_id=result.source_id,
        rows_written=result.rows_written,
        backfill_performed=result.backfill_performed,
        error=result.error,
    )


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
