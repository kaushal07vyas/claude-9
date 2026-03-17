# database proj/backend/db_connection.py
import pymysql
from contextlib import contextmanager
from dotenv import load_dotenv
import os
import logging

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database configuration (reads from .env if present)
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 3306)),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASS', ''),
    'database': os.getenv('DB_NAME', 'Claude9'),
    'charset': 'utf8mb4',
    'cursorclass': pymysql.cursors.DictCursor,
    # We will manage transactions explicitly (autocommit = False)
    'autocommit': False,
    'connect_timeout': 10,
}


@contextmanager
def get_db_connection():
    """
    Context manager that yields a pymysql Connection.
    Ensures proper cleanup and that autocommit is turned off for explicit transaction control.

    Usage:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(...)
            conn.commit()
    """
    conn = None
    try:
        conn = pymysql.connect(**DB_CONFIG)
        # Ensure autocommit is disabled - we want explicit commit/rollback behavior
        conn.autocommit(False)
        yield conn
    except Exception:
        # If an exception happens before yielding or while using conn, ensure rollback if possible
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        raise
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass


def execute_query(query, params=(), fetch_one=False, fetch_all=False, conn=None):
    """
    Execute a SELECT (or other read) query and return results.

    - If `conn` is provided, uses that connection (useful inside transactions).
    - If no `conn` provided, opens its own connection and closes it.
    - Returns a dict (for fetch_one) or list of dicts (for fetch_all) or list of dicts (default).
    """
    close_conn = False
    if conn is None:
        conn = pymysql.connect(**DB_CONFIG)
        conn.autocommit(True)  # reads don't need transaction control
        close_conn = True

    try:
        with conn.cursor() as cursor:
            cursor.execute(query, params)
            if fetch_one:
                return cursor.fetchone()
            if fetch_all:
                return cursor.fetchall()
            # default: return all rows
            return cursor.fetchall()
    finally:
        if close_conn and conn:
            conn.close()


def execute_update(query, params=(), conn=None):
    """
    Execute an INSERT/UPDATE/DELETE statement.
    - Returns number of affected rows.
    - If `conn` provided, the caller is responsible for commit/rollback (use inside transactions).
    - If no `conn` provided, this function commits automatically.
    """
    close_conn = False
    if conn is None:
        conn = pymysql.connect(**DB_CONFIG)
        conn.autocommit(False)  # manage commit ourselves
        close_conn = True

    try:
        with conn.cursor() as cursor:
            affected = cursor.execute(query, params)
        # commit if we opened the connection here
        if close_conn:
            conn.commit()
        return affected
    except Exception:
        # rollback if we opened the connection here
        if close_conn:
            try:
                conn.rollback()
            except Exception:
                pass
        raise
    finally:
        if close_conn and conn:
            conn.close()


def execute_transaction(queries_with_params, isolation_level=None):
    """
    Execute multiple queries in a single transaction.

    Args:
        queries_with_params: list of tuples (query, params) OR list of dicts {'query':..., 'params':...}
        isolation_level: optional string like 'READ COMMITTED' to set transaction isolation for this transaction

    Returns:
        list of affected row counts (one per query) on success.

    Behavior:
    - All queries execute inside one DB connection.
    - If any statement raises, the transaction is rolled back and the exception re-raised.
    - On success, the transaction is committed and list of affected counts returned.
    """
    if not isinstance(queries_with_params, (list, tuple)):
        raise ValueError("queries_with_params must be a list/tuple of (query, params) tuples or dicts")

    with get_db_connection() as conn:
        try:
            # Optionally set isolation level for the session/transaction
            if isolation_level:
                with conn.cursor() as cur:
                    cur.execute(f"SET SESSION TRANSACTION ISOLATION LEVEL {isolation_level}")

            results = []
            with conn.cursor() as cursor:
                for entry in queries_with_params:
                    if isinstance(entry, dict):
                        q = entry.get("query")
                        p = entry.get("params", ())
                    else:
                        q, p = entry
                    affected = cursor.execute(q, p)
                    results.append(affected)

            conn.commit()
            return results
        except Exception as e:
            try:
                conn.rollback()
            except Exception:
                logger.exception("Rollback failed after exception: %s", e)
            raise


# Optional helper for bulk executemany operations inside transactions
def execute_transaction_many(query, params_list, isolation_level=None):
    """
    Run cursor.executemany(query, params_list) inside a transaction.
    Returns number of executed parameter-sets (len(params_list)).
    """
    with get_db_connection() as conn:
        try:
            if isolation_level:
                with conn.cursor() as cur:
                    cur.execute(f"SET SESSION TRANSACTION ISOLATION LEVEL {isolation_level}")

            with conn.cursor() as cursor:
                cursor.executemany(query, params_list)
            conn.commit()
            return len(params_list)
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            raise
