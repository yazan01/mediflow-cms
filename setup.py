#!/usr/bin/env python3
"""
MediFlow CMS — One-time setup
Run: python setup.py
"""
import sys
import os
import subprocess
import getpass
from pathlib import Path

ROOT    = Path(__file__).parent.resolve()
BACKEND = ROOT / "backend"
VENV    = BACKEND / ".venv"
VPYTHON = VENV / "Scripts" / "python.exe"
VPIP    = VENV / "Scripts" / "pip.exe"

# Enable ANSI colours on Windows
os.system("")

R    = "\033[0m"
BOLD = "\033[1m"
G    = "\033[92m"
B    = "\033[94m"
Y    = "\033[93m"
RED  = "\033[91m"
C    = "\033[96m"

STEPS = 7


def banner():
    print(f"""
{B}{BOLD}
  ╔══════════════════════════════════════════╗
  ║         MediFlow CMS  —  Setup           ║
  ╚══════════════════════════════════════════╝
{R}""")


def step(n, msg):
    print(f"\n{C}[{n}/{STEPS}]{R} {BOLD}{msg}{R}")


def ok(msg=""):
    print(f"  {G}v{R}  {msg}")


def info(msg):
    print(f"  {Y}>{R}  {msg}")


def abort(msg):
    print(f"\n{RED}  ERROR: {msg}{R}\n")
    input("  Press Enter to exit...")
    sys.exit(1)


def run(cmd, cwd=None):
    return subprocess.run(cmd, cwd=str(cwd or ROOT)).returncode == 0


def capture(cmd, cwd=None):
    r = subprocess.run(cmd, cwd=str(cwd or ROOT), capture_output=True, text=True)
    return r.returncode == 0, r.stdout, r.stderr


# ── 1. Python version ────────────────────────────────────────────────────────

def check_python():
    step(1, "Checking Python version")
    v = sys.version_info
    if v < (3, 11):
        abort(f"Python 3.11+ is required — found {v.major}.{v.minor}")
    ok(f"Python {v.major}.{v.minor}.{v.micro}")


# ── 2. Node.js ───────────────────────────────────────────────────────────────

def check_node():
    step(2, "Checking Node.js")
    success, out, _ = capture(["node", "--version"])
    if not success:
        abort("Node.js not found — install Node.js 18+ from https://nodejs.org")
    ver = out.strip()
    major = int(ver.lstrip("v").split(".")[0])
    if major < 18:
        abort(f"Node.js 18+ required — found {ver}")
    ok(f"Node.js {ver}")


# ── 3. Python venv + deps ────────────────────────────────────────────────────

def setup_python():
    step(3, "Setting up Python environment")

    if not VPYTHON.exists():
        info("Creating virtual environment...")
        if not run([sys.executable, "-m", "venv", str(VENV)]):
            abort("Failed to create virtual environment")
    ok("Virtual environment ready")

    info("Installing Python dependencies...")
    if not run([str(VPIP), "install", "-r", "requirements.txt", "-q"], cwd=BACKEND):
        abort("pip install failed — check requirements.txt")
    ok("Python dependencies installed")


# ── 4. Node deps ─────────────────────────────────────────────────────────────

def setup_node():
    step(4, "Installing Node.js dependencies")

    if (ROOT / "node_modules").exists():
        ok("node_modules already present")
        return

    info("Running npm install (this may take a minute)...")
    if not run(["npm", "install"], cwd=ROOT):
        abort("npm install failed")
    ok("Node.js dependencies installed")


# ── 5. Database credentials ──────────────────────────────────────────────────

def collect_db_config():
    step(5, "Database configuration")
    print(f"\n  {Y}Enter your MySQL connection details.")
    print(f"  Press Enter to accept the default shown in brackets.{R}\n")

    host    = input(f"  MySQL host   [{Y}localhost{R}]: ").strip() or "localhost"
    port    = input(f"  MySQL port   [{Y}3306{R}]:      ").strip() or "3306"
    user    = input(f"  MySQL user   [{Y}root{R}]:      ").strip() or "root"
    password = getpass.getpass("  MySQL password:          ")
    db_name = input(f"  Database name [{Y}mediflow{R}]: ").strip() or "mediflow"

    return host, port, user, password, db_name


# ── 6. Create DB + write .env ────────────────────────────────────────────────

def setup_database(host, port, user, password, db_name):
    step(6, "Creating database")

    script = (
        "import pymysql, sys\n"
        "try:\n"
        f"    c = pymysql.connect(host='{host}', port={port}, user='{user}', password='{password}', connect_timeout=5)\n"
        f"    c.cursor().execute(\"CREATE DATABASE IF NOT EXISTS `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci\")\n"
        "    c.commit(); c.close(); print('ok')\n"
        "except Exception as e:\n"
        "    print('err:' + str(e)); sys.exit(1)\n"
    )
    success, out, err = capture([str(VPYTHON), "-c", script])
    if not success or out.strip().startswith("err:"):
        detail = out.strip().replace("err:", "") or err.strip()
        abort(f"Cannot connect to MySQL: {detail}")
    ok(f"Database `{db_name}` is ready")

    jwt_secret = os.urandom(32).hex()
    env = (
        f"DATABASE_URL=mysql+pymysql://{user}:{password}@{host}:{port}/{db_name}\n"
        f"JWT_SECRET={jwt_secret}\n"
    )
    (BACKEND / ".env").write_text(env, encoding="utf-8")
    ok(".env file written")

    # Next.js middleware needs JWT_SECRET in the root .env.local
    (ROOT / ".env.local").write_text(f"JWT_SECRET={jwt_secret}\n", encoding="utf-8")
    ok(".env.local written (Next.js JWT)")


# ── 7. Tables + seed ─────────────────────────────────────────────────────────

def init_database():
    step(7, "Creating tables and seeding default users")

    tmp = BACKEND / "_setup_init.py"
    tmp.write_text(
        "import sys, os\n"
        "sys.path.insert(0, os.path.dirname(__file__))\n"
        "from database import engine, Base\n"
        "import models\n"
        "from seed import seed\n"
        "Base.metadata.create_all(bind=engine)\n"
        "seed()\n",
        encoding="utf-8",
    )
    success, out, err = capture([str(VPYTHON), str(tmp)], cwd=BACKEND)
    tmp.unlink(missing_ok=True)

    if not success:
        abort(f"Database initialisation failed:\n{err or out}")

    for line in out.strip().splitlines():
        if line.strip():
            ok(line.strip())


# ── Done ─────────────────────────────────────────────────────────────────────

def print_done():
    print(f"""
{G}{BOLD}
  ╔══════════════════════════════════════════════════╗
  ║   Setup complete!  MediFlow CMS is ready.        ║
  ╚══════════════════════════════════════════════════╝
{R}
  To start the application run:

    {C}start.bat{R}

  Then open:  {B}http://localhost:3000{R}

  Default credentials:
    Email    :  {Y}admin@mediflow.com{R}
    Password :  {Y}Admin@1234{R}
""")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    banner()
    check_python()
    check_node()
    setup_python()
    setup_node()
    host, port, user, password, db_name = collect_db_config()
    setup_database(host, port, user, password, db_name)
    init_database()
    print_done()
    input("  Press Enter to exit...")
